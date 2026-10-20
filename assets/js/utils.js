/* Utilitários: formatação, datas, ícones e helpers de DOM. */
window.App = window.App || {};
(function (A) {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  /* ---------- Números ---------- */
  const fmtCache = {};
  function currencyFmt(code, compact) {
    const k = code + (compact ? ':c' : '');
    if (!fmtCache[k]) {
      fmtCache[k] = new Intl.NumberFormat('pt-BR', compact
        ? { style: 'currency', currency: code, notation: 'compact', maximumFractionDigits: 1 }
        : { style: 'currency', currency: code });
    }
    return fmtCache[k];
  }
  const currency = () => (A.store && A.store.state.settings.currency) || 'BRL';
  const money = (v) => currencyFmt(currency()).format(Number(v) || 0);
  const moneyShort = (v) => {
    const n = Number(v) || 0;
    return Math.abs(n) >= 10000 ? currencyFmt(currency(), true).format(n) : money(n);
  };
  const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : 0)
    .toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (ratio, d = 1) => (Number.isFinite(ratio) ? (ratio * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%' : '—');
  const ratioX = (r) => (Number.isFinite(r) ? r.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'x' : '—');
  const div = (a, b) => (b ? a / b : NaN);
  const orDash = (v, f) => (Number.isFinite(v) ? f(v) : '—');

  /** Aceita "1.234,56", "1234,56", "1234.56", "R$ 10". */
  function parseNum(v) {
    if (typeof v === 'number') return v;
    let s = String(v == null ? '' : v).trim().replace(/[^\d,.\-]/g, '');
    if (!s) return 0;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }
  /** Formata número para exibir dentro de um input (pt-BR, sem símbolo). */
  const toInput = (v, d = 2) => (v === '' || v == null || !Number(v) ? '' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d }));

  /* ---------- Datas (sempre 'YYYY-MM-DD' no fuso local) ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const today = () => iso(new Date());
  const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
  const addMonths = (s, n) => {
    const d = parseISO(s); const day = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + n);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return iso(d);
  };
  const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
  const startOfMonth = (s) => s.slice(0, 8) + '01';
  const endOfMonth = (s) => { const d = parseISO(s); return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };
  const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MONTHS_FULL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const fmtDate = (s) => (s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '—');
  const fmtDay = (s) => (s ? s.slice(8, 10) + '/' + s.slice(5, 7) : '');
  const fmtMonth = (s) => MONTHS[Number(s.slice(5, 7)) - 1] + '/' + s.slice(2, 4);
  const monthName = (s) => MONTHS_FULL[Number(s.slice(5, 7)) - 1] + ' de ' + s.slice(0, 4);
  const weekday = (s) => ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][parseISO(s).getDay()];
  function relDays(s) {
    if (!s) return '';
    const d = daysBetween(s, today());
    if (d === 0) return 'hoje';
    if (d === 1) return 'ontem';
    if (d < 0) return 'em ' + (-d) + 'd';
    if (d < 30) return 'há ' + d + 'd';
    if (d < 365) return 'há ' + Math.floor(d / 30) + ' mês' + (d >= 60 ? 'es' : '');
    return 'há ' + Math.floor(d / 365) + 'a';
  }

  /* ---------- Períodos ---------- */
  const PERIODS = [
    ['today', 'Hoje'], ['yesterday', 'Ontem'], ['7d', 'Últimos 7 dias'], ['14d', 'Últimos 14 dias'],
    ['30d', 'Últimos 30 dias'], ['90d', 'Últimos 90 dias'], ['month', 'Este mês'], ['lastMonth', 'Mês passado'],
    ['year', 'Este ano'], ['all', 'Todo o período'], ['custom', 'Personalizado…'],
  ];
  function rangeFor(p) {
    const t = today();
    switch (p.preset) {
      case 'today': return { from: t, to: t };
      case 'yesterday': { const y = addDays(t, -1); return { from: y, to: y }; }
      case '7d': return { from: addDays(t, -6), to: t };
      case '14d': return { from: addDays(t, -13), to: t };
      case '30d': return { from: addDays(t, -29), to: t };
      case '90d': return { from: addDays(t, -89), to: t };
      case 'month': return { from: startOfMonth(t), to: t };
      case 'lastMonth': { const lm = addMonths(startOfMonth(t), -1); return { from: lm, to: endOfMonth(lm) }; }
      case 'year': return { from: t.slice(0, 4) + '-01-01', to: t };
      case 'custom': return { from: p.from || t, to: p.to || t };
      default: return { from: null, to: null };
    }
  }
  function previousRange(r) {
    if (!r.from || !r.to) return null;
    const len = daysBetween(r.from, r.to) + 1;
    return { from: addDays(r.from, -len), to: addDays(r.from, -1) };
  }
  const inRange = (d, r) => !!d && (!r || ((!r.from || d >= r.from) && (!r.to || d <= r.to)));
  function rangeLabel(p) {
    if (p.preset === 'custom') { const r = rangeFor(p); return fmtDate(r.from) + ' – ' + fmtDate(r.to); }
    return (PERIODS.find((x) => x[0] === p.preset) || PERIODS[9])[1];
  }

  /* ---------- DOM ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  function on(root, event, selector, handler) {
    root.addEventListener(event, (e) => {
      const el = e.target.closest(selector);
      if (el && root.contains(el)) handler(e, el);
    });
  }
  function download(filename, content, type) {
    const blob = new Blob([content], { type: type || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function toCSV(rows) {
    const cell = (v) => {
      const s = v == null ? '' : String(v);
      return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\n');
  }
  const csvNum = (v) => (Number(v) || 0).toFixed(2).replace('.', ',');
  const safeUrl = (u) => {
    if (!u) return '';
    const s = String(u).trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (/^[\w.-]+\.[a-z]{2,}/i.test(s)) return 'https://' + s;
    return '';
  };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  /* ---------- Ícones (traço 2px, estilo lucide) ---------- */
  const P = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    package: '<path d="M16.5 9.4 7.5 4.2"/><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    wallet: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    dollar: '<path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
    percent: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    refund: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    columns: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    play: '<path d="m6 3 14 9-14 9V3z"/>',
    arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
  };
  const icon = (name, cls) => '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || '') + '</svg>';

  Object.assign(A, {
    esc, uid, money, moneyShort, num, pct, ratioX, div, orDash, parseNum, toInput,
    iso, parseISO, today, addDays, addMonths, daysBetween, startOfMonth, endOfMonth,
    fmtDate, fmtDay, fmtMonth, monthName, weekday, relDays,
    PERIODS, rangeFor, previousRange, inRange, rangeLabel,
    $, $$, on, download, toCSV, csvNum, safeUrl, debounce, norm, icon,
  });
})(window.App);
