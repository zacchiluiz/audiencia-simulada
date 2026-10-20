/* Página: Minhas ofertas */
(function (A) {
  'use strict';
  const { esc, icon, money, num, pct, ratioX, orDash } = A;
  const ui = () => A.ui;
  const S = () => A.store.state;
  const statusBadge = (s) => A.C.badge(A.C.OFFER_STATUS, s);

  const fields = () => [
    { name: 'name', label: 'Nome da oferta / produto', required: true, placeholder: 'Ex.: Método Emagrecer 30D' },
    { name: 'niche', label: 'Nicho', span: 4, placeholder: 'Emagrecimento, renda extra…' },
    { name: 'platform', label: 'Plataforma de venda', type: 'select', options: A.C.SALES_PLATFORMS, span: 4, default: 'Kiwify' },
    { name: 'model', label: 'Modelo', type: 'select', options: A.C.OFFER_MODEL, span: 4, default: 'Produtor' },
    { name: 'status', label: 'Status', type: 'select', options: A.C.OFFER_STATUS.map((x) => [x[0], x[1]]), span: 4, default: 'active' },
    { name: 'price', label: 'Preço de venda', type: 'money', span: 4 },
    { name: 'commission', label: 'Sua comissão', type: 'percent', span: 4, default: 100, hint: '100% se você é o produtor' },
    { type: 'section', label: 'Custos por venda (usados no cálculo de lucro)' },
    { name: 'feeRate', label: 'Taxa da plataforma', type: 'percent', span: 4, hint: 'Ex.: 6,99%' },
    { name: 'feeFixed', label: 'Taxa fixa por venda', type: 'money', span: 4, hint: 'Ex.: R$ 2,49' },
    { name: 'productCost', label: 'Custo do produto + frete', type: 'money', span: 4, hint: 'Para físico/drop. Por unidade' },
    { type: 'section', label: 'Links e anotações' },
    { name: 'salesPage', label: 'Página de vendas', type: 'url', span: 6, placeholder: 'https://…' },
    { name: 'checkoutUrl', label: 'Checkout', type: 'url', span: 6, placeholder: 'https://…' },
    { name: 'tags', label: 'Tags', type: 'tags' },
    { name: 'notes', label: 'Anotações', type: 'textarea', placeholder: 'Upsells, order bumps, ângulos de copy…' },
  ];

  function edit(o, preset) {
    const isNew = !o;
    ui().formModal({
      title: isNew ? 'Nova oferta' : 'Editar oferta', size: 'wide',
      fields: fields(), values: o || preset || {},
      onSave: (data) => {
        if (isNew) {
          const item = A.store.insert('offers', Object.assign(data, { color: A.store.nextColor('offers') }));
          ui().toast('Oferta criada.', { action: { label: 'Criar campanha', fn: () => A.pages.campaigns.edit(null, { offerId: item.id }) } });
          return item;
        }
        A.store.update('offers', o.id, data); ui().toast('Oferta atualizada.');
      },
    });
  }
  const remove = (o) => ui().removeWithUndo('offers', o.id, o.name, 'As campanhas e vendas ligadas a ela serão mantidas, mas ficarão sem oferta.');

  function renderList(view) {
    const st = S();
    const u = A.store.ui.offers || {};
    if (!st.offers.length) {
      view.innerHTML = '<div class="card">' + ui().emptyState('package', 'Nenhuma oferta cadastrada', 'Cadastre os produtos que você vende ou promove — com preço, comissão e taxas, para o lucro sair certinho.',
        '<button class="btn btn-primary" data-act="new">' + icon('plus') + 'Nova oferta</button>') + '</div>';
      A.on(view, 'click', '[data-act=new]', () => edit());
      return;
    }
    const mode = u.view || 'cards';
    view.innerHTML =
      '<div class="toolbar">' +
        '<div class="search">' + icon('search') + '<input class="input input-sm" id="oSearch" placeholder="Buscar oferta, nicho, tag…" value="' + esc(u.q || '') + '"></div>' +
        '<select class="input input-sm" data-u="status"><option value="">Todos os status</option>' + A.C.OFFER_STATUS.map((x) => '<option value="' + x[0] + '"' + (u.status === x[0] ? ' selected' : '') + '>' + x[1] + '</option>').join('') + '</select>' +
        '<span class="spacer"></span>' +
        '<div class="seg"><button data-view="cards" class="' + (mode === 'cards' ? 'on' : '') + '">' + 'Cards</button><button data-view="table" class="' + (mode === 'table' ? 'on' : '') + '">Tabela</button></div>' +
        '<button class="btn btn-sm btn-primary" data-act="new">' + icon('plus') + 'Nova oferta</button>' +
      '</div><div id="oBox"></div>';
    const box = A.$('#oBox', view);
    const range = A.rangeFor(A.store.ui.period);

    const draw = () => {
      const uu = A.store.ui.offers || {};
      const q = A.norm(uu.q);
      const rows = A.metrics.breakdown('offer', { range }).filter((r) => {
        const o = r.item;
        if (uu.status ? o.status !== uu.status : o.status === 'archived' && !q) return false;
        if (q && !A.norm([o.name, o.niche, o.platform, o.model, (o.tags || []).join(' ')].join(' ')).includes(q)) return false;
        return true;
      });
      const activeCamps = (id) => st.campaigns.filter((c) => c.offerId === id && (c.status === 'active' || c.status === 'testing')).length;
      const archived = st.offers.filter((o) => o.status === 'archived').length;
      const hint = !uu.status && archived && !q ? '<div class="muted small" style="margin-top:10px">' + archived + ' oferta(s) arquivada(s) oculta(s) — filtre por "Arquivada" para ver.</div>' : '';
      if ((uu.view || 'cards') === 'cards') {
        const ser = (id) => A.metrics.series({ range, offerId: id }).points.map((p) => p.m.profit);
        box.innerHTML = (rows.length ? '<div class="offer-cards">' + rows.map((r) => {
          const o = r.item;
          const vals = ser(r.id);
          return '<div class="card offer-card" data-id="' + o.id + '">' +
            '<div class="row between" style="align-items:flex-start;flex-wrap:nowrap"><div style="min-width:0"><h3>' + ui().colorDot(o.color) + '<span class="truncate">' + esc(o.name) + '</span></h3>' +
            '<div class="muted small" style="margin-top:4px">' + [o.platform, o.model, o.niche].filter(Boolean).map(esc).join(' · ') + '</div></div>' + statusBadge(o.status) + '</div>' +
            '<div class="stats"><div><span>Faturamento</span><b>' + A.moneyShort(r.m.gross) + '</b></div><div><span>Lucro</span><b class="' + (r.m.profit < 0 ? 'neg' : '') + '">' + A.moneyShort(r.m.profit) + '</b></div><div><span>ROAS</span><b>' + ratioX(r.m.roas) + '</b></div>' +
            '<div><span>Vendas</span><b>' + num(r.m.qty) + '</b></div><div><span>CPA</span><b>' + orDash(r.m.cpa, A.moneyShort) + '</b></div><div><span>Preço</span><b>' + (o.price ? A.moneyShort(o.price) : '—') + '</b></div></div>' +
            '<div class="row between"><span class="muted small">' + activeCamps(o.id) + ' campanha(s) rodando</span>' + (vals.some((v) => v) ? A.charts.sparkline(vals, { color: A.charts.color(o.color), width: 110 }) : '') + '</div>' +
            '<div class="row" style="border-top:1px solid var(--border);padding-top:10px;margin-top:-2px">' + ui().extLink(o.salesPage, 'Página') + '<span class="spacer"></span>' +
              '<button class="icon-btn" data-a="camp" title="Nova campanha">' + icon('megaphone') + '</button><button class="icon-btn" data-a="edit" title="Editar">' + icon('edit') + '</button><button class="icon-btn danger" data-a="del" title="Excluir">' + icon('trash') + '</button></div>' +
          '</div>';
        }).join('') + '</div>' : '<div class="card"><div class="empty"><p>Nenhuma oferta corresponde aos filtros.</p></div></div>') + hint;
      } else {
        box.innerHTML = '<div class="card">' + ui().table({
          id: 'offers', rows, defaultSort: { key: 'profit', dir: 'desc' },
          rowAttr: (r) => 'class="clickable" data-id="' + r.id + '"',
          columns: [
            { key: 'name', label: 'Oferta', sort: (r) => r.name, html: (r) => '<div class="name-cell">' + ui().colorDot(r.color) + '<div><b>' + esc(r.name) + '</b><div class="muted small">' + [r.item.platform, r.item.niche].filter(Boolean).map(esc).join(' · ') + '</div></div></div>' },
            { key: 'status', label: 'Status', sort: (r) => r.item.status, html: (r) => statusBadge(r.item.status) },
            { key: 'price', label: 'Preço', num: true, sort: (r) => Number(r.item.price) || 0, html: (r) => (r.item.price ? money(r.item.price) : '—') },
            { key: 'gross', label: 'Faturamento', num: true, sort: (r) => r.m.gross, html: (r) => money(r.m.gross) },
            { key: 'spend', label: 'Gasto', num: true, sort: (r) => r.m.adsTotal, html: (r) => money(r.m.adsTotal) },
            { key: 'profit', label: 'Lucro', num: true, sort: (r) => r.m.profit, html: (r) => ui().signed(r.m.profit) },
            { key: 'roas', label: 'ROAS', num: true, sort: (r) => r.m.roas, html: (r) => ui().roasHtml(r.m.roas) },
            { key: 'margin', label: 'Margem', num: true, sort: (r) => r.m.margin, html: (r) => ui().signedPct(r.m.margin) },
            { key: 'qty', label: 'Vendas', num: true, sort: (r) => r.m.qty, html: (r) => num(r.m.qty) },
            { key: 'cpa', label: 'CPA', num: true, sort: (r) => r.m.cpa, html: (r) => orDash(r.m.cpa, money) },
            { key: 'act', label: '', cls: 'actions', html: () => '<button class="icon-btn" data-a="camp" title="Nova campanha">' + icon('megaphone') + '</button><button class="icon-btn" data-a="edit" title="Editar">' + icon('edit') + '</button><button class="icon-btn danger" data-a="del" title="Excluir">' + icon('trash') + '</button>' },
          ],
          empty: '<div class="empty"><p>Nenhuma oferta corresponde aos filtros.</p></div>',
        }) + '</div>' + hint;
      }
    };
    draw();
    ui().bindSort(box, draw);
    A.on(box, 'click', '[data-id]', (e, card) => {
      if (e.target.closest('[data-stop]')) return;
      const o = A.store.get('offers', card.dataset.id);
      const b = e.target.closest('[data-a]');
      if (!b) { location.hash = '#/ofertas/' + o.id; return; }
      if (b.dataset.a === 'edit') edit(o);
      if (b.dataset.a === 'del') remove(o);
      if (b.dataset.a === 'camp') A.pages.campaigns.edit(null, { offerId: o.id });
    });
    A.$('#oSearch', view).addEventListener('input', A.debounce((e) => { A.store.setUI({ offers: Object.assign({}, A.store.ui.offers, { q: e.target.value }) }); draw(); }, 120));
    A.$$('[data-u]', view).forEach((s) => s.addEventListener('change', () => { const n = Object.assign({}, A.store.ui.offers); n[s.dataset.u] = s.value; A.store.setUI({ offers: n }); draw(); }));
    A.on(view, 'click', '[data-view]', (e, b) => { A.store.setUI({ offers: Object.assign({}, A.store.ui.offers, { view: b.dataset.view }) }); A.app.refresh(); });
    A.on(view, 'click', '[data-act=new]', () => edit());
  }

  function renderDetail(view, id) {
    const o = A.store.get('offers', id);
    if (!o) { view.innerHTML = '<div class="card">' + ui().emptyState('package', 'Oferta não encontrada', 'Ela pode ter sido excluída.', '<a class="btn" href="#/ofertas">Voltar</a>') + '</div>'; return; }
    A.app.setTitle(o.name);
    const range = A.rangeFor(A.store.ui.period);
    const m = A.metrics.summarize({ range, offerId: id });
    const metric = (l, v) => '<div><span>' + l + '</span><b>' + v + '</b></div>';
    const unitProfit = (Number(o.price) || 0) * (Number(o.commission) || 100) / 100;
    const unitFees = unitProfit * (Number(o.feeRate) || 0) / 100 + (Number(o.feeFixed) || 0);
    const unitTax = unitProfit * (Number(S().settings.taxRate) || 0) / 100;
    const breakEvenCpa = unitProfit - unitFees - unitTax - (Number(o.productCost) || 0);
    view.innerHTML =
      '<a class="back-link" href="#/ofertas">' + icon('back') + 'Ofertas</a>' +
      '<div class="detail-head"><div class="title"><h2>' + ui().colorDot(o.color) + ' ' + esc(o.name) + '</h2><div class="meta">' + statusBadge(o.status) +
        [o.platform, o.model, o.niche].filter(Boolean).map((x) => '<span>' + esc(x) + '</span>').join('<span>·</span>') +
        ui().extLink(o.salesPage, 'Página de vendas') + ui().extLink(o.checkoutUrl, 'Checkout') + ui().tagsHtml(o.tags) + '</div></div>' +
        '<div class="row"><button class="btn btn-primary" data-a="camp">' + icon('plus') + 'Nova campanha</button><button class="btn" data-a="edit">' + icon('edit') + 'Editar</button><button class="btn btn-danger" data-a="del">' + icon('trash') + '</button></div></div>' +
      '<div class="stack">' +
      '<div class="metric-strip">' +
        metric('Lucro', ui().signed(m.profit)) + metric('Faturamento', money(m.gross)) + metric('Gasto', money(m.adsTotal)) + metric('ROAS', ratioX(m.roas)) +
        metric('ROI', ui().signedPct(m.roi)) + metric('Margem', ui().signedPct(m.margin)) + metric('Vendas', num(m.qty)) + metric('CPA', orDash(m.cpa, money)) +
        metric('Ticket médio', orDash(m.ticket, money)) + metric('Reembolsos', money(m.refunds) + ' <span class="muted small">' + pct(m.refundRate) + '</span>') + metric('Custos extras', money(m.costs)) + metric('Pendentes', money(m.pending)) +
      '</div>' +
      '<div class="grid grid-main">' +
        '<div class="card"><div class="card-head"><h3>Desempenho</h3><span class="spacer"></span><div class="legend"><span><i style="background:var(--s1)"></i>Faturamento</span><span><i style="background:var(--s2)"></i>Gasto</span><span><i style="background:var(--s3)"></i>Lucro</span></div></div><div class="card-body"><div id="odLine"></div></div></div>' +
        '<div class="card"><div class="card-head"><h3>Unidade econômica</h3></div><div class="card-body"><dl class="kv">' +
          '<dt>Preço</dt><dd>' + (o.price ? money(o.price) : '—') + '</dd>' +
          '<dt>Comissão</dt><dd>' + A.num(o.commission || 100, 0) + '% → ' + money(unitProfit) + '</dd>' +
          '<dt>Taxas / venda</dt><dd>' + money(unitFees) + '</dd>' +
          (unitTax ? '<dt>Imposto / venda</dt><dd>' + money(unitTax) + '</dd>' : '') +
          (o.productCost ? '<dt>Custo produto</dt><dd>' + money(o.productCost) + '</dd>' : '') +
          '<dt><b>CPA máximo</b></dt><dd><b>' + money(breakEvenCpa) + '</b> <span class="muted small">(empate)</span></dd>' +
          '<dt>ROAS de empate</dt><dd>' + (breakEvenCpa > 0 ? ratioX(unitProfit / breakEvenCpa) : '—') + '</dd>' +
          '<dt>CPA atual</dt><dd>' + (Number.isFinite(m.cpa) ? '<span class="' + (m.cpa > breakEvenCpa ? 'neg' : 'pos') + '">' + money(m.cpa) + '</span>' : '—') + '</dd>' +
        '</dl>' + (o.notes ? '<div class="notes small" style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px">' + esc(o.notes) + '</div>' : '') + '</div></div>' +
      '</div>' +
      '<div class="card"><div class="card-head"><h3>Campanhas desta oferta</h3></div><div class="card-body" style="padding-top:6px" id="odCamps"></div></div>' +
      '</div>';

    const ser = A.metrics.series({ range, offerId: id });
    A.charts.line(A.$('#odLine', view), {
      points: ser.points.map((p) => ({ label: p.label, title: ser.monthly ? A.monthName(p.date) : A.weekday(p.date) + ', ' + A.fmtDate(p.date), values: { gross: p.m.gross, spend: p.m.adsTotal, profit: p.m.profit }, m: p.m })),
      series: [{ key: 'gross', name: 'Faturamento', color: 'var(--s1)', area: true }, { key: 'spend', name: 'Gasto', color: 'var(--s2)' }, { key: 'profit', name: 'Lucro', color: 'var(--s3)' }],
      extraTip: (p) => A.charts.ttRow('', 'Vendas', num(p.m.qty)),
    });
    const camps = A.metrics.breakdown('campaign', { range, offerId: id });
    const box = A.$('#odCamps', view);
    const draw = () => {
      box.innerHTML = ui().table({
        id: 'offerCamps', rows: camps, defaultSort: { key: 'profit', dir: 'desc' },
        rowAttr: (r) => 'class="clickable" data-href="#/campanhas/' + r.id + '"',
        empty: '<div class="muted small" style="padding:12px 0">Nenhuma campanha ligada a esta oferta.</div>',
        columns: [
          { key: 'name', label: 'Campanha', sort: (r) => r.name, html: (r) => '<div class="name-cell">' + ui().colorDot(r.color) + '<b>' + esc(r.name) + '</b></div>' },
          { key: 'status', label: 'Status', sort: (r) => r.item.status, html: (r) => A.C.badge(A.C.CAMPAIGN_STATUS, r.item.status) },
          { key: 'platform', label: 'Fonte', sort: (r) => r.item.platform, html: (r) => esc(r.item.platform || '—') },
          { key: 'spend', label: 'Gasto', num: true, sort: (r) => r.m.adsTotal, html: (r) => money(r.m.adsTotal) },
          { key: 'gross', label: 'Faturamento', num: true, sort: (r) => r.m.gross, html: (r) => money(r.m.gross) },
          { key: 'profit', label: 'Lucro', num: true, sort: (r) => r.m.profit, html: (r) => ui().signed(r.m.profit) },
          { key: 'roas', label: 'ROAS', num: true, sort: (r) => r.m.roas, html: (r) => ui().roasHtml(r.m.roas) },
          { key: 'cpa', label: 'CPA', num: true, sort: (r) => r.m.cpa, html: (r) => orDash(r.m.cpa, money) },
          { key: 'qty', label: 'Vendas', num: true, sort: (r) => r.m.qty, html: (r) => num(r.m.qty) },
        ],
      });
    };
    draw();
    ui().bindSort(box, draw);
    A.on(box, 'click', 'tr[data-href]', (e, tr) => { location.hash = tr.dataset.href; });
    A.on(view, 'click', '.detail-head [data-a]', async (e, b) => {
      if (b.dataset.a === 'edit') edit(o);
      if (b.dataset.a === 'camp') A.pages.campaigns.edit(null, { offerId: o.id });
      if (b.dataset.a === 'del' && await remove(o)) location.hash = '#/ofertas';
    });
  }

  A.pages.offers = {
    title: 'Minhas ofertas', period: true,
    render: (view, params) => (params[0] ? renderDetail(view, params[0]) : renderList(view)),
    edit,
  };
})(window.App);
