// charts.js
(function () {
  const $ = (sel) => document.querySelector(sel);

  // =========================
  // Kategorier
  // =========================
  const CAT_ALIASES = {
    DRONE:['uav','drönare','drone','quad','fpv'],
    INFRA:['sabotage','infrastruktur','el','fiber','kabel','bro','tunnel'],
    NUCLEAR:['kärn','nuclear','radioaktiv','uran','strål'],
    TERROR:['terror','attack','spräng','bomb'],
    INTEL:['spion','underrätt','säpo','intel','kgb','gru','fsb'],
    LEGAL:['dom','åtal','rättsfall','rättegång'],
    MIL:['militär','försvar','brigad','regemente','övning'],
    HYBRID:['påverkan','hybrid','desinfo','psyop','reflexiv'],
    MAR:['marin','sjöfart','tanker','hamn','fartyg','ais'],
    GPS:['gps','gnss','jamming','störning','spoof'],
    POLICY:['politik','policy','myndighet','lag','förordning']
  };

  const CATS = {
    DRONE:   { label:'Drönare / UAV',             emoji:'🛩️' },
    INFRA:   { label:'Infrastruktur / sabotage',  emoji:'⚡'  },
    NUCLEAR: { label:'Kärnenergi / farligt gods', emoji:'☢️' },
    TERROR:  { label:'Terror / våld',             emoji:'💣' },
    INTEL:   { label:'Spionage / underrättelse',  emoji:'🕵️‍♂️' },
    LEGAL:   { label:'Rättsfall / domar',         emoji:'⚖️' },
    MIL:     { label:'Militär / försvar',         emoji:'🪖' },
    HYBRID:  { label:'Påverkan / hybrid',         emoji:'🧠' },
    MAR:     { label:'Maritimt / skuggflotta',    emoji:'⚓' },
    GPS:     { label:'GPS-störning / signal',     emoji:'📡' },
    POLICY:  { label:'Politik / policy',          emoji:'🏛️' }
  };

  // =========================
  // Expandera (kort)
  // =========================
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-expand]");
    if (!btn) return;
    const sel = btn.getAttribute("data-expand");
    const card = document.querySelector(sel);
    if (!card) return;

    const open = card.classList.toggle("expanded");
    btn.textContent = open ? "Stäng" : "Expandera";
    if (open) card.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
  }, true);

  // =========================
  // Helpers
  // =========================
  function safeStr(x, fallback = "") {
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

  function canonicalCat(ev) {
    let c = safeStr(ev.cat || ev.category || "").trim().toUpperCase();
    if (c && CATS[c]) return c;

    const blob = [
      safeStr(ev.title),
      safeStr(ev.summary),
      safeStr(ev.place),
      safeStr(ev.country),
    ].join(" ").toLowerCase();

    for (const [key, words] of Object.entries(CAT_ALIASES)) {
      if (words.some(w => blob.includes(w))) return key;
    }
    return c && CATS[c] ? c : "POLICY";
  }

  function normalizeEvents(input) {
    const arr = Array.isArray(input) ? input : [];
    return arr.map((e, i) => {
      const cat = canonicalCat(e);
      return {
        id: e.id ?? i,
        ...e,
        cat,
        category: cat,
        date: safeStr(e.date),
        country: safeStr(e.country, "Okänt"),
        place: safeStr(e.place, "Okänd plats"),
        title: safeStr(e.title, "(utan titel)"),
        summary: safeStr(e.summary, ""),
      };
    });
  }

  const RAW = normalizeEvents(window.events || window.rawEvents || []);

  // =========================
  // Canvas utils
  // =========================
  function resizeCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(2, Math.floor(rect.width * dpr));
    const h = Math.max(2, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
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

  // =========================
  // KPI
  // =========================
  function buildKPIs() {
    const n = RAW.length;
    const cats = uniq(RAW.map(e => e.cat)).length;
    const months = uniq(RAW.map(e => monthKey(e.date))).filter(m => m !== "Okänd").length;
    const countries = uniq(RAW.map(e => e.country)).length;

    const k = $("#kpis");
    if (k) {
      k.innerHTML = `
        <div class="kpi"><div class="n">${n}</div><div class="l">Händelser</div></div>
        <div class="kpi"><div class="n">${cats}</div><div class="l">Kategorier</div></div>
        <div class="kpi"><div class="n">${months}</div><div class="l">Månader</div></div>
        <div class="kpi"><div class="n">${countries}</div><div class="l">Länder</div></div>
      `;
    }

    const ds = RAW.map(e => e.date).filter(Boolean).sort();
    const minD = ds[0] ? ds[0].slice(0,10) : "–";
    const maxD = ds[ds.length - 1] ? ds[ds.length - 1].slice(0,10) : "–";
    const r = $("#dataRange");
    if (r) r.textContent = `Tidsintervall i data: ${minD} → ${maxD}`;
  }

  // =========================
  // Filter (chips för huvudgraferna)
  // =========================
  const activeCats = new Set(Object.keys(CATS));
  function countByCat(list) {
    const m = new Map();
    list.forEach(e => m.set(e.cat, (m.get(e.cat) || 0) + 1));
    return m;
  }

  function renderCatChips() {
    const el = $("#catChips");
    if (!el) return;

    const counts = countByCat(RAW);
    const keys = Object.keys(CATS);

    el.innerHTML = keys.map(k => {
      const meta = CATS[k];
      const on = activeCats.has(k);
      const n = counts.get(k) || 0;
      return `
        <button class="chip" type="button" data-cat="${k}" aria-pressed="${on}">
          <span>${meta.emoji}</span>
          <span>${meta.label}</span>
          <span class="count">${n}</span>
        </button>
      `;
    }).join("");

    el.querySelectorAll(".chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const k = btn.getAttribute("data-cat");
        if (!k) return;
        if (activeCats.has(k)) activeCats.delete(k); else activeCats.add(k);
        if (activeCats.size === 0) Object.keys(CATS).forEach(x => activeCats.add(x));
        renderCatChips();
        drawAll();
      });
    });
  }

  function filtered() {
    return RAW.filter(e => activeCats.has(e.cat));
  }

  // =========================
  // Aggregation
  // =========================
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
    list.forEach(e => m.set(e.cat, (m.get(e.cat)||0) + 1));
    const arr = Array.from(m.entries()).sort((a,b)=>b[1]-a[1]).slice(0, 10);
    return {
      labels: arr.map(([k]) => `${CATS[k]?.emoji || ""} ${CATS[k]?.label || k}`.trim()),
      values: arr.map(([,v]) => v)
    };
  }

  function heat(list) {
    const months = uniq(list.map(e => monthKey(e.date))).filter(m=>m!=="Okänd").sort();
    const cats = Object.keys(CATS);
    const mi = new Map(months.map((m,i)=>[m,i]));
    const ci = new Map(cats.map((c,i)=>[c,i]));
    const matrix = Array.from({length: cats.length}, ()=> Array.from({length: months.length}, ()=>0));
    list.forEach(e => {
      const m = monthKey(e.date), c = e.cat;
      if (!mi.has(m) || !ci.has(c)) return;
      matrix[ci.get(c)][mi.get(m)] += 1;
    });
    return { months, cats, matrix };
  }

  function geoTop(list, mode) {
    const m = new Map();
    list.forEach(e => {
      const key = mode === "place" ? e.place : e.country;
      m.set(key, (m.get(key)||0) + 1);
    });
    const arr = Array.from(m.entries()).sort((a,b)=>b[1]-a[1]).slice(0, 12);
    return { labels: arr.map(x=>x[0]), values: arr.map(x=>x[1]) };
  }

  // =========================
  // Drawing (enkla canvas)
  // =========================
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
    const padL=220, top=36;
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
    const padL=220, padT=40, padR=14, padB=46;
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
        const a = 0.05 + (v/maxV)*0.75;
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

    for (let i=0;i<cats.length;i++){
      const k = cats[i];
      const meta = CATS[k];
      const label = `${meta?.emoji || ""} ${meta?.label || k}`.trim();
      ctx.fillText(label, 12, padT+i*cellH+14);
    }
  }

  // =========================
  // 1) MULTI-LINJE "Volym över tid" (ÖVERSIKT)
  // =========================
  const sparkCats = new Set(Object.keys(CATS)); // vilka kategorilinjer som visas

  function monthlyByCat(list) {
    const months = uniq(list.map(e => monthKey(e.date))).filter(m=>m!=="Okänd").sort();
    const cats = Object.keys(CATS);
    const mi = new Map(months.map((m,i)=>[m,i]));
    const series = {};
    cats.forEach(c => series[c] = Array(months.length).fill(0));
    const total = Array(months.length).fill(0);

    list.forEach(e => {
      const m = monthKey(e.date);
      if (!mi.has(m)) return;
      const idx = mi.get(m);
      total[idx] += 1;
      if (series[e.cat]) series[e.cat][idx] += 1;
    });

    return { months, total, series };
  }

  function renderSparkLegend() {
    const el = $("#sparkLegend");
    if (!el) return;

    const counts = countByCat(RAW);
    const keys = Object.keys(CATS);

    el.innerHTML = keys.map(k => {
      const meta = CATS[k];
      const on = sparkCats.has(k);
      const n = counts.get(k) || 0;
      return `
        <button class="chip" type="button" data-spark-cat="${k}" aria-pressed="${on}">
          <span>${meta.emoji}</span>
          <span>${meta.label}</span>
          <span class="count">${n}</span>
        </button>
      `;
    }).join("");

    el.querySelectorAll(".chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const k = btn.getAttribute("data-spark-cat");
        if (!k) return;
        if (sparkCats.has(k)) sparkCats.delete(k); else sparkCats.add(k);
        renderSparkLegend();
        drawSparkMulti();
      });
    });

    const allBtn = $("#selAllCats");
    const noneBtn = $("#selNoCats");

    if (allBtn && !allBtn.__wired) {
      allBtn.__wired = true;
      allBtn.addEventListener("click", () => {
        Object.keys(CATS).forEach(k => sparkCats.add(k));
        renderSparkLegend();
        drawSparkMulti();
      });
    }
    if (noneBtn && !noneBtn.__wired) {
      noneBtn.__wired = true;
      noneBtn.addEventListener("click", () => {
        sparkCats.clear();
        renderSparkLegend();
        drawSparkMulti();
      });
    }
  }

  // färger: deterministiska, men enkla (utan att du behöver ange dem i CSS)
  function catColor(idx, alpha=1) {
    const base = [
      [37,99,235],[16,185,129],[245,158,11],[239,68,68],[124,58,237],
      [14,165,233],[234,88,12],[100,116,139],[217,70,239],[34,197,94],[59,130,246]
    ];
    const c = base[idx % base.length];
    return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
  }

  function drawSparkMulti() {
    const canvas = $("#sparkMulti");
    if (!canvas) return;

    const { months, total, series } = monthlyByCat(RAW);
    const N = months.length;
    const lastN = Math.min(24, N); // visa senaste 24 månader
    const m = months.slice(N-lastN);
    const tot = total.slice(N-lastN);

    const activeKeys = Object.keys(CATS).filter(k => sparkCats.has(k));
    const seriesCut = {};
    activeKeys.forEach(k => seriesCut[k] = (series[k] || []).slice(N-lastN));

    const { ctx, w, h } = clear(canvas);
    const padL=54, padR=14, padT=36, padB=30;
    const cw = w - padL - padR;
    const ch = h - padT - padB;

    // max baserat på total (så total alltid syns bra)
    const maxV = Math.max(1, ...tot);

    ctx.fillStyle="#0f172a";
    ctx.font="700 13px system-ui";
    ctx.fillText("Volym över tid (total + kategorier)", 12, 22);

    // grid
    ctx.strokeStyle="rgba(15,23,42,0.08)";
    for (let i=0;i<=4;i++){
      const y = padT + (i/4)*ch;
      ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+cw,y); ctx.stroke();
    }

    // TOTAL (tjock)
    ctx.strokeStyle="rgba(37,99,235,1)";
    ctx.lineWidth=2.6;
    ctx.beginPath();
    for (let i=0;i<m.length;i++){
      const x = padL + (i/Math.max(1,m.length-1))*cw;
      const y = padT + (1-(tot[i]/maxV))*ch;
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();

    // kategorier (tunnare)
    const keys = Object.keys(CATS);
    activeKeys.forEach(k => {
      const idx = keys.indexOf(k);
      const vals = seriesCut[k] || [];
      ctx.strokeStyle = catColor(idx, 0.65);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i=0;i<m.length;i++){
        const x = padL + (i/Math.max(1,m.length-1))*cw;
        const y = padT + (1-((vals[i]||0)/maxV))*ch;
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.stroke();
    });

    // x labels
    ctx.fillStyle="#475569";
    ctx.font="11px system-ui";
    const step = Math.max(1, Math.floor(m.length/6));
    for (let i=0;i<m.length;i+=step){
      const x = padL + (i/Math.max(1,m.length-1))*cw;
      ctx.fillText(m[i], x-18, h-10);
    }

    // liten legendtext
    ctx.fillStyle="#475569";
    ctx.font="11px system-ui";
    ctx.fillText("Total = blå linje. Kategorier = tunna linjer (styr via legend).", 12, h-12);
  }

  // =========================
  // 2) OIAT: rita + beräkna score + RAG
  // =========================
  function drawOIAT(){
    const sO=$("#sO"), sI=$("#sI"), sA=$("#sA"), sT=$("#sT");
    const vO=$("#vO"), vI=$("#vI"), vA=$("#vA"), vT=$("#vT");
    const canvas=$("#oiatChart");
    if (!sO||!sI||!sA||!sT||!vO||!vI||!vA||!vT||!canvas) return;

    const O=+sO.value, I=+sI.value, A=+sA.value, T=+sT.value;
    vO.textContent=O; vI.textContent=I; vA.textContent=A; vT.textContent=T;

    // Uträknat värde: snitt (0–5)
    const score = (O + I + A + T) / 4;
    const scoreEl = $("#oiatScore");
    if (scoreEl) scoreEl.textContent = score.toFixed(2);

    // RAG-trösklar enligt din bild
    const ragEl = $("#oiatRag");
    if (ragEl) {
      ragEl.classList.remove("red","amber","green");
      if (score < 2.5) { ragEl.textContent = "RÖD – otillräckligt"; ragEl.classList.add("red"); }
      else if (score < 3.5) { ragEl.textContent = "GUL – komplettera"; ragEl.classList.add("amber"); }
      else { ragEl.textContent = "GRÖN – robust"; ragEl.classList.add("green"); }
    }

    // Rita staplar
    const labels=["Objektivitet","Integritet","Aktualitet","Täckning"];
    const vals=[O,I,A,T];
    const { ctx, w } = clear(canvas);

    const padL=180, top=36, barH=18, gap=14;

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

  // =========================
  // Huvudgrafer
  // =========================
  function drawAll(){
    const list = filtered();

    const cc = categoryCounts(list);
    const c1=$("#catChart"); if (c1) drawBars(c1, cc.labels, cc.values, "Händelser per kategori");

    const t = monthlyCounts(list);
    const lastK = t.keys.slice(-36);
    const lastV = t.vals.slice(-36);
    const c2=$("#timeChart"); if (c2) drawLine(c2, lastK, lastV, "Per månad");

    const hm = heat(list);
    const c3=$("#heatChart"); if (c3) drawHeat(c3, hm.months, hm.cats, hm.matrix, "Kategori × månad");

    const modeSel=$("#geoMode");
    const mode = modeSel ? modeSel.value : "country";
    const g = geoTop(list, mode);
    const c4=$("#geoChart"); if (c4) drawBars(c4, g.labels, g.values, mode==="place" ? "Topplista – plats" : "Topplista – land");
  }

  function wire(){
    const gm=$("#geoMode");
    if (gm) gm.addEventListener("change", ()=>setTimeout(drawAll,0));

    ["sO","sI","sA","sT"].forEach(id=>{
      const el=$("#"+id);
      if (el) el.addEventListener("input", ()=>setTimeout(drawOIAT,0));
    });

    window.addEventListener("resize", ()=>{
      drawAll();
      drawSparkMulti();
      drawOIAT();
    });
  }

  // =========================
  // Init
  // =========================
  document.addEventListener("DOMContentLoaded", ()=>{
    console.log("[charts] events:", RAW.length, "kategorier:", uniq(RAW.map(e=>e.cat)));

    buildKPIs();
    renderCatChips();

    // Översikt: multi-serie + legend + select all/none
    renderSparkLegend();
    drawSparkMulti();

    wire();
    setTimeout(()=>{ drawAll(); drawOIAT(); }, 120);
  });
  // ===== OIAT: reglage -> score + RAG + helskärm-bild =====
(function initOIAT(){
  const $ = (id) => document.getElementById(id);

  const sO = $("sO"), sI = $("sI"), sA = $("sA"), sT = $("sT");
  const vO = $("vO"), vI = $("vI"), vA = $("vA"), vT = $("vT");

  const outScoreRight = $("oiatScore");
  const outRagRight   = $("oiatRag");
  const outScoreLeft  = $("oiatScoreInline");
  const outRagLeft    = $("oiatRagInline");

  // Om något saknas: gör inget (förhindrar att resten av charts.js kraschar)
  if(!sO || !sI || !sA || !sT || !vO || !vI || !vA || !vT){
    console.warn("OIAT: saknar reglage/labels i DOM.");
    return;
  }

  function ragFromScore(score){
    if(score < 2.5) return { key:"RÖD",  text:"RÖD – otillräckligt" };
    if(score < 3.5) return { key:"GUL",  text:"GUL – komplettera" };
    return             { key:"GRÖN", text:"GRÖN – robust" };
  }

  function setBadge(el, rag){
    if(!el) return;
    el.textContent = rag.text;
    // enkel färgkodning utan nya CSS-krav
    el.style.padding = "6px 10px";
    el.style.borderRadius = "999px";
    el.style.border = "1px solid var(--line)";
    el.style.background = "#f8fafc";
    if(rag.key === "RÖD") el.style.background = "rgba(239,68,68,.12)";
    if(rag.key === "GUL") el.style.background = "rgba(245,158,11,.14)";
    if(rag.key === "GRÖN") el.style.background = "rgba(34,197,94,.14)";
  }

  function update(){
    const O = Number(sO.value);
    const I = Number(sI.value);
    const A = Number(sA.value);
    const T = Number(sT.value);

    vO.textContent = O;
    vI.textContent = I;
    vA.textContent = A;
    vT.textContent = T;

    const score = (O + I + A + T) / 4;
    const scoreTxt = score.toFixed(2);

    const rag = ragFromScore(score);

    if(outScoreRight) outScoreRight.textContent = scoreTxt;
    if(outScoreLeft)  outScoreLeft.textContent  = scoreTxt;

    setBadge(outRagRight, rag);
    if(outRagLeft) outRagLeft.textContent = rag.text;
  }

  ["input","change"].forEach(evt=>{
    sO.addEventListener(evt, update);
    sI.addEventListener(evt, update);
    sA.addEventListener(evt, update);
    sT.addEventListener(evt, update);
  });

  update(); // initial beräkning

  // Helsskärm/lightbox för bilden
  const fullBtn = $("oiatFullBtn");
  const lb = $("oiatLightbox");
  const closeBtn = $("oiatCloseBtn");

  function openLB(){
    if(!lb) return;
    lb.classList.add("open");
    lb.setAttribute("aria-hidden","false");
    document.body.style.overflow = "hidden";
  }
  function closeLB(){
    if(!lb) return;
    lb.classList.remove("open");
    lb.setAttribute("aria-hidden","true");
    document.body.style.overflow = "";
  }

  if(fullBtn && lb){
    fullBtn.addEventListener("click", openLB);
  }
  if(closeBtn && lb){
    closeBtn.addEventListener("click", closeLB);
  }
  // klick utanför panel stänger
  if(lb){
    lb.addEventListener("click", (e)=>{
      if(e.target === lb) closeLB();
    });
    document.addEventListener("keydown", (e)=>{
      if(e.key === "Escape" && lb.classList.contains("open")) closeLB();
    });
  }
})();
