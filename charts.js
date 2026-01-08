// charts.js
(function () {
  // ---------- helpers ----------
  const $ = (sel) => document.querySelector(sel);

  function monthKey(dateStr) {
    if (!dateStr) return "Okänd";
    const m = String(dateStr).match(/^(\d{4})-(\d{2})/);
    return m ? `${m[1]}-${m[2]}` : "Okänd";
  }

  function uniq(arr) {
    return Array.from(new Set(arr)).filter(Boolean);
  }

  function safeStr(x, fallback = "Okänt") {
    const s = (x ?? "").toString().trim();
    return s ? s : fallback;
  }

  function clearCanvas(canvas) {
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(2, Math.floor(rect.width * dpr));
    const h = Math.max(2, Math.floor(rect.height * dpr));
    canvas.width = w;
    canvas.height = h;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    return { ctx, w: rect.width, h: rect.height };
  }

  // ---------- fullscreen buttons ----------
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-fullscreen]");
    if (!btn) return;
    const sel = btn.getAttribute("data-fullscreen");
    const el = document.querySelector(sel);
    if (!el) return;

    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen();
  });

  // ---------- data ----------
  const RAW = (window.events || []).slice();

  // ---------- KPIs + spark ----------
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

  function computeMonthlyCounts(list) {
    const map = new Map();
    for (const e of list) {
      const k = monthKey(e.date);
      map.set(k, (map.get(k) || 0) + 1);
    }
    const keys = Array.from(map.keys()).filter(k => k !== "Okänd").sort();
    return { keys, vals: keys.map(k => map.get(k) || 0) };
  }

  // ---------- simple charts ----------
  function drawLine(canvas, labels, values, title) {
    const { ctx, w, h } = clearCanvas(canvas);
    const padL = 44, padR = 14, padT = 36, padB = 28;

    ctx.fillStyle = "#0f172a";
    ctx.font = "700 13px system-ui";
    ctx.fillText(title, 12, 22);

    const cw = w - padL - padR;
    const ch = h - padT - padB;
    const maxV = Math.max(1, ...values);

    // grid
    ctx.strokeStyle = "rgba(15,23,42,0.08)";
    ctx.lineWidth = 1;
    for (let i=0; i<=4; i++) {
      const y = padT + (i/4)*ch;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL+cw, y); ctx.stroke();
    }

    // line
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    ctx.beginPath();
    labels.forEach((_, i) => {
      const x = padL + (i / Math.max(1, labels.length-1)) * cw;
      const y = padT + (1 - (values[i] / maxV)) * ch;
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();

    // dots
    ctx.fillStyle = "#0f172a";
    labels.forEach((_, i) => {
      const x = padL + (i / Math.max(1, labels.length-1)) * cw;
      const y = padT + (1 - (values[i] / maxV)) * ch;
      ctx.beginPath(); ctx.arc(x,y,2.4,0,Math.PI*2); ctx.fill();
    });

    // x labels (sparse)
    ctx.fillStyle = "#475569";
    ctx.font = "11px system-ui";
    const step = Math.max(1, Math.floor(labels.length/6));
    for (let i=0; i<labels.length; i+=step) {
      const x = padL + (i / Math.max(1, labels.length-1)) * cw;
      ctx.fillText(labels[i], x-16, h-10);
    }

    // y labels
    ctx.fillText(String(maxV), 10, padT+10);
    ctx.fillText("0", 18, padT+ch);
  }

  function drawBars(canvas, labels, values, title) {
    const { ctx, w, h } = clearCanvas(canvas);
    const pad = 140;
    const top = 36;

    ctx.fillStyle = "#0f172a";
    ctx.font = "700 13px system-ui";
    ctx.fillText(title, 12, 22);

    const maxV = Math.max(1, ...values);
    const barH = Math.max(10, (h - top - 18) / Math.max(1, labels.length) - 8);

    ctx.font = "12px system-ui";
    labels.forEach((lab, i) => {
      const y = top + i*(barH+8);
      const v = values[i];
      const bw = (w - pad - 20) * (v / maxV);

      // bar
      ctx.fillStyle = "rgba(37,99,235,0.35)";
      ctx.fillRect(pad, y, bw, barH);
      ctx.strokeStyle = "rgba(15,23,42,0.12)";
      ctx.strokeRect(pad, y, bw, barH);

      // label
      ctx.fillStyle = "#475569";
      ctx.fillText(lab, 12, y + barH - 2);

      // value
      ctx.fillStyle = "#0f172a";
      ctx.fillText(String(v), pad + bw + 8, y + barH - 2);
    });
  }

  function drawHeatmap(canvas, months, cats, matrix, title) {
    const { ctx, w, h } = clearCanvas(canvas);
    const padL = 90, padT = 40, padR = 14, padB = 44;

    ctx.fillStyle = "#0f172a";
    ctx.font = "700 13px system-ui";
    ctx.fillText(title, 12, 22);

    const cw = w - padL - padR;
    const ch = h - padT - padB;

    const cellW = cw / Math.max(1, months.length);
    const cellH = ch / Math.max(1, cats.length);

    let maxV = 1;
    for (const row of matrix) for (const v of row) maxV = Math.max(maxV, v);

    for (let r=0; r<cats.length; r++) {
      for (let c=0; c<months.length; c++) {
        const v = matrix[r][c] || 0;
        const a = 0.05 + (v/maxV)*0.65;
        ctx.fillStyle = `rgba(37,99,235,${a})`;
        ctx.fillRect(padL + c*cellW, padT + r*cellH, cellW, cellH);
        ctx.strokeStyle = "rgba(15,23,42,0.06)";
        ctx.strokeRect(padL + c*cellW, padT + r*cellH, cellW, cellH);
      }
    }

    // labels
    ctx.fillStyle = "#475569";
    ctx.font = "11px system-ui";

    const cstep = Math.max(1, Math.floor(months.length/7));
    for (let i=0; i<months.length; i+=cstep) {
      ctx.save();
      ctx.translate(padL + i*cellW + 4, h-10);
      ctx.rotate(-0.35);
      ctx.fillText(months[i], 0, 0);
      ctx.restore();
    }

    const rstep = Math.max(1, Math.floor(cats.length/10));
    for (let i=0; i<cats.length; i+=rstep) {
      ctx.fillText(cats[i], 12, padT + i*cellH + 14);
    }
  }

  // ---------- charts data computations ----------
  function computeCategoryCounts(list) {
    const m = new Map();
    list.forEach(e => {
      const c = safeStr(e.category, "OKÄND").toUpperCase();
      m.set(c, (m.get(c)||0) + 1);
    });
    const arr = Array.from(m.entries()).sort((a,b)=>b[1]-a[1]);
    const top = arr.slice(0, 10);
    return { labels: top.map(x=>x[0]), values: top.map(x=>x[1]) };
  }

  function computeHeat(list) {
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

  function computeGeoTop(list, mode) {
    const m = new Map();
    list.forEach(e => {
      const key = mode === "place" ? safeStr(e.place) : safeStr(e.country);
      m.set(key, (m.get(key)||0) + 1);
    });
    const arr = Array.from(m.entries()).sort((a,b)=>b[1]-a[1]).slice(0, 12);
    return { labels: arr.map(x=>x[0]), values: arr.map(x=>x[1]) };
  }

  // ---------- OIAT slider chart ----------
  function drawOIAT() {
    const O = +$("#sO").value, I = +$("#sI").value, A = +$("#sA").value, T = +$("#sT").value;
    $("#vO").textContent = O;
    $("#vI").textContent = I;
    $("#vA").textContent = A;
    $("#vT").textContent = T;

    const canvas = $("#oiatChart");
    const { ctx, w, h } = clearCanvas(canvas);

    const labels = ["Objektivitet","Integritet","Aktualitet","Täckning"];
    const vals = [O,I,A,T];
    const maxV = 5;

    const padL=140, top=36, barH=18, gap=14;
    ctx.fillStyle="#0f172a";
    ctx.font="700 13px system-ui";
    ctx.fillText("OIAT-poäng (0–5)", 12, 22);

    ctx.font="12px system-ui";
    labels.forEach((lab, i) => {
      const y = top + i*(barH+gap);
      const v = vals[i];
      const bw = (w - padL - 30) * (v/maxV);

      ctx.fillStyle="rgba(37,99,235,0.35)";
      ctx.fillRect(padL, y, bw, barH);
      ctx.strokeStyle="rgba(15,23,42,0.12)";
      ctx.strokeRect(padL, y, bw, barH);

      ctx.fillStyle="#475569";
      ctx.fillText(lab, 12, y + barH - 3);

      ctx.fillStyle="#0f172a";
      ctx.fillText(String(v), padL + bw + 8, y + barH - 3);
    });
  }

  // ---------- main render ----------
  function fillFilters() {
    const sel = $("#catFilter");
    sel.innerHTML = "";
    const cats = uniq(RAW.map(e => safeStr(e.category).toUpperCase())).sort();
    const optAll = document.createElement("option");
    optAll.value = "ALL";
    optAll.textContent = "Alla";
    sel.appendChild(optAll);

    cats.forEach(c => {
      const o = document.createElement("option");
      o.value = c;
      o.textContent = c;
      sel.appendChild(o);
    });
  }

  function getFiltered() {
    const val = $("#catFilter").value;
    if (val === "ALL") return RAW;
    return RAW.filter(e => safeStr(e.category).toUpperCase() === val);
  }

  function drawAll() {
    const filtered = getFiltered();

    // category bars
    const cat = computeCategoryCounts(filtered);
    drawBars($("#catChart"), cat.labels, cat.values, "Händelser per kategori");

    // time
    const t = computeMonthlyCounts(filtered);
    const last = t.keys.slice(-36);
    const lastV = t.vals.slice(-36);
    drawLine($("#timeChart"), last, lastV, "Per månad");

    // heatmap
    const h = computeHeat(filtered);
    drawHeatmap($("#heatChart"), h.months, h.cats, h.matrix, "Kategori × månad");

    // geo
    const mode = $("#geoMode").value;
    const g = computeGeoTop(filtered, mode);
    drawBars($("#geoChart"), g.labels, g.values, mode === "place" ? "Topplista – plats" : "Topplista – land");
  }

  function drawSpark() {
    const t = computeMonthlyCounts(RAW);
    const last = t.keys.slice(-18);
    const lastV = t.vals.slice(-18);
    drawLine($("#spark"), last, lastV, "Senaste 18 månader (volym)");
  }

  function wireEvents() {
    $("#catFilter").addEventListener("change", drawAll);
    $("#geoMode").addEventListener("change", drawAll);

    ["sO","sI","sA","sT"].forEach(id => {
      const el = $("#"+id);
      el.addEventListener("input", drawOIAT);
    });

    window.addEventListener("resize", () => {
      drawSpark();
      drawAll();
      drawOIAT();
    });
  }

  // ---------- init ----------
  document.addEventListener("DOMContentLoaded", () => {
    buildKPIs();
    fillFilters();
    wireEvents();

    drawSpark();
    drawAll();
    drawOIAT();
  });

})();
