/* Página: Espionagem (ofertas que você está acompanhando) */
(function (A) {
  'use strict';
  const { esc, icon, num } = A;
  const ui = () => A.ui;
  const S = () => A.store.state;
  const COLS = () => A.C.SPY_STATUS;

  const stars = (n) => '<span class="stars" title="' + (n || 0) + ' de 5">' + [1, 2, 3, 4, 5].map((i) => (i <= n ? '★' : '<span class="off">★</span>')).join('') + '</span>';
  const hist = (s) => (s.adsHistory || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  function trend(s) {
    const h = hist(s);
    if (!h.length) return { last: null, diff: null, values: [] };
    const last = h[h.length - 1].count;
    const prev = h.length > 1 ? h[h.length - 2].count : null;
    return { last, diff: prev === null ? null : last - prev, values: h.map((x) => x.count), lastDate: h[h.length - 1].date };
  }
  const trendHtml = (t) => {
    if (t.last === null) return '<span class="muted small">sem contagem</span>';
    const d = t.diff === null ? '' : t.diff > 0 ? ' <span class="trend pos">▲ ' + t.diff + '</span>' : t.diff < 0 ? ' <span class="trend neg">▼ ' + Math.abs(t.diff) + '</span>' : ' <span class="trend muted">=</span>';
    return '<span class="small"><b class="tnum">' + num(t.last) + '</b> anúncios' + d + '</span>';
  };

  const fields = (isNew) => [
    { name: 'name', label: 'Nome da oferta', required: true, placeholder: 'Ex.: Protocolo Glicose Zero', span: 8 },
    { name: 'rating', label: 'Potencial', type: 'rating', span: 4 },
    { name: 'niche', label: 'Nicho', span: 4 },
    { name: 'country', label: 'País / idioma', span: 4, placeholder: 'BR, US, ES…' },
    { name: 'adPlatform', label: 'Onde anuncia', type: 'select', options: A.C.TRAFFIC, span: 4, default: 'Meta Ads' },
    { name: 'status', label: 'Etapa', type: 'select', options: COLS(), span: 4, default: 'new' },
    { name: 'price', label: 'Preço observado', type: 'money', span: 4 },
    { name: 'foundAt', label: 'Encontrada em', type: 'date', span: 4, default: A.today() },
    isNew ? { name: 'adsNow', label: 'Anúncios ativos agora', type: 'int', span: 12, hint: 'Vira o 1º ponto do histórico — acompanhe se está escalando.' } : null,
    { type: 'section', label: 'Links' },
    { name: 'adLibraryUrl', label: 'Biblioteca de anúncios', type: 'url', span: 6, placeholder: 'https://www.facebook.com/ads/library/…' },
    { name: 'salesPageUrl', label: 'Página de vendas / VSL', type: 'url', span: 6 },
    { name: 'checkoutUrl', label: 'Checkout', type: 'url', span: 6 },
    { name: 'creatives', label: 'Criativos de referência', type: 'textarea', rows: 2, span: 6, placeholder: 'Um link por linha' },
    { type: 'section', label: 'Análise' },
    { name: 'tags', label: 'Tags', type: 'tags', placeholder: 'VSL, quiz, UGC, low ticket…' },
    { name: 'notes', label: 'Anotações (copy, ângulo, funil, promessa…)', type: 'textarea', rows: 4 },
  ].filter(Boolean);

  function historyHtml(s) {
    const h = hist(s).reverse();
    return '<div class="row between" style="margin-bottom:8px"><b>Histórico de anúncios ativos</b>' + (h.length > 1 ? A.charts.sparkline(h.map((x) => x.count).reverse(), { width: 140, height: 30 }) : '') + '</div>' +
      '<div class="row" style="margin-bottom:10px"><input type="date" class="input input-sm" style="width:150px" id="hDate" value="' + A.today() + '"><input class="input input-sm tnum" style="width:120px" id="hCount" inputmode="numeric" placeholder="Nº anúncios"><button type="button" class="btn btn-sm" data-h="add">' + icon('plus') + 'Registrar</button></div>' +
      (h.length ? '<div class="history-list">' + h.map((x, i) => {
        const prev = h[i + 1];
        const d = prev ? x.count - prev.count : null;
        return '<div class="h-row"><span class="tnum">' + A.fmtDate(x.date) + '</span><b class="tnum">' + num(x.count) + '</b>' +
          (d === null ? '' : '<span class="trend ' + (d > 0 ? 'pos' : d < 0 ? 'neg' : 'muted') + '">' + (d > 0 ? '+' : '') + d + '</span>') +
          '<span class="spacer"></span><button type="button" class="icon-btn danger" data-h="del" data-date="' + x.date + '" title="Remover">' + icon('x') + '</button></div>';
      }).join('') + '</div>' : '<div class="muted small">Nenhuma contagem ainda. Registre periodicamente quantos anúncios ativos a oferta tem.</div>');
  }

  function open(s) {
    const isNew = !s;
    const values = s ? Object.assign({}, s, { creatives: (s.creatives || []).join('\n') }) : {};
    const f = fields(isNew);
    let current = s;
    ui().formModal({
      title: isNew ? 'Nova oferta espionada' : 'Oferta espionada', size: 'wide',
      fields: f, values,
      after: isNew ? '' : '<div class="card" style="margin-top:18px;padding:14px;box-shadow:none" id="hBox">' + historyHtml(s) + '</div>',
      left: isNew ? '' :
        '<button type="button" class="btn btn-danger" data-x="del">' + icon('trash') + 'Excluir</button>' +
        (s.offerId && A.store.get('offers', s.offerId) ? '<a class="btn" href="#/ofertas/' + s.offerId + '" data-close>' + icon('package') + 'Ver minha oferta</a>' : '<button type="button" class="btn" data-x="convert">' + icon('arrowRight') + 'Modelar → minha oferta</button>'),
      onMount: (form, close) => {
        const hBox = A.$('#hBox', form);
        if (hBox) {
          A.on(hBox, 'click', '[data-h]', (e, b) => {
            const list = (current.adsHistory || []).slice();
            if (b.dataset.h === 'add') {
              const date = A.$('#hDate', form).value || A.today();
              const raw = A.$('#hCount', form).value;
              if (raw.trim() === '') { A.$('#hCount', form).focus(); return; }
              const count = Math.round(A.parseNum(raw));
              const i = list.findIndex((x) => x.date === date);
              if (i >= 0) list[i] = { date, count }; else list.push({ date, count });
            } else {
              const i = list.findIndex((x) => x.date === b.dataset.date);
              if (i >= 0) list.splice(i, 1);
            }
            current = A.store.update('spy', current.id, { adsHistory: list });
            hBox.innerHTML = historyHtml(current);
          });
          A.$('#hCount', form).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); A.$('[data-h=add]', form).click(); } });
        }
        A.on(form, 'click', '[data-x]', async (e, b) => {
          if (b.dataset.x === 'del') { close(); ui().removeWithUndo('spy', s.id, s.name); }
          if (b.dataset.x === 'convert') { close(); convert(A.store.get('spy', s.id)); }
        });
      },
      onSave: (data) => {
        data.creatives = String(data.creatives || '').split('\n').map((x) => x.trim()).filter(Boolean);
        if (isNew) {
          const n = data.adsNow; delete data.adsNow;
          data.adsHistory = n ? [{ date: A.today(), count: n }] : [];
          A.store.insert('spy', data);
          ui().toast('Oferta adicionada à espionagem.');
        } else {
          A.store.update('spy', s.id, data);
          ui().toast('Salvo.');
        }
      },
    });
  }

  function convert(s) {
    const o = A.store.insert('offers', {
      name: s.name, niche: s.niche, price: s.price, salesPage: '', checkoutUrl: '', status: 'testing', model: 'Produtor',
      platform: 'Kiwify', commission: 100, tags: s.tags || [], color: A.store.nextColor('offers'),
      notes: 'Modelada a partir da espionagem: ' + s.name + (s.salesPageUrl ? '\nReferência: ' + s.salesPageUrl : '') + (s.notes ? '\n\n' + s.notes : ''),
    });
    A.store.update('spy', s.id, { status: 'modeled', offerId: o.id });
    ui().toast('Oferta criada a partir da espionagem.');
    location.hash = '#/ofertas/' + o.id;
    setTimeout(() => A.pages.offers.edit(A.store.get('offers', o.id)), 50);
  }

  function card(s) {
    const t = trend(s);
    const links = [['adLibraryUrl', 'Biblioteca'], ['salesPageUrl', 'Página'], ['checkoutUrl', 'Checkout']].map(([k, l]) => (A.safeUrl(s[k]) ? '<a href="' + esc(A.safeUrl(s[k])) + '" target="_blank" rel="noopener noreferrer" class="tag" data-stop title="' + l + '">' + l + ' ↗</a>' : '')).join('');
    return '<div class="kcard" draggable="true" data-id="' + s.id + '">' +
      '<div class="kcard-title"><span>' + esc(s.name) + '</span>' + (s.rating ? stars(s.rating) : '') + '</div>' +
      '<div class="kcard-meta">' + [s.niche, s.country, s.adPlatform].filter(Boolean).map(esc).join(' · ') + (s.price ? ' · ' + A.money(s.price) : '') + '</div>' +
      '<div class="kcard-foot">' + trendHtml(t) + '<span class="spacer"></span>' + (t.values.length > 1 ? A.charts.sparkline(t.values, { width: 64, height: 20, color: t.diff < 0 ? 'var(--bad)' : 'var(--accent)' }) : '') + '</div>' +
      ((s.tags || []).length || links ? '<div class="kcard-foot">' + ui().tagsHtml(s.tags) + links + '</div>' : '') +
      '<div class="kcard-meta" style="margin-top:6px">' + (s.foundAt ? 'encontrada ' + A.relDays(s.foundAt) : '') + (t.lastDate && t.lastDate !== s.foundAt ? ' · checada ' + A.relDays(t.lastDate) : '') + '</div>' +
    '</div>';
  }

  function render(view) {
    const u = A.store.ui.spy || {};
    const mode = u.view || 'kanban';
    if (!S().spy.length) {
      view.innerHTML = '<div class="card">' + ui().emptyState('eye', 'Nenhuma oferta espionada', 'Salve aqui as ofertas que você encontra na biblioteca de anúncios, acompanhe quantos anúncios ativos elas têm ao longo do tempo e decida quais modelar.',
        '<button class="btn btn-primary" data-act="new">' + icon('plus') + 'Adicionar oferta espionada</button>') + '</div>';
      A.on(view, 'click', '[data-act=new]', () => open());
      return;
    }
    const niches = Array.from(new Set(S().spy.map((s) => s.niche).filter(Boolean))).sort();
    view.innerHTML =
      '<div class="toolbar">' +
        '<div class="search">' + icon('search') + '<input class="input input-sm" id="sSearch" placeholder="Buscar nome, nicho, tag, anotação…" value="' + esc(u.q || '') + '"></div>' +
        '<select class="input input-sm" data-u="niche"><option value="">Todos os nichos</option>' + niches.map((n) => '<option' + (u.niche === n ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select>' +
        '<select class="input input-sm" data-u="minRating"><option value="">Qualquer potencial</option>' + [3, 4, 5].map((n) => '<option value="' + n + '"' + (String(u.minRating) === String(n) ? ' selected' : '') + '>' + n + '+ estrelas</option>').join('') + '</select>' +
        '<span class="spacer"></span>' +
        '<div class="seg"><button data-view="kanban" class="' + (mode === 'kanban' ? 'on' : '') + '">Quadro</button><button data-view="table" class="' + (mode === 'table' ? 'on' : '') + '">Tabela</button></div>' +
        '<button class="btn btn-sm btn-primary" data-act="new">' + icon('plus') + 'Adicionar</button>' +
      '</div><div id="sBox"></div>';
    const box = A.$('#sBox', view);
    const filtered = () => {
      const uu = A.store.ui.spy || {};
      const q = A.norm(uu.q);
      return S().spy.filter((s) => {
        if (uu.niche && s.niche !== uu.niche) return false;
        if (uu.minRating && (s.rating || 0) < Number(uu.minRating)) return false;
        if (q && !A.norm([s.name, s.niche, s.country, s.adPlatform, s.notes, (s.tags || []).join(' ')].join(' ')).includes(q)) return false;
        return true;
      });
    };
    const draw = () => {
      const list = filtered();
      if ((A.store.ui.spy || {}).view === 'table') {
        box.innerHTML = '<div class="card">' + ui().table({
          id: 'spy', rows: list, defaultSort: { key: 'ads', dir: 'desc' },
          rowAttr: (r) => 'class="clickable" data-id="' + r.id + '"',
          empty: '<div class="empty"><p>Nada encontrado com esses filtros.</p></div>',
          columns: [
            { key: 'name', label: 'Oferta', sort: (r) => r.name, html: (r) => '<b>' + esc(r.name) + '</b><div class="muted small">' + [r.niche, r.country].filter(Boolean).map(esc).join(' · ') + '</div>' },
            { key: 'status', label: 'Etapa', sort: (r) => COLS().findIndex((c) => c[0] === r.status), html: (r) => '<span class="badge plain">' + esc(A.C.label(COLS(), r.status)) + '</span>' },
            { key: 'rating', label: 'Potencial', sort: (r) => r.rating || 0, html: (r) => stars(r.rating || 0) },
            { key: 'platform', label: 'Onde anuncia', sort: (r) => r.adPlatform, html: (r) => esc(r.adPlatform || '—') },
            { key: 'price', label: 'Preço', num: true, sort: (r) => Number(r.price) || 0, html: (r) => (r.price ? A.money(r.price) : '—') },
            { key: 'ads', label: 'Anúncios', num: true, sort: (r) => trend(r).last, html: (r) => { const t = trend(r); return t.last === null ? '—' : num(t.last); } },
            { key: 'diff', label: 'Variação', num: true, sort: (r) => trend(r).diff, html: (r) => { const t = trend(r); return t.diff === null ? '—' : '<span class="' + (t.diff > 0 ? 'pos' : t.diff < 0 ? 'neg' : '') + '">' + (t.diff > 0 ? '+' : '') + t.diff + '</span>'; } },
            { key: 'spark', label: 'Tendência', html: (r) => { const t = trend(r); return t.values.length > 1 ? A.charts.sparkline(t.values, { width: 80, height: 22 }) : ''; } },
            { key: 'found', label: 'Encontrada', sort: (r) => r.foundAt || '', html: (r) => (r.foundAt ? A.fmtDate(r.foundAt) : '—') },
          ],
        }) + '</div>';
        return;
      }
      box.innerHTML = '<div class="kanban">' + COLS().map(([k, l]) => {
        const items = list.filter((s) => (s.status || 'new') === k).sort((a, b) => (b.rating || 0) - (a.rating || 0) || (trend(b).last || 0) - (trend(a).last || 0));
        return '<div class="kcol" data-col="' + k + '"><div class="kcol-head">' + esc(l) + '<span class="count">' + items.length + '</span><span class="spacer"></span>' +
          '<button class="icon-btn" data-newin="' + k + '" title="Adicionar aqui">' + icon('plus') + '</button></div>' +
          '<div class="kcol-body">' + items.map(card).join('') + '</div></div>';
      }).join('') + '</div>';
    };
    draw();
    ui().bindSort(box, draw);

    A.on(box, 'click', '[data-id]', (e, el) => { if (!e.target.closest('[data-stop]')) open(A.store.get('spy', el.dataset.id)); });
    A.on(box, 'click', '[data-newin]', (e, b) => {
      e.stopPropagation();
      open();
      setTimeout(() => { const sel = document.querySelector('.modal select[name=status]'); if (sel) sel.value = b.dataset.newin; }, 0);
    });
    // Arrastar e soltar entre colunas
    let dragId = null;
    box.addEventListener('dragstart', (e) => { const c = e.target.closest('.kcard'); if (!c) return; dragId = c.dataset.id; c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); });
    box.addEventListener('dragend', (e) => { const c = e.target.closest('.kcard'); if (c) c.classList.remove('dragging'); A.$$('.kcol', box).forEach((k) => k.classList.remove('drag-over')); });
    box.addEventListener('dragover', (e) => { const col = e.target.closest('.kcol'); if (!col || !dragId) return; e.preventDefault(); A.$$('.kcol', box).forEach((k) => k.classList.toggle('drag-over', k === col)); });
    box.addEventListener('drop', (e) => {
      const col = e.target.closest('.kcol'); if (!col || !dragId) return;
      e.preventDefault();
      const s = A.store.get('spy', dragId);
      if (s && s.status !== col.dataset.col) A.store.update('spy', dragId, { status: col.dataset.col });
      dragId = null;
    });

    A.$('#sSearch', view).addEventListener('input', A.debounce((e) => { A.store.setUI({ spy: Object.assign({}, A.store.ui.spy, { q: e.target.value }) }); draw(); }, 120));
    A.$$('[data-u]', view).forEach((s) => s.addEventListener('change', () => { const n = Object.assign({}, A.store.ui.spy); n[s.dataset.u] = s.value; A.store.setUI({ spy: n }); draw(); }));
    A.on(view, 'click', '[data-view]', (e, b) => { A.store.setUI({ spy: Object.assign({}, A.store.ui.spy, { view: b.dataset.view }) }); A.app.refresh(); });
    A.on(view, 'click', '[data-act=new]', () => open());
  }

  A.pages.spy = { title: 'Espionagem', period: false, render, open };
})(window.App);
