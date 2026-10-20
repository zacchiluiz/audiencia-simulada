/* Página: Campanhas (lista, detalhe, lançamento diário) */
(function (A) {
  'use strict';
  const { esc, icon, money, num, pct, ratioX, orDash } = A;
  const ui = () => A.ui;
  const S = () => A.store.state;
  const statusBadge = (s) => A.C.badge(A.C.CAMPAIGN_STATUS, s);
  const offerName = (id) => { const o = A.store.get('offers', id); return o ? o.name : ''; };

  /* ---------- Formulário de campanha ---------- */
  const fields = () => [
    { name: 'name', label: 'Nome da campanha', required: true, placeholder: 'Ex.: [CBO] Oferta X — Público aberto' },
    { name: 'offerId', label: 'Oferta', type: 'select', empty: '— sem oferta —', options: () => S().offers.map((o) => [o.id, o.name]), span: 6 },
    { name: 'platform', label: 'Fonte de tráfego', type: 'select', options: A.C.TRAFFIC, span: 6, default: 'Meta Ads' },
    { name: 'status', label: 'Status', type: 'select', options: A.C.CAMPAIGN_STATUS.map((x) => [x[0], x[1]]), span: 4, default: 'active' },
    { name: 'dailyBudget', label: 'Orçamento diário', type: 'money', span: 4 },
    { name: 'startDate', label: 'Início', type: 'date', span: 4, default: A.today() },
    { name: 'account', label: 'Conta de anúncio / BM', span: 6, placeholder: 'Ex.: BM Principal' },
    { name: 'objective', label: 'Objetivo', span: 6, placeholder: 'Conversão, Vendas, Tráfego…' },
    { name: 'link', label: 'Link / UTM usado', type: 'url', placeholder: 'https://…' },
    { name: 'tags', label: 'Tags', type: 'tags' },
    { name: 'notes', label: 'Anotações', type: 'textarea', placeholder: 'Públicos, criativos, aprendizados…' },
  ];

  function edit(c, preset) {
    const isNew = !c;
    ui().formModal({
      title: isNew ? 'Nova campanha' : 'Editar campanha',
      fields: fields(), values: c || preset || {},
      onSave: (data) => {
        if (isNew) {
          const item = A.store.insert('campaigns', Object.assign(data, { color: A.store.nextColor('campaigns') }));
          ui().toast('Campanha criada.', { action: { label: 'Lançar dia', fn: () => quickEntry({ campaignId: item.id }) } });
        } else { A.store.update('campaigns', c.id, data); ui().toast('Campanha atualizada.'); }
      },
    });
  }

  function duplicate(c) {
    const copy = Object.assign({}, c, { name: c.name + ' (cópia)', color: A.store.nextColor('campaigns'), startDate: A.today() });
    delete copy.id; delete copy.createdAt; delete copy.updatedAt;
    A.store.insert('campaigns', copy);
    ui().toast('Campanha duplicada (sem os registros).');
  }

  function remove(c) {
    return ui().removeWithUndo('campaigns', c.id, c.name, 'Os registros diários de gasto desta campanha também serão excluídos. As vendas são mantidas, mas ficam sem campanha.');
  }

  /* ---------- Lançamento do dia (upsert por campanha + data) ---------- */
  function dayData(campaignId, date) {
    const sp = S().spend.find((s) => s.campaignId === campaignId && s.date === date) || {};
    const sale = S().sales.find((s) => s.campaignId === campaignId && s.date === date && s.source === 'daily') || {};
    const ref = S().sales.find((s) => s.campaignId === campaignId && s.date === date && s.source === 'daily-refund') || {};
    const others = S().sales.filter((s) => s.campaignId === campaignId && s.date === date && !s.source);
    return {
      amount: sp.amount || 0, impressions: sp.impressions || 0, clicks: sp.clicks || 0, checkouts: sp.checkouts || 0,
      qty: sale.qty || 0, gross: sale.gross || 0, fees: sale.feesAuto ? undefined : sale.fees, method: sale.method || 'pix',
      refundQty: ref.qty || 0, refundGross: ref.gross || 0, others, exists: !!(sp.id || sale.id || ref.id),
    };
  }
  function autoFees(offerId, gross, qty) {
    const o = A.store.get('offers', offerId);
    if (!o) return 0;
    return Math.round(((gross * (Number(o.feeRate) || 0)) / 100 + qty * (Number(o.feeFixed) || 0)) * 100) / 100;
  }
  function upsertDay(st, campaignId, date, d) {
    const c = st.campaigns.find((x) => x.id === campaignId);
    const offerId = c ? c.offerId : '';
    const now = new Date().toISOString();
    const up = (arr, pred, keep, obj) => {
      const i = arr.findIndex(pred);
      if (!keep) { if (i >= 0) arr.splice(i, 1); return; }
      if (i >= 0) Object.assign(arr[i], obj, { updatedAt: now });
      else arr.push(Object.assign({ id: A.uid(), createdAt: now, updatedAt: now }, obj));
    };
    up(st.spend, (s) => s.campaignId === campaignId && s.date === date,
      d.amount || d.impressions || d.clicks || d.checkouts,
      { campaignId, date, amount: d.amount, impressions: d.impressions, clicks: d.clicks, checkouts: d.checkouts });
    const feesAuto = d.fees === null || d.fees === undefined;
    const fees = feesAuto ? autoFees(offerId, d.gross, d.qty) : d.fees;
    up(st.sales, (s) => s.campaignId === campaignId && s.date === date && s.source === 'daily',
      d.qty || d.gross,
      { campaignId, offerId, date, qty: d.qty, gross: d.gross, fees, feesAuto, status: 'approved', method: d.method || 'pix', source: 'daily' });
    up(st.sales, (s) => s.campaignId === campaignId && s.date === date && s.source === 'daily-refund',
      d.refundQty || d.refundGross,
      { campaignId, offerId, date, qty: d.refundQty || 1, gross: d.refundGross, fees: 0, status: 'refunded', method: 'other', source: 'daily-refund' });
  }
  function removeDay(campaignId, date) {
    const snap = A.store.snapshot();
    A.store.batch((st) => {
      st.spend = st.spend.filter((s) => !(s.campaignId === campaignId && s.date === date));
      st.sales = st.sales.filter((s) => !(s.campaignId === campaignId && s.date === date && (s.source === 'daily' || s.source === 'daily-refund')));
    });
    ui().toast('Registro de ' + A.fmtDate(date) + ' excluído.', { action: { label: 'Desfazer', fn: () => A.store.restore(snap) } });
  }

  const dayFields = [
    { type: 'section', label: 'Tráfego' },
    { name: 'amount', label: 'Valor gasto', type: 'money', span: 3 },
    { name: 'impressions', label: 'Impressões', type: 'int', span: 3 },
    { name: 'clicks', label: 'Cliques', type: 'int', span: 3 },
    { name: 'checkouts', label: 'Checkouts (IC)', type: 'int', span: 3 },
    { type: 'section', label: 'Vendas aprovadas' },
    { name: 'qty', label: 'Nº de vendas', type: 'int', span: 3 },
    { name: 'gross', label: 'Faturamento bruto', type: 'money', span: 3, hint: 'Valor que entra pra você (comissão)' },
    { name: 'fees', label: 'Taxas da plataforma', type: 'money', span: 3, hint: 'Vazio = calcula pela oferta' },
    { name: 'method', label: 'Pagamento principal', type: 'select', options: A.C.PAYMENT, span: 3 },
    { type: 'section', label: 'Reembolsos / chargebacks do dia (opcional)' },
    { name: 'refundQty', label: 'Qtd. reembolsos', type: 'int', span: 3 },
    { name: 'refundGross', label: 'Valor reembolsado', type: 'money', span: 3 },
  ];

  function quickEntry(opts) {
    opts = opts || {};
    const camps = S().campaigns.filter((c) => c.status !== 'ended' || c.id === opts.campaignId);
    if (!S().campaigns.length) {
      ui().toast('Crie uma campanha primeiro.');
      edit();
      return;
    }
    const sorted = camps.slice().sort((a, b) => (a.status === 'active' ? -1 : 0) - (b.status === 'active' ? -1 : 0) || a.name.localeCompare(b.name));
    const cid = opts.campaignId || (A.store.ui.lastCampaign && camps.some((c) => c.id === A.store.ui.lastCampaign) ? A.store.ui.lastCampaign : (sorted[0] || {}).id);
    const date = opts.date || A.today();
    const head =
      '<div class="form-grid" style="margin-bottom:14px">' +
        '<label class="field span-8"><span>Campanha *</span><select class="input" name="campaignId" data-required>' +
          sorted.map((c) => '<option value="' + c.id + '"' + (c.id === cid ? ' selected' : '') + '>' + esc(c.name) + (c.offerId ? ' — ' + esc(offerName(c.offerId)) : '') + '</option>').join('') +
        '</select></label>' +
        '<label class="field span-4"><span>Data *</span><input type="date" class="input" name="date" value="' + date + '" data-required></label>' +
        '<div class="span-12 small muted" id="dayInfo"></div>' +
      '</div>';
    const preview = '<div class="preview-box" style="margin-top:16px" id="dayPreview"></div>';
    const m = ui().modal({
      title: 'Lançamento do dia', size: 'wide', sticky: true,
      body: head + '<div id="dayFields"></div>' + preview,
      submitLabel: 'Salvar lançamento',
      onMount: (form) => {
        const box = A.$('#dayFields', form);
        const load = () => {
          const d = dayData(form.campaignId.value, form.date.value);
          box.innerHTML = ui().formHtml(dayFields, Object.assign({}, d, { fees: d.fees === undefined ? '' : d.fees }));
          if (d.gross) form.gross.dataset.touched = '1';
          const info = A.$('#dayInfo', form);
          const c = A.store.get('campaigns', form.campaignId.value) || {};
          info.innerHTML = (d.exists ? '<span class="badge info">Editando lançamento existente</span> ' : '') +
            (c.platform ? esc(c.platform) + ' · ' : '') + (c.dailyBudget ? 'orçamento ' + money(c.dailyBudget) + '/dia · ' : '') +
            (d.others.length ? d.others.length + ' venda(s) avulsa(s) registradas neste dia (em Vendas)' : '');
          calc();
        };
        const calc = () => {
          const v = ui().readForm(form, dayFields);
          const c = A.store.get('campaigns', form.campaignId.value) || {};
          const o = A.store.get('offers', c.offerId) || {};
          const fees = form.fees.value.trim() === '' ? autoFees(c.offerId, v.gross, v.qty) : v.fees;
          form.fees.placeholder = 'auto: ' + A.toInput(autoFees(c.offerId, v.gross, v.qty));
          const st = S().settings;
          const ads = v.amount * (1 + (Number(st.adTaxRate) || 0) / 100);
          const profit = v.gross - fees - v.gross * (Number(st.taxRate) || 0) / 100 - v.qty * (Number(o.productCost) || 0) - ads;
          A.$('#dayPreview', form).innerHTML =
            '<div>Lucro do dia<b class="' + (profit < 0 ? 'neg' : 'pos') + '">' + money(profit) + '</b></div>' +
            '<div>ROAS<b>' + ratioX(A.div(v.gross, ads)) + '</b></div>' +
            '<div>CPA<b>' + orDash(A.div(ads, v.qty), money) + '</b></div>' +
            '<div>CTR · CPC<b>' + pct(A.div(v.clicks, v.impressions)) + ' · ' + orDash(A.div(v.amount, v.clicks), money) + '</b></div>';
        };
        // Sugestão: preencher faturamento a partir do nº de vendas
        form.addEventListener('input', (e) => {
          if (e.target.name === 'qty' && !form.gross.dataset.touched) {
            const c = A.store.get('campaigns', form.campaignId.value) || {};
            const o = A.store.get('offers', c.offerId);
            if (o && o.price) form.gross.value = A.toInput(A.parseNum(form.qty.value) * o.price * (Number(o.commission) || 100) / 100);
          }
          if (e.target.name === 'gross') form.gross.dataset.touched = '1';
          calc();
        });
        form.campaignId.addEventListener('change', load);
        form.date.addEventListener('change', load);
        load();
      },
      onSubmit: (form) => {
        const v = ui().readForm(form, dayFields);
        if (form.fees.value.trim() === '') v.fees = null;
        const campaignId = form.campaignId.value, d = form.date.value;
        A.store.batch((st) => upsertDay(st, campaignId, d, v));
        A.store.setUI({ lastCampaign: campaignId });
        ui().toast('Lançamento de ' + A.fmtDate(d) + ' salvo.');
        if (opts.onSaved) opts.onSaved();
      },
    });
    return m;
  }

  /** Lançamento rápido de todas as campanhas ativas numa grade. */
  function bulkEntry() {
    const camps = S().campaigns.filter((c) => c.status === 'active' || c.status === 'testing');
    if (!camps.length) { ui().toast('Nenhuma campanha ativa ou em teste.'); return; }
    const rowsHtml = (date) => camps.map((c) => {
      const d = dayData(c.id, date);
      const v = (x) => esc(A.toInput(x));
      return '<tr data-id="' + c.id + '"><td><div class="name-cell">' + ui().colorDot(c.color) + '<b class="truncate" style="max-width:260px">' + esc(c.name) + '</b></div><div class="muted small">' + esc(offerName(c.offerId) || '—') + '</div></td>' +
        '<td><input class="input input-sm tnum" inputmode="decimal" name="amount" value="' + v(d.amount) + '" placeholder="0"></td>' +
        '<td><input class="input input-sm tnum" inputmode="numeric" name="qty" value="' + v(d.qty) + '" placeholder="0" style="width:80px"></td>' +
        '<td><input class="input input-sm tnum" inputmode="decimal" name="gross" value="' + v(d.gross) + '" placeholder="0"></td></tr>';
    }).join('');
    ui().modal({
      title: 'Lançar todas as campanhas', size: 'wide', sticky: true,
      body: '<div class="row" style="margin-bottom:12px"><label class="field"><span>Data</span><input type="date" class="input" name="date" value="' + A.today() + '"></label><div class="muted small" style="align-self:flex-end;max-width:420px">Preencha gasto, vendas e faturamento de cada campanha ativa. Taxas são calculadas pela oferta. Para impressões, cliques e reembolsos use o lançamento individual.</div></div>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Campanha</th><th>Gasto</th><th>Vendas</th><th>Faturamento</th></tr></thead><tbody id="bulkRows">' + rowsHtml(A.today()) + '</tbody></table></div>',
      submitLabel: 'Salvar tudo',
      onMount: (form) => { form.date.addEventListener('change', () => { A.$('#bulkRows', form).innerHTML = rowsHtml(form.date.value); }); },
      onSubmit: (form) => {
        const date = form.date.value;
        A.store.batch((st) => {
          A.$$('#bulkRows tr', form).forEach((tr) => {
            const prev = dayData(tr.dataset.id, date);
            const g = (n) => A.parseNum(tr.querySelector('[name=' + n + ']').value);
            const next = Object.assign({}, prev, { amount: g('amount'), qty: Math.round(g('qty')), gross: g('gross') });
            const changed = next.amount !== prev.amount || next.qty !== prev.qty || next.gross !== prev.gross;
            if (!changed) return;
            if (next.gross !== prev.gross || next.qty !== prev.qty) next.fees = null;
            upsertDay(st, tr.dataset.id, date, next);
          });
        });
        ui().toast('Lançamentos de ' + A.fmtDate(date) + ' salvos.');
      },
    });
  }

  /* ---------- Lista ---------- */
  function renderList(view) {
    const st = S();
    const u = A.store.ui.camps || {};
    const range = A.rangeFor(A.store.ui.period);
    if (!st.campaigns.length) {
      view.innerHTML = '<div class="card">' + ui().emptyState('megaphone', 'Nenhuma campanha ainda', 'Crie campanhas e ligue cada uma a uma oferta para ver gasto, faturamento, lucro, ROAS e CPA por campanha.',
        '<button class="btn btn-primary" data-act="new">' + icon('plus') + 'Nova campanha</button>') + '</div>';
      A.on(view, 'click', '[data-act=new]', () => edit());
      return;
    }
    const platforms = Array.from(new Set(st.campaigns.map((c) => c.platform).filter(Boolean)));
    view.innerHTML =
      '<div class="toolbar">' +
        '<div class="search">' + icon('search') + '<input class="input input-sm" id="cSearch" placeholder="Buscar campanha, conta, tag…" value="' + esc(u.q || '') + '"></div>' +
        '<select class="input input-sm" data-u="status"><option value="">Todos os status</option><option value="running"' + (u.status === 'running' ? ' selected' : '') + '>Rodando (ativa + teste)</option>' + A.C.CAMPAIGN_STATUS.map((x) => '<option value="' + x[0] + '"' + (u.status === x[0] ? ' selected' : '') + '>' + x[1] + '</option>').join('') + '</select>' +
        '<select class="input input-sm" data-u="offerId"><option value="">Todas as ofertas</option>' + st.offers.map((o) => '<option value="' + o.id + '"' + (u.offerId === o.id ? ' selected' : '') + '>' + esc(o.name) + '</option>').join('') + '</select>' +
        '<select class="input input-sm" data-u="platform"><option value="">Todas as fontes</option>' + platforms.map((p) => '<option' + (u.platform === p ? ' selected' : '') + '>' + esc(p) + '</option>').join('') + '</select>' +
        '<span class="spacer"></span>' +
        '<button class="btn btn-sm" data-act="export">' + icon('download') + 'CSV</button>' +
        '<button class="btn btn-sm" data-act="bulk">' + icon('list') + 'Lançar todas</button>' +
        '<button class="btn btn-sm btn-primary" data-act="new">' + icon('plus') + 'Nova campanha</button>' +
      '</div>' +
      '<div class="card"><div id="cTable"></div></div>';

    const tableBox = A.$('#cTable', view);
    let rows = [];
    const draw = () => {
      const q = A.norm(A.store.ui.camps && A.store.ui.camps.q);
      const uu = A.store.ui.camps || {};
      rows = A.metrics.breakdown('campaign', { range }).filter((r) => {
        const c = r.item;
        if (uu.status === 'running' ? !(c.status === 'active' || c.status === 'testing') : (uu.status && c.status !== uu.status)) return false;
        if (uu.offerId && c.offerId !== uu.offerId) return false;
        if (uu.platform && c.platform !== uu.platform) return false;
        if (q && !A.norm([c.name, c.account, c.platform, offerName(c.offerId), (c.tags || []).join(' ')].join(' ')).includes(q)) return false;
        return true;
      });
      const tot = A.metrics.compute([], [], 0);
      ['gross', 'adsTotal', 'profit', 'qty'].forEach((k) => { tot[k] = rows.reduce((s, r) => s + r.m[k], 0); });
      tot.roas = A.div(tot.gross, tot.adsTotal); tot.roi = A.div(tot.profit, tot.adsTotal); tot.cpa = A.div(tot.adsTotal, tot.qty);
      tableBox.innerHTML = ui().table({
        id: 'camps', rows, defaultSort: { key: 'profit', dir: 'desc' },
        rowAttr: (r) => 'class="clickable" data-id="' + r.id + '"',
        empty: '<div class="empty"><p>Nenhuma campanha corresponde aos filtros.</p></div>',
        columns: [
          { key: 'name', label: 'Campanha', sort: (r) => r.name, html: (r) => '<div class="name-cell">' + ui().colorDot(r.color) + '<div style="min-width:0"><b class="truncate" style="display:block;max-width:300px">' + esc(r.name) + '</b><span class="muted small">' + esc(r.item.platform || '') + ' · ' + esc(offerName(r.item.offerId) || 'sem oferta') + (r.item.account ? ' · ' + esc(r.item.account) : '') + '</span></div></div>' },
          { key: 'status', label: 'Status', sort: (r) => r.item.status, html: (r) => statusBadge(r.item.status) },
          { key: 'spend', label: 'Gasto', num: true, sort: (r) => r.m.adsTotal, html: (r) => money(r.m.adsTotal) },
          { key: 'gross', label: 'Faturamento', num: true, sort: (r) => r.m.gross, html: (r) => money(r.m.gross) },
          { key: 'profit', label: 'Lucro', num: true, sort: (r) => r.m.profit, html: (r) => ui().signed(r.m.profit) },
          { key: 'roas', label: 'ROAS', num: true, sort: (r) => r.m.roas, html: (r) => ui().roasHtml(r.m.roas) },
          { key: 'roi', label: 'ROI', num: true, sort: (r) => r.m.roi, html: (r) => ui().signedPct(r.m.roi) },
          { key: 'cpa', label: 'CPA', num: true, sort: (r) => r.m.cpa, html: (r) => orDash(r.m.cpa, money) },
          { key: 'qty', label: 'Vendas', num: true, sort: (r) => r.m.qty, html: (r) => num(r.m.qty) },
          { key: 'act', label: '', cls: 'actions', html: (r) =>
            '<button class="icon-btn" data-a="day" title="Lançar dia">' + icon('zap') + '</button>' +
            '<button class="icon-btn" data-a="toggle" title="' + (r.item.status === 'paused' ? 'Ativar' : 'Pausar') + '">' + icon(r.item.status === 'paused' ? 'play' : 'pause') + '</button>' +
            '<button class="icon-btn" data-a="edit" title="Editar">' + icon('edit') + '</button>' +
            '<button class="icon-btn danger" data-a="del" title="Excluir">' + icon('trash') + '</button>' },
        ],
        footer: rows.length > 1 ? { name: '<b>Total (' + rows.length + ')</b>', spend: money(tot.adsTotal), gross: money(tot.gross), profit: ui().signed(tot.profit), roas: ui().roasHtml(tot.roas), roi: ui().signedPct(tot.roi), cpa: orDash(tot.cpa, money), qty: num(tot.qty) } : null,
      });
    };
    draw();
    ui().bindSort(tableBox, draw);
    A.on(tableBox, 'click', 'tr[data-id]', (e, tr) => {
      const c = A.store.get('campaigns', tr.dataset.id);
      const b = e.target.closest('[data-a]');
      if (!b) { location.hash = '#/campanhas/' + c.id; return; }
      e.stopPropagation();
      ({
        day: () => quickEntry({ campaignId: c.id }),
        toggle: () => { A.store.update('campaigns', c.id, { status: c.status === 'paused' ? 'active' : 'paused' }); },
        edit: () => edit(c), dup: () => duplicate(c), del: () => remove(c),
      })[b.dataset.a]();
    });
    A.$('#cSearch', view).addEventListener('input', A.debounce((e) => { A.store.setUI({ camps: Object.assign({}, A.store.ui.camps, { q: e.target.value }) }); draw(); }, 120));
    A.$$('[data-u]', view).forEach((s) => s.addEventListener('change', () => { const n = Object.assign({}, A.store.ui.camps); n[s.dataset.u] = s.value; A.store.setUI({ camps: n }); draw(); }));
    A.on(view, 'click', '[data-act]', (e, b) => {
      if (b.dataset.act === 'new') edit(null, A.store.ui.camps && A.store.ui.camps.offerId ? { offerId: A.store.ui.camps.offerId } : null);
      if (b.dataset.act === 'bulk') bulkEntry();
      if (b.dataset.act === 'export') exportCSV(rows);
    });
  }

  function exportCSV(rows) {
    const head = ['Campanha', 'Oferta', 'Status', 'Fonte', 'Conta', 'Gasto', 'Faturamento', 'Lucro', 'ROAS', 'ROI %', 'CPA', 'Vendas', 'Impressões', 'Cliques', 'CTR %'];
    const data = rows.map((r) => [r.name, offerName(r.item.offerId), A.C.label(A.C.CAMPAIGN_STATUS, r.item.status), r.item.platform, r.item.account,
      A.csvNum(r.m.adsTotal), A.csvNum(r.m.gross), A.csvNum(r.m.profit), Number.isFinite(r.m.roas) ? A.csvNum(r.m.roas) : '', Number.isFinite(r.m.roi) ? A.csvNum(r.m.roi * 100) : '',
      Number.isFinite(r.m.cpa) ? A.csvNum(r.m.cpa) : '', r.m.qty, r.m.impressions, r.m.clicks, Number.isFinite(r.m.ctr) ? A.csvNum(r.m.ctr * 100) : '']);
    A.download('campanhas-' + A.today() + '.csv', A.toCSV([head].concat(data)), 'text/csv;charset=utf-8');
  }

  /* ---------- Detalhe ---------- */
  function renderDetail(view, id) {
    const c = A.store.get('campaigns', id);
    if (!c) { view.innerHTML = '<div class="card">' + ui().emptyState('megaphone', 'Campanha não encontrada', 'Ela pode ter sido excluída.', '<a class="btn" href="#/campanhas">Voltar</a>') + '</div>'; return; }
    A.app.setTitle(c.name);
    const range = A.rangeFor(A.store.ui.period);
    const m = A.metrics.summarize({ range, campaignId: id });
    const o = A.store.get('offers', c.offerId);
    const metric = (l, v) => '<div><span>' + l + '</span><b>' + v + '</b></div>';
    view.innerHTML =
      '<a class="back-link" href="#/campanhas">' + icon('back') + 'Campanhas</a>' +
      '<div class="detail-head"><div class="title"><h2>' + esc(c.name) + '</h2><div class="meta">' + statusBadge(c.status) +
        '<span>' + esc(c.platform || '') + '</span>' + (o ? '<a href="#/ofertas/' + o.id + '">' + icon('package') + ' ' + esc(o.name) + '</a>' : '') +
        (c.account ? '<span>· ' + esc(c.account) + '</span>' : '') + (c.startDate ? '<span>· desde ' + A.fmtDate(c.startDate) + '</span>' : '') +
        (c.dailyBudget ? '<span>· ' + money(c.dailyBudget) + '/dia</span>' : '') + ui().extLink(c.link) + ui().tagsHtml(c.tags) + '</div></div>' +
        '<div class="row"><button class="btn btn-primary" data-a="day">' + icon('zap') + 'Lançar dia</button>' +
        '<button class="btn" data-a="toggle">' + icon(c.status === 'paused' ? 'play' : 'pause') + (c.status === 'paused' ? 'Ativar' : 'Pausar') + '</button>' +
        '<button class="btn" data-a="edit">' + icon('edit') + 'Editar</button>' +
        '<button class="btn" data-a="dup">' + icon('copy') + '</button>' +
        '<button class="btn btn-danger" data-a="del">' + icon('trash') + '</button></div></div>' +
      '<div class="stack">' +
      '<div class="metric-strip">' +
        metric('Lucro', ui().signed(m.profit)) + metric('Faturamento', money(m.gross)) + metric('Gasto', money(m.adsTotal)) +
        metric('ROAS', ratioX(m.roas)) + metric('ROI', ui().signedPct(m.roi)) + metric('CPA', orDash(m.cpa, money)) + metric('Vendas', num(m.qty)) +
        metric('Ticket médio', orDash(m.ticket, money)) + metric('Impressões', num(m.impressions)) + metric('Cliques', num(m.clicks)) +
        metric('CTR', pct(m.ctr, 2)) + metric('CPC', orDash(m.cpc, money)) + metric('CPM', orDash(m.cpm, money)) + metric('Checkouts', num(m.checkouts)) +
        metric('Custo / IC', orDash(m.cpi, money)) + metric('Conv. checkout', pct(m.checkoutConv)) + metric('Conv. clique', pct(m.conv, 2)) + metric('Reembolsos', money(m.refunds)) +
      '</div>' +
      '<div class="card"><div class="card-head"><h3>Desempenho</h3><span class="spacer"></span><div class="legend"><span><i style="background:var(--s1)"></i>Faturamento</span><span><i style="background:var(--s2)"></i>Gasto</span><span><i style="background:var(--s3)"></i>Lucro</span></div></div><div class="card-body"><div id="cdLine"></div></div></div>' +
      '<div class="card"><div class="card-head"><h3>Registros diários</h3><span class="sub">' + esc(A.rangeLabel(A.store.ui.period)) + '</span></div><div class="card-body" style="padding-top:6px" id="cdDays"></div></div>' +
      (c.notes ? '<div class="card"><div class="card-head"><h3>Anotações</h3></div><div class="card-body notes">' + esc(c.notes) + '</div></div>' : '') +
      '</div>';

    const ser = A.metrics.series({ range: range.from ? range : { from: c.startDate || null, to: null }, campaignId: id });
    A.charts.line(A.$('#cdLine', view), {
      points: ser.points.map((p) => ({ label: p.label, title: ser.monthly ? A.monthName(p.date) : A.weekday(p.date) + ', ' + A.fmtDate(p.date), values: { gross: p.m.gross, spend: p.m.adsTotal, profit: p.m.profit }, m: p.m })),
      series: [{ key: 'gross', name: 'Faturamento', color: 'var(--s1)', area: true }, { key: 'spend', name: 'Gasto', color: 'var(--s2)' }, { key: 'profit', name: 'Lucro', color: 'var(--s3)' }],
      extraTip: (p) => A.charts.ttRow('', 'Vendas', num(p.m.qty)) + A.charts.ttRow('', 'CPA', orDash(p.m.cpa, money)),
    });

    // Tabela por dia
    const dates = new Set();
    S().spend.forEach((s) => { if (s.campaignId === id && A.inRange(s.date, range)) dates.add(s.date); });
    S().sales.forEach((s) => { if (s.campaignId === id && A.inRange(s.date, range)) dates.add(s.date); });
    const rows = Array.from(dates).map((d) => ({ date: d, m: A.metrics.summarize({ range: { from: d, to: d }, campaignId: id }) }));
    const box = A.$('#cdDays', view);
    const draw = () => {
      box.innerHTML = ui().table({
        id: 'campDays', rows, defaultSort: { key: 'date', dir: 'desc' },
        empty: '<div class="muted small" style="padding:12px 0">Sem registros no período. Clique em <b>Lançar dia</b> para começar.</div>',
        columns: [
          { key: 'date', label: 'Data', sort: (r) => r.date, html: (r) => '<b>' + A.fmtDate(r.date) + '</b> <span class="muted small">' + A.weekday(r.date) + '</span>' },
          { key: 'spend', label: 'Gasto', num: true, sort: (r) => r.m.adsTotal, html: (r) => money(r.m.adsTotal) },
          { key: 'imp', label: 'Impr.', num: true, sort: (r) => r.m.impressions, html: (r) => num(r.m.impressions) },
          { key: 'clk', label: 'Cliques', num: true, sort: (r) => r.m.clicks, html: (r) => num(r.m.clicks) },
          { key: 'ctr', label: 'CTR', num: true, sort: (r) => r.m.ctr, html: (r) => pct(r.m.ctr, 2) },
          { key: 'cpc', label: 'CPC', num: true, sort: (r) => r.m.cpc, html: (r) => orDash(r.m.cpc, money) },
          { key: 'ic', label: 'IC', num: true, sort: (r) => r.m.checkouts, html: (r) => num(r.m.checkouts) },
          { key: 'qty', label: 'Vendas', num: true, sort: (r) => r.m.qty, html: (r) => num(r.m.qty) },
          { key: 'gross', label: 'Faturamento', num: true, sort: (r) => r.m.gross, html: (r) => money(r.m.gross) },
          { key: 'profit', label: 'Lucro', num: true, sort: (r) => r.m.profit, html: (r) => ui().signed(r.m.profit) },
          { key: 'roas', label: 'ROAS', num: true, sort: (r) => r.m.roas, html: (r) => ui().roasHtml(r.m.roas) },
          { key: 'cpa', label: 'CPA', num: true, sort: (r) => r.m.cpa, html: (r) => orDash(r.m.cpa, money) },
          { key: 'act', label: '', cls: 'actions', html: (r) => '<button class="icon-btn" data-d="edit" data-date="' + r.date + '" title="Editar">' + icon('edit') + '</button><button class="icon-btn danger" data-d="del" data-date="' + r.date + '" title="Excluir lançamento">' + icon('trash') + '</button>' },
        ],
        footer: rows.length > 1 ? { date: '<b>Total</b>', spend: money(m.adsTotal), imp: num(m.impressions), clk: num(m.clicks), ctr: pct(m.ctr, 2), cpc: orDash(m.cpc, money), ic: num(m.checkouts), qty: num(m.qty), gross: money(m.gross), profit: ui().signed(m.profit), roas: ui().roasHtml(m.roas), cpa: orDash(m.cpa, money) } : null,
      });
    };
    draw();
    ui().bindSort(box, draw);
    A.on(box, 'click', '[data-d]', async (e, b) => {
      if (b.dataset.d === 'edit') quickEntry({ campaignId: id, date: b.dataset.date });
      else if (await ui().confirm({ title: 'Excluir lançamento?', message: 'Remove gasto e vendas lançadas em ' + A.fmtDate(b.dataset.date) + ' nesta campanha (vendas avulsas são mantidas).' })) removeDay(id, b.dataset.date);
    });
    A.on(view, 'click', '.detail-head [data-a]', async (e, b) => {
      const a = b.dataset.a;
      if (a === 'day') quickEntry({ campaignId: id });
      if (a === 'toggle') A.store.update('campaigns', id, { status: c.status === 'paused' ? 'active' : 'paused' });
      if (a === 'edit') edit(c);
      if (a === 'dup') duplicate(c);
      if (a === 'del' && await remove(c)) location.hash = '#/campanhas';
    });
  }

  A.pages.campaigns = {
    title: 'Campanhas', period: true,
    render: (view, params) => (params[0] ? renderDetail(view, params[0]) : renderList(view)),
    edit, quickEntry, bulkEntry, autoFees,
  };
})(window.App);
