/* Página: Custos extras (ferramentas, criativos, equipe…) */
(function (A) {
  'use strict';
  const { esc, icon, money } = A;
  const ui = () => A.ui;
  const S = () => A.store.state;

  const fields = () => [
    { name: 'description', label: 'Descrição', required: true, placeholder: 'Ex.: Ferramenta de páginas', span: 8 },
    { name: 'amount', label: 'Valor', type: 'money', required: true, span: 4 },
    { name: 'category', label: 'Categoria', type: 'select', options: A.C.COST_CATS, span: 6 },
    { name: 'offerId', label: 'Vincular a uma oferta', type: 'select', empty: '— custo geral —', options: () => S().offers.map((o) => [o.id, o.name]), span: 6 },
    { name: 'date', label: 'Data (ou início da recorrência)', type: 'date', required: true, span: 6, default: A.today() },
    { name: 'endDate', label: 'Encerrar recorrência em', type: 'date', span: 6, hint: 'Opcional — quando cancelar a assinatura' },
    { name: 'recurring', label: 'Recorrente todo mês (assinatura)', type: 'checkbox' },
    { name: 'notes', label: 'Anotações', type: 'textarea', rows: 2 },
  ];

  function edit(c) {
    const isNew = !c;
    ui().formModal({
      title: isNew ? 'Novo custo' : 'Editar custo', fields: fields(), values: c || {},
      onSave: (data) => {
        if (!data.recurring) data.endDate = '';
        if (isNew) { A.store.insert('costs', data); ui().toast('Custo adicionado.'); } else { A.store.update('costs', c.id, data); ui().toast('Custo atualizado.'); }
      },
    });
  }

  function render(view) {
    const range = A.rangeFor(A.store.ui.period);
    const r = A.metrics.resolveRange(range);
    if (!S().costs.length) {
      view.innerHTML = '<div class="card">' + ui().emptyState('wallet', 'Nenhum custo extra', 'Cadastre assinaturas de ferramentas, domínios, criativos, freelancers… Eles entram no cálculo do lucro líquido.',
        '<button class="btn btn-primary" data-act="new">' + icon('plus') + 'Adicionar custo</button>') + '</div>';
      A.on(view, 'click', '[data-act=new]', () => edit());
      return;
    }
    const rows = S().costs.map((c) => {
      const n = A.metrics.costDates(c, range).length;
      const active = c.recurring && (!c.endDate || c.endDate >= A.today());
      return { c, n, total: n * (Number(c.amount) || 0), active };
    });
    const total = rows.reduce((a, x) => a + x.total, 0);
    const monthly = rows.filter((x) => x.active).reduce((a, x) => a + (Number(x.c.amount) || 0), 0);
    const byCat = {};
    rows.forEach((x) => { if (x.total) byCat[x.c.category || 'Outros'] = (byCat[x.c.category || 'Outros'] || 0) + x.total; });
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

    view.innerHTML =
      '<div class="toolbar"><span class="muted small">' + esc(A.rangeLabel(A.store.ui.period)) + ' · ' + A.fmtDate(r.from) + ' – ' + A.fmtDate(r.to) + '</span><span class="spacer"></span><button class="btn btn-sm btn-primary" data-act="new">' + icon('plus') + 'Adicionar custo</button></div>' +
      '<div class="stack">' +
        '<div class="kpis">' +
          '<div class="card kpi"><div class="kpi-label">' + icon('wallet') + 'Custos no período</div><div class="kpi-value">' + money(total) + '</div><div class="kpi-foot">incluídos no lucro líquido</div></div>' +
          '<div class="card kpi"><div class="kpi-label">' + icon('refund') + 'Assinaturas ativas / mês</div><div class="kpi-value">' + money(monthly) + '</div><div class="kpi-foot">' + rows.filter((x) => x.active).length + ' recorrente(s) · ' + money(monthly * 12) + '/ano</div></div>' +
        '</div>' +
        '<div class="grid grid-main">' +
          '<div class="card" id="cTbl"></div>' +
          '<div class="card"><div class="card-head"><h3>Por categoria</h3></div><div class="card-body"><div id="cCats"></div></div></div>' +
        '</div>' +
      '</div>';
    const box = A.$('#cTbl', view);
    const draw = () => {
      box.innerHTML = ui().table({
        id: 'costs', rows, defaultSort: { key: 'date', dir: 'desc' },
        rowAttr: (x) => 'class="clickable" data-id="' + x.c.id + '"',
        columns: [
          { key: 'desc', label: 'Descrição', sort: (x) => x.c.description, html: (x) => '<b>' + esc(x.c.description) + '</b>' + (x.c.offerId && A.store.get('offers', x.c.offerId) ? '<div class="muted small">' + esc(A.store.get('offers', x.c.offerId).name) + '</div>' : '') },
          { key: 'cat', label: 'Categoria', sort: (x) => x.c.category, html: (x) => esc(x.c.category || '—') },
          { key: 'date', label: 'Data', sort: (x) => x.c.date, html: (x) => A.fmtDate(x.c.date) },
          { key: 'rec', label: 'Tipo', sort: (x) => (x.c.recurring ? 1 : 0), html: (x) => (x.c.recurring ? (x.active ? '<span class="badge info">Mensal</span>' : '<span class="badge">Encerrada ' + A.fmtDate(x.c.endDate) + '</span>') : '<span class="badge plain">Único</span>') },
          { key: 'amount', label: 'Valor', num: true, sort: (x) => Number(x.c.amount) || 0, html: (x) => money(x.c.amount) },
          { key: 'total', label: 'No período', num: true, sort: (x) => x.total, html: (x) => (x.total ? '<b>' + money(x.total) + '</b>' + (x.n > 1 ? ' <span class="muted small">×' + x.n + '</span>' : '') : '<span class="muted">—</span>') },
          { key: 'act', label: '', cls: 'actions', html: () => '<button class="icon-btn" data-a="edit" title="Editar">' + icon('edit') + '</button><button class="icon-btn danger" data-a="del" title="Excluir">' + icon('trash') + '</button>' },
        ],
        footer: { desc: '<b>Total</b>', total: money(total) },
      });
    };
    draw();
    ui().bindSort(box, draw);
    A.charts.hbar(A.$('#cCats', view), { valueName: 'Custo', items: cats.map(([k, v], i) => ({ label: k, value: v, color: A.charts.color(i + 1) })) });
    A.on(box, 'click', 'tr[data-id]', (e, tr) => {
      const c = A.store.get('costs', tr.dataset.id);
      const b = e.target.closest('[data-a]');
      if (b && b.dataset.a === 'del') ui().removeWithUndo('costs', c.id, c.description);
      else edit(c);
    });
    A.on(view, 'click', '[data-act=new]', () => edit());
  }

  A.pages.costs = { title: 'Custos extras', period: true, render, edit };
})(window.App);
