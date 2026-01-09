(() => {
  "use strict";

  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ===== Dataset =====
  const events = Array.isArray(window.events) ? window.events : [];

  // ===== Helpers =====
  const pad2 = (n) => String(n).padStart(2, "0");

  function parseISODate(s) {
    if (!s || typeof s !== "string") return null;
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    return isNaN(dt.getTime()) ? null : dt;
  }

  function fmtDate(dt) {
    return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
  }

  function uniq(arr) {
    return Array.from(new Set(arr));
  }

  function safeInt(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? Math.round(x) : fallback;
  }

  // ===== KPI =====
  function buildKpis() {
    const elKpis = $("#kpis");
    const elRange = $("#dataRange");
    if (!elKpis || !elRange) return;

    const dates = events
      .map(e => parseISODate(e.date))
      .filter(Boolean)
      .sort((a,b) => a - b);

    const minDate = dates.length ? dates[0] : null;
    const maxDate = dates.length ? dates[dates.length - 1] : null;

    const total = events.length;

    const cats = uniq(events.map(e => e.cat).filter(Boolean));
    const countries = uniq(events.map(e => e.country).filter(Boolean));
    const places = uniq(events.map(e => e.place).filter(Boolean));

    const items = [
      { label: "Händelser", value: total },
      { label: "Kategorier", value: cats.length },
      { label: "Länder", value: countries.length },
      { label: "Platser", value: places.length },
    ];

    elKpis.innerHTML = items.map(it => `
      <div class="kpi">
        <div class="kpi-label">${it.label}</div>
        <div class="kpi-value">${it.value}</div>
      </div>
    `).join("");

    if (minDate && maxDate) {
      elRange.textContent = `Data: ${fmtDate(minDate)} → ${fmtDate(maxDate)} (UTC)`;
    } else {
      elRange.textContent = `Data: inga datum hittades i datasetet.`;
    }
  }

  // ===== OIAT =====
  function ragFromScore(score) {
    if (score >= 3.5) return { key: "green", text: "GRÖN – robust" };
    if (score >= 2.5) return { key: "yellow", text: "GUL – rimlig" };
    return { key: "red", text: "RÖD – bristfällig" };
  }

  function calcOiat(o, i, a, t) {
    // Enkel modell: medelvärde 0..5
    const score = (o + i + a + t) / 4;
    return { score, rag: ragFromScore(score) };
  }

  function setupOiat() {
    const sO = $("#sO"), sI = $("#sI"), sA = $("#sA"), sT = $("#sT");
    if (!sO || !sI || !sA || !sT) return;

    const vO = $("#vO"), vI = $("#vI"), vA = $("#vA"), vT = $("#vT");
    const outScore = $("#oiatScore");
    const ragPill = $("#oiatRagPill");
    const ragText = $("#oiatRagText");

    function render() {
      const O = safeInt(sO.value, 0);
      const I = safeInt(sI.value, 0);
      const A = safeInt(sA.value, 0);
      const T = safeInt(sT.value, 0);

      if (vO) vO.textContent = O;
      if (vI) vI.textContent = I;
      if (vA) vA.textContent = A;
      if (vT) vT.textContent = T;

      const { score, rag } = calcOiat(O, I, A, T);

      if (outScore) outScore.textContent = score.toFixed(2);
      if (ragText) ragText.textContent = rag.text;
      if (ragPill) ragPill.setAttribute("data-rag", rag.key);
    }

    ["input", "change"].forEach(ev => {
      sO.addEventListener(ev, render);
      sI.addEventListener(ev, render);
      sA.addEventListener(ev, render);
      sT.addEventListener(ev, render);
    });

    render();
  }

  // ===== Expand sections =====
  function setupExpandButtons() {
    $$("[data-expand]").forEach(btn => {
      const sel = btn.getAttribute("data-expand");
      if (!sel) return;

      btn.addEventListener("click", () => {
        const target = document.querySelector(sel);
        if (!target) return;

        const isOn = target.classList.toggle("expanded");
        btn.textContent = isOn ? "Återställ" : "Expandera";

        if (isOn) {
          const top = target.getBoundingClientRect().top + window.scrollY - 90;
          window.scrollTo({ top, behavior: "smooth" });
        }
      });
    });
  }

  // ===== Fullscreen =====
  async function requestFullscreen(el) {
    if (!el) return;

    const fn =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.msRequestFullscreen;

    if (fn) {
      try { await fn.call(el); } catch (_) {}
    }
  }

  function setupFullscreenButtons() {
    $$("[data-fullscreen]").forEach(btn => {
      const sel = btn.getAttribute("data-fullscreen");
      if (!sel) return;

      btn.addEventListener("click", () => {
        const target = document.querySelector(sel);
        if (!target) return;
        requestFullscreen(target);
      });
    });
  }

  // ===== Init =====
  function init() {
    buildKpis();
    setupOiat();
    setupExpandButtons();
    setupFullscreenButtons();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
