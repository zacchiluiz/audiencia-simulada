/* Página: Swipe de ofertas (anúncios da Biblioteca do Facebook e apps da App Store) */
(function (A) {
  'use strict';
  const { esc, icon, num } = A;
  const ui = () => A.ui;
  const S = () => A.store.state;

  const SOURCES = [['fb', 'Biblioteca do Facebook'], ['appstore', 'App Store']];
  const FORMATS = ['Vídeo', 'Imagem', 'Carrossel', 'Vários formatos'];
  const COUNTRIES = [['BR', 'Brasil'], ['US', 'Estados Unidos'], ['PT', 'Portugal'], ['ES', 'Espanha'], ['MX', 'México'], ['AR', 'Argentina'], ['CO', 'Colômbia'], ['GB', 'Reino Unido'], ['CA', 'Canadá'], ['DE', 'Alemanha'], ['FR', 'França'], ['IT', 'Itália']];
  const IDEAS = ['método', 'protocolo', 'desafio 21 dias', 'receitas', 'renda extra', 'emagrecer', 'ansiedade', 'inglês', 'jejum', 'relacionamento', 'treino em casa', 'oração'];
  const VALIDATED_DAYS = 30;

  /* ---------- Links e integrações ---------- */
  /** Monta a busca da Biblioteca de Anúncios (o Facebook não permite consultar sem token, então abrimos a página). */
  function adLibrarySearchUrl(o) {
    const p = new URLSearchParams({
      active_status: o.activeOnly === false ? 'all' : 'active', ad_type: 'all', country: o.country || 'BR',
      media_type: o.media || 'all', q: o.q || '', search_type: o.exact ? 'keyword_exact_phrase' : 'keyword_unordered',
    });
    return 'https://www.facebook.com/ads/library/?' + p.toString();
  }
  const adLibraryAdUrl = (id) => 'https://www.facebook.com/ads/library/?id=' + encodeURIComponent(id);

  /** Extrai ID do anúncio / da página de um link da biblioteca. */
  function parseAdLibraryUrl(raw) {
    const u = A.safeUrl(raw);
    if (!u) return {};
    try {
      const url = new URL(u);
      return { adId: url.searchParams.get('id') || '', pageId: url.searchParams.get('view_all_page_id') || '', country: url.searchParams.get('country') || '' };
    } catch (e) { return {}; }
  }

  /** Extrai ID e país de um link da App Store (apps.apple.com/br/app/nome/id123456). */
  function parseAppStoreUrl(raw) {
    const s = String(raw || '').trim();
    const id = (s.match(/id(\d{5,})/) || s.match(/^(\d{5,})$/) || [])[1] || '';
    const country = ((s.match(/apple\.com\/([a-z]{2})\//i) || [])[1] || '').toUpperCase();
    return { appId: id, country };
  }

  /** JSONP: a API pública do iTunes responde com callback, o que funciona até abrindo o index.html direto do disco. */
  let jsonpSeq = 0;
  function jsonp(url, timeout) {
    return new Promise((resolve, reject) => {
      const cb = '__swipeCb' + (++jsonpSeq);
      const script = document.createElement('script');
      const done = () => { clearTimeout(timer); delete window[cb]; script.remove(); };
      const timer = setTimeout(() => { done(); reject(new Error('A App Store demorou demais para responder.')); }, timeout || 12000);
      window[cb] = (data) => { done(); resolve(data); };
      script.onerror = () => { done(); reject(new Error('Não foi possível falar com a App Store. Verifique sua internet.')); };
      script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + cb;
      document.head.appendChild(script);
    });
  }
  const itunes = {
    search: (term, country) => jsonp('https://itunes.apple.com/search?' + new URLSearchParams({ term, country: (country || 'BR').toLowerCase(), entity: 'software', limit: '30', lang: 'pt_br' })).then((d) => d.results || []),
    lookup: (id, country) => jsonp('https://itunes.apple.com/lookup?' + new URLSearchParams({ id, country: (country || 'BR').toLowerCase(), lang: 'pt_br' })).then((d) => (d.results || [])[0] || null),
  };

  /** Converte um resultado do iTunes nos campos do swipe. */
  function fromItunes(r, country) {
    const desc = String(r.description || '').trim();
    return {
      source: 'appstore', title: r.trackName || '', appId: String(r.trackId || ''), url: (r.trackViewUrl || '').split('?')[0],
      developer: r.sellerName || r.artistName || '', category: r.primaryGenreName || '', country: (country || 'BR').toUpperCase(),
      priceLabel: r.formattedPrice || (r.price ? String(r.price) : 'Grátis'), priceValue: Number(r.price) || 0,
      appRating: Math.round((Number(r.averageUserRating) || 0) * 10) / 10, ratingCount: Number(r.userRatingCount) || 0,
      iconUrl: r.artworkUrl512 || r.artworkUrl100 || '', screenshots: (r.screenshotUrls || []).slice(0, 6),
      description: desc.length > 1500 ? desc.slice(0, 1500) + '…' : desc,
      releasedAt: (r.releaseDate || '').slice(0, 10), appUpdatedAt: (r.currentVersionReleaseDate || '').slice(0, 10),
      ageRating: r.contentAdvisoryRating || '',
    };
  }
  const findApp = (appId) => S().swipe.find((x) => x.source === 'appstore' && x.appId && x.appId === String(appId));

  /* ---------- Cálculos ---------- */
  const daysLive = (s) => (s.source === 'fb' && s.startedAt ? Math.max(0, A.daysBetween(s.startedAt, s.endedAt || A.today())) : null);
  const isImage = (u) => /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(u || '') || /fbcdn\.net|mzstatic\.com/i.test(u || '');
  const thumbOf = (s) => (s.source === 'appstore' ? s.iconUrl : (isImage(s.mediaUrl) ? s.mediaUrl : ''));
  const stars = (n) => '<span class="stars" title="' + (n || 0) + ' de 5">' + [1, 2, 3, 4, 5].map((i) => (i <= n ? '★' : '<span class="off">★</span>')).join('') + '</span>';
  const compact = (n) => (n >= 1000 ? (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: n >= 10000 ? 0 : 1 }) + ' mil' : num(n));

  function liveBadge(s) {
    const d = daysLive(s);
    if (d === null) return '';
    const cls = s.endedAt ? '' : d >= VALIDATED_DAYS ? 'good' : d >= 7 ? 'info' : 'warn';
    return '<span class="badge ' + cls + '" title="' + (d >= VALIDATED_DAYS ? 'Anúncio rodando há muito tempo costuma estar dando lucro' : '') + '">' + (s.endedAt ? 'Ficou ' : 'No ar há ') + d + ' dia' + (d === 1 ? '' : 's') + '</span>';
  }

  /* ---------- Formulários ---------- */
  const commonTail = [
    { type: 'section', label: 'Análise' },
    { name: 'angle', label: 'Ângulo / promessa', span: 6, placeholder: 'Ex.: "emagreça sem academia", medo, curiosidade…' },
    { name: 'niche', label: 'Nicho', span: 3 },
    { name: 'rating', label: 'Potencial', type: 'rating', span: 3 },
    { name: 'tags', label: 'Tags', type: 'tags', placeholder: 'VSL, quiz, UGC, assinatura, trial…' },
    { name: 'notes', label: 'Anotações (o que modelar, funil, oferta, upsells…)', type: 'textarea', rows: 3 },
  ];

  const fbFields = () => [
    { name: 'url', label: 'Link do anúncio na biblioteca', type: 'url', span: 8, placeholder: 'https://www.facebook.com/ads/library/?id=…', hint: 'Cole o link — o ID do anúncio é preenchido sozinho.' },
    { name: 'adId', label: 'ID do anúncio', span: 4 },
    { name: 'title', label: 'Nome da oferta / produto', required: true, span: 6, placeholder: 'Ex.: Protocolo Glicose Zero' },
    { name: 'pageName', label: 'Página que anuncia', span: 6 },
    { name: 'country', label: 'País', type: 'select', options: COUNTRIES, span: 3, default: 'BR' },
    { name: 'format', label: 'Formato', type: 'select', options: FORMATS, span: 3, default: 'Vídeo' },
    { name: 'startedAt', label: 'Início da veiculação', type: 'date', span: 3, hint: 'Quanto mais tempo no ar, mais validado.' },
    { name: 'activeAds', label: 'Anúncios ativos da página', type: 'int', span: 3, hint: 'Muitas variações = escala.' },
    { type: 'section', label: 'Criativo e copy' },
    { name: 'hook', label: 'Gancho (primeiros 3 segundos / 1ª linha)', type: 'textarea', rows: 2, span: 6 },
    { name: 'headline', label: 'Título', span: 6 },
    { name: 'copy', label: 'Texto do anúncio', type: 'textarea', rows: 4, span: 6 },
    { name: 'cta', label: 'Botão (CTA)', span: 6, placeholder: 'Saiba mais, Comprar agora…' },
    { name: 'mediaUrl', label: 'Link da imagem / vídeo do criativo', type: 'url', span: 6, hint: 'Se for uma imagem, vira a capa do card.' },
    { name: 'landingUrl', label: 'Página de destino (VSL, quiz, checkout)', type: 'url', span: 6 },
  ].concat(commonTail);

  const appFields = () => [
    { name: 'url', label: 'Link da App Store', type: 'url', span: 8, placeholder: 'https://apps.apple.com/br/app/…/id123456789' },
    { type: 'html', span: 4, html: '<span class="field-label-spacer"></span><button type="button" class="btn btn-block" data-x="lookup">' + icon('download') + 'Buscar dados do app</button>' },
    { name: 'title', label: 'Nome do app', required: true, span: 6 },
    { name: 'developer', label: 'Desenvolvedor', span: 6 },
    { name: 'category', label: 'Categoria', span: 4 },
    { name: 'country', label: 'Loja (país)', type: 'select', options: COUNTRIES, span: 4, default: 'BR' },
    { name: 'priceLabel', label: 'Preço na loja', span: 4, placeholder: 'Grátis' },
    { name: 'monetization', label: 'Como cobra (assinatura, trial, compras no app…)', span: 6, placeholder: 'Ex.: trial 7 dias → R$ 39,90/mês ou R$ 199/ano' },
    { name: 'appRating', label: 'Nota na loja', span: 3 },
    { name: 'ratingCount', label: 'Nº de avaliações', type: 'int', span: 3 },
    { name: 'hook', label: 'Promessa principal (título / 1ª tela)', type: 'textarea', rows: 2 },
  ].concat(commonTail);

  /* ---------- Modal de edição ---------- */
  function open(s, preset) {
    const source = (s && s.source) || (preset && preset.source) || 'fb';
    const isNew = !s || !s.id;
    const isApp = source === 'appstore';
    const f = isApp ? appFields() : fbFields();
    const values = Object.assign({}, preset || {}, s || {});
    let appData = isApp ? Object.assign({}, values) : null;

    const preview = () => {
      if (!isApp || !appData) return '';
      const shots = (appData.screenshots || []).filter((u) => A.safeUrl(u));
      return '<div id="appPreview">' + (appData.iconUrl || shots.length || appData.description ?
        '<div class="swipe-app-head">' + (A.safeUrl(appData.iconUrl) ? '<img src="' + esc(A.safeUrl(appData.iconUrl)) + '" alt="" class="swipe-app-icon" onerror="this.style.visibility=\'hidden\'">' : '') +
        '<div><b>' + esc(appData.title || '') + '</b><div class="muted small">' + [appData.developer, appData.category, appData.ageRating].filter(Boolean).map(esc).join(' · ') + '</div>' +
        '<div class="muted small">' + (appData.releasedAt ? 'Lançado em ' + A.fmtDate(appData.releasedAt) : '') + (appData.appUpdatedAt ? ' · atualizado ' + A.relDays(appData.appUpdatedAt) : '') + '</div></div></div>' +
        (shots.length ? '<div class="swipe-shots">' + shots.map((u) => '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer"><img src="' + esc(u) + '" alt="Tela do app" loading="lazy"></a>').join('') + '</div>' : '') +
        (appData.description ? '<details class="swipe-desc"><summary>Descrição da loja (copy do app)</summary><div class="notes small">' + esc(appData.description) + '</div></details>' : '')
        : '') + '</div>';
    };

    const left = (isNew ? '' : '<button type="button" class="btn btn-danger" data-x="del">' + icon('trash') + 'Excluir</button>' +
      (s.spyId && A.store.get('spy', s.spyId) ? '<a class="btn" href="#/espionagem" data-close>' + icon('eye') + 'Na espionagem</a>' : '<button type="button" class="btn" data-x="spy">' + icon('eye') + 'Enviar p/ espionagem</button>'));

    ui().formModal({
      title: (isNew ? 'Salvar no swipe — ' : '') + (isApp ? 'App da App Store' : 'Anúncio da biblioteca'), size: 'wide',
      fields: f, values,
      before: isApp ? preview() : '',
      left,
      onMount: (form, close) => {
        const el = form.elements;
        if (!isApp) {
          el.url.addEventListener('input', () => {
            const p = parseAdLibraryUrl(el.url.value);
            if (p.adId && !el.adId.value) el.adId.value = p.adId;
            if (p.country && COUNTRIES.some((c) => c[0] === p.country)) el.country.value = p.country;
          });
        }
        A.on(form, 'click', '[data-x]', async (e, b) => {
          const x = b.dataset.x;
          if (x === 'del') { close(); ui().removeWithUndo('swipe', s.id, s.title || 'item do swipe'); }
          if (x === 'spy') { close(); toSpy(A.store.get('swipe', s.id)); }
          if (x === 'lookup') {
            const p = parseAppStoreUrl(el.url.value);
            if (!p.appId) { ui().toast('Cole um link da App Store com o ID do app (…/id123456789).', { error: true }); el.url.focus(); return; }
            b.disabled = true;
            try {
              const r = await itunes.lookup(p.appId, p.country || el.country.value);
              if (!r) throw new Error('App não encontrado nessa loja. Tente trocar o país.');
              const dup = findApp(r.trackId);
              if (dup && dup.id !== (s && s.id)) ui().toast('Esse app já está no seu swipe.', { error: true });
              appData = Object.assign(appData || {}, fromItunes(r, p.country || el.country.value));
              ['url', 'title', 'developer', 'category', 'priceLabel'].forEach((k) => { el[k].value = appData[k] || ''; });
              if (COUNTRIES.some((c) => c[0] === appData.country)) el.country.value = appData.country;
              el.appRating.value = appData.appRating ? String(appData.appRating).replace('.', ',') : '';
              el.ratingCount.value = appData.ratingCount ? num(appData.ratingCount) : '';
              const box = A.$('#appPreview', form);
              if (box) box.outerHTML = preview();
              ui().toast('Dados do app carregados.');
            } catch (err) { ui().toast(err.message, { error: true, duration: 5000 }); }
            b.disabled = false;
          }
        });
      },
      onSave: (data) => {
        data.source = source;
        if (isApp) {
          data.appRating = Math.round(A.parseNum(data.appRating) * 10) / 10;
          const p = parseAppStoreUrl(data.url);
          ['appId', 'iconUrl', 'screenshots', 'description', 'releasedAt', 'appUpdatedAt', 'ageRating', 'priceValue'].forEach((k) => { if (appData && appData[k] !== undefined) data[k] = appData[k]; });
          if (p.appId) data.appId = p.appId;
        } else if (!data.adId) {
          data.adId = parseAdLibraryUrl(data.url).adId || '';
        }
        if (!isApp && !data.url && data.adId) data.url = adLibraryAdUrl(data.adId);
        if (isNew) {
          data.savedAt = A.today();
          A.store.insert('swipe', data);
          ui().toast('Salvo no swipe.');
        } else {
          A.store.update('swipe', s.id, data);
          ui().toast('Salvo.');
        }
      },
    });
  }

  /** Cria uma oferta na Espionagem a partir do swipe, para acompanhar a escala. */
  function toSpy(s) {
    const isApp = s.source === 'appstore';
    const notes = [
      'Vinda do swipe (' + (isApp ? 'App Store' : 'Biblioteca do Facebook') + ').',
      s.angle ? 'Ângulo: ' + s.angle : '', s.hook ? 'Gancho: ' + s.hook : '', s.monetization ? 'Monetização: ' + s.monetization : '',
      s.notes || '',
    ].filter(Boolean).join('\n');
    const spy = A.store.insert('spy', {
      name: s.title, niche: s.niche || s.category || '', country: s.country || '', adPlatform: isApp ? 'Outro' : 'Meta Ads',
      status: 'new', rating: s.rating || 0, price: 0, foundAt: A.today(),
      adLibraryUrl: isApp ? '' : (A.safeUrl(s.url) || ''), salesPageUrl: isApp ? (A.safeUrl(s.url) || '') : (A.safeUrl(s.landingUrl) || ''), checkoutUrl: '',
      creatives: [s.mediaUrl].filter((u) => A.safeUrl(u)), tags: s.tags || [],
      adsHistory: s.activeAds ? [{ date: A.today(), count: s.activeAds }] : [], notes,
    });
    A.store.update('swipe', s.id, { spyId: spy.id });
    ui().toast('Enviada para a Espionagem.', { action: { label: 'Abrir', fn: () => { location.hash = '#/espionagem'; } } });
  }

  /* ---------- Garimpar (busca) ---------- */
  function hunt(tab) {
    const u = A.store.ui.swipe || {};
    let active = tab || u.huntTab || 'appstore';
    const country = u.huntCountry || 'BR';
    const countryOpts = COUNTRIES.map(([k, l]) => '<option value="' + k + '"' + (k === country ? ' selected' : '') + '>' + esc(l) + '</option>').join('');
    const chips = IDEAS.map((t) => '<button type="button" class="tag tag-btn" data-idea="' + esc(t) + '">' + esc(t) + '</button>').join('');

    ui().modal({
      title: 'Garimpar ofertas', size: 'wide', noFoot: true, noAutofocus: true,
      body:
        '<div class="seg seg-icons" style="margin-bottom:14px"><button type="button" data-tab="appstore">' + icon('phone') + ' App Store</button><button type="button" data-tab="fb">' + icon('megaphone') + ' Biblioteca do Facebook</button></div>' +
        '<div class="row" style="margin-bottom:10px">' +
          '<div class="search" style="flex:1;min-width:200px">' + icon('search') + '<input class="input" id="hq" placeholder="Palavra-chave: protocolo, desafio, meditação…" value="' + esc(u.huntQ || '') + '"></div>' +
          '<select class="input" id="hc" style="width:auto">' + countryOpts + '</select>' +
          '<span data-only="fb" class="row"><select class="input" id="hm" style="width:auto"><option value="all">Todos os formatos</option><option value="video">Vídeo</option><option value="image">Imagem</option></select>' +
          '<label class="check"><input type="checkbox" id="hx"> <span>Frase exata</span></label></span>' +
          '<button type="button" class="btn btn-primary" data-go>' + icon('search') + '<span id="goLabel">Buscar</span></button>' +
        '</div>' +
        '<div class="row" style="margin-bottom:14px;gap:4px"><span class="muted small" style="margin-right:4px">Ideias:</span>' + chips + '</div>' +
        '<div id="huntOut"></div>',
      onMount: (form) => {
        const q = A.$('#hq', form), out = A.$('#huntOut', form);
        const remember = () => A.store.setUI({ swipe: Object.assign({}, A.store.ui.swipe, { huntTab: active, huntQ: q.value, huntCountry: A.$('#hc', form).value }) });
        const fbHelp = () => '<div class="card swipe-help"><div class="card-body">' +
          '<b>Como garimpar na biblioteca</b><ol class="small">' +
            '<li>Busque a palavra-chave — a biblioteca abre numa nova aba já filtrada por <b>anúncios ativos</b> no país escolhido.</li>' +
            '<li>Procure anúncios com <b>início de veiculação antigo</b> (há ' + VALIDATED_DAYS + '+ dias) e páginas com <b>muitas variações</b> do mesmo criativo: é sinal de que está vendendo.</li>' +
            '<li>Clique em “Ver detalhes do anúncio”, copie o link e salve aqui no swipe.</li>' +
          '</ol><button type="button" class="btn" data-newfb>' + icon('plus') + 'Salvar anúncio pelo link</button></div></div>';
        const setTab = (t) => {
          active = t;
          A.$$('[data-tab]', form).forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
          A.$$('[data-only=fb]', form).forEach((el) => { el.style.display = t === 'fb' ? '' : 'none'; });
          A.$('#goLabel', form).textContent = t === 'fb' ? 'Abrir na biblioteca' : 'Buscar';
          out.innerHTML = t === 'fb' ? fbHelp() : '<div class="muted small">Busque apps por palavra-chave para ver quem está monetizando no seu nicho: preço, nota, número de avaliações e telas.</div>';
          remember();
        };
        const resultRow = (r, cc) => {
          const saved = findApp(r.trackId);
          return '<div class="swipe-result">' +
            (r.artworkUrl100 ? '<img src="' + esc(r.artworkUrl100) + '" alt="" class="swipe-app-icon sm" onerror="this.style.visibility=\'hidden\'">' : '') +
            '<div class="grow"><b>' + esc(r.trackName) + '</b><div class="muted small">' + [r.sellerName || r.artistName, r.primaryGenreName].filter(Boolean).map(esc).join(' · ') + '</div>' +
            '<div class="small">' + (r.averageUserRating ? stars(Math.round(r.averageUserRating)) + ' <b>' + num(r.averageUserRating, 1) + '</b> ' : '') + '<span class="muted">(' + compact(r.userRatingCount || 0) + ' avaliações)</span> · ' + esc(r.formattedPrice || 'Grátis') + '</div></div>' +
            '<a class="icon-btn" href="' + esc(A.safeUrl(r.trackViewUrl)) + '" target="_blank" rel="noopener noreferrer" title="Abrir na App Store">' + icon('external') + '</a>' +
            (saved ? '<span class="badge good">No swipe</span>' : '<button type="button" class="btn btn-sm" data-save="' + r.trackId + '" data-cc="' + esc(cc) + '">' + icon('plus') + 'Salvar</button>') +
          '</div>';
        };
        let results = [];
        const go = async () => {
          const term = q.value.trim();
          const cc = A.$('#hc', form).value;
          remember();
          if (!term) { q.focus(); return; }
          if (active === 'fb') {
            window.open(adLibrarySearchUrl({ q: term, country: cc, media: A.$('#hm', form).value, exact: A.$('#hx', form).checked }), '_blank', 'noopener');
            return;
          }
          out.innerHTML = '<div class="muted small">Buscando na App Store…</div>';
          try {
            results = await itunes.search(term, cc);
            results.sort((a, b) => (b.userRatingCount || 0) - (a.userRatingCount || 0));
            out.innerHTML = results.length
              ? '<div class="muted small" style="margin-bottom:8px">' + results.length + ' apps, ordenados por nº de avaliações (popularidade).</div><div class="swipe-results">' + results.map((r) => resultRow(r, cc)).join('') + '</div>'
              : '<div class="empty"><p>Nenhum app encontrado. Tente outra palavra ou outro país.</p></div>';
          } catch (err) {
            out.innerHTML = '<div class="empty"><p>' + esc(err.message) + '</p></div>';
          }
        };
        A.on(form, 'click', '[data-tab]', (e, b) => setTab(b.dataset.tab));
        A.on(form, 'click', '[data-go]', go);
        A.on(form, 'click', '[data-idea]', (e, b) => { q.value = b.dataset.idea; go(); });
        A.on(form, 'click', '[data-newfb]', () => open(null, { source: 'fb', country: A.$('#hc', form).value }));
        A.on(form, 'click', '[data-save]', (e, b) => {
          const r = results.find((x) => String(x.trackId) === b.dataset.save);
          if (!r || findApp(r.trackId)) return;
          A.store.insert('swipe', Object.assign(fromItunes(r, b.dataset.cc), { savedAt: A.today(), niche: '', tags: [], rating: 0 }));
          b.outerHTML = '<span class="badge good">No swipe</span>';
          ui().toast('App salvo no swipe.');
        });
        q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
        setTab(active);
        setTimeout(() => q.focus(), 30);
      },
    });
  }

  /* ---------- Listagem ---------- */
  function card(s) {
    const isApp = s.source === 'appstore';
    const th = A.safeUrl(thumbOf(s));
    const link = A.safeUrl(s.url);
    const stats = isApp
      ? [s.appRating ? '★ ' + num(s.appRating, 1) : '', s.ratingCount ? compact(s.ratingCount) + ' avaliações' : '', s.priceLabel || ''].filter(Boolean)
      : [s.format || '', s.activeAds ? num(s.activeAds) + ' anúncios ativos' : '', s.pageName || ''].filter(Boolean);
    return '<div class="card swipe-card" data-id="' + s.id + '">' +
      '<div class="swipe-thumb' + (isApp ? ' is-app' : '') + '">' +
        (th ? '<img src="' + esc(th) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' : '<div class="swipe-ph">' + icon(isApp ? 'phone' : s.format === 'Imagem' || s.format === 'Carrossel' ? 'image' : 'play') + '</div>') +
        '<span class="swipe-src ' + (isApp ? 'src-app' : 'src-fb') + '">' + (isApp ? 'App Store' : 'Facebook') + '</span>' +
        (s.fav ? '<span class="swipe-fav" title="Favorito">★</span>' : '') +
      '</div>' +
      '<div class="swipe-body">' +
        '<div class="kcard-title"><span>' + esc(s.title) + '</span>' + (s.rating ? stars(s.rating) : '') + '</div>' +
        '<div class="kcard-meta">' + [s.niche || s.category, s.country].filter(Boolean).map(esc).join(' · ') + '</div>' +
        (s.hook || s.angle ? '<div class="swipe-hook">“' + esc(s.hook || s.angle) + '”</div>' : '') +
        '<div class="kcard-meta">' + stats.map(esc).join(' · ') + '</div>' +
        '<div class="kcard-foot">' + liveBadge(s) + (s.monetization ? '<span class="badge plain" title="' + esc(s.monetization) + '">' + icon('dollar') + 'monetização</span>' : '') + ui().tagsHtml(s.tags) + '</div>' +
      '</div>' +
      '<div class="swipe-actions">' +
        '<button type="button" class="icon-btn" data-fav="' + s.id + '" title="' + (s.fav ? 'Tirar dos favoritos' : 'Favoritar') + '">' + (s.fav ? '★' : '☆') + '</button>' +
        (link ? '<a class="icon-btn" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer" data-stop title="Abrir original">' + icon('external') + '</a>' : '') +
        (A.safeUrl(s.landingUrl) ? '<a class="icon-btn" href="' + esc(A.safeUrl(s.landingUrl)) + '" target="_blank" rel="noopener noreferrer" data-stop title="Página de destino">' + icon('link') + '</a>' : '') +
        '<span class="spacer"></span><span class="muted small">' + (s.savedAt ? 'salvo ' + A.relDays(s.savedAt) : '') + '</span>' +
      '</div>' +
    '</div>';
  }

  const SORTS = [
    ['recent', 'Mais recentes'], ['live', 'Mais tempo no ar'], ['ads', 'Mais anúncios ativos'],
    ['reviews', 'Mais avaliações (apps)'], ['rating', 'Maior potencial'],
  ];
  function sortList(list, key) {
    const by = {
      recent: (s) => s.savedAt || s.createdAt || '',
      live: (s) => (daysLive(s) === null ? -1 : daysLive(s)),
      ads: (s) => Number(s.activeAds) || 0,
      reviews: (s) => Number(s.ratingCount) || 0,
      rating: (s) => (s.rating || 0) * 1e9 + (Number(s.ratingCount) || 0) + (daysLive(s) || 0),
    }[key] || ((s) => s.savedAt || '');
    return list.slice().sort((a, b) => { const x = by(a), y = by(b); return x < y ? 1 : x > y ? -1 : 0; });
  }

  function exportCSV() {
    const rows = [['Fonte', 'Nome', 'Nicho', 'País', 'Página / Desenvolvedor', 'Formato / Categoria', 'Início veiculação', 'Dias no ar', 'Anúncios ativos', 'Nota loja', 'Avaliações', 'Preço', 'Monetização', 'Gancho', 'Ângulo', 'Link', 'Destino', 'Potencial', 'Tags', 'Anotações']];
    S().swipe.forEach((s) => rows.push([
      s.source === 'appstore' ? 'App Store' : 'Facebook', s.title, s.niche, s.country, s.pageName || s.developer, s.format || s.category,
      s.startedAt ? A.fmtDate(s.startedAt) : '', daysLive(s) === null ? '' : daysLive(s), s.activeAds || '', s.appRating || '', s.ratingCount || '',
      s.priceLabel || '', s.monetization || '', s.hook || '', s.angle || '', s.url || '', s.landingUrl || '', s.rating || '', (s.tags || []).join(', '), s.notes || '',
    ]));
    A.download('swipe-ofertas-' + A.today() + '.csv', A.toCSV(rows), 'text/csv;charset=utf-8');
  }

  function render(view) {
    const u = A.store.ui.swipe || {};
    if (!S().swipe.length) {
      view.innerHTML = '<div class="card">' + ui().emptyState('bookmark', 'Seu swipe de ofertas está vazio',
        'Junte aqui os anúncios que estão escalando na Biblioteca do Facebook e os apps que mais faturam na App Store: gancho, copy, ângulo, tempo no ar e como cobram. É o seu arquivo de referências para modelar.',
        '<div class="row" style="justify-content:center"><button class="btn btn-primary" data-act="hunt">' + icon('search') + 'Garimpar ofertas</button>' +
        '<button class="btn" data-act="newfb">' + icon('megaphone') + 'Salvar anúncio</button><button class="btn" data-act="newapp">' + icon('phone') + 'Salvar app</button></div>') +
        '<div class="steps" style="padding:0 24px 32px">' +
          '<div class="step"><span class="num-badge">1</span><b>Garimpe</b>Busque por palavra-chave na App Store (aqui mesmo) ou abra a biblioteca do Facebook já filtrada.</div>' +
          '<div class="step"><span class="num-badge">2</span><b>Salve</b>Cole o link. Os dados do app vêm sozinhos; do anúncio você anota gancho, copy e início da veiculação.</div>' +
          '<div class="step"><span class="num-badge">3</span><b>Modele</b>Filtre pelos que estão há mais tempo no ar e envie para a Espionagem para acompanhar a escala.</div>' +
        '</div></div>';
      bindActions(view);
      return;
    }
    const niches = Array.from(new Set(S().swipe.map((s) => s.niche || s.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const src = u.src || '';
    const cnt = (k) => S().swipe.filter((s) => !k || s.source === k).length;
    view.innerHTML =
      '<div class="toolbar">' +
        '<div class="search">' + icon('search') + '<input class="input input-sm" id="wSearch" placeholder="Buscar nome, gancho, copy, tag…" value="' + esc(u.q || '') + '"></div>' +
        '<div class="seg">' + [['', 'Todos'], ['fb', 'Facebook'], ['appstore', 'App Store']].map(([k, l]) => '<button data-src="' + k + '" class="' + (src === k ? 'on' : '') + '">' + l + ' <span class="muted">' + cnt(k) + '</span></button>').join('') + '</div>' +
        '<select class="input input-sm" data-u="niche"><option value="">Todos os nichos</option>' + niches.map((n) => '<option' + (u.niche === n ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select>' +
        '<select class="input input-sm" data-u="sort">' + SORTS.map(([k, l]) => '<option value="' + k + '"' + ((u.sort || 'recent') === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>' +
        '<label class="check small"><input type="checkbox" data-u="favOnly"' + (u.favOnly ? ' checked' : '') + '> <span>Só favoritos</span></label>' +
        '<label class="check small" title="Anúncios no ar há ' + VALIDATED_DAYS + '+ dias ou apps com 1.000+ avaliações"><input type="checkbox" data-u="validated"' + (u.validated ? ' checked' : '') + '> <span>Só validados</span></label>' +
        '<span class="spacer"></span>' +
        '<button class="btn btn-sm" data-act="csv" title="Exportar CSV">' + icon('download') + '</button>' +
        '<button class="btn btn-sm" data-act="newfb">' + icon('plus') + 'Anúncio</button>' +
        '<button class="btn btn-sm" data-act="newapp">' + icon('plus') + 'App</button>' +
        '<button class="btn btn-sm btn-primary" data-act="hunt">' + icon('search') + 'Garimpar</button>' +
      '</div><div id="wBox"></div>';

    const box = A.$('#wBox', view);
    const draw = () => {
      const uu = A.store.ui.swipe || {};
      const q = A.norm(uu.q);
      const list = sortList(S().swipe.filter((s) => {
        if (uu.src && s.source !== uu.src) return false;
        if (uu.niche && (s.niche || s.category) !== uu.niche) return false;
        if (uu.favOnly && !s.fav) return false;
        if (uu.validated && !((daysLive(s) || 0) >= VALIDATED_DAYS || (Number(s.ratingCount) || 0) >= 1000)) return false;
        if (q && !A.norm([s.title, s.niche, s.category, s.pageName, s.developer, s.hook, s.headline, s.copy, s.angle, s.monetization, s.notes, (s.tags || []).join(' ')].join(' ')).includes(q)) return false;
        return true;
      }), uu.sort || 'recent');
      box.innerHTML = list.length ? '<div class="swipe-grid">' + list.map(card).join('') + '</div>' : '<div class="card"><div class="empty"><p>Nada encontrado com esses filtros.</p></div></div>';
    };
    draw();

    A.on(box, 'click', '[data-fav]', (e, b) => { e.stopPropagation(); const s = A.store.get('swipe', b.dataset.fav); if (s) A.store.update('swipe', s.id, { fav: !s.fav }); });
    A.on(box, 'click', '.swipe-card', (e, el) => { if (!e.target.closest('[data-stop],[data-fav]')) open(A.store.get('swipe', el.dataset.id)); });
    A.on(view, 'click', '[data-src]', (e, b) => { A.store.setUI({ swipe: Object.assign({}, A.store.ui.swipe, { src: b.dataset.src }) }); A.app.refresh(); });
    A.$('#wSearch', view).addEventListener('input', A.debounce((e) => { A.store.setUI({ swipe: Object.assign({}, A.store.ui.swipe, { q: e.target.value }) }); draw(); }, 120));
    A.$$('[data-u]', view).forEach((el) => el.addEventListener('change', () => {
      const n = Object.assign({}, A.store.ui.swipe);
      n[el.dataset.u] = el.type === 'checkbox' ? el.checked : el.value;
      A.store.setUI({ swipe: n }); draw();
    }));
    bindActions(view);
  }

  function bindActions(view) {
    A.on(view, 'click', '[data-act]', (e, b) => {
      const a = b.dataset.act;
      if (a === 'hunt') hunt();
      if (a === 'newfb') open(null, { source: 'fb' });
      if (a === 'newapp') open(null, { source: 'appstore' });
      if (a === 'csv') exportCSV();
    });
  }

  A.pages.swipe = { title: 'Swipe de ofertas', period: false, render, open, hunt };
})(window.App);
