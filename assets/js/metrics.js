/* Cálculo de métricas: faturamento, gasto, lucro, ROAS, ROI, CPA etc. */
(function (A) {
  'use strict';
  const S = () => A.store.state;
  const camp = (id) => A.store.get('campaigns', id);
  const offerOf = (id) => A.store.get('offers', id);

  /** Oferta efetiva de uma venda (a da própria venda ou a da campanha). */
  const saleOffer = (s) => s.offerId || (camp(s.campaignId) || {}).offerId || '';

  function matchSpend(s, f) {
    if (!A.inRange(s.date, f.range)) return false;
    if (f.campaignId && s.campaignId !== f.campaignId) return false;
    if (f.offerId || f.platform) {
      const c = camp(s.campaignId) || {};
      if (f.offerId && c.offerId !== f.offerId) return false;
      if (f.platform && c.platform !== f.platform) return false;
    }
    return true;
  }
  function matchSale(s, f) {
    if (!A.inRange(s.date, f.range)) return false;
    if (f.campaignId && s.campaignId !== f.campaignId) return false;
    if (f.offerId && saleOffer(s) !== f.offerId) return false;
    if (f.platform && (camp(s.campaignId) || {}).platform !== f.platform) return false;
    return true;
  }

  /** Datas em que um custo incide dentro do intervalo. */
  function costDates(c, range) {
    if (!c.date) return [];
    if (!c.recurring) return A.inRange(c.date, range) ? [c.date] : [];
    const limit = [range && range.to, c.endDate, A.today()].filter(Boolean).sort()[0];
    const out = [];
    for (let i = 0, d = c.date; i < 600 && d <= limit; i++, d = A.addMonths(c.date, i)) {
      if (A.inRange(d, range)) out.push(d);
    }
    return out;
  }
  function matchCostScope(c, f) {
    if (f.campaignId || f.platform) return false;
    if (f.offerId) return c.offerId === f.offerId;
    return true;
  }

  function compute(sales, spend, costTotal) {
    const st = S().settings;
    const m = {
      gross: 0, fees: 0, qty: 0, orders: 0, refunds: 0, refundQty: 0, pending: 0, pendingQty: 0,
      productCost: 0, spend: 0, impressions: 0, clicks: 0, checkouts: 0, costs: costTotal || 0,
      methods: { pix: 0, card: 0, boleto: 0, other: 0 },
    };
    sales.forEach((s) => {
      const q = Number(s.qty) || 0;
      const g = Number(s.gross) || 0;
      if (s.status === 'approved') {
        m.gross += g; m.fees += Number(s.fees) || 0; m.qty += q; m.orders++;
        const o = offerOf(saleOffer(s));
        if (o && o.productCost) m.productCost += q * Number(o.productCost);
        m.methods[s.method in m.methods ? s.method : 'other'] += g;
      } else if (s.status === 'refunded' || s.status === 'chargeback') {
        m.refunds += g; m.refundQty += q;
      } else if (s.status === 'pending') {
        m.pending += g; m.pendingQty += q;
      }
    });
    spend.forEach((s) => {
      m.spend += Number(s.amount) || 0;
      m.impressions += Number(s.impressions) || 0;
      m.clicks += Number(s.clicks) || 0;
      m.checkouts += Number(s.checkouts) || 0;
    });
    m.net = m.gross - m.fees;
    m.adTax = m.spend * (Number(st.adTaxRate) || 0) / 100;
    m.adsTotal = m.spend + m.adTax;
    m.tax = m.gross * (Number(st.taxRate) || 0) / 100;
    m.totalCost = m.adsTotal + m.fees + m.tax + m.productCost + m.costs;
    m.profit = m.gross - m.totalCost;
    m.roas = A.div(m.gross, m.adsTotal);
    m.roi = A.div(m.profit, m.adsTotal);
    m.margin = A.div(m.profit, m.gross);
    m.cpa = A.div(m.adsTotal, m.qty);
    m.ticket = A.div(m.gross, m.qty);
    m.ctr = A.div(m.clicks, m.impressions);
    m.cpc = A.div(m.spend, m.clicks);
    m.cpm = A.div(m.spend * 1000, m.impressions);
    m.conv = A.div(m.qty, m.clicks);
    m.cpi = A.div(m.spend, m.checkouts);
    m.checkoutConv = A.div(m.qty, m.checkouts);
    m.refundRate = A.div(m.refunds, m.gross + m.refunds);
    return m;
  }

  /** f = { range, offerId, campaignId, platform } */
  function summarize(f) {
    f = f || {};
    const sales = S().sales.filter((s) => matchSale(s, f));
    const spend = S().spend.filter((s) => matchSpend(s, f));
    let costs = 0;
    S().costs.forEach((c) => { if (matchCostScope(c, f)) costs += costDates(c, f.range).length * (Number(c.amount) || 0); });
    return compute(sales, spend, costs);
  }

  /** Data mais antiga com algum registro (para "todo o período"). */
  function firstDate() {
    let min = null;
    const st = S();
    [st.sales, st.spend, st.costs].forEach((arr) => arr.forEach((x) => { if (x.date && (!min || x.date < min)) min = x.date; }));
    return min;
  }
  function resolveRange(range) {
    const t = A.today();
    const from = (range && range.from) || firstDate() || A.addDays(t, -29);
    const to = (range && range.to) || t;
    return { from, to };
  }

  /** Série temporal (diária até ~3 meses; mensal acima disso). */
  function series(f) {
    f = f || {};
    const r = resolveRange(f.range);
    const days = A.daysBetween(r.from, r.to) + 1;
    const monthly = days > 95;
    const key = (d) => (monthly ? d.slice(0, 7) : d);
    const buckets = new Map();
    if (monthly) {
      for (let d = A.startOfMonth(r.from); d <= r.to; d = A.addMonths(d, 1)) buckets.set(key(d), { key: key(d), date: d, sales: [], spend: [], costs: 0 });
    } else {
      for (let d = r.from; d <= r.to; d = A.addDays(d, 1)) buckets.set(d, { key: d, date: d, sales: [], spend: [], costs: 0 });
    }
    const ff = Object.assign({}, f, { range: r });
    S().sales.forEach((s) => { if (matchSale(s, ff)) { const b = buckets.get(key(s.date)); if (b) b.sales.push(s); } });
    S().spend.forEach((s) => { if (matchSpend(s, ff)) { const b = buckets.get(key(s.date)); if (b) b.spend.push(s); } });
    S().costs.forEach((c) => {
      if (!matchCostScope(c, ff)) return;
      costDates(c, r).forEach((d) => { const b = buckets.get(key(d)); if (b) b.costs += Number(c.amount) || 0; });
    });
    return {
      monthly,
      points: Array.from(buckets.values()).map((b) => ({
        key: b.key, date: b.date,
        label: monthly ? A.fmtMonth(b.date) : A.fmtDay(b.date),
        m: compute(b.sales, b.spend, b.costs),
      })),
    };
  }

  /** Quebra por dimensão: 'offer' | 'campaign' | 'platform'. */
  function breakdown(by, f) {
    f = f || {};
    if (by === 'offer') {
      return S().offers.map((o) => ({ id: o.id, name: o.name, color: o.color, item: o, m: summarize(Object.assign({}, f, { offerId: o.id })) }));
    }
    if (by === 'campaign') {
      return S().campaigns
        .filter((c) => !f.offerId || c.offerId === f.offerId)
        .map((c) => ({ id: c.id, name: c.name, color: c.color, item: c, m: summarize({ range: f.range, campaignId: c.id }) }));
    }
    if (by === 'platform') {
      const plats = Array.from(new Set(S().campaigns.map((c) => c.platform).filter(Boolean)));
      return plats.map((p, i) => ({ id: p, name: p, color: i + 1, m: summarize(Object.assign({}, f, { platform: p })) }));
    }
    return [];
  }

  /** Variação relativa entre dois valores (para KPIs). */
  function delta(cur, prev) {
    if (!Number.isFinite(cur) || !Number.isFinite(prev)) return null;
    if (prev === 0) return cur === 0 ? 0 : null;
    return (cur - prev) / Math.abs(prev);
  }

  A.metrics = { summarize, series, breakdown, delta, compute, costDates, resolveRange, saleOffer, firstDate };
})(window.App);
