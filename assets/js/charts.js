/* Gráficos em SVG puro (sem dependências), com tooltip ao passar o mouse. */
(function (A) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const color = (slot) => 'var(--s' + (((Number(slot) || 1) - 1) % 8 + 1) + ')';

  /* ---------- Tooltip compartilhado ---------- */
  const tip = {
    el: null,
    show(html, x, y) {
      if (!this.el) this.el = document.getElementById('tooltip');
      this.el.innerHTML = html;
      this.el.classList.add('show');
      const r = this.el.getBoundingClientRect();
      let left = x + 14, top = y + 14;
      if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
      if (top + r.height > window.innerHeight - 8) top = y - r.height - 14;
      this.el.style.left = Math.max(8, left) + 'px';
      this.el.style.top = Math.max(8, top) + 'px';
    },
    hide() { if (this.el) this.el.classList.remove('show'); },
  };
  const ttRow = (c, label, value) => '<div class="tt-row"><span>' + (c ? '<i style="background:' + c + '"></i>' : '') + A.esc(label) + '</span><b>' + value + '</b></div>';

  /* ---------- Escala "bonita" ---------- */
  function niceScale(min, max, count) {
    if (min === max) { max = min + 1; }
    const span = max - min;
    const step0 = span / Math.max(1, count);
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const norm = step0 / mag;
    const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    return { lo, hi, ticks };
  }
  const el = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };

  /**
   * Gráfico de linhas com crosshair.
   * opts: { points:[{label, title, values:{key:num}}], series:[{key,name,color}], format, height }
   */
  function line(container, opts) {
    const W = Math.max(280, container.clientWidth || 600);
    const H = opts.height || 260;
    const pad = { t: 12, r: 12, b: 26, l: 64 };
    const pts = opts.points;
    const fmt = opts.format || A.money;
    const fmtTick = opts.formatTick || A.moneyShort;
    container.innerHTML = '';
    container.classList.add('chart');
    if (!pts.length) { container.innerHTML = '<div class="muted small">Sem dados no período.</div>'; return; }

    let min = 0, max = 0;
    pts.forEach((p) => opts.series.forEach((s) => { const v = p.values[s.key] || 0; if (v < min) min = v; if (v > max) max = v; }));
    const sc = niceScale(min, max, 4);
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const x = (i) => pad.l + (pts.length === 1 ? iw / 2 : (i / (pts.length - 1)) * iw);
    const y = (v) => pad.t + ih - ((v - sc.lo) / (sc.hi - sc.lo)) * ih;

    const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': opts.label || 'Gráfico' });
    sc.ticks.forEach((t) => {
      svg.appendChild(el('line', { x1: pad.l, x2: W - pad.r, y1: y(t), y2: y(t), class: t === 0 ? 'baseline' : 'gridline' }));
      const tx = el('text', { x: pad.l - 8, y: y(t) + 4, 'text-anchor': 'end', class: 'tick' });
      tx.textContent = fmtTick(t);
      svg.appendChild(tx);
    });
    const every = Math.max(1, Math.ceil(pts.length / Math.max(2, Math.floor(iw / 70))));
    pts.forEach((p, i) => {
      if (i % every !== 0 && i !== pts.length - 1) return;
      if (i === pts.length - 1 && i % every !== 0 && (pts.length - 1) % every < every / 2) return;
      const tx = el('text', { x: x(i), y: H - 6, 'text-anchor': 'middle', class: 'tick' });
      tx.textContent = p.label;
      svg.appendChild(tx);
    });
    opts.series.forEach((s) => {
      const d = pts.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.values[s.key] || 0).toFixed(1)).join(' ');
      if (s.area) {
        const area = d + ' L' + x(pts.length - 1).toFixed(1) + ' ' + y(Math.max(sc.lo, 0)) + ' L' + x(0).toFixed(1) + ' ' + y(Math.max(sc.lo, 0)) + ' Z';
        svg.appendChild(el('path', { d: area, fill: s.color, opacity: 0.08 }));
      }
      svg.appendChild(el('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': s.dash ? '5 4' : '' }));
      if (pts.length <= 1) svg.appendChild(el('circle', { cx: x(0), cy: y(pts[0].values[s.key] || 0), r: 4, fill: s.color }));
    });

    const cross = el('line', { y1: pad.t, y2: pad.t + ih, class: 'crosshair', visibility: 'hidden' });
    svg.appendChild(cross);
    const dots = opts.series.map((s) => { const c = el('circle', { r: 4.5, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2, visibility: 'hidden' }); svg.appendChild(c); return c; });
    const hit = el('rect', { x: pad.l, y: pad.t, width: iw, height: ih, fill: 'transparent' });
    svg.appendChild(hit);
    const move = (e) => {
      const rect = svg.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * W;
      const i = Math.max(0, Math.min(pts.length - 1, Math.round(((mx - pad.l) / iw) * (pts.length - 1))));
      const p = pts[i];
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
      opts.series.forEach((s, k) => { dots[k].setAttribute('cx', x(i)); dots[k].setAttribute('cy', y(p.values[s.key] || 0)); dots[k].setAttribute('visibility', 'visible'); });
      let html = '<div class="tt-title">' + A.esc(p.title || p.label) + '</div>';
      opts.series.forEach((s) => { html += ttRow(s.color, s.name, fmt(p.values[s.key] || 0)); });
      if (opts.extraTip) html += opts.extraTip(p);
      tip.show(html, e.clientX, e.clientY);
    };
    hit.addEventListener('mousemove', move);
    hit.addEventListener('mouseleave', () => { tip.hide(); cross.setAttribute('visibility', 'hidden'); dots.forEach((d) => d.setAttribute('visibility', 'hidden')); });
    container.appendChild(svg);
  }

  /**
   * Barras horizontais (aceita negativos).
   * opts: { items:[{label, value, color, tip}], format }
   */
  function hbar(container, opts) {
    const items = opts.items;
    const W = Math.max(260, container.clientWidth || 400);
    const rowH = 30, gap = 8, labelW = Math.min(170, W * 0.38), valueW = 86;
    const H = items.length * (rowH + gap);
    const fmt = opts.format || A.money;
    container.innerHTML = '';
    container.classList.add('chart');
    if (!items.length) { container.innerHTML = '<div class="muted small">Sem dados no período.</div>'; return; }
    let min = 0, max = 0;
    items.forEach((it) => { if (it.value < min) min = it.value; if (it.value > max) max = it.value; });
    if (min === max) max = 1;
    const x0 = labelW + 8, x1 = W - valueW;
    const sx = (v) => x0 + ((v - min) / (max - min)) * (x1 - x0);
    const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': opts.label || 'Gráfico de barras' });
    if (min < 0) svg.appendChild(el('line', { x1: sx(0), x2: sx(0), y1: 0, y2: H - gap, class: 'baseline' }));
    items.forEach((it, i) => {
      const yy = i * (rowH + gap);
      const lb = el('text', { x: 0, y: yy + rowH / 2 + 4, class: 'bar-label' });
      const maxChars = Math.floor(labelW / 6.2);
      lb.textContent = it.label.length > maxChars ? it.label.slice(0, maxChars - 1) + '…' : it.label;
      svg.appendChild(lb);
      const a = sx(Math.min(0, it.value)), b = sx(Math.max(0, it.value));
      const w = Math.max(2, b - a);
      const r = Math.min(4, w / 2);
      const bh = rowH - 8, by = yy + 4;
      // cantos arredondados apenas na ponta do dado
      const d = it.value >= 0
        ? 'M' + a + ' ' + by + ' H' + (a + w - r) + ' Q' + (a + w) + ' ' + by + ' ' + (a + w) + ' ' + (by + r) + ' V' + (by + bh - r) + ' Q' + (a + w) + ' ' + (by + bh) + ' ' + (a + w - r) + ' ' + (by + bh) + ' H' + a + ' Z'
        : 'M' + b + ' ' + by + ' H' + (a + r) + ' Q' + a + ' ' + by + ' ' + a + ' ' + (by + r) + ' V' + (by + bh - r) + ' Q' + a + ' ' + (by + bh) + ' ' + (a + r) + ' ' + (by + bh) + ' H' + b + ' Z';
      svg.appendChild(el('path', { d, fill: it.color || color(1) }));
      const vt = el('text', { x: W, y: yy + rowH / 2 + 4, 'text-anchor': 'end', class: 'bar-value' });
      vt.textContent = (opts.formatShort || A.moneyShort)(it.value);
      svg.appendChild(vt);
      const hit = el('rect', { x: 0, y: yy, width: W, height: rowH, fill: 'transparent' });
      hit.addEventListener('mousemove', (e) => tip.show('<div class="tt-title">' + A.esc(it.label) + '</div>' + (it.tip || ttRow(it.color, opts.valueName || 'Valor', fmt(it.value))), e.clientX, e.clientY));
      hit.addEventListener('mouseleave', () => tip.hide());
      if (it.onClick) { hit.style.cursor = 'pointer'; hit.addEventListener('click', it.onClick); }
      svg.appendChild(hit);
    });
    container.appendChild(svg);
  }

  /** Mini linha (sparkline) — retorna string SVG. */
  function sparkline(values, opts) {
    opts = opts || {};
    const W = opts.width || 90, H = opts.height || 26;
    if (!values.length) return '';
    let min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    if (min === max) { min -= 1; max += 1; }
    const x = (i) => (values.length === 1 ? W / 2 : (i / (values.length - 1)) * (W - 4) + 2);
    const y = (v) => H - 3 - ((v - min) / (max - min)) * (H - 6);
    const d = values.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
    const last = values.length - 1;
    return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><path d="' + d + '" fill="none" stroke="' + (opts.color || 'var(--accent)') + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="' + x(last) + '" cy="' + y(values[last]) + '" r="2.5" fill="' + (opts.color || 'var(--accent)') + '"/></svg>';
  }

  const compact = (v) => { const a = Math.abs(v), s = v < 0 ? '−' : ''; return s + (a >= 1000 ? (a / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k' : Math.round(a)); };

  /** Calendário mensal com lucro diário (escala divergente azul ↔ vermelho). */
  function calendar(container, opts) {
    const month = opts.month; // 'YYYY-MM-01'
    const values = opts.values; // { 'YYYY-MM-DD': number }
    const first = A.parseISO(month);
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const offset = (first.getDay() + 6) % 7; // semana começa na segunda
    let maxAbs = 0;
    Object.values(values).forEach((v) => { if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v); });
    const step = (v) => {
      if (!v || !maxAbs) return null;
      const k = Math.min(4, Math.max(1, Math.ceil((Math.abs(v) / maxAbs) * 4)));
      return (v > 0 ? 'pos-' : 'neg-') + k;
    };
    const t = A.today();
    let html = '<div class="cal">' + ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((d) => '<div class="dow">' + d + '</div>').join('');
    for (let i = 0; i < offset; i++) html += '<div class="day out"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const date = month.slice(0, 8) + String(d).padStart(2, '0');
      const v = values[date];
      const s = date > t ? null : step(v);
      const ink = s ? (Number(s.slice(-1)) >= 3 ? 'ink-hi' : 'ink-lo') : '';
      const bg = s ? 'background:var(--div-' + s + ')' : '';
      const has = date <= t && v !== undefined;
      html += '<div class="day ' + ink + (date === t ? ' today' : '') + '" style="' + bg + '" data-date="' + date + '" data-v="' + (has ? v : '') + '"><span>' + d + '</span>' + (has && v ? '<b>' + compact(v) + '</b>' : '') + '</div>';
    }
    html += '</div><div class="cal-legend">Prejuízo <i style="background:var(--div-neg-4)"></i><i style="background:var(--div-neg-2)"></i><i style="background:var(--div-mid)"></i><i style="background:var(--div-pos-2)"></i><i style="background:var(--div-pos-4)"></i> Lucro</div>';
    container.innerHTML = html;
    container.querySelectorAll('.day[data-date]').forEach((d) => {
      d.addEventListener('mousemove', (e) => {
        const v = d.dataset.v;
        const extra = opts.tip ? opts.tip(d.dataset.date) : '';
        tip.show('<div class="tt-title">' + A.weekday(d.dataset.date) + ', ' + A.fmtDate(d.dataset.date) + '</div>' + (v === '' ? '<div class="muted">Sem registros</div>' : ttRow('', 'Lucro', A.money(Number(v))) + extra), e.clientX, e.clientY);
      });
      d.addEventListener('mouseleave', () => tip.hide());
    });
  }

  A.charts = { line, hbar, sparkline, calendar, color, tip, ttRow };
})(window.App);
