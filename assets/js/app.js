/* Roteador, navegação, período, tema e atalhos. */
(function (A) {
  'use strict';
  const { esc, icon } = A;

  const ROUTES = [
    { path: 'dashboard', page: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: 'campanhas', page: 'campaigns', label: 'Campanhas', icon: 'megaphone', count: () => A.store.state.campaigns.filter((c) => c.status === 'active' || c.status === 'testing').length },
    { path: 'ofertas', page: 'offers', label: 'Minhas ofertas', icon: 'package', count: () => A.store.state.offers.filter((o) => o.status !== 'archived').length },
    { path: 'espionagem', page: 'spy', label: 'Espionagem', icon: 'eye', count: () => A.store.state.spy.filter((s) => s.status !== 'discarded' && s.status !== 'modeled').length },
    { path: 'vendas', page: 'sales', label: 'Vendas', icon: 'cart' },
    { path: 'custos', page: 'costs', label: 'Custos extras', icon: 'wallet' },
    { path: 'config', page: 'settings', label: 'Configurações', icon: 'settings' },
  ];

  const viewRoot = document.getElementById('view');
  let current = { route: ROUTES[0], params: [] };

  function parseHash() {
    const parts = (location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    const route = ROUTES.find((r) => r.path === parts[0]) || ROUTES[0];
    return { route, params: parts.slice(1) };
  }

  function renderNav() {
    const nav = document.getElementById('nav');
    nav.innerHTML = '<div class="nav-section">Operação</div>' + ROUTES.map((r, i) => {
      const n = r.count ? r.count() : 0;
      return (i === 4 ? '<div class="nav-section">Financeiro</div>' : '') + (i === 6 ? '<div class="nav-section">Sistema</div>' : '') +
        '<a href="#/' + r.path + '" class="' + (current.route === r ? 'active' : '') + '">' + icon(r.icon) + '<span>' + esc(r.label) + '</span>' + (n ? '<span class="count">' + n + '</span>' : '') + '</a>';
    }).join('');
    const st = A.store.state.settings;
    document.getElementById('brandSub').textContent = st.name || 'Uso pessoal · sem tracking';
    const lb = st.lastBackup;
    const days = lb ? A.daysBetween(lb.slice(0, 10), A.today()) : null;
    const status = document.getElementById('saveStatus');
    if (A.lastSaveError) status.innerHTML = '<span class="neg">Erro ao salvar!</span>';
    else if (!A.store.isEmpty() && (days === null || days > 7)) status.innerHTML = '<a href="#/config">' + (days === null ? 'Faça seu 1º backup' : 'Backup há ' + days + ' dias') + '</a>';
    else status.textContent = 'Salvo neste navegador';
  }

  function renderPeriod() {
    const box = document.getElementById('periodPicker');
    const page = A.pages[current.route.page];
    if (!page.period) { box.innerHTML = ''; return; }
    const p = A.store.ui.period;
    const r = A.rangeFor(p);
    box.innerHTML = '<select class="input input-sm" id="periodSel" aria-label="Período">' + A.PERIODS.map(([k, l]) => '<option value="' + k + '"' + (p.preset === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>' +
      (p.preset === 'custom' ? '<input type="date" class="input input-sm" id="pFrom" value="' + r.from + '"><input type="date" class="input input-sm" id="pTo" value="' + r.to + '">' : '');
    document.getElementById('periodSel').addEventListener('change', (e) => {
      const np = { preset: e.target.value };
      if (np.preset === 'custom') { const cr = A.rangeFor(p.preset === 'all' ? { preset: '30d' } : p); np.from = cr.from; np.to = cr.to; }
      A.store.setUI({ period: np });
      refresh();
    });
    if (p.preset === 'custom') {
      const upd = () => {
        let from = document.getElementById('pFrom').value, to = document.getElementById('pTo').value;
        if (!from || !to) return;
        if (from > to) [from, to] = [to, from];
        A.store.setUI({ period: { preset: 'custom', from, to } });
        refresh();
      };
      document.getElementById('pFrom').addEventListener('change', upd);
      document.getElementById('pTo').addEventListener('change', upd);
    }
  }

  function setTitle(t) {
    document.getElementById('pageTitle').textContent = t;
    document.title = t + ' · Gestor de Campanhas';
  }

  /** Re-renderiza a página atual num container novo (evita listeners duplicados). */
  function refresh() {
    current = parseHash();
    const page = A.pages[current.route.page];
    const scroll = window.scrollY;
    const samePage = viewRoot.dataset.route === current.route.path + '/' + current.params.join('/');
    const v = document.createElement('div');
    viewRoot.replaceChildren(v);
    viewRoot.dataset.route = current.route.path + '/' + current.params.join('/');
    setTitle(page.title);
    renderNav();
    renderPeriod();
    try {
      page.render(v, current.params);
    } catch (e) {
      console.error(e);
      v.innerHTML = '<div class="card"><div class="empty"><h3>Algo deu errado ao abrir esta página</h3><p class="muted">' + esc(e.message) + '</p></div></div>';
    }
    window.scrollTo(0, samePage ? scroll : 0);
    A.charts.tip.hide();
  }

  function applyTheme() {
    const t = A.store.state.settings.theme;
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
    const next = { system: ['sun', 'Tema: automático'], light: ['sun', 'Tema: claro'], dark: ['moon', 'Tema: escuro'] }[t] || ['monitor', 'Tema'];
    document.getElementById('themeToggle').innerHTML = icon(next[0]) + '<span>' + next[1] + '</span>';
  }

  function init() {
    applyTheme();
    document.getElementById('menuBtn').innerHTML = icon('menu');
    document.getElementById('quickAdd').innerHTML = icon('zap') + '<span>Lançamento do dia</span>';
    document.getElementById('quickAdd').addEventListener('click', () => A.pages.campaigns.quickEntry());
    document.getElementById('themeToggle').addEventListener('click', () => {
      const order = ['system', 'light', 'dark'];
      const t = A.store.state.settings.theme;
      A.store.setSettings({ theme: order[(order.indexOf(t) + 1) % 3] });
      applyTheme();
    });
    const sidebar = document.getElementById('sidebar');
    document.getElementById('menuBtn').addEventListener('click', (e) => { e.stopPropagation(); sidebar.classList.toggle('open'); });
    document.addEventListener('click', (e) => { if (sidebar.classList.contains('open') && !sidebar.contains(e.target)) sidebar.classList.remove('open'); });
    sidebar.addEventListener('click', (e) => { if (e.target.closest('a')) sidebar.classList.remove('open'); });

    window.addEventListener('hashchange', refresh);
    A.store.subscribe(A.debounce(refresh, 10));
    let w = window.innerWidth;
    window.addEventListener('resize', A.debounce(() => { if (Math.abs(window.innerWidth - w) > 40) { w = window.innerWidth; refresh(); } }, 200));
    window.addEventListener('storage', (e) => { if (e.key === 'gestor-campanhas:v1') location.reload(); });

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || A.ui.hasModal()) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
      const k = e.key.toLowerCase();
      if (k === 'n') { e.preventDefault(); A.pages.campaigns.quickEntry(); }
      else if (k === 'v') { e.preventDefault(); A.pages.sales.edit(); }
      else if (k === 'e') { e.preventDefault(); A.pages.spy.open(); }
      else if (/^[1-7]$/.test(k)) { location.hash = '#/' + ROUTES[Number(k) - 1].path; }
    });

    if (!location.hash) history.replaceState(null, '', '#/dashboard');
    refresh();
  }

  A.app = { refresh, setTitle, applyTheme };
  init();
})(window.App);
