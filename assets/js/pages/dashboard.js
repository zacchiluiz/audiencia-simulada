/* Página: Dashboard */
(function (A) {
  'use strict';
  const { esc, icon, money, num, pct, ratioX, orDash } = A;
  const ui = () => A.ui;

  function kpi(label, ic, value, foot, cls) {
    return '<div class="card kpi ' + (cls || '') + '"><div class="kpi-label">' + icon(ic) + esc(label) + '</div>' +
      '<div class="kpi-value">' + value + '</div><div class="kpi-foot">' + (foot || '&nbsp;') + '</div></div>';
  }

  function onboarding() {
    return '<div class="card">' + ui().emptyState('zap', 'Bem-vindo ao seu Gestor de Campanhas',
      'Organize ofertas, campanhas, vendas, custos e lucro em um só lugar. Tudo fica salvo só no seu navegador — sem tracking, sem login.',
      '<div class="row" style="justify-content:center"><button class="btn btn-primary" data-act="new-offer">' + icon('plus') + 'Cadastrar primeira oferta</button>' +
      '<button class="btn" data-act="demo">' + icon('database') + 'Ver com dados de exemplo</button></div>' +
      '<div class="steps">' +
        '<div class="step"><span class="num-badge">1</span><b>Cadastre suas ofertas</b>Produto, plataforma, preço, comissão e custo por venda.</div>' +
        '<div class="step"><span class="num-badge">2</span><b>Crie as campanhas</b>Meta, Google, TikTok… ligadas a cada oferta.</div>' +
        '<div class="step"><span class="num-badge">3</span><b>Faça o lançamento diário</b>Gasto + vendas do dia em um só formulário (atalho <kbd>N</kbd>).</div>' +
      '</div>') + '</div>';
  }

  function render(view) {
    const st = A.store.state;
    if (A.store.isEmpty()) {
      view.innerHTML = onboarding();
      A.on(view, 'click', '[data-act]', (e, b) => {
        if (b.dataset.act === 'demo') { A.store.seedDemo(); ui().toast('Dados de exemplo carregados. Você pode apagá-los em Configurações.'); }
        if (b.dataset.act === 'new-offer') A.pages.offers.edit();
      });
      return;
    }
    const f = A.store.ui.dash || {};
    const range = A.rangeFor(A.store.ui.period);
    const prevR = A.previousRange(range);
    const filt = { range, offerId: f.offerId || '', platform: f.platform || '' };
    const m = A.metrics.summarize(filt);
    const p = prevR ? A.metrics.summarize(Object.assign({}, filt, { range: prevR })) : null;
    const d = (k, inv) => (p ? ui().deltaBadge(A.metrics.delta(m[k], p[k]), inv) : '');
    const vs = p ? '<span>vs período anterior</span>' : '';
    const platforms = Array.from(new Set(st.campaigns.map((c) => c.platform).filter(Boolean)));

    view.innerHTML =
      '<div class="toolbar">' +
        '<select class="input input-sm" data-f="offerId"><option value="">Todas as ofertas</option>' + st.offers.map((o) => '<option value="' + o.id + '"' + (f.offerId === o.id ? ' selected' : '') + '>' + esc(o.name) + '</option>').join('') + '</select>' +
        '<select class="input input-sm" data-f="platform"><option value="">Todas as fontes de tráfego</option>' + platforms.map((x) => '<option' + (f.platform === x ? ' selected' : '') + '>' + esc(x) + '</option>').join('') + '</select>' +
        '<span class="muted small">' + esc(A.rangeLabel(A.store.ui.period)) + (range.from ? ' · ' + A.fmtDate(range.from) + ' – ' + A.fmtDate(range.to) : '') + '</span>' +
      '</div>' +
      '<div class="stack">' +
      '<div class="kpis">' +
        kpi('Lucro líquido', 'wallet', '<span class="' + (m.profit < 0 ? 'neg' : '') + '">' + money(m.profit) + '</span>', d('profit') + vs, 'hero') +
        kpi('Faturamento bruto', 'dollar', money(m.gross), d('gross') + '<span>líquido ' + money(m.net) + '</span>', 'hero') +
        kpi('Gasto em anúncios', 'megaphone', money(m.adsTotal), d('adsTotal', true) + (m.adTax ? '<span>inclui ' + money(m.adTax) + ' imposto</span>' : '')) +
        kpi('ROAS', 'trend', ratioX(m.roas), d('roas') + '<span>faturamento ÷ gasto</span>') +
        kpi('ROI', 'percent', '<span class="' + (m.roi < 0 ? 'neg' : '') + '">' + pct(m.roi) + '</span>', d('roi') + '<span>lucro ÷ gasto</span>') +
        kpi('Margem', 'percent', '<span class="' + (m.margin < 0 ? 'neg' : '') + '">' + pct(m.margin) + '</span>', d('margin') + '<span>lucro ÷ faturamento</span>') +
        kpi('Vendas', 'cart', num(m.qty), d('qty') + '<span>' + num(m.orders) + ' lançamento(s)</span>') +
        kpi('CPA', 'target', orDash(m.cpa, money), d('cpa', true) + '<span>custo por venda</span>') +
        kpi('Ticket médio', 'receipt', orDash(m.ticket, money), d('ticket')) +
        kpi('Reembolsos', 'refund', money(m.refunds), '<span>' + num(m.refundQty) + ' · taxa ' + pct(m.refundRate) + '</span>') +
        kpi('Pendentes', 'calendar', money(m.pending), '<span>' + num(m.pendingQty) + ' venda(s) a confirmar</span>') +
        kpi('Taxas e custos', 'receipt', money(m.fees + m.tax + m.productCost + m.costs), '<span>gateway, imposto, produto, extras</span>') +
      '</div>' +

      '<div class="grid grid-main">' +
        '<div class="card"><div class="card-head"><h3>Faturamento, gasto e lucro</h3><span class="sub" id="dashGran"></span><span class="spacer"></span>' +
          '<div class="legend"><span><i style="background:var(--s1)"></i>Faturamento</span><span><i style="background:var(--s2)"></i>Gasto</span><span><i style="background:var(--s3)"></i>Lucro</span></div></div>' +
          '<div class="card-body"><div id="dashLine"></div></div></div>' +
        '<div class="stack">' + goalCard(filt) + resultCard(m) + '</div>' +
      '</div>' +

      '<div class="grid grid-3">' +
        '<div class="card"><div class="card-head"><h3>Lucro por oferta</h3></div><div class="card-body"><div id="dashOffers"></div></div></div>' +
        '<div class="card"><div class="card-head"><h3>Lucro por fonte de tráfego</h3></div><div class="card-body"><div id="dashPlat"></div></div></div>' +
        '<div class="card"><div class="card-head"><h3>Faturamento por pagamento</h3></div><div class="card-body"><div id="dashPay"></div></div></div>' +
      '</div>' +

      '<div class="grid grid-main">' +
        '<div class="card"><div class="card-head"><h3>Campanhas no período</h3><span class="spacer"></span><a href="#/campanhas" class="small">Ver todas →</a></div><div class="card-body" style="padding-top:6px" id="dashCamps"></div></div>' +
        '<div class="card"><div class="card-head"><h3>Calendário de lucro</h3><span class="sub" id="calLabel"></span></div><div class="card-body"><div id="dashCal"></div></div></div>' +
      '</div>' +
      '</div>';

    A.$$('[data-f]', view).forEach((s) => s.addEventListener('change', () => {
      const nf = Object.assign({}, A.store.ui.dash || {}); nf[s.dataset.f] = s.value;
      A.store.setUI({ dash: nf }); A.app.refresh();
    }));

    // Linha temporal
    const ser = A.metrics.series(filt);
    A.$('#dashGran', view).textContent = ser.monthly ? 'por mês' : 'por dia';
    A.charts.line(A.$('#dashLine', view), {
      label: 'Faturamento, gasto e lucro ao longo do tempo',
      points: ser.points.map((pt) => ({ label: pt.label, title: ser.monthly ? A.monthName(pt.date) : A.weekday(pt.date) + ', ' + A.fmtDate(pt.date), values: { gross: pt.m.gross, spend: pt.m.adsTotal, profit: pt.m.profit }, m: pt.m })),
      series: [
        { key: 'gross', name: 'Faturamento', color: 'var(--s1)', area: true },
        { key: 'spend', name: 'Gasto', color: 'var(--s2)' },
        { key: 'profit', name: 'Lucro', color: 'var(--s3)' },
      ],
      extraTip: (pt) => A.charts.ttRow('', 'Vendas', num(pt.m.qty)) + A.charts.ttRow('', 'ROAS', ratioX(pt.m.roas)),
      height: 420,
    });

    // Barras
    const byOffer = A.metrics.breakdown('offer', { range, platform: filt.platform })
      .filter((x) => x.m.gross || x.m.adsTotal || x.m.costs).sort((a, b) => b.m.profit - a.m.profit).slice(0, 8);
    A.charts.hbar(A.$('#dashOffers', view), {
      valueName: 'Lucro',
      items: byOffer.map((x) => ({ label: x.name, value: x.m.profit, color: A.charts.color(x.color), tip: tipFor(x.m), onClick: () => { location.hash = '#/ofertas/' + x.id; } })),
    });
    const byPlat = A.metrics.breakdown('platform', { range, offerId: filt.offerId })
      .filter((x) => x.m.gross || x.m.adsTotal).sort((a, b) => b.m.profit - a.m.profit);
    A.charts.hbar(A.$('#dashPlat', view), { valueName: 'Lucro', items: byPlat.map((x) => ({ label: x.name, value: x.m.profit, color: A.charts.color(x.color), tip: tipFor(x.m) })) });
    const pay = A.C.PAYMENT.map(([k, l], i) => ({ label: l, value: m.methods[k] || 0, color: A.charts.color(i + 1) })).filter((x) => x.value);
    A.charts.hbar(A.$('#dashPay', view), {
      valueName: 'Faturamento',
      items: pay.map((x) => Object.assign(x, { tip: A.charts.ttRow(x.color, 'Faturamento', money(x.value)) + A.charts.ttRow('', 'Participação', pct(A.div(x.value, m.gross))) })),
    });

    // Campanhas
    const camps = A.metrics.breakdown('campaign', { range, offerId: filt.offerId })
      .filter((x) => (!filt.platform || x.item.platform === filt.platform) && (x.m.gross || x.m.adsTotal));
    A.$('#dashCamps', view).innerHTML = ui().table({
      id: 'dashCamps', rows: camps, defaultSort: { key: 'profit', dir: 'desc' },
      rowAttr: (r) => 'class="clickable" data-href="#/campanhas/' + r.id + '"',
      empty: '<div class="muted small" style="padding:12px 0">Nenhuma campanha com movimento no período.</div>',
      columns: [
        { key: 'name', label: 'Campanha', sort: (r) => r.name, html: (r) => '<div class="name-cell">' + ui().colorDot(r.color) + '<b class="truncate" style="max-width:240px">' + esc(r.name) + '</b></div>' },
        { key: 'spend', label: 'Gasto', num: true, sort: (r) => r.m.adsTotal, html: (r) => money(r.m.adsTotal) },
        { key: 'gross', label: 'Faturamento', num: true, sort: (r) => r.m.gross, html: (r) => money(r.m.gross) },
        { key: 'profit', label: 'Lucro', num: true, sort: (r) => r.m.profit, html: (r) => ui().signed(r.m.profit) },
        { key: 'roas', label: 'ROAS', num: true, sort: (r) => r.m.roas, html: (r) => ui().roasHtml(r.m.roas) },
        { key: 'qty', label: 'Vendas', num: true, sort: (r) => r.m.qty, html: (r) => num(r.m.qty) },
      ],
    });
    ui().bindSort(A.$("#dashCamps", view), A.app.refresh);
    A.on(A.$('#dashCamps', view), 'click', 'tr[data-href]', (e, tr) => { location.hash = tr.dataset.href; });

    // Calendário (mês do fim do período)
    const ref = (range.to || A.today());
    const month = A.startOfMonth(ref);
    A.$('#calLabel', view).textContent = A.monthName(month);
    const calSer = A.metrics.series(Object.assign({}, filt, { range: { from: month, to: A.endOfMonth(month) < A.today() ? A.endOfMonth(month) : A.today() } }));
    const values = {}, byDate = {};
    calSer.points.forEach((pt) => { if (pt.m.gross || pt.m.adsTotal || pt.m.costs) { values[pt.date] = pt.m.profit; byDate[pt.date] = pt.m; } });
    A.charts.calendar(A.$('#dashCal', view), {
      month, values,
      tip: (date) => { const mm = byDate[date]; return mm ? A.charts.ttRow('', 'Faturamento', money(mm.gross)) + A.charts.ttRow('', 'Gasto', money(mm.adsTotal)) + A.charts.ttRow('', 'Vendas', num(mm.qty)) : ''; },
    });
  }

  function tipFor(m) {
    const r = A.charts.ttRow;
    return r('', 'Lucro', money(m.profit)) + r('', 'Faturamento', money(m.gross)) + r('', 'Gasto', money(m.adsTotal)) + r('', 'ROAS', ratioX(m.roas)) + r('', 'Vendas', num(m.qty));
  }

  function goalCard(filt) {
    const goal = Number(A.store.state.settings.monthlyGoal) || 0;
    const t = A.today();
    const from = A.startOfMonth(t);
    const mm = A.metrics.summarize(Object.assign({}, filt, { range: { from, to: t } }));
    const day = Number(t.slice(8, 10));
    const dim = Number(A.endOfMonth(t).slice(8, 10));
    const proj = (mm.gross / day) * dim;
    const projProfit = (mm.profit / day) * dim;
    if (!goal) {
      return '<div class="card"><div class="card-head"><h3>Meta do mês</h3></div><div class="card-body">' +
        '<div class="muted small" style="margin-bottom:10px">Defina uma meta mensal de faturamento para acompanhar o progresso.</div>' +
        '<div class="metric-strip"><div><span>Faturado no mês</span><b>' + money(mm.gross) + '</b></div><div><span>Projeção</span><b>' + money(proj) + '</b></div></div>' +
        '<a class="btn btn-sm" style="margin-top:12px" href="#/config">' + icon('target') + 'Definir meta</a></div></div>';
    }
    const ratio = Math.min(1, mm.gross / goal);
    const need = Math.max(0, goal - mm.gross);
    const perDay = dim - day + 1 > 0 ? need / (dim - day + 1) : need;
    return '<div class="card"><div class="card-head"><h3>Meta de ' + esc(A.monthName(from).split(' ')[0]) + '</h3><span class="spacer"></span><b>' + pct(mm.gross / goal, 0) + '</b></div><div class="card-body">' +
      '<div class="row between"><span class="kpi-value" style="font-size:20px;margin:0">' + money(mm.gross) + '</span><span class="muted">de ' + money(goal) + '</span></div>' +
      '<div class="goal-bar" role="progressbar" aria-valuenow="' + Math.round(ratio * 100) + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + (ratio * 100).toFixed(1) + '%"></i></div>' +
      '<div class="metric-strip" style="margin-top:12px;grid-template-columns:repeat(3,minmax(0,1fr))">' +
        '<div><span>Projeção do mês</span><b>' + money(proj) + '</b></div>' +
        '<div><span>Lucro projetado</span><b class="' + (projProfit < 0 ? 'neg' : '') + '">' + money(projProfit) + '</b></div>' +
        '<div><span>' + (need ? 'Falta / dia' : 'Meta batida!') + '</span><b>' + (need ? money(perDay) : '🎉') + '</b></div>' +
      '</div></div></div>';
  }

  function resultCard(m) {
    const rows = [
      ['Faturamento bruto', m.gross, 'var(--s1)'],
      ['Taxas da plataforma', -m.fees],
      ['Impostos', -m.tax],
      ['Custo de produto', -m.productCost],
      ['Anúncios' + (m.adTax ? ' (+ imposto)' : ''), -m.adsTotal],
      ['Custos extras', -m.costs],
    ].filter((r, i) => i === 0 || r[1]);
    const max = Math.max(1, m.gross, ...rows.map((r) => Math.abs(r[1])));
    return '<div class="card"><div class="card-head"><h3>Composição do resultado</h3></div><div class="card-body" style="display:flex;flex-direction:column;gap:8px">' +
      rows.map((r) => '<div><div class="row between small"><span class="muted">' + esc(r[0]) + '</span><b class="tnum">' + money(r[1]) + '</b></div>' +
        '<div class="goal-bar" style="height:6px;margin:4px 0 0"><i style="width:' + (Math.abs(r[1]) / max * 100).toFixed(1) + '%;background:' + (r[1] >= 0 ? 'var(--s1)' : 'var(--s2)') + '"></i></div></div>').join('') +
      '<div class="row between" style="border-top:1px solid var(--border);padding-top:10px;margin-top:2px"><b>Lucro líquido</b><b class="tnum ' + (m.profit < 0 ? 'neg' : 'pos') + '">' + money(m.profit) + '</b></div>' +
      '</div></div>';
  }

  A.pages = A.pages || {};
  A.pages.dashboard = { title: 'Dashboard', period: true, render };
})(window.App);
