/* Shared helpers for the dashboards: theme, formatting, ECharts defaults, tile map, tables. */
(function () {
  const root = document.documentElement;

  // ---------- theme ----------
  function storedTheme() { try { return localStorage.getItem("srh-theme"); } catch (e) { return null; } }
  function storeTheme(t) { try { localStorage.setItem("srh-theme", t); } catch (e) { /* private mode */ } }
  const saved = storedTheme();
  if (saved === "dark" || saved === "light") root.setAttribute("data-theme", saved);

  function isDark() {
    const t = root.getAttribute("data-theme");
    if (t) return t === "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  function paintThemeBtn() {
    document.querySelectorAll(".theme-btn").forEach(b => {
      b.innerHTML = isDark() ? SUN : MOON;
      b.setAttribute("aria-label", isDark() ? "Switch to light theme" : "Switch to dark theme");
    });
  }
  document.addEventListener("click", e => {
    const b = e.target.closest(".theme-btn");
    if (!b) return;
    const next = isDark() ? "light" : "dark";
    root.setAttribute("data-theme", next);
    storeTheme(next);
    paintThemeBtn();
    rerenderAll();
  });
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (!root.getAttribute("data-theme")) { paintThemeBtn(); rerenderAll(); } });
  }
  document.addEventListener("DOMContentLoaded", paintThemeBtn);

  const css = name => getComputedStyle(root).getPropertyValue(name).trim();
  const series = () => [1, 2, 3, 4, 5, 6, 7, 8].map(i => css("--s" + i));

  // ---------- formatting ----------
  const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const fmt = {
    int: v => v == null ? "–" : nf0.format(Math.round(v)),
    compact: v => {
      if (v == null || isNaN(v)) return "–";
      const a = Math.abs(v);
      if (a >= 1e12) return (v / 1e12).toFixed(2).replace(/\.?0+$/, "") + "T";
      if (a >= 1e9) return (v / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace(/\.0$/, "") + "B";
      if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.?0+$/, "") + "M";
      if (a >= 1e4) return (v / 1e3).toFixed(0) + "K";
      if (a >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
      return nf0.format(v);
    },
    usd: v => v == null ? "–" : "$" + fmt.compact(v),
    gbp: v => v == null ? "–" : "£" + fmt.compact(v),
    pct: (v, d = 1) => v == null || isNaN(v) ? "–" : v.toFixed(d) + "%",
    signedPct: (v, d = 1) => v == null || isNaN(v) || !isFinite(v) ? "–" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(d) + "%",
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- color ramps ----------
  function hex2rgb(h) { h = h.replace("#", ""); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }
  function rgb2hex(c) { return "#" + c.map(x => Math.round(x).toString(16).padStart(2, "0")).join(""); }
  function mix(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((x, i) => x + (B[i] - x) * t)); }
  function rampAt(stops, t) {
    t = Math.max(0, Math.min(1, t));
    const p = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(p));
    return mix(stops[i], stops[i + 1], p - i);
  }
  // low values recede toward the surface: light->dark on the light theme, dark->bright on the dark theme
  const seqStops = () => {
    const s = ["--seq-100", "--seq-200", "--seq-300", "--seq-400", "--seq-500", "--seq-600", "--seq-700"].map(css);
    return isDark() ? s.reverse() : s;
  };
  const divStops = () => [css("--div-neg"), css("--div-mid"), css("--div-pos")];
  function inkFor(bg) { const [r, g, b] = hex2rgb(bg); const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; return L > 0.55 ? "#0b0b0b" : "#ffffff"; }

  // ---------- floating tooltip (tile map, tables) ----------
  let tipEl;
  function tip() { if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "tip"; document.body.appendChild(tipEl); } return tipEl; }
  function showTip(x, y, title, rows) {
    const t = tip();
    t.textContent = "";
    const h = document.createElement("div"); h.className = "t"; h.textContent = title; t.appendChild(h);
    rows.forEach(([label, value, color]) => {
      const r = document.createElement("div"); r.className = "r";
      const em = document.createElement("em");
      if (color) { const i = document.createElement("i"); i.style.background = color; em.appendChild(i); }
      em.appendChild(document.createTextNode(label));
      const b = document.createElement("b"); b.textContent = value;
      r.appendChild(em); r.appendChild(b); t.appendChild(r);
    });
    t.style.opacity = 1;
    const w = t.offsetWidth, hgt = t.offsetHeight;
    let left = x + 14, top = y + 14;
    if (left + w > window.innerWidth - 8) left = x - w - 14;
    if (top + hgt > window.innerHeight - 8) top = y - hgt - 14;
    t.style.left = Math.max(8, left) + "px"; t.style.top = Math.max(8, top) + "px";
  }
  function hideTip() { if (tipEl) tipEl.style.opacity = 0; }

  // ---------- ECharts ----------
  const charts = [];
  function base() {
    return {
      animation: false,
      textStyle: { fontFamily: css("--font"), color: css("--ink-2") },
      grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
      tooltip: {
        trigger: "axis", confine: true,
        backgroundColor: css("--surface-1"), borderColor: css("--ink"), borderWidth: 1.5,
        padding: [8, 10], textStyle: { color: css("--ink"), fontSize: 12.5, fontFamily: css("--font") },
        extraCssText: "border-radius:0;box-shadow:4px 4px 0 " + css("--surface-2") + ";",
        axisPointer: { type: "line", lineStyle: { color: css("--axis"), width: 1 }, shadowStyle: { color: "rgba(127,127,127,0.08)" } },
      },
    };
  }
  function catAxis(data, extra = {}) {
    return Object.assign({
      type: "category", data,
      axisLine: { lineStyle: { color: css("--axis") } }, axisTick: { show: false },
      axisLabel: { color: css("--muted"), fontSize: 11.5, hideOverlap: true },
    }, extra);
  }
  function valAxis(formatter, extra = {}) {
    return Object.assign({
      type: "value", splitNumber: 4,
      axisLine: { show: false }, axisTick: { show: false },
      splitLine: { lineStyle: { color: css("--grid"), width: 1, type: "solid" } },
      axisLabel: { color: css("--muted"), fontSize: 11.5, formatter },
    }, extra);
  }
  // tooltip body: value strong, name secondary, short line key
  function axisTip(valueFmt, opts = {}) {
    return params => {
      const ps = Array.isArray(params) ? params : [params];
      if (!ps.length) return "";
      const title = opts.title ? opts.title(ps[0]) : ps[0].axisValueLabel || ps[0].name;
      let html = '<div style="color:' + css("--ink-2") + ';font-size:12px;margin-bottom:4px">' + esc(title) + "</div>";
      const rows = opts.reverse ? ps.slice().reverse() : ps;
      rows.forEach(p => {
        if (p.value == null || p.value === "-") return;
        const v = Array.isArray(p.value) ? p.value[opts.valueIndex || 1] : p.value;
        html += '<div style="display:flex;justify-content:space-between;gap:16px;align-items:center">' +
          '<span style="color:' + css("--ink-2") + ';display:inline-flex;align-items:center;gap:6px">' +
          '<i style="display:inline-block;width:12px;height:2px;border-radius:1px;background:' + (p.color || css("--s1")) + '"></i>' + esc(p.seriesName) + "</span>" +
          '<b style="font-weight:600;font-variant-numeric:tabular-nums">' + esc(valueFmt(v, p)) + "</b></div>";
      });
      if (opts.footer) html += '<div style="border-top:1px solid ' + css("--grid") + ';margin-top:5px;padding-top:4px;display:flex;justify-content:space-between;gap:16px"><span style="color:' + css("--ink-2") + '">' + esc(opts.footer.label) + "</span><b>" + esc(opts.footer.value(ps)) + "</b></div>";
      return html;
    };
  }
  function register(el, build) {
    if (typeof el === "string") el = document.getElementById(el);
    const inst = { el, build, chart: null };
    charts.push(inst);
    render(inst);
    return inst;
  }
  function render(inst) {
    if (!window.echarts) return;
    if (inst.chart) inst.chart.dispose();
    inst.chart = echarts.init(inst.el, null, { renderer: "svg" });
    inst.chart.setOption(inst.build(), true);
  }
  function update(inst) { if (inst.chart) inst.chart.setOption(inst.build(), true); }
  function rerenderAll() { charts.forEach(render); rerenderHooks.forEach(f => f()); }
  const rerenderHooks = [];
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => charts.forEach(c => c.chart && c.chart.resize()), 120); });

  // stacked column helper: 2px surface gap between segments, rounded top on last visible series only
  function stackedBars(names, dataBy, colors, opts = {}) {
    const surf = css("--surface-1");
    return names.map((n, i) => ({
      name: n, type: "bar", stack: opts.stack || "s", data: dataBy[i], barMaxWidth: opts.barMaxWidth || 24,
      barCategoryGap: opts.gap || "35%",
      itemStyle: { color: colors[i], borderColor: surf, borderWidth: opts.borderWidth == null ? 1 : opts.borderWidth, borderRadius: i === names.length - 1 ? [4, 4, 0, 0] : 0 },
      emphasis: { focus: "series" },
    }));
  }

  // ---------- tile grid map ----------
  const TILES = {
    AK: [0, 0], ME: [11, 0], VT: [10, 1], NH: [11, 1],
    WA: [1, 2], ID: [2, 2], MT: [3, 2], ND: [4, 2], MN: [5, 2], IL: [6, 2], WI: [7, 2], MI: [8, 2], NY: [9, 2], RI: [10, 2], MA: [11, 2],
    OR: [1, 3], NV: [2, 3], WY: [3, 3], SD: [4, 3], IA: [5, 3], IN: [6, 3], OH: [7, 3], PA: [8, 3], NJ: [9, 3], CT: [10, 3],
    CA: [1, 4], UT: [2, 4], CO: [3, 4], NE: [4, 4], MO: [5, 4], KY: [6, 4], WV: [7, 4], VA: [8, 4], MD: [9, 4], DE: [10, 4],
    AZ: [2, 5], NM: [3, 5], KS: [4, 5], AR: [5, 5], TN: [6, 5], NC: [7, 5], SC: [8, 5], DC: [9, 5],
    OK: [4, 6], LA: [5, 6], MS: [6, 6], AL: [7, 6], GA: [8, 6],
    HI: [0, 7], TX: [4, 7], FL: [9, 7],
  };
  // opts: {values:{ST:number}, color:(v)=>hex, tipRows:(st)=>[[label,value]], title:(st)=>string, onClick, selected}
  function tileMap(container, opts) {
    container.textContent = "";
    container.classList.add("tilemap");
    container.style.gridTemplateRows = "repeat(8, auto)";
    Object.entries(TILES).forEach(([st, [c, r]]) => {
      const b = document.createElement("button");
      b.className = "tile" + (opts.selected === st ? " sel" : "");
      b.style.gridColumn = c + 1; b.style.gridRow = r + 1;
      const v = opts.values[st];
      const bg = v == null ? css("--surface-2") : opts.color(v);
      b.style.background = bg; b.style.color = inkFor(bg.startsWith("#") ? bg : "#888888");
      b.textContent = st;
      b.setAttribute("aria-label", opts.title(st) + ": " + opts.tipRows(st).map(r => r[0] + " " + r[1]).join(", "));
      const show = e => { const rc = b.getBoundingClientRect(); showTip(e && e.clientX != null ? e.clientX : rc.right, e && e.clientY != null ? e.clientY : rc.bottom, opts.title(st), opts.tipRows(st)); };
      b.addEventListener("pointermove", show); b.addEventListener("pointerleave", hideTip);
      b.addEventListener("focus", () => show(null)); b.addEventListener("blur", hideTip);
      if (opts.onClick) b.addEventListener("click", () => opts.onClick(st));
      container.appendChild(b);
    });
  }

  // ---------- sortable table ----------
  // cols: [{key,label,fmt?,txt?,bar?}] rows: [{...}]
  function table(container, cols, rows, opts = {}) {
    let sortKey = opts.sortKey || cols[1].key, dir = opts.dir || -1;
    function draw() {
      const sorted = rows.slice().sort((a, b) => {
        const x = a[sortKey], y = b[sortKey];
        if (typeof x === "string") return dir * x.localeCompare(y);
        return dir * ((x == null ? -Infinity : x) - (y == null ? -Infinity : y));
      });
      const max = {};
      cols.filter(c => c.bar).forEach(c => { max[c.key] = Math.max(...rows.map(r => r[c.key] || 0)); });
      const t = document.createElement("table"); t.className = "data";
      const thead = t.createTHead().insertRow();
      cols.forEach(c => {
        const th = document.createElement("th"); th.textContent = c.label; if (c.txt) th.className = "txt";
        th.setAttribute("scope", "col"); th.tabIndex = 0;
        if (c.key === sortKey) th.setAttribute("aria-sort", dir < 0 ? "descending" : "ascending");
        const sortBy = () => { if (sortKey === c.key) dir = -dir; else { sortKey = c.key; dir = c.txt ? 1 : -1; } draw(); };
        th.addEventListener("click", sortBy);
        th.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sortBy(); } });
        thead.appendChild(th);
      });
      const tb = t.createTBody();
      sorted.forEach(r => {
        const tr = tb.insertRow();
        if (opts.selected && opts.selected(r)) tr.className = "sel";
        if (opts.onRow) { tr.style.cursor = "pointer"; tr.addEventListener("click", () => opts.onRow(r)); }
        cols.forEach(c => {
          const td = tr.insertCell();
          if (c.txt) td.className = "txt";
          const val = c.fmt ? c.fmt(r[c.key], r) : r[c.key];
          if (c.render) { td.appendChild(c.render(r)); }
          else if (c.bar) {
            const wrap = document.createElement("div"); wrap.className = "bar-cell";
            const s = document.createElement("span"); s.textContent = val;
            const i = document.createElement("i"); i.style.width = Math.max(2, (r[c.key] || 0) / (max[c.key] || 1) * 80) + "px";
            wrap.appendChild(s); wrap.appendChild(i); td.appendChild(wrap);
          } else td.textContent = val;
        });
      });
      container.textContent = ""; container.appendChild(t);
    }
    draw();
  }

  // panel "Table" toggle buttons: <button class="tbl-btn" data-panel="id">
  document.addEventListener("click", e => {
    const b = e.target.closest(".tbl-btn[data-panel]");
    if (!b) return;
    const p = document.getElementById(b.dataset.panel);
    const on = !p.classList.contains("show-table");
    p.classList.toggle("show-table", on);
    b.setAttribute("aria-pressed", on);
    b.textContent = on ? "Chart" : "Table";
    if (!on) charts.forEach(c => { if (p.contains(c.el) && c.chart) c.chart.resize(); });
  });

  // legend builder (always shown for 2+ series)
  function legend(el, items, kind = "box") {
    if (typeof el === "string") el = document.getElementById(el);
    el.textContent = ""; el.className = "legend";
    items.forEach(([name, color]) => {
      const s = document.createElement("span"); const i = document.createElement("i");
      if (kind === "line") i.className = "line";
      i.style.background = color; s.appendChild(i); s.appendChild(document.createTextNode(name)); el.appendChild(s);
    });
  }

  // number exhibits and add source lines on report pages (<body data-source="...">)
  document.addEventListener("DOMContentLoaded", () => {
    const src = document.body.dataset.source;
    if (!src) return;
    let n = 0;
    document.querySelectorAll("main .panel").forEach(p => {
      const h = p.querySelector(".panel-head h3");
      if (!h || p.hasAttribute("data-no-exhibit")) return;
      n++;
      const lab = document.createElement("p"); lab.className = "exhibit-no"; lab.textContent = "Exhibit " + n;
      h.parentNode.insertBefore(lab, h);
      const s = document.createElement("p"); s.className = "source"; s.textContent = "Source: " + (p.dataset.source || src);
      p.appendChild(s);
    });
  });

  window.V = { css, series, fmt, esc, mix, rampAt, seqStops, divStops, inkFor, showTip, hideTip, base, catAxis, valAxis, axisTip,
    register, update, render, rerenderAll, rerenderHooks, stackedBars, tileMap, table, legend, isDark };
})();
