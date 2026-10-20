/* Página: Vendas */
(function (A) {
  'use strict';
  const { esc, icon, money, num, pct } = A;
  const ui = () => A.ui;
  const S = () => A.store.state;
  const offerName = (id) => { const o = A.store.get('offers', id); return o ? o.name : ''; };
  const campName = (id) => { const c = A.store.get('campaigns', id); return c ? c.name : ''; };

  const fields = () => [
    { name: 'date', label: 'Data', type: 'date', required: true, span: 4, default: A.today() },
    { name: 'status', label: 'Status', type: 'select', options: A.C.SALE_STATUS.map((x) => [x[0], x[1]]), span: 4, default: 'approved' },
    { name: 'method', label: 'Pagamento', type: 'select', options: A.C.PAYMENT, span: 4, default: 'pix' },
    { name: 'offerId', label: 'Oferta', type: 'select', empty: '— selecione —', options: () => S().offers.map((o) => [o.id, o.name]), span: 6 },
    { name: 'campaignId', label: 'Campanha (origem)', type: 'select', empty: '— nenhuma / orgânico —', options: () => S().campaigns.map((c) => [c.id, c.name]), span: 6 },
    { name: 'qty', label: 'Quantidade', type: 'int', span: 4, default: 1 },
    { name: 'gross', label: 'Valor total (bruto)', type: 'money', required: true, span: 4, hint: 'O que você recebe (comissão)' },
    { name: 'fees', label: 'Taxas', type: 'money', span: 4, hint: 'Vazio = calcula pela oferta' },
    { name: 'customer', label: 'Cliente / ID do pedido', span: 6, placeholder: 'Opcional' },
    { name: 'product', label: 'Item', span: 6, placeholder: 'Principal, upsell, order bump…' },
    { name: 'notes', label: 'Anotações', type: 'textarea', rows: 2 },
  ];

  function edit(s, preset) {
    const isNew = !s;
    const values = s ? Object.assign({}, s) : Object.assign({}, preset || {});
    ui().formModal({
      title: isNew ? 'Registrar venda' : 'Editar venda',
      fields: fields(), values,
      before: s && s.source ? '<div class="badge info plain" style="margin-bottom:14px">Venda criada pelo lançamento diário da campanha</div>' : '',
      onMount: (form) => {
        // Ao escolher campanha, preenche a oferta; ao escolher oferta, sugere valor
        form.elements.campaignId.addEventListener('change', () => {
          const c = A.store.get('campaigns', form.elements.campaignId.value);
          if (c && c.offerId && !form.elements.offerId.value) { form.elements.offerId.value = c.offerId; suggest(); }
        });
        const suggest = () => {
          const o = A.store.get('offers', form.elements.offerId.value);
          if (o && o.price && !form.elements.gross.dataset.touched) form.elements.gross.value = A.toInput(Math.max(1, A.parseNum(form.elements.qty.value)) * o.price * (Number(o.commission) || 100) / 100);
          const g = A.parseNum(form.elements.gross.value);
          form.elements.fees.placeholder = 'auto: ' + A.toInput(A.pages.campaigns.autoFees(form.elements.offerId.value, g, Math.max(1, A.parseNum(form.elements.qty.value))));
        };
        form.elements.offerId.addEventListener('change', suggest);
        form.elements.qty.addEventListener('input', suggest);
        form.elements.gross.addEventListener('input', () => { form.elements.gross.dataset.touched = '1'; suggest(); });
        if (s) form.elements.gross.dataset.touched = '1';
        suggest();
      },
      onSave: (data, form) => {
        if (!data.qty) data.qty = 1;
        if (!data.offerId && data.campaignId) data.offerId = (A.store.get('campaigns', data.campaignId) || {}).offerId || '';
        if (form.elements.fees.value.trim() === '') data.fees = data.status === 'approved' ? A.pages.campaigns.autoFees(data.offerId, data.gross, data.qty) : 0;
        if (isNew) { A.store.insert('sales', data); ui().toast('Venda registrada.'); }
        else { A.store.update('sales', s.id, data); ui().toast('Venda atualizada.'); }
      },
    });
  }

  function render(view) {
    const u = A.store.ui.sales || {};
    const range = A.rangeFor(A.store.ui.period);
    if (!S().sales.length) {
      view.innerHTML = '<div class="card">' + ui().emptyState('cart', 'Nenhuma venda registrada', 'Registre vendas uma a uma aqui, ou use o "Lançamento do dia" nas campanhas para lançar o total de vendas do dia de uma vez.',
        '<div class="row" style="justify-content:center"><button class="btn btn-primary" data-act="new">' + icon('plus') + 'Registrar venda</button><button class="btn" data-act="day">' + icon('zap') + 'Lançamento do dia</button></div>') + '</div>';
      A.on(view, 'click', '[data-act]', (e, b) => (b.dataset.act === 'new' ? edit() : A.pages.campaigns.quickEntry()));
      return;
    }
    view.innerHTML =
      '<div class="toolbar">' +
        '<div class="search">' + icon('search') + '<input class="input input-sm" id="vSearch" placeholder="Buscar cliente, item, anotação…" value="' + esc(u.q || '') + '"></div>' +
        '<select class="input input-sm" data-u="status"><option value="">Todos os status</option>' + A.C.SALE_STATUS.map((x) => '<option value="' + x[0] + '"' + (u.status === x[0] ? ' selected' : '') + '>' + x[1] + '</option>').join('') + '</select>' +
        '<select class="input input-sm" data-u="offerId"><option value="">Todas as ofertas</option>' + S().offers.map((o) => '<option value="' + o.id + '"' + (u.offerId === o.id ? ' selected' : '') + '>' + esc(o.name) + '</option>').join('') + '</select>' +
        '<select class="input input-sm" data-u="method"><option value="">Todos os pagamentos</option>' + A.C.PAYMENT.map((x) => '<option value="' + x[0] + '"' + (u.method === x[0] ? ' selected' : '') + '>' + x[1] + '</option>').join('') + '</select>' +
        '<span class="spacer"></span>' +
        '<button class="btn btn-sm" data-act="export">' + icon('download') + 'CSV</button>' +
        '<button class="btn btn-sm btn-primary" data-act="new">' + icon('plus') + 'Registrar venda</button>' +
      '</div>' +
      '<div class="stack"><div class="metric-strip" id="vStrip"></div><div class="card" id="vTable"></div></div>';

    const box = A.$('#vTable', view);
    let rows = [];
    const draw = () => {
      const uu = A.store.ui.sales || {};
      const q = A.norm(uu.q);
      rows = S().sales.filter((s) => {
        if (!A.inRange(s.date, range)) return false;
        if (uu.status && s.status !== uu.status) return false;
        if (uu.offerId && A.metrics.saleOffer(s) !== uu.offerId) return false;
        if (uu.method && s.method !== uu.method) return false;
        if (q && !A.norm([s.customer, s.product, s.notes, offerName(A.metrics.saleOffer(s)), campName(s.campaignId)].join(' ')).includes(q)) return false;
        return true;
      });
      const m = A.metrics.compute(rows, [], 0);
      const cell = (l, v) => '<div><span>' + l + '</span><b>' + v + '</b></div>';
      A.$('#vStrip', view).innerHTML = cell('Aprovado (bruto)', money(m.gross)) + cell('Líquido de taxas', money(m.net)) + cell('Vendas aprovadas', num(m.qty)) +
        cell('Ticket médio', A.orDash(m.ticket, money)) + cell('Pendente', money(m.pending) + ' <span class="muted small">' + num(m.pendingQty) + '</span>') +
        cell('Reembolsos', money(m.refunds) + ' <span class="muted small">' + pct(m.refundRate) + '</span>') + cell('Pix', money(m.methods.pix)) + cell('Cartão', money(m.methods.card));
      box.innerHTML = ui().table({
        id: 'sales', rows, defaultSort: { key: 'date', dir: 'desc' },
        rowAttr: (r) => 'class="clickable" data-id="' + r.id + '"',
        empty: '<div class="empty"><p>Nenhuma venda neste período/filtro.</p></div>',
        columns: [
          { key: 'date', label: 'Data', sort: (r) => r.date + (r.createdAt || ''), html: (r) => '<b>' + A.fmtDate(r.date) + '</b>' },
          { key: 'offer', label: 'Oferta', sort: (r) => offerName(A.metrics.saleOffer(r)), html: (r) => esc(offerName(A.metrics.saleOffer(r)) || '—') + (r.product ? '<div class="muted small">' + esc(r.product) + '</div>' : '') },
          { key: 'camp', label: 'Campanha', sort: (r) => campName(r.campaignId), html: (r) => (r.campaignId ? '<span class="truncate" style="display:inline-block;max-width:220px">' + esc(campName(r.campaignId)) + '</span>' : '<span class="muted">—</span>') + (r.source ? '<div class="muted small">lançamento diário</div>' : '') },
          { key: 'status', label: 'Status', sort: (r) => r.status, html: (r) => A.C.badge(A.C.SALE_STATUS, r.status) },
          { key: 'method', label: 'Pagamento', sort: (r) => r.method, html: (r) => esc(A.C.label(A.C.PAYMENT, r.method)) },
          { key: 'qty', label: 'Qtd', num: true, sort: (r) => Number(r.qty) || 0, html: (r) => num(r.qty) },
          { key: 'gross', label: 'Bruto', num: true, sort: (r) => Number(r.gross) || 0, html: (r) => money(r.gross) },
          { key: 'fees', label: 'Taxas', num: true, sort: (r) => Number(r.fees) || 0, html: (r) => money(r.fees) },
          { key: 'net', label: 'Líquido', num: true, sort: (r) => (Number(r.gross) || 0) - (Number(r.fees) || 0), html: (r) => '<b>' + money((Number(r.gross) || 0) - (Number(r.fees) || 0)) + '</b>' },
          { key: 'customer', label: 'Cliente', sort: (r) => r.customer || '', html: (r) => esc(r.customer || '') },
          { key: 'act', label: '', cls: 'actions', html: (r) => (r.status === 'pending' ? '<button class="icon-btn" data-a="approve" title="Marcar como aprovada">' + icon('check') + '</button>' : '') +
            '<button class="icon-btn" data-a="edit" title="Editar">' + icon('edit') + '</button><button class="icon-btn" data-a="dup" title="Duplicar">' + icon('copy') + '</button><button class="icon-btn danger" data-a="del" title="Excluir">' + icon('trash') + '</button>' },
        ],
        footer: rows.length > 1 ? { date: '<b>' + rows.length + ' registro(s)</b>', qty: num(rows.reduce((a, r) => a + (Number(r.qty) || 0), 0)), gross: money(rows.reduce((a, r) => a + (Number(r.gross) || 0), 0)), fees: money(rows.reduce((a, r) => a + (Number(r.fees) || 0), 0)), net: money(rows.reduce((a, r) => a + (Number(r.gross) || 0) - (Number(r.fees) || 0), 0)) } : null,
      });
    };
    draw();
    ui().bindSort(box, draw);
    A.on(box, 'click', 'tr[data-id]', (e, tr) => {
      const s = A.store.get('sales', tr.dataset.id);
      const b = e.target.closest('[data-a]');
      if (!b) return edit(s);
      if (b.dataset.a === 'edit') edit(s);
      if (b.dataset.a === 'approve') {
        A.store.update('sales', s.id, { status: 'approved', fees: s.fees || A.pages.campaigns.autoFees(A.metrics.saleOffer(s), s.gross, s.qty) });
        ui().toast('Venda aprovada.');
      }
      if (b.dataset.a === 'dup') { const c = Object.assign({}, s, { date: A.today() }); delete c.id; delete c.createdAt; delete c.source; A.store.insert('sales', c); ui().toast('Venda duplicada para hoje.'); }
      if (b.dataset.a === 'del') ui().removeWithUndo('sales', s.id, 'venda de ' + A.fmtDate(s.date));
    });
    A.$('#vSearch', view).addEventListener('input', A.debounce((e) => { A.store.setUI({ sales: Object.assign({}, A.store.ui.sales, { q: e.target.value }) }); draw(); }, 120));
    A.$$('[data-u]', view).forEach((s) => s.addEventListener('change', () => { const n = Object.assign({}, A.store.ui.sales); n[s.dataset.u] = s.value; A.store.setUI({ sales: n }); draw(); }));
    A.on(view, 'click', '[data-act]', (e, b) => {
      if (b.dataset.act === 'new') edit(null, A.store.ui.sales && A.store.ui.sales.offerId ? { offerId: A.store.ui.sales.offerId } : null);
      if (b.dataset.act === 'export') {
        const head = ['Data', 'Oferta', 'Campanha', 'Status', 'Pagamento', 'Qtd', 'Bruto', 'Taxas', 'Líquido', 'Cliente', 'Item', 'Anotações'];
        A.download('vendas-' + A.today() + '.csv', A.toCSV([head].concat(rows.map((r) => [A.fmtDate(r.date), offerName(A.metrics.saleOffer(r)), campName(r.campaignId), A.C.label(A.C.SALE_STATUS, r.status), A.C.label(A.C.PAYMENT, r.method), r.qty, A.csvNum(r.gross), A.csvNum(r.fees), A.csvNum((r.gross || 0) - (r.fees || 0)), r.customer, r.product, r.notes]))), 'text/csv;charset=utf-8');
      }
    });
  }

  A.pages.sales = { title: 'Vendas', period: true, render, edit };
})(window.App);
