// charts.js (robust, utan externa bibliotek)
// Förväntar sig att data.js definierar: window.events = [ ... ]
// Stödjer events med fält: cat ELLER category, date, country, place, title, summary, url, lat, lng

(() => {
  "use strict";

  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // =========================
  // Kategorier (som du angav)
  // =========================
  const CAT_ALIASES = {
    DRONE:  ['uav','drönare','drone','quad','fpv'],
    INFRA:  ['sabotage','infrastruktur','el','fiber','kabel','bro','tunnel'],
    NUCLEAR:['kärn','nuclear','radioaktiv','uran','strål'],
    TERROR: ['terror','attack','spräng','bomb'],
    INTEL:  ['spion','underrätt','säpo','intel','kgb','gru','fsb'],
    LEGAL:  ['dom','åtal','rättsfall','rättegång'],
    MIL:    ['militär','försvar','brigad','regemente','övning'],
    HYBRID: ['påverkan','hybrid','desinfo','psyop','reflexiv'],
    MAR:    ['marin','sjöfart','tanker','hamn','fartyg','ais'],
    GPS:    ['gps','gnss','jamming','störning','spoof'],
    POLICY: ['politik','policy','myndighet','lag','förordning']
  };

  const CATS = {
    DRONE:   { label:'Drönare / UAV',             emoji:'🛩️', color:'#b9e3ff', desc:'Incidenter med UAV/drönare.', iconUrl:'' },
    INFRA:   { label:'Infrastruktur / sabotage',  emoji:'⚡',  color:'#ffe08a', desc:'Kritisk infrastruktur, sabotage, störningar.', iconUrl:'' },
    NUCLEAR: { label:'Kärnenergi / farligt gods', emoji:'☢️',  color:'#ffd0d0', desc:'Kärntekniskt/farligt gods.', iconUrl:'' },
    TERROR:  { label:'Terror / våld',             emoji:'💣',  color:'#ffc4b6', desc:'Terrorism och våldsbrott med hög påverkan.', iconUrl:'' },
    INTEL:   { label:'Spionage / underrättelse',  emoji:'🕵️‍♂️', color:'#e6e6e6', desc:'Spioneri, underrättelse, säkerhet.', iconUrl:'' },
    LEGAL:   { label:'Rättsfall / domar',         emoji:'⚖️',  color:'#c8ffcb', desc:'Juridik, domar och rättsfall.', iconUrl:'' },
    MIL:     { label:'Militär / försvar',         emoji:'🪖',  color:'#b8efe6', desc:'Militär aktivitet och försvar.', iconUrl:'' },
    HYBRID:  { label:'Påverkan / hybrid',         emoji:'🧠',  color:'#dfcffc', desc:'Informationspåverkan/hybridaktiviteter.', iconUrl:'' },
    MAR:     { label:'Maritimt / skuggflotta',    emoji:'⚓',  color:'#cfe3ff', desc:'Händelser till sjöss/skuggflotta.', iconUrl:'' },
    GPS:     { label:'GPS-störning / signal',     emoji:'📡',  color:'#eed9ff', desc:'GNSS-störningar och signalpåverkan.', iconUrl:'' },
    POLICY:  { label:'Politik / policy',          emoji:'🏛️',  color:'#e9ffd4', desc:'Policy, myndigheter, styrdokument.', iconUrl:'' }
  };

  // =========================
  // Normalisering & hjälpare
  // =========================
  const pad2 = (n) => String(n).padStart(2, "0");

  function parseISODate(s) {
    // s: "YYYY-MM-DD"
    if (!s || typeof s !== "string") return null;
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    return isNaN(dt.getTime()) ? null : dt;
  }

  function monthKeyFromDate(dt) {
    // UTC month key
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth() + 1;
    return `${y}-${pad2(m)}`;
  }

  function detectCategory(e) {
    const direct = (e && (e.cat || e.category)) ? String(e.cat || e.category).trim() : "";
    if (direct && CATS[direct]) return direct;

    const blob = [
      e?.title, e?.summary, e?.place, e?.country, e?.url
    ].filter(Boolean).join(" ").toLowerCase();

    for (const [cat, words] of Object.entries(CAT_ALIASES)) {
      for (const w of words) {
        if (blob.includes(String(w).toLowerCase())) return cat;
      }
    }
    // fallback
    return "POLICY";
  }

  function normalizeEvents(raw) {
    const out = [];
    for (const e of (Array.isArray(raw) ? raw : [])) {
      const dt = parseISODate(e?.date);
      if (!dt) continue;
      const cat = detectCategory(e);
      out.push({
        date: e.date,
        dt,
        month: monthKeyFromDate(dt),
        cat,
        country: (e.country || "").toString(),
        place: (e.place || "").toString(),
        title: (e.title || "").toString(),
        summary: (e.summary || "").toString(),
        url: (e.url || "").toString(),
        lat: typeof e.lat === "number" ? e.lat : null,
        lng: typeof e.lng === "number" ? e.lng : null,
      });
    }
    // sort by date
    out.sort((a,b) => a.dt - b.dt);
    return out;
  }

  function uniq(arr) {
    return Array.from(new Set(arr));
  }

  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  // =========================
  // Canvas: DPI & text
  // =========================
  function setupCanvas(canvas) {
    const ctx = canvas.getContext("2d");
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(1, rect.width);
    const cssH = Math.max(1, rect.height || canvas.height || 300);

    canvas.width  = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
    ctx.clearRect(0, 0, cssW, cssH);

    return { ctx, w: cssW, h: cssH };
  }

  function drawEmpty(canvas, title) {
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#64748b";
    ctx.font = "13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(title || "Ingen data", 12, 22);
    ctx.fillText("Kontrollera att data.js laddas och att window.events innehåller händelser.", 12, 44);
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
  // Data-aggregation
  // =========================
  function buildAgg(events) {
    const months = uniq(events.map(e => e.month)).sort();
    const cats = Object.keys(CATS);

    const totalByMonth = new Map(months.map(m => [m, 0]));
    const byCatMonth = new Map(); // cat -> Map(month->count)
    for (const c of cats) byCatMonth.set(c, new Map(months.map(m => [m, 0])));

    const totalByCat = new Map(cats.map(c => [c, 0]));
    const byCountry = new Map();
    const byPlace = new Map();

    for (const e of events) {
      totalByMonth.set(e.month, (totalByMonth.get(e.month) || 0) + 1);

      if (!byCatMonth.has(e.cat)) byCatMonth.set(e.cat, new Map(months.map(m => [m, 0])));
      byCatMonth.get(e.cat).set(e.month, (byCatMonth.get(e.cat).get(e.month) || 0) + 1);

      totalByCat.set(e.cat, (totalByCat.get(e.cat) || 0) + 1);

      if (e.country) byCountry.set(e.country, (byCountry.get(e.country) || 0) + 1);
      if (e.place) byPlace.set(e.place, (byPlace.get(e.place) || 0) + 1);
    }

    return { months, cats, totalByMonth, byCatMonth, totalByCat, byCountry, byPlace };
  }

  // =========================
  // Rendering: KPIs + range
  // =========================
  function renderKPIs(events, agg) {
    const el = $("#kpis");
    const range = $("#dataRange");
    if (!el || !range) return;

    const total = events.length;
    const catsUsed = uniq(events.map(e => e.cat)).length;
    const monthsUsed = agg.months.length;
    const countriesUsed = uniq(events.map(e => e.country).filter(Boolean)).length;

    el.innerHTML = "";
    const items = [
      { n: total, l: "Händelser" },
      { n: catsUsed, l: "Kategorier" },
      { n: monthsUsed, l: "Månader" },
      { n: countriesUsed, l: "Länder" },
    ];
    for (const it of items) {
      const d = document.createElement("div");
      d.className = "kpi";
      d.innerHTML = `<div class="n">${it.n}</div><div class="l">${it.l}</div>`;
      el.appendChild(d);
    }

    if (events.length) {
      const a = events[0].date;
      const b = events[events.length - 1].date;
      range.textContent = `Tidsintervall i data: ${a} – ${b}`;
    } else {
      range.textContent = "Tidsintervall i data: –";
    }
  }

  // =========================
  // Rendering: Spark multi (overview)
  // =========================
  function renderSparkLegend(agg, sparkCats, onChange) {
    const host = $("#sparkLegend");
    if (!host) return;

    host.innerHTML = "";
    const cats = Object.keys(CATS);

    for (const c of cats) {
      const meta = CATS[c];
      const count = agg.totalByCat.get(c) || 0;

      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.dataset.cat = c;
      chip.style.borderColor = "var(--line)";
      chip.style.background = sparkCats.has(c) ? "rgba(37,99,235,.10)" : "#fff";
      chip.style.cursor = "pointer";

      chip.innerHTML = `
        <span class="emoji">${meta.emoji || ""}</span>
        <span class="t">${meta.label}</span>
        <span class="n">${count}</span>
      `;

      chip.addEventListener("click", () => {
        if (sparkCats.has(c)) sparkCats.delete(c);
        else sparkCats.add(c);
        onChange();
      });

      host.appendChild(chip);
    }
  }

  function drawSparkMulti(events, agg, sparkCats) {
    const canvas = $("#sparkMulti");
    if (!canvas) return;

    if (!events.length || !agg.months.length) {
      drawEmpty(canvas, "Volym över tid");
      return;
    }

    const { ctx, w, h } = setupCanvas(canvas);

    // padding
    const padL = 40, padR = 12, padT = 12, padB = 26;
    const iw = w - padL - padR;
    const ih = h - padT - padB;

    // build series
    const months = agg.months;
    const total = months.map(m => agg.totalByMonth.get(m) || 0);

    const series = [];
    for (const c of Object.keys(CATS)) {
      if (!sparkCats.has(c)) continue;
      const m = agg.byCatMonth.get(c);
      const arr = months.map(mm => (m ? (m.get(mm) || 0) : 0));
      series.push({ cat: c, arr });
    }

    const maxV = Math.max(1, ...total, ...series.flatMap(s => s.arr));
    const yt = yTicks(maxV, 4);

    // background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    // grid + y labels
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

    // x labels (sparsely)
    const stepX = iw / Math.max(1, (months.length - 1));
    const labelEvery = Math.max(1, Math.floor(months.length / 6));
    for (let i = 0; i < months.length; i += labelEvery) {
      const x = padL + i * stepX;
      ctx.fillText(months[i], x - 18, padT + ih + 18);
    }

    function drawLine(arr, stroke, width, alpha = 1) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let i = 0; i < arr.length; i++) {
        const x = padL + i * stepX;
        const y = padT + ih - (arr[i] / yt.max) * ih;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // category lines (thin)
    for (const s of series) {
      const col = (CATS[s.cat]?.color) || "#94a3b8";
      drawLine(s.arr, col, 1.5, 0.9);
    }

    // total line (thicker)
    drawLine(total, "#2563eb", 2.5, 1);

    // title
    ctx.fillStyle = "#0f172a";
    ctx.font = "13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Volym över tid (total + kategorier)", padL, 18);
  }

  // =========================
  // Rendering: Chips-filter (charts section)
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

      const on = activeCats.has(c);
      chip.style.background = on ? "rgba(37,99,235,.10)" : "#fff";
      chip.style.borderColor = "var(--line)";
      chip.style.cursor = "pointer";

      chip.innerHTML = `
        <span class="emoji">${meta.emoji || ""}</span>
        <span class="t">${meta.label}</span>
        <span class="n">${count}</span>
      `;

      chip.addEventListener("click", () => {
        if (activeCats.has(c)) activeCats.delete(c);
        else activeCats.add(c);

        // skydd: om användaren släcker allt → slå på allt igen (så grafer inte blir tomma)
        if (activeCats.size === 0) {
          Object.keys(CATS).forEach(k => activeCats.add(k));
        }
        onChange();
      });

      host.appendChild(chip);
    }
  }

  function filterEventsByCats(events, activeCats) {
    if (!activeCats || activeCats.size === 0) return events;
    return events.filter(e => activeCats.has(e.cat));
  }

  // =========================
  // Chart: Fördelning per kategori (bar)
  // =========================
  function drawCatBar(canvasSel, agg, eventsFiltered) {
    const canvas = $(canvasSel);
    if (!canvas) return;

    if (!eventsFiltered.length) {
      drawEmpty(canvas, "Fördelning per kategori");
      return;
    }

    const { ctx, w, h } = setupCanvas(canvas);
    const padL = 46, padR = 12, padT = 16, padB = 28;
    const iw = w - padL - padR;
    const ih = h - padT - padB;

    // counts from filtered set
    const counts = new Map(Object.keys(CATS).map(c => [c, 0]));
    for (const e of eventsFiltered) counts.set(e.cat, (counts.get(e.cat) || 0) + 1);

    const cats = Object.keys(CATS).filter(c => (counts.get(c) || 0) > 0);
    cats.sort((a,b) => (counts.get(b) || 0) - (counts.get(a) || 0));

    const vals = cats.map(c => counts.get(c) || 0);
    const maxV = Math.max(1, ...vals);
    const yt = yTicks(maxV, 4);

    // bg
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = "#e5e7eb";
    ctx.fillStyle = "#64748b";
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    for (const v of yt.ticks) {
      const y = padT + ih - (v / yt.max) * ih;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + iw, y);
      ctx.stroke();
      ctx.fillText(String(Math.round(v)), 8, y + 4);
    }

    // bars
    const n = cats.length;
    const gap = 8;
    const bw = Math.max(10, (iw - gap * (n - 1)) / n);

    for (let i = 0; i < n; i++) {
      const c = cats[i];
      const v = counts.get(c) || 0;
      const x = padL + i * (bw + gap);
      const bh = (v / yt.max) * ih;
      const y = padT + ih - bh;

      ctx.fillStyle = CATS[c]?.color || "#94a3b8";
      ctx.fillRect(x, y, bw, bh);

      // x labels (emoji)
      ctx.fillStyle = "#0f172a";
      ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText(CATS[c]?.emoji || "", x + 2, padT + ih + 18);
    }

    // title
    ctx.fillStyle = "#0f172a";
    ctx.font = "13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Fördelning per kategori", padL, 18);
  }

  // =========================
  // Chart: Volym över tid (månad) – total line
  // =========================
  function drawTimeLine(canvasSel, agg, eventsFiltered) {
    const canvas = $(canvasSel);
    if (!canvas) return;

    if (!eventsFiltered.length) {
      drawEmpty(canvas, "Volym över tid (månad)");
      return;
    }

    // rebuild total by month on filtered set
    const months = uniq(eventsFiltered.map(e => e.month)).sort();
    const totalByMonth = new Map(months.map(m => [m, 0]));
    for (const e of eventsFiltered) totalByMonth.set(e.month, (totalByMonth.get(e.month) || 0) + 1);
    const total = months.map(m => totalByMonth.get(m) || 0);

    const { ctx, w, h } = setupCanvas(canvas);
    const padL = 46, padR = 12, padT = 16, padB = 28;
    const iw = w - padL - padR;
    const ih = h - padT - padB;

    const maxV = Math.max(1, ...total);
    const yt = yTicks(maxV, 4);

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "#e5e7eb";
    ctx.fillStyle = "#64748b";
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";

    for (const v of yt.ticks) {
      const y = padT + ih - (v / yt.max) * ih;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + iw, y);
      ctx.stroke();
      ctx.fillText(String(Math.round(v)), 8, y + 4);
    }

    const stepX = iw / Math.max(1, (months.length - 1));
    const labelEvery = Math.max(1, Math.floor(months.length / 6));
    for (let i = 0; i < months.length; i += labelEvery) {
      const x = padL + i * stepX;
      ctx.fillText(months[i], x - 18, padT + ih + 18);
    }

    // line
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < total.length; i++) {
      const x = padL + i * stepX;
      const y = padT + ih - (total[i] / yt.max) * ih;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // title
    ctx.fillStyle = "#0f172a";
    ctx.font = "13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Volym över tid (månad)", padL, 18);
  }

  // =========================
  // Chart: Heatmap (kategori × månad)
  // =========================
  function drawHeatmap(canvasSel, eventsFiltered) {
    const canvas = $(canvasSel);
    if (!canvas) return;

    if (!eventsFiltered.length) {
      drawEmpty(canvas, "Heatmap");
      return;
    }

    const months = uniq(eventsFiltered.map(e => e.month)).sort();
    const cats = Object.keys(CATS);

    const grid = new Map(); // key cat|month -> count
    let maxV = 1;
    for (const c of cats) {
      for (const m of months) grid.set(`${c}|${m}`, 0);
    }
    for (const e of eventsFiltered) {
      const k = `${e.cat}|${e.month}`;
      const v = (grid.get(k) || 0) + 1;
      grid.set(k, v);
      if (v > maxV) maxV = v;
    }

    const { ctx, w, h } = setupCanvas(canvas);
    const padL = 140, padR = 12, padT = 22, padB = 26;
    const iw = w - padL - padR;
    const ih = h - padT - padB;

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);

    // cell sizes
    const cw = iw / Math.max(1, months.length);
    const ch = ih / Math.max(1, cats.length);

    // draw cells
    for (let r = 0; r < cats.length; r++) {
      const c = cats[r];
      for (let col = 0; col < months.length; col++) {
        const m = months[col];
        const v = grid.get(`${c}|${m}`) || 0;
        const t = clamp01(v / maxV);

        // base from cat color, apply alpha by intensity
        ctx.fillStyle = CATS[c]?.color || "#94a3b8";
        ctx.globalAlpha = 0.12 + 0.88 * t;
        ctx.fillRect(padL + col * cw, padT + r * ch, cw - 1, ch - 1);
      }
    }
    ctx.globalAlpha = 1;

    // labels
    ctx.fillStyle = "#64748b";
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";

    const labelEvery = Math.max(1, Math.floor(months.length / 6));
    for (let col = 0; col < months.length; col += labelEvery) {
      ctx.fillText(months[col], padL + col * cw, padT + ih + 18);
    }

    for (let r = 0; r < cats.length; r++) {
      const c = cats[r];
      const y = padT + r * ch + ch * 0.65;
      ctx.fillText(`${CATS[c]?.emoji || ""} ${CATS[c]?.label || c}`, 10, y);
    }

    // title
    ctx.fillStyle = "#0f172a";
    ctx.font = "13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Heatmap (kategori × månad)", padL, 16);
  }

  // =========================
  // Chart: Topplista (land/plats)
  // =========================
  function drawGeoTop(canvasSel, eventsFiltered, mode) {
    const canvas = $(canvasSel);
    if (!canvas) return;

    if (!eventsFiltered.length) {
      drawEmpty(canvas, "Topplista");
      return;
    }

    const keyFn = mode === "place" ? (e => e.place) : (e => e.country);
    const map = new Map();

    for (const e of eventsFiltered) {
      const k = (keyFn(e) || "").trim();
      if (!k) continue;
      map.set(k, (map.get(k) || 0) + 1);
    }

    const items = Array.from(map.entries()).sort((a,b) => b[1] - a[1]).slice(0, 12);
    const vals = items.map(x => x[1]);
    const maxV = Math.max(1, ...vals);

    const { ctx, w, h } = setupCanvas(canvas);
    const padL = 180, padR = 12, padT = 22, padB = 18;
    const iw = w - padL - padR;
    const ih = h - padT - padB;

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#0f172a";
    ctx.font = "13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Topplista (${mode === "place" ? "plats" : "land"})`, padL, 16);

    const rowH = ih / Math.max(1, items.length);
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";

    for (let i = 0; i < items.length; i++) {
      const [name, v] = items[i];
      const y = padT + i * rowH + rowH * 0.65;

      // label
      ctx.fillStyle = "#0f172a";
      ctx.fillText(name, 10, y);

      // bar
      const bw = (v / maxV) * iw;
      ctx.fillStyle = "rgba(37,99,235,.18)";
      ctx.fillRect(padL, padT + i * rowH + 6, bw, Math.max(10, rowH - 10));

      // value
      ctx.fillStyle = "#475569";
      ctx.fillText(String(v), padL + bw + 8, y);
    }
  }

  // =========================
  // Init + redraw
  // =========================
  function init() {
    const raw = window.events;
    if (!Array.isArray(raw)) {
      console.error("charts.js: window.events saknas eller är inte en array. Kontrollera data.js.");
      // försök ändå skriva tomma canvas om de finns:
      ["#sparkMulti","#catChart","#timeChart","#heatChart","#geoChart"].forEach(sel => {
        const c = $(sel);
        if (c) drawEmpty(c, "Ingen data");
      });
      return;
    }

    const events = normalizeEvents(raw);
    const aggAll = buildAgg(events);

    // State
    const sparkCats = new Set(Object.keys(CATS));     // för översiktens multi-line
    const activeCats = new Set(Object.keys(CATS));    // för huvudgraferna
    let geoMode = ($("#geoMode")?.value || "country");

    // Buttons: markera/avmarkera (spark)
    $("#selAllCats")?.addEventListener("click", () => {
      Object.keys(CATS).forEach(k => sparkCats.add(k));
      renderSparkLegend(aggAll, sparkCats, redrawSpark);
      redrawSpark();
    });

    $("#selNoCats")?.addEventListener("click", () => {
      sparkCats.clear(); // totalen visas ändå
      renderSparkLegend(aggAll, sparkCats, redrawSpark);
      redrawSpark();
    });

    // geo dropdown
    $("#geoMode")?.addEventListener("change", (e) => {
      geoMode = e.target.value;
      redrawMain();
    });

    function redrawSpark() {
      // bygg agg på ALLA events (översikten ska vara global)
      const agg = aggAll;
      drawSparkMulti(events, agg, sparkCats);
      // uppdatera chip-styling
      $$("#sparkLegend .chip").forEach(ch => {
        const c = ch.dataset.cat;
        ch.style.background = sparkCats.has(c) ? "rgba(37,99,235,.10)" : "#fff";
      });
    }

    function redrawMain() {
      const filtered = filterEventsByCats(events, activeCats);
      const agg = buildAgg(filtered);

      drawCatBar("#catChart", agg, filtered);
      drawTimeLine("#timeChart", agg, filtered);
      drawHeatmap("#heatChart", filtered);
      drawGeoTop("#geoChart", filtered, geoMode);
    }

    // Render static UI
    renderKPIs(events, aggAll);

    renderSparkLegend(aggAll, sparkCats, () => {
      renderSparkLegend(aggAll, sparkCats, redrawSpark);
      redrawSpark();
    });
    redrawSpark();

    renderCatChips(aggAll, activeCats, () => {
      renderCatChips(aggAll, activeCats, redrawMain);
      redrawMain();
    });
    redrawMain();

    // Resize redraw (debounced)
    let t = null;
    window.addEventListener("resize", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        redrawSpark();
        redrawMain();
      }, 120);
    });
  }

  // =========================
  // Start
  // =========================
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
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
