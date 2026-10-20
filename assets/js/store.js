/* Armazenamento local (localStorage), CRUD, backup e dados de exemplo. */
(function (A) {
  'use strict';

  const KEY = 'gestor-campanhas:v1';
  const UI_KEY = 'gestor-campanhas:ui';
  const VERSION = 1;
  const COLLECTIONS = ['offers', 'campaigns', 'spend', 'sales', 'spy', 'costs'];

  /* ---------- Listas de opções ---------- */
  const C = {
    OFFER_STATUS: [['active', 'Ativa', 'good'], ['testing', 'Testando', 'info'], ['paused', 'Pausada', 'warn'], ['archived', 'Arquivada', '']],
    CAMPAIGN_STATUS: [['active', 'Ativa', 'good'], ['testing', 'Em teste', 'info'], ['paused', 'Pausada', 'warn'], ['ended', 'Encerrada', '']],
    SALE_STATUS: [['approved', 'Aprovada', 'good'], ['pending', 'Pendente', 'warn'], ['refunded', 'Reembolsada', 'bad'], ['chargeback', 'Chargeback', 'bad'], ['canceled', 'Cancelada', '']],
    SPY_STATUS: [['new', 'Nova'], ['watching', 'Observando'], ['scaling', 'Escalando'], ['model', 'Para modelar'], ['modeled', 'Modelada'], ['discarded', 'Descartada']],
    TRAFFIC: ['Meta Ads', 'Google Ads', 'TikTok Ads', 'Kwai Ads', 'YouTube Ads', 'Pinterest Ads', 'Taboola', 'Outbrain', 'Native', 'Orgânico', 'Influenciador', 'Outro'],
    SALES_PLATFORMS: ['Hotmart', 'Kiwify', 'Eduzz', 'Monetizze', 'Braip', 'Perfect Pay', 'Ticto', 'Cakto', 'Lastlink', 'Greenn', 'Pepper', 'Yampi', 'Shopify', 'CartPanda', 'ClickBank', 'Digistore24', 'Outro'],
    OFFER_MODEL: ['Produtor', 'Afiliado', 'Coprodutor', 'Dropshipping', 'Físico / COD', 'Outro'],
    PAYMENT: [['pix', 'Pix'], ['card', 'Cartão'], ['boleto', 'Boleto'], ['other', 'Outro']],
    COST_CATS: ['Ferramentas / SaaS', 'Domínio / Hospedagem', 'Criativos', 'Equipe / Freelancer', 'Contas / Perfis', 'Proxy / VPS', 'Impostos / Contador', 'Outros'],
    PALETTE: 8,
  };
  C.label = (list, key) => { const f = list.find((x) => x[0] === key); return f ? f[1] : key || '—'; };
  C.badge = (list, key) => {
    const f = list.find((x) => x[0] === key) || [key, key || '—', ''];
    return '<span class="badge ' + (f[2] || '') + '">' + A.esc(f[1]) + '</span>';
  };
  A.C = C;

  const defaults = () => ({
    version: VERSION,
    settings: {
      name: '', currency: 'BRL', taxRate: 0, adTaxRate: 0, monthlyGoal: 0,
      theme: 'system', lastBackup: null, createdAt: new Date().toISOString(),
    },
    offers: [], campaigns: [], spend: [], sales: [], spy: [], costs: [],
  });

  function migrate(data) {
    const base = defaults();
    const out = Object.assign(base, data || {});
    out.settings = Object.assign(defaults().settings, (data && data.settings) || {});
    COLLECTIONS.forEach((c) => { if (!Array.isArray(out[c])) out[c] = []; });
    out.version = VERSION;
    return out;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? migrate(JSON.parse(raw)) : defaults();
    } catch (e) {
      console.error('Falha ao carregar dados', e);
      return defaults();
    }
  }

  let state = load();
  let index = null;
  const listeners = [];

  function buildIndex() {
    index = {};
    COLLECTIONS.forEach((c) => { const m = new Map(); state[c].forEach((x) => m.set(x.id, x)); index[c] = m; });
  }

  function persist() {
    index = null;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      A.lastSaveError = null;
    } catch (e) {
      A.lastSaveError = e;
      if (A.ui) A.ui.toast('Não foi possível salvar: armazenamento do navegador cheio ou bloqueado. Faça um backup!', { error: true, duration: 8000 });
    }
    listeners.forEach((fn) => fn());
  }

  const store = {
    get state() { return state; },
    subscribe(fn) { listeners.push(fn); },
    get(coll, id) { if (!index) buildIndex(); return id ? index[coll].get(id) : undefined; },
    all(coll) { return state[coll]; },

    insert(coll, obj) {
      const now = new Date().toISOString();
      const item = Object.assign({ id: A.uid(), createdAt: now, updatedAt: now }, obj);
      state[coll].push(item);
      persist();
      return item;
    },
    insertMany(coll, items) {
      const now = new Date().toISOString();
      items.forEach((o) => state[coll].push(Object.assign({ id: A.uid(), createdAt: now, updatedAt: now }, o)));
      persist();
    },
    update(coll, id, patch) {
      const item = state[coll].find((x) => x.id === id);
      if (!item) return null;
      Object.assign(item, patch, { updatedAt: new Date().toISOString() });
      persist();
      return item;
    },
    /** Remove e aplica cascata. Retorna snapshot para "desfazer". */
    remove(coll, id) {
      const snap = this.snapshot();
      state[coll] = state[coll].filter((x) => x.id !== id);
      if (coll === 'offers') {
        state.campaigns.forEach((c) => { if (c.offerId === id) c.offerId = ''; });
        state.sales.forEach((s) => { if (s.offerId === id) s.offerId = ''; });
        state.costs.forEach((s) => { if (s.offerId === id) s.offerId = ''; });
        state.spy.forEach((s) => { if (s.offerId === id) s.offerId = ''; });
      }
      if (coll === 'campaigns') {
        state.spend = state.spend.filter((s) => s.campaignId !== id);
        state.sales.forEach((s) => { if (s.campaignId === id) s.campaignId = ''; });
      }
      persist();
      return snap;
    },
    removeWhere(coll, pred) {
      const snap = this.snapshot();
      state[coll] = state[coll].filter((x) => !pred(x));
      persist();
      return snap;
    },
    /** Várias mutações diretas no estado com uma única gravação. */
    batch(fn) { fn(state); persist(); },
    setSettings(patch) { Object.assign(state.settings, patch); persist(); },

    snapshot() { return JSON.stringify(state); },
    restore(snap) { state = migrate(JSON.parse(snap)); persist(); },
    replace(data) { state = migrate(data); persist(); },
    reset() { const theme = state.settings.theme; state = defaults(); state.settings.theme = theme; persist(); },
    isEmpty() { return COLLECTIONS.every((c) => state[c].length === 0); },
    counts() { const o = {}; COLLECTIONS.forEach((c) => { o[c] = state[c].length; }); return o; },

    exportJSON() {
      return JSON.stringify({ app: 'gestor-campanhas', exportedAt: new Date().toISOString(), data: state }, null, 2);
    },
    parseImport(text) {
      const obj = JSON.parse(text);
      const data = obj && obj.data ? obj.data : obj;
      if (!data || typeof data !== 'object' || !COLLECTIONS.some((c) => Array.isArray(data[c]))) {
        throw new Error('Arquivo não parece ser um backup do Gestor de Campanhas.');
      }
      return migrate(data);
    },

    nextColor(coll) {
      const used = state[coll].map((x) => x.color);
      for (let i = 1; i <= C.PALETTE; i++) if (!used.includes(i)) return i;
      return (state[coll].length % C.PALETTE) + 1;
    },

    /* ---------- Preferências de interface ---------- */
    ui: (function () {
      let ui = {};
      try { ui = JSON.parse(localStorage.getItem(UI_KEY) || '{}') || {}; } catch (e) { ui = {}; }
      if (!ui.period) ui.period = { preset: '30d' };
      return ui;
    })(),
    setUI(patch) {
      Object.assign(this.ui, patch);
      try { localStorage.setItem(UI_KEY, JSON.stringify(this.ui)); } catch (e) { /* ignora */ }
    },
  };
  A.store = store;

  /* ---------- Dados de exemplo ---------- */
  store.seedDemo = function () {
    let seed = 42;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const between = (a, b) => a + rnd() * (b - a);
    const t = A.today();
    const mk = (o) => Object.assign({ id: A.uid(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, o);

    const offers = [
      mk({ name: 'Método Emagrecer 30D', niche: 'Emagrecimento', platform: 'Kiwify', model: 'Produtor', price: 97, commission: 100, feeRate: 6.99, feeFixed: 2.49, productCost: 0, status: 'active', color: 1, salesPage: 'https://exemplo.com/emagrecer', tags: ['low ticket', 'VSL'], notes: 'Oferta principal. Upsell de R$ 47 em teste.' }),
      mk({ name: 'Curso Renda Extra Digital', niche: 'Renda extra', platform: 'Hotmart', model: 'Afiliado', price: 197, commission: 50, feeRate: 6.99, feeFixed: 2.49, productCost: 0, status: 'active', color: 2, salesPage: 'https://exemplo.com/renda', tags: ['afiliado'], notes: '' }),
      mk({ name: 'Kit Skincare Natural', niche: 'Beleza', platform: 'Shopify', model: 'Dropshipping', price: 149.9, commission: 100, feeRate: 6.99, feeFixed: 2.49, productCost: 38, status: 'testing', color: 3, salesPage: 'https://exemplo.com/skincare', tags: ['físico'], notes: 'Frete ~R$ 12 já embutido no custo.' }),
    ];
    const camps = [
      mk({ name: '[CBO] Emagrecer — Público aberto', offerId: offers[0].id, platform: 'Meta Ads', account: 'BM Principal', status: 'active', dailyBudget: 300, startDate: A.addDays(t, -59), objective: 'Conversão', tags: ['escala'], color: 1 }),
      mk({ name: '[ABO] Emagrecer — Teste criativos', offerId: offers[0].id, platform: 'Meta Ads', account: 'BM Reserva', status: 'testing', dailyBudget: 120, startDate: A.addDays(t, -25), objective: 'Conversão', tags: ['teste'], color: 2 }),
      mk({ name: 'Renda Extra — YouTube', offerId: offers[1].id, platform: 'Google Ads', account: 'Conta Google 01', status: 'active', dailyBudget: 200, startDate: A.addDays(t, -50), objective: 'Vendas', tags: [], color: 3 }),
      mk({ name: 'Skincare — TikTok Spark', offerId: offers[2].id, platform: 'TikTok Ads', account: 'TT Ads 01', status: 'paused', dailyBudget: 150, startDate: A.addDays(t, -40), objective: 'Conversão', tags: [], color: 4 }),
    ];
    const spend = [], sales = [];
    const profile = [
      { c: camps[0], from: -59, to: 0, spend: [220, 380], roas: [1.6, 2.6] },
      { c: camps[1], from: -25, to: 0, spend: [80, 140], roas: [0.6, 2.2] },
      { c: camps[2], from: -50, to: 0, spend: [150, 240], roas: [1.0, 1.8] },
      { c: camps[3], from: -40, to: -12, spend: [100, 170], roas: [0.5, 1.4] },
    ];
    profile.forEach((p) => {
      const offer = offers.find((o) => o.id === p.c.offerId);
      const ticket = offer.price * (offer.commission / 100);
      for (let d = p.from; d <= p.to; d++) {
        const date = A.addDays(t, d);
        const s = Math.round(between(p.spend[0], p.spend[1]) * 100) / 100;
        const cpm = between(18, 35);
        const impressions = Math.round((s / cpm) * 1000);
        const clicks = Math.round(impressions * between(0.009, 0.022));
        const qty = Math.max(0, Math.round((s * between(p.roas[0], p.roas[1])) / ticket));
        spend.push(mk({ campaignId: p.c.id, date, amount: s, impressions, clicks, checkouts: Math.round(qty * between(2.2, 3.6)) }));
        if (qty > 0) {
          const gross = Math.round(qty * ticket * 100) / 100;
          const method = rnd() < 0.68 ? 'pix' : rnd() < 0.85 ? 'card' : 'boleto';
          sales.push(mk({ date, offerId: offer.id, campaignId: p.c.id, qty, gross, fees: Math.round(gross * 0.0699 * 100) / 100 + qty * 2.49, status: 'approved', method, source: 'daily', feesAuto: true }));
          if (rnd() < 0.18) sales.push(mk({ date, offerId: offer.id, campaignId: p.c.id, qty: 1, gross: ticket, fees: 0, status: 'refunded', method: 'other', source: 'daily-refund' }));
          if (rnd() < 0.15) sales.push(mk({ date, offerId: offer.id, campaignId: p.c.id, qty: 1, gross: ticket, fees: 0, status: 'pending', method: 'boleto', notes: 'Boleto gerado' }));
        }
      }
    });
    const hist = (start, steps) => steps.map((n, i) => ({ date: A.addDays(t, start + i * 4), count: n }));
    const spy = [
      mk({ name: 'Protocolo Glicose Zero', niche: 'Saúde', country: 'BR', adPlatform: 'Meta Ads', status: 'scaling', rating: 5, price: 67, adLibraryUrl: 'https://www.facebook.com/ads/library/', salesPageUrl: 'https://exemplo.com/glicose', foundAt: A.addDays(t, -20), adsHistory: hist(-20, [12, 18, 31, 44, 63, 88]), tags: ['VSL', 'quiz'], notes: 'Funil com quiz de 8 perguntas antes da VSL. Copy foca em "sem dieta".' }),
      mk({ name: 'Desafio Inglês 21 dias', niche: 'Idiomas', country: 'BR', adPlatform: 'Meta Ads', status: 'watching', rating: 3, price: 47, adLibraryUrl: 'https://www.facebook.com/ads/library/', salesPageUrl: '', foundAt: A.addDays(t, -9), adsHistory: hist(-9, [7, 9, 8]), tags: ['low ticket'], notes: '' }),
      mk({ name: 'Jardinagem Lucrativa', niche: 'Renda extra', country: 'BR', adPlatform: 'TikTok Ads', status: 'model', rating: 4, price: 37, adLibraryUrl: '', salesPageUrl: 'https://exemplo.com/jardim', foundAt: A.addDays(t, -30), adsHistory: hist(-30, [5, 14, 22, 26, 35]), tags: ['UGC'], notes: 'Criativos UGC simples. Dá pra modelar com orçamento baixo.' }),
      mk({ name: 'Anti-Ronco Pro', niche: 'Saúde', country: 'US', adPlatform: 'Meta Ads', status: 'new', rating: 0, price: 39.9, adLibraryUrl: '', salesPageUrl: '', foundAt: A.addDays(t, -1), adsHistory: hist(-1, [21]), tags: ['físico'], notes: '' }),
      mk({ name: 'Mentoria Confeitaria', niche: 'Culinária', country: 'BR', adPlatform: 'Meta Ads', status: 'discarded', rating: 2, price: 497, adLibraryUrl: '', salesPageUrl: '', foundAt: A.addDays(t, -45), adsHistory: hist(-45, [9, 6, 3, 1]), tags: [], notes: 'Anúncios caindo, parece ter saturado.' }),
    ];
    const costs = [
      mk({ date: A.addDays(t, -58), description: 'Ferramenta de páginas', category: 'Ferramentas / SaaS', amount: 97, recurring: true, offerId: '' }),
      mk({ date: A.addDays(t, -58), description: 'Hospedagem + domínios', category: 'Domínio / Hospedagem', amount: 39.9, recurring: true, offerId: '' }),
      mk({ date: A.addDays(t, -30), description: 'Editor de vídeo (criativos)', category: 'Criativos', amount: 450, recurring: false, offerId: offers[0].id }),
      mk({ date: A.addDays(t, -12), description: 'Pack de criativos UGC', category: 'Criativos', amount: 300, recurring: false, offerId: offers[2].id }),
    ];
    state.offers.push(...offers); state.campaigns.push(...camps); state.spend.push(...spend);
    state.sales.push(...sales); state.spy.push(...spy); state.costs.push(...costs);
    if (!state.settings.monthlyGoal) state.settings.monthlyGoal = 50000;
    persist();
  };
})(window.App);
