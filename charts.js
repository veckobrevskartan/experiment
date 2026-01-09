// charts.js (REN VERSION – en enda implementation)
// Förväntar sig: window.events = [ ... ] från data.js

(() => {
  "use strict";

  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // =========================
  // Kategorier (låst lista)
  // =========================
  const CATS = {
    HYBRID:  { label:'Påverkan / hybrid',         emoji:'🧠' },
    NUCLEAR: { label:'Kärnenergi / farligt gods', emoji:'☢️' },
    DRONE:   { label:'Drönare / UAV',             emoji:'🛩️' },
    INFRA:   { label:'Infrastruktur / sabotage',  emoji:'⚡'  },
    MIL:     { label:'Militär / försvar',         emoji:'🪖' },
    INTEL:   { label:'Spionage / underrättelse',  emoji:'🕵️‍♂️' },
    TERROR:  { label:'Terror / våld',             emoji:'💣' },
    POLICY:  { label:'Politik / policy',          emoji:'🏛️' },
    LEGAL:   { label:'Rättsfall / domar',         emoji:'⚖️' },
    MAR:     { label:'Maritimt / skuggflotta',    emoji:'⚓' },
    GPS:     { label:'GPS-störning / signal',     emoji:'📡' }
  };

  // =========================
  // Robust datumhantering
  // =========================
  const pad2 = (n) => String(n).padStart(2, "0");

  function parseISODate(s) {
    if (!s || typeof s !== "string") return null;
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    return isNaN(dt.getTime()) ? null : dt;
  }

  function monthKey(dt) {
    return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}`;
  }

  function uniq(arr) {
    return Array.from(new Set(arr));
  }

  // =========================
  // Normalisering av events
  // =========================
  function normalizeEvents(raw) {
    const out = [];
    for (const e of (Array.isArray(raw) ? raw : [])) {
      const dt = parseISODate(e?.date);
      if (!dt) continue;

      const cat = String(e?.cat || e?.category || "").trim().toUpperCase();
      const safeCat = CATS[cat] ? cat : "POLICY";

      out.push({
        date: e.date,
        dt,
        month: monthKey(dt),
        cat: safeCat,
        country: (e.country || "").toString(),
        place: (e.place || "").toString(),
        title: (e.title || "").toString(),
        summary: (e.summary || "").toString(),
        url: (e.url || "").toString(),
        source: (e.source || "").toString(),
        lat: typeof e.lat === "number" ? e.lat : null,
        lng: typeof e.lng === "number" ? e.lng : null,
      });
    }
    out.sort((a,b) => a.dt - b.dt);
    return out;
  }

  // =========================
  // Canvas helpers
  // =========================
  function setupCanvas(canvas) {
    const ctx = canvas.getContext("2d");
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(1, rect.width);
    const cssH = Math.max(1, rect.height || canvas.height || 300);

    canvas.width  = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    return { ctx, w: cssW, h: cssH };
  }

  function drawEmpty(canvas, title) {
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0,0,w,h);
    ctx.fillStyle = "#64748b";
    ctx.font = "13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(title || "Ingen data", 12, 22);
    ctx.fillText("Kontrollera att data.js laddas och att window.events innehåller poster.", 12, 44);
  }

  function niceMax(v) {
    if (v <= 0) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / pow;
    let m = 1;
    if (n <= 1) m = 1;
    else if (n <= 2) m = 2;
    else if (n <= 5) m = 5;
    else m = 10;
    return m * pow;
  }

  function yTicks(maxV, ticks = 4) {
    const m = niceMax(maxV);
    const step = m / ticks;
    const arr = [];
    for (let i = 0; i <= ticks; i++) arr.push(step * i);
    return { max: m, step, ticks: arr };
  }

  // =========================
  // Aggregation
  // =========================
  function buildAgg(events) {
    const months = uniq(events.map(e => e.month)).sort();
    const cats = Object.keys(CATS);

    const totalByMonth = new Map(months.map(m => [m, 0]));
    const totalByCat   = new Map(cats.map(c => [c, 0]));
    const byCatMonth   = new Map(cats.map(c => [c, new Map(months.map(m => [m, 0]))]));

    for (const e of events) {
      totalByMonth.set(e.month, (totalByMonth.get(e.month) || 0) + 1);
      totalByCat.set(e.cat, (totalByCat.get(e.cat) || 0) + 1);

      const m = byCatMonth.get(e.cat);
      if (m) m.set(e.month, (m.get(e.month) || 0) + 1);
    }

    return { months, totalByMonth, totalByCat, byCatMonth };
  }

  // =========================
  // KPI
  // =========================
  function renderKPIs(events, agg) {
    const host = $("#kpis");
    const range = $("#dataRange");
    const catsUsed = uniq(events.map(e => e.cat)).length;

    if (host) {
      host.innerHTML = "";
      const items = [
        { n: events.length, l: "Händelser" },
        { n: catsUsed,      l: "Kategorier" },
        { n: agg.months.length, l: "Månader" },
        { n: uniq(events.map(e => e.country).filter(Boolean)).length, l: "Länder" },
      ];
      for (const it of items) {
        const d = document.createElement("div");
        d.className = "kpi";
        d.innerHTML = `<div class="n">${it.n}</div><div class="l">${it.l}</div>`;
        host.appendChild(d);
      }
    }

    if (range) {
      if (events.length) range.textContent = `Tidsintervall i data: ${events[0].date} – ${events[events.length-1].date}`;
      else range.textContent = "Tidsintervall i data: –";
    }

    // extra KPI i OIAT-rutan
    const elCats = $("#catsUsed");
    const elTot  = $("#eventsTotal");
    if (elCats) elCats.textContent = String(catsUsed);
    if (elTot)  elTot.textContent  = String(events.length);
  }

  // =========================
  // Chips: översiktens legend
  // =========================
  function renderSparkLegend(agg, sparkCats, onChange) {
    const host = $("#sparkLegend");
    if (!host) return;

    host.innerHTML = "";
    for (const c of Object.keys(CATS)) {
      const meta = CATS[c];
      const count = agg.totalByCat.get(c) || 0;

      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.dataset.cat = c;
      chip.setAttribute("aria-pressed", sparkCats.has(c) ? "true" : "false");
      chip.innerHTML = `
        <span>${meta.emoji}</span>
        <span>${meta.label}</span>
        <span class="count">${count}</span>
      `;

      chip.addEventListener("click", () => {
        if (sparkCats.has(c)) sparkCats.delete(c);
        else sparkCats.add(c);
        chip.setAttribute("aria-pressed", sparkCats.has(c) ? "true" : "false");
        onChange();
      });

      host.appendChild(chip);
    }
  }

  // =========================
  // Chips: filter i huvudgrafer
  // =========================
  function renderCatChips(agg, activeCats, onChange) {
    const host = $("#catChips");
    if (!host) return;

    host.innerHTML = "";
    for (const c of Object.keys(CATS)) {
      const meta = CATS[c];
      const count = agg.totalByCat.get(c) || 0;

      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.dataset.cat = c;
      chip.setAttribute("aria-pressed", activeCats.has(c) ? "true" : "false");
      chip.innerHTML = `
        <span>${meta.emoji}</span>
        <span>${meta.label}</span>
        <span class="count">${count}</span>
      `;

      chip.addEventListener("click", () => {
        if (activeCats.has(c)) activeCats.delete(c);
        else activeCats.add(c);

        // skydd: aldrig låt allt bli avstängt
        if (activeCats.size === 0) Object.keys(CATS).forEach(k => activeCats.add(k));

        onChange();
      });

      host.appendChild(chip);
    }
  }

  function filterByCats(events, activeCats) {
    return events.filter(e => activeCats.has(e.cat));
  }

  // =========================
  // Chart: Spark multi (overview)
  // =========================
  function drawSparkMulti(canvasSel, events, agg, sparkCats) {
    const canvas = $(canvasSel);
    if (!canvas) return;

    if (!events.length || !agg.months.length) {
      drawEmpty(canvas, "Volym över tid");
      return;
    }

    const { ctx, w, h } = setupCanvas(canvas);
    const padL = 44, padR = 12, padT = 14, padB = 26;
    const iw = w - padL - padR;
    const ih = h - padT - padB;

    const months = agg.months;
    const total = months.map(m => agg.totalByMonth.get(m) || 0);

    const series = [];
    for (const c of Object.keys(CATS)) {
      if (!sparkCats.has(c)) continue;
      const mm = agg.byCatMonth.get(c);
      series.push({ cat: c, arr: months.map(m => (mm ? (mm.get(m) || 0) : 0)) });
    }

    const maxV = Math.max(1, ...total, ...series.flatMap(s => s.arr));
    const yt = yTicks(maxV, 4);
    const stepX = iw / Math.max(1, months.length - 1);

    // bg
    ctx.fillStyle = "#fff";
    ctx.fillRect(0,0,w,h);

    // grid
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#64748b";
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    for (const v of yt.ticks) {
      const y = padT + ih - (v / yt.max) * ih;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + iw, y);
      ctx.stroke();
      ctx.fillText(String(Math.round(v)), 6, y + 4);
    }

    // x labels
    const labelEvery = Math.max(1, Math.floor(months.length / 6));
    for (let i = 0; i < months.length; i += labelEvery) {
      const x = padL + i * stepX;
      ctx.fillText(months[i], x - 18, padT + ih + 18);
    }

    function drawLine(arr, stroke, width, alpha=1) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let i=0;i<arr.length;i++){
        const x = padL + i * stepX;
        const y = padT + ih - (arr[i] / yt.max) * ih;
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // kategori-linjer (tunna)
    let idx = 0;
    for (const s of series) {
      const hue = (idx * 33) % 360;
      drawLine(s.arr, `hsla(${hue}, 70%, 45%, 0.85)`, 1.4, 0.9);
      idx++;
    }

    // total (tjock blå)
    drawLine(total, "rgba(37,99,235,1)", 2.6, 1);

    // title
    ctx.fillStyle = "#0f172a";
    ctx.font = "13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Volym över tid (total + kategorier)", padL, 18);
  }

  // =========================
  // Chart: Bar per kategori
  // =========================
  function drawCatBar(canvasSel, eventsFiltered) {
    const canvas = $(canvasSel);
    if (!canvas) return;

    if (!eventsFiltered.length) {
      drawEmpty(canvas, "Fördelning per kategori");
      return;
    }

    const { ctx, w, h } = setupCanvas(canvas);
    const padL = 220, padR = 14, padT = 22, padB = 18;
    const iw = w - padL - padR;
    const ih = h - padT - padB;

    const counts = new Map(Object.keys(CATS).map(c => [c, 0]));
    for (const e of eventsFiltered) counts.set(e.cat, (counts.get(e.cat) || 0) + 1);

    const items = Array.from(counts.entries()).filter(([,v]) => v > 0).sort((a,b)=>b[1]-a[1]);
    const vals = items.map(x => x[1]);
    const maxV = Math.max(1, ...vals);

    ctx.fillStyle = "#fff";
    ctx.fillRect(0,0,w,h);

    ctx.fillStyle = "#0f172a";
    ctx.font = "13px system-ui";
    ctx.fillText("Händelser per kategori", padL, 16);

    const rowH = ih / Math.max(1, items.length);
    ctx.font = "12px system-ui";

    for (let i=0;i<items.length;i++){
      const [cat, v] = items[i];
      const y0 = padT + i*rowH + 6;
      const yText = padT + i*rowH + rowH*0.65;

      ctx.fillStyle = "#0f172a";
      ctx.fillText(`${CATS[cat].emoji} ${CATS[cat].label}`, 10, yText);

      const bw = (v / maxV) * iw;
      ctx.fillStyle = "rgba(37,99,235,.18)";
      ctx.fillRect(padL, y0, bw, Math.max(10, rowH - 10));

      ctx.fillStyle = "#475569";
      ctx.fillText(String(v), padL + bw + 8, yText);
    }
  }

  // =========================
  // Chart: Volym per månad
  // =========================
  function drawTimeLine(canvasSel, eventsFiltered) {
    const canvas = $(canvasSel);
    if (!canvas) return;

    if (!eventsFiltered.length) {
      drawEmpty(canvas, "Volym per månad");
      return;
    }

    const agg = buildAgg(eventsFiltered);
    const months = agg.months.slice(-36);
    const vals = months.map(m => agg.totalByMonth.get(m) || 0);

    const { ctx, w, h } = setupCanvas(canvas);
    const padL = 46, padR = 12, padT = 22, padB = 28;
    const iw = w - padL - padR;
    const ih = h - padT - padB;

    const maxV = Math.max(1, ...vals);
    const yt = yTicks(maxV, 4);
    const stepX = iw / Math.max(1, months.length - 1);

    ctx.fillStyle = "#fff";
    ctx.fillRect(0,0,w,h);

    ctx.strokeStyle = "#e5e7eb";
    ctx.fillStyle = "#64748b";
    ctx.font = "12px system-ui";

    for (const v of yt.ticks) {
      const y = padT + ih - (v / yt.max) * ih;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + iw, y);
      ctx.stroke();
      ctx.fillText(String(Math.round(v)), 6, y + 4);
    }

    // line
    ctx.strokeStyle = "rgba(37,99,235,1)";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    for (let i=0;i<vals.length;i++){
      const x = padL + i*stepX;
      const y = padT + ih - (vals[i] / yt.max) * ih;
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();

    // labels
    const labelEvery = Math.max(1, Math.floor(months.length / 6));
    ctx.fillStyle = "#475569";
    ctx.font = "11px system-ui";
    for (let i=0;i<months.length;i+=labelEvery){
      const x = padL + i*stepX;
      ctx.fillText(months[i], x - 18, padT + ih + 18);
    }

    ctx.fillStyle = "#0f172a";
    ctx.font = "13px system-ui";
    ctx.fillText("Volym per månad", padL, 16);
  }

  // =========================
  // Chart: Heatmap cat × månad
  // =========================
  function drawHeatmap(canvasSel, eventsFiltered) {
    const canvas = $(canvasSel);
    if (!canvas) return;

    if (!eventsFiltered.length) {
      drawEmpty(canvas, "Heatmap");
      return;
    }

    const agg = buildAgg(eventsFiltered);
    const months = agg.months.slice(-24);
    const cats = Object.keys(CATS);

    const matrix = cats.map(c => months.map(m => (agg.byCatMonth.get(c)?.get(m) || 0)));
    const maxV = Math.max(1, ...matrix.flat());

    const { ctx, w, h } = setupCanvas(canvas);
    const padL = 180, padR = 12, padT = 22, padB = 26;
    const iw = w - padL - padR;
    const ih = h - padT - padB;

    ctx.fillStyle = "#fff";
    ctx.fillRect(0,0,w,h);

    ctx.fillStyle = "#0f172a";
    ctx.font = "13px system-ui";
    ctx.fillText("Heatmap (kategori × månad)", padL, 16);

    const cellW = iw / Math.max(1, months.length);
    const cellH = ih / Math.max(1, cats.length);

    // x labels
    ctx.fillStyle = "#475569";
    ctx.font = "10.5px system-ui";
    const labelEvery = Math.max(1, Math.floor(months.length / 8));
    for (let i=0;i<months.length;i+=labelEvery){
      ctx.fillText(months[i], padL + i*cellW, padT + ih + 16);
    }

    // y labels + cells
    ctx.font = "12px system-ui";
    for (let r=0;r<cats.length;r++){
      const cat = cats[r];
      const y = padT + r*cellH;

      ctx.fillStyle = "#0f172a";
      ctx.fillText(`${CATS[cat].emoji} ${CATS[cat].label}`, 10, y + cellH*0.7);

      for (let c=0;c<months.length;c++){
        const v = matrix[r][c];
        const a = v / maxV; // 0..1
        ctx.fillStyle = `rgba(37,99,235,${0.08 + a*0.42})`;
        ctx.fillRect(padL + c*cellW, y, cellW-1, cellH-1);
      }
    }
  }

  // =========================
  // Chart: Topplista land/plats
  // =========================
  function drawGeoTop(canvasSel, eventsFiltered, mode) {
    const canvas = $(canvasSel);
    if (!canvas) return;

    if (!eventsFiltered.length) {
      drawEmpty(canvas, "Topplista");
      return;
    }

    const keyFn = mode === "place" ? (e => e.place) : (e => e.country);
    const m = new Map();
    for (const e of eventsFiltered) {
      const k = (keyFn(e) || "").trim();
      if (!k) continue;
      m.set(k, (m.get(k) || 0) + 1);
    }

    const items = Array.from(m.entries()).sort((a,b)=>b[1]-a[1]).slice(0, 12);
    const vals = items.map(x => x[1]);
    const maxV = Math.max(1, ...vals);

    const { ctx, w, h } = setupCanvas(canvas);
    const padL = 180, padR = 12, padT = 22, padB = 18;
    const iw = w - padL - padR;
    const ih = h - padT - padB;

    ctx.fillStyle = "#fff";
    ctx.fillRect(0,0,w,h);

    ctx.fillStyle = "#0f172a";
    ctx.font = "13px system-ui";
    ctx.fillText(`Topplista (${mode === "place" ? "plats" : "land"})`, padL, 16);

    const rowH = ih / Math.max(1, items.length);
    ctx.font = "12px system-ui";

    for (let i=0;i<items.length;i++){
      const [name, v] = items[i];
      const y0 = padT + i*rowH + 6;
      const yText = padT + i*rowH + rowH*0.65;

      ctx.fillStyle = "#0f172a";
      ctx.fillText(name, 10, yText);

      const bw = (v / maxV) * iw;
      ctx.fillStyle = "rgba(37,99,235,.18)";
      ctx.fillRect(padL, y0, bw, Math.max(10, rowH - 10));

      ctx.fillStyle = "#475569";
      ctx.fillText(String(v), padL + bw + 8, yText);
    }
  }

  // =========================
  // Expandera (helskärm-kort)
  // =========================
  function wireExpanders() {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-expand]");
      if (!btn) return;
      const sel = btn.getAttribute("data-expand");
      const card = sel ? document.querySelector(sel) : null;
      if (!card) return;

      const open = card.classList.toggle("expanded");
      btn.textContent = open ? "Stäng" : "Expandera";

      // trigga canvas-resize
      setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
    }, true);
  }

  // =========================
  // OIAT: score + RAG + lightbox
  // =========================
  function wireOIAT() {
    const sO = $("#sO"), sI = $("#sI"), sA = $("#sA"), sT = $("#sT");
    const vO = $("#vO"), vI = $("#vI"), vA = $("#vA"), vT = $("#vT");
    const outScoreRight = $("#oiatScore");
    const outRagRight   = $("#oiatRag");
    const outScoreLeft  = $("#oiatScoreInline");
    const outRagLeft    = $("#oiatRagInline");

    function ragFromScore(score){
      if (score < 2.5) return { key:"RÖD",  text:"RÖD – otillräckligt" };
      if (score < 3.5) return { key:"GUL",  text:"GUL – komplettera" };
      return             { key:"GRÖN", text:"GRÖN – robust" };
    }

    function setBadge(el, rag){
      if(!el) return;
      el.textContent = rag.text;
      el.style.padding = "6px 10px";
      el.style.borderRadius = "999px";
      el.style.border = "1px solid var(--line)";
      el.style.background = "#f8fafc";
      if(rag.key === "RÖD") el.style.background = "rgba(239,68,68,.12)";
      if(rag.key === "GUL") el.style.background = "rgba(245,158,11,.14)";
      if(rag.key === "GRÖN") el.style.background = "rgba(34,197,94,.14)";
    }

    function update(){
      if(!sO || !sI || !sA || !sT || !vO || !vI || !vA || !vT) return;

      const O = Number(sO.value);
      const I = Number(sI.value);
      const A = Number(sA.value);
      const T = Number(sT.value);

      vO.textContent = O;
      vI.textContent = I;
      vA.textContent = A;
      vT.textContent = T;

      const score = (O + I + A + T) / 4;
      const rag = ragFromScore(score);

      if(outScoreRight) outScoreRight.textContent = score.toFixed(2);
      if(outScoreLeft)  outScoreLeft.textContent  = score.toFixed(2);

      setBadge(outRagRight, rag);
      if(outRagLeft) outRagLeft.textContent = rag.text;
    }

    ["input","change"].forEach(evt=>{
      sO?.addEventListener(evt, update);
      sI?.addEventListener(evt, update);
      sA?.addEventListener(evt, update);
      sT?.addEventListener(evt, update);
    });

    update();

    // Lightbox
    const fullBtn  = $("#oiatFullBtn");
    const lb       = $("#oiatLightbox");
    const closeBtn = $("#oiatCloseBtn");

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

    fullBtn?.addEventListener("click", openLB);
    closeBtn?.addEventListener("click", closeLB);

    lb?.addEventListener("click", (e)=>{ if(e.target === lb) closeLB(); });
    document.addEventListener("keydown", (e)=>{ if(e.key === "Escape" && lb?.classList.contains("open")) closeLB(); });
  }

  // =========================
  // Init
  // =========================
  function init() {
    const raw = window.events;

    if (!Array.isArray(raw)) {
      // Om data.js inte laddats → visa tomma grafer så du ser felet direkt
      ["#sparkMulti","#catChart","#timeChart","#heatChart","#geoChart"].forEach(sel=>{
        const c=$(sel);
        if(c) drawEmpty(c, "Ingen data");
      });
      return;
    }

    const events = normalizeEvents(raw);
    const aggAll = buildAgg(events);

    // state
    const sparkCats  = new Set(Object.keys(CATS)); // översiktens linjer
    const activeCats = new Set(Object.keys(CATS)); // huvudgrafernas filter
    let geoMode = $("#geoMode")?.value || "country";

    // KPIs
    renderKPIs(events, aggAll);

    // översikt: legend + chart
    function redrawSpark(){
      drawSparkMulti("#sparkMulti", events, aggAll, sparkCats);
      // aria-pressed uppdateras i renderSparkLegend när man klickar
    }
    renderSparkLegend(aggAll, sparkCats, redrawSpark);
    redrawSpark();

    $("#selAllCats")?.addEventListener("click", ()=>{
      Object.keys(CATS).forEach(k=>sparkCats.add(k));
      renderSparkLegend(aggAll, sparkCats, redrawSpark);
      redrawSpark();
    });
    $("#selNoCats")?.addEventListener("click", ()=>{
      sparkCats.clear();
      renderSparkLegend(aggAll, sparkCats, redrawSpark);
      redrawSpark();
    });

    // huvudgrafer
    function redrawMain(){
      const filtered = filterByCats(events, activeCats);

      // räkna om counts för chips baserat på ALLA events (så siffrorna är stabila)
      renderCatChips(aggAll, activeCats, ()=>{
        renderCatChips(aggAll, activeCats, redrawMain);
        redrawMain();
      });

      drawCatBar("#catChart", filtered);
      drawTimeLine("#timeChart", filtered);
      drawHeatmap("#heatChart", filtered);
      drawGeoTop("#geoChart", filtered, geoMode);

      // uppdatera aria-pressed styling (CSS tar resten)
      $$("#catChips .chip").forEach(ch=>{
        const c = ch.dataset.cat;
        ch.setAttribute("aria-pressed", activeCats.has(c) ? "true" : "false");
      });
      $$("#sparkLegend .chip").forEach(ch=>{
        const c = ch.dataset.cat;
        ch.setAttribute("aria-pressed", sparkCats.has(c) ? "true" : "false");
      });
    }

    renderCatChips(aggAll, activeCats, redrawMain);
    redrawMain();

    $("#geoMode")?.addEventListener("change", (e)=>{
      geoMode = e.target.value;
      redrawMain();
    });

    // resize redraw (debounced)
    let t=null;
    window.addEventListener("resize", ()=>{
      clearTimeout(t);
      t=setTimeout(()=>{
        redrawSpark();
        redrawMain();
      }, 120);
    });
  }

  // Boot
  wireExpanders();
  document.addEventListener("DOMContentLoaded", () => {
    wireOIAT();
    init();
  });
})();
