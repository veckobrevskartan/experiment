// charts.js
(function () {
  const $ = (sel) => document.querySelector(sel);
  const RAW = (window.events || []).slice();

  // Expandera: CSS overlay (funkar alltid)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-expand]");
    if (!btn) return;

    const sel = btn.getAttribute("data-expand");
    const card = document.querySelector(sel);
    if (!card) return;

    const open = card.classList.toggle("expanded");
    btn.textContent = open ? "Stäng" : "Expandera";

    if (open) card.scrollIntoView({ behavior: "smooth", block: "start" });

    // tvinga redraw
    setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
  }, true);

  // helpers
  function safeStr(x, fallback = "Okänt") {
    const s = (x ?? "").toString().trim();
    return s ? s : fallback;
  }
  function monthKey(dateStr) {
    const m = String(dateStr || "").match(/^(\d{4})-(\d{2})/);
    return m ? `${m[1]}-${m[2]}` : "Okänd";
  }
  function uniq(arr) {
    return Array.from(new Set(arr)).filter(Boolean);
  }

  // canvas sizing
  function resizeCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(2, Math.floor(rect.width * dpr));
    const h = Math.max(2, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: rect.width, h: rect.height };
  }
  function clear(canvas) {
    const { ctx, w, h } = resizeCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  // KPI
  function buildKPIs() {
    const n = RAW.length;
    const cats = uniq(RAW.map(e => safeStr(e.category).toUpperCase())).length;
    const months = uniq(RAW.map(e => monthKey(e.date))).filter(m => m !== "Okänd").length;
    const countries = uniq(RAW.map(e => safeStr(e.country))).length;

    $("#kpis").innerHTML = `
      <div class="kpi"><div class="n">${n}</div><div class="l">Händelser</div></div>
      <div class="kpi"><div class="n">${cats}</div><div class="l">Kategorier</div></div>
      <div class="kpi"><div class="n">${months}</div><div class="l">Månader</div></div>
      <div class="kpi"><div class="n">${countries}</div><div class="l">Länder</div></div>
    `;

    const ds = RAW.map(e => e.date).filter(Boolean).sort();
    const minD = ds[0] ? ds[0].slice(0,10) : "–";
    const maxD = ds[ds.length - 1] ? ds[ds.length - 1].slice(0,10) : "–";
    $("#dataRange").textContent = `Tidsintervall i data: ${minD} → ${maxD}`;
  }

  // computations
  function monthlyCounts(list) {
    const map = new Map();
    for (const e of list) {
      const k = monthKey(e.date);
      if (k === "Okänd") continue;
      map.set(k, (map.get(k) || 0) + 1);
    }
    const keys = Array.from(map.keys()).sort();
    return { keys, vals: keys.map(k => map.get(k) || 0) };
  }

  function categoryCounts(list) {
    const m = new Map();
    list.forEach(e => {
      const c = safeStr(e.category, "OKÄND").toUpperCase();
      m.set(c, (m.get(c)||0) + 1);
    });
    const arr = Array.from(m.entries()).sort((a,b)=>b[1]-a[1]).slice(0,10);
    return { labels: arr.map(x=>x[0]), values: arr.map(x=>x[1]) };
  }

  function heat(list) {
    const months = uniq(list.map(e => monthKey(e.date))).filter(m=>m!=="Okänd").sort();
    const cats = uniq(list.map(e => safeStr(e.category).toUpperCase())).sort();

    const mi = new Map(months.map((m,i)=>[m,i]));
    const ci = new Map(cats.map((c,i)=>[c,i]));
    const matrix = Array.from({length: cats.length}, ()=> Array.from({length: months.length}, ()=>0));

    list.forEach(e => {
      const m = monthKey(e.date);
      const c = safeStr(e.category).toUpperCase();
      if (!mi.has(m) || !ci.has(c)) return;
      matrix[ci.get(c)][mi.get(m)] += 1;
    });

    return { months, cats, matrix };
  }

  function geoTop(list, mode) {
    const m = new Map();
    list.forEach(e => {
      const key = mode === "place" ? safeStr(e.place) : safeStr(e.country);
      m.set(key, (m.get(key)||0) + 1);
    });
    const arr = Array.from(m.entries()).sort((a,b)=>b[1]-a[1]).slice(0,12);
    return { labels: arr.map(x=>x[0]), values: arr.map(x=>x[1]) };
  }

  // drawing
  function drawLine(canvas, labels, values, title) {
    const { ctx, w, h } = clear(canvas);
    const padL=54, padR=14, padT=36, padB=30;
    const cw = w - padL - padR;
    const ch = h - padT - padB;
    const maxV = Math.max(1, ...values);

    ctx.fillStyle="#0f172a";
    ctx.font="700 13px system-ui";
    ctx.fillText(title, 12, 22);

    ctx.strokeStyle="rgba(15,23,42,0.08)";
    for (let i=0;i<=4;i++){
      const y = padT + (i/4)*ch;
      ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+cw,y); ctx.stroke();
    }

    ctx.strokeStyle="#2563eb";
    ctx.lineWidth=2;
    ctx.beginPath();
    labels.forEach((_, i) => {
      const x = padL + (i/Math.max(1,labels.length-1))*cw;
      const y = padT + (1-(values[i]/maxV))*ch;
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();

    ctx.fillStyle="#475569";
    ctx.font="11px system-ui";
    const step = Math.max(1, Math.floor(labels.length/6));
    for (let i=0;i<labels.length;i+=step){
      const x = padL + (i/Math.max(1,labels.length-1))*cw;
      ctx.fillText(labels[i], x-18, h-10);
    }
  }

  function drawBars(canvas, labels, values, title) {
    const { ctx, w, h } = clear(canvas);
    const padL=160, top=36;
    const maxV = Math.max(1, ...values);

    ctx.fillStyle="#0f172a";
    ctx.font="700 13px system-ui";
    ctx.fillText(title, 12, 22);

    const barH = Math.max(12, (h - top - 18)/Math.max(1,labels.length) - 8);

    ctx.font="12px system-ui";
    labels.forEach((lab, i) => {
      const y = top + i*(barH+8);
      const v = values[i];
      const bw = Math.max(2, (w - padL - 26)*(v/maxV));

      ctx.fillStyle="rgba(37,99,235,0.35)";
      ctx.fillRect(padL,y,bw,barH);
      ctx.strokeStyle="rgba(15,23,42,0.12)";
      ctx.strokeRect(padL,y,bw,barH);

      ctx.fillStyle="#475569";
      ctx.fillText(lab, 12, y+barH-2);

      ctx.fillStyle="#0f172a";
      ctx.fillText(String(v), padL+bw+8, y+barH-2);
    });
  }

  function drawHeat(canvas, months, cats, matrix, title) {
    const { ctx, w, h } = clear(canvas);
    const padL=100, padT=40, padR=14, padB=46;
    const cw = w - padL - padR;
    const ch = h - padT - padB;
    const cellW = cw/Math.max(1,months.length);
    const cellH = ch/Math.max(1,cats.length);

    ctx.fillStyle="#0f172a";
    ctx.font="700 13px system-ui";
    ctx.fillText(title, 12, 22);

    let maxV=1;
    for (const row of matrix) for (const v of row) maxV=Math.max(maxV,v);

    for (let r=0;r<cats.length;r++){
      for (let c=0;c<months.length;c++){
        const v = matrix[r][c]||0;
        const a = 0.06 + (v/maxV)*0.7;
        ctx.fillStyle = `rgba(37,99,235,${a})`;
        ctx.fillRect(padL+c*cellW, padT+r*cellH, cellW, cellH);
        ctx.strokeStyle="rgba(15,23,42,0.06)";
        ctx.strokeRect(padL+c*cellW, padT+r*cellH, cellW, cellH);
      }
    }

    ctx.fillStyle="#475569";
    ctx.font="11px system-ui";
    const cstep = Math.max(1, Math.floor(months.length/7));
    for (let i=0;i<months.length;i+=cstep){
      ctx.save();
      ctx.translate(padL+i*cellW+4, h-10);
      ctx.rotate(-0.35);
      ctx.fillText(months[i],0,0);
      ctx.restore();
    }
    const rstep = Math.max(1, Math.floor(cats.length/10));
    for (let i=0;i<cats.length;i+=rstep){
      ctx.fillText(cats[i], 12, padT+i*cellH+14);
    }
  }

  // OIAT chart
  function drawOIAT(){
    const O = +$("#sO").value, I = +$("#sI").value, A = +$("#sA").value, T = +$("#sT").value;
    $("#vO").textContent = O; $("#vI").textContent = I; $("#vA").textContent = A; $("#vT").textContent = T;

    const labels = ["Objektivitet","Integritet","Aktualitet","Täckning"];
    const vals = [O,I,A,T];
    const { ctx, w, h } = clear($("#oiatChart"));
    const padL=160, top=36, barH=18, gap=14;

    ctx.fillStyle="#0f172a";
    ctx.font="700 13px system-ui";
    ctx.fillText("OIAT-poäng (0–5)", 12, 22);

    labels.forEach((lab,i)=>{
      const y = top + i*(barH+gap);
      const bw = Math.max(2, (w - padL - 30) * (vals[i]/5));
      ctx.fillStyle="rgba(37,99,235,0.35)";
      ctx.fillRect(padL,y,bw,barH);
      ctx.strokeStyle="rgba(15,23,42,0.12)";
      ctx.strokeRect(padL,y,bw,barH);

      ctx.fillStyle="#475569";
      ctx.font="12px system-ui";
      ctx.fillText(lab, 12, y+barH-3);

      ctx.fillStyle="#0f172a";
      ctx.fillText(String(vals[i]), padL+bw+8, y+barH-3);
    });
  }

  // filters + draw
  function fillFilters(){
    const sel = $("#catFilter");
    sel.innerHTML = "";
    const cats = uniq(RAW.map(e=>safeStr(e.category).toUpperCase())).sort();

    const all = document.createElement("option");
    all.value="ALL"; all.textContent="Alla";
    sel.appendChild(all);

    cats.forEach(c=>{
      const o=document.createElement("option");
      o.value=c; o.textContent=c;
      sel.appendChild(o);
    });
  }

  function filtered(){
    const v = $("#catFilter").value;
    if (v==="ALL") return RAW;
    return RAW.filter(e=>safeStr(e.category).toUpperCase()===v);
  }

  function drawAll(){
    const list = filtered();

    const cc = categoryCounts(list);
    drawBars($("#catChart"), cc.labels, cc.values, "Händelser per kategori");

    const t = monthlyCounts(list);
    const lastK = t.keys.slice(-36);
    const lastV = t.vals.slice(-36);
    drawLine($("#timeChart"), lastK, lastV, "Per månad");

    const hm = heat(list);
    drawHeat($("#heatChart"), hm.months, hm.cats, hm.matrix, "Kategori × månad");

    const g = geoTop(list, $("#geoMode").value);
    drawBars($("#geoChart"), g.labels, g.values, $("#geoMode").value==="place" ? "Topplista – plats" : "Topplista – land");
  }

  function drawSpark(){
    const t = monthlyCounts(RAW);
    const k = t.keys.slice(-18);
    const v = t.vals.slice(-18);
    drawLine($("#spark"), k, v, "Senaste 18 månader (volym)");
  }

  function wire(){
    $("#catFilter").addEventListener("change", ()=>setTimeout(drawAll,0));
    $("#geoMode").addEventListener("change", ()=>setTimeout(drawAll,0));
    ["sO","sI","sA","sT"].forEach(id => $("#"+id).addEventListener("input", ()=>setTimeout(drawOIAT,0)));

    window.addEventListener("resize", ()=>{
      drawSpark(); drawAll(); drawOIAT();
    });
  }

  // init
  document.addEventListener("DOMContentLoaded", ()=>{
    buildKPIs();
    fillFilters();
    wire();
    setTimeout(()=>{ drawSpark(); drawAll(); drawOIAT(); }, 120);
  });
})();
