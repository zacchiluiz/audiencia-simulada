/* Página: Configurações, backup e dados */
(function (A) {
  'use strict';
  const { esc, icon } = A;
  const ui = () => A.ui;

  const fields = [
    { type: 'section', label: 'Geral' },
    { name: 'name', label: 'Seu nome / empresa', span: 6, placeholder: 'Aparece no menu lateral' },
    { name: 'currency', label: 'Moeda', type: 'select', options: [['BRL', 'Real (R$)'], ['USD', 'Dólar (US$)'], ['EUR', 'Euro (€)']], span: 3 },
    { name: 'theme', label: 'Tema', type: 'select', options: [['system', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']], span: 3 },
    { name: 'monthlyGoal', label: 'Meta mensal de faturamento', type: 'money', span: 4 },
    { name: 'taxRate', label: 'Imposto sobre faturamento', type: 'percent', span: 4, hint: 'Ex.: Simples Nacional 6%' },
    { name: 'adTaxRate', label: 'Imposto sobre gasto em anúncios', type: 'percent', span: 4, hint: 'Ex.: IOF/ISS cobrado pela plataforma' },
  ];

  function exportBackup() {
    A.download('backup-gestor-campanhas-' + A.today() + '.json', A.store.exportJSON(), 'application/json');
    A.store.setSettings({ lastBackup: new Date().toISOString() });
    ui().toast('Backup baixado. Guarde o arquivo em local seguro (Drive, pendrive…).');
  }

  function importFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      let data;
      try { data = A.store.parseImport(String(reader.result)); } catch (e) { ui().toast(e.message || 'Arquivo inválido.', { error: true, duration: 5000 }); return; }
      const c = ['offers', 'campaigns', 'sales', 'spy'].map((k) => data[k].length);
      const ok = await ui().confirm({
        title: 'Restaurar backup?', confirmLabel: 'Restaurar', danger: true,
        html: 'O arquivo tem <b>' + c[0] + '</b> ofertas, <b>' + c[1] + '</b> campanhas, <b>' + c[2] + '</b> vendas e <b>' + c[3] + '</b> espionadas.<br><br>Os dados atuais serão <b>substituídos</b>. Você poderá desfazer logo em seguida.',
      });
      if (!ok) return;
      const snap = A.store.snapshot();
      A.store.replace(data);
      A.app.applyTheme();
      ui().toast('Backup restaurado.', { action: { label: 'Desfazer', fn: () => { A.store.restore(snap); A.app.applyTheme(); } } });
    };
    reader.readAsText(file);
  }

  function render(view) {
    const st = A.store.state;
    const counts = A.store.counts();
    const lb = st.settings.lastBackup;
    const days = lb ? A.daysBetween(lb.slice(0, 10), A.today()) : null;
    const usage = (() => { try { return (localStorage.getItem('gestor-campanhas:v1') || '').length; } catch (e) { return 0; } })();
    view.innerHTML =
      '<div class="grid grid-2" style="align-items:start">' +
      '<div class="stack">' +
        '<form class="card" id="setForm"><div class="card-head"><h3>Preferências</h3></div><div class="card-body">' + ui().formHtml(fields, st.settings) +
          '<div class="row" style="margin-top:16px;justify-content:flex-end"><button class="btn btn-primary" type="submit">Salvar preferências</button></div></div></form>' +
        '<div class="card"><div class="card-head"><h3>Como as métricas são calculadas</h3></div><div class="card-body"><dl class="kv">' +
          '<dt>Faturamento</dt><dd>Soma das vendas <b>aprovadas</b> (valor que você recebe)</dd>' +
          '<dt>Gasto</dt><dd>Valor gasto em anúncios + imposto sobre anúncios</dd>' +
          '<dt>Lucro líquido</dt><dd>Faturamento − taxas − imposto − custo do produto − gasto − custos extras</dd>' +
          '<dt>ROAS</dt><dd>Faturamento ÷ gasto</dd>' +
          '<dt>ROI</dt><dd>Lucro líquido ÷ gasto</dd>' +
          '<dt>Margem</dt><dd>Lucro líquido ÷ faturamento</dd>' +
          '<dt>CPA</dt><dd>Gasto ÷ nº de vendas aprovadas</dd>' +
          '<dt>CTR · CPC · CPM</dt><dd>Cliques ÷ impressões · gasto ÷ cliques · gasto por mil impressões</dd>' +
          '<dt>Custos extras</dt><dd>Entram no lucro geral e da oferta vinculada (não nas campanhas)</dd>' +
        '</dl></div></div>' +
        '<div class="card"><div class="card-head"><h3>Atalhos</h3></div><div class="card-body"><dl class="kv">' +
          '<dt><kbd>N</kbd></dt><dd>Lançamento do dia</dd><dt><kbd>V</kbd></dt><dd>Registrar venda</dd><dt><kbd>E</kbd></dt><dd>Nova oferta espionada</dd>' +
          '<dt><kbd>1</kbd>…<kbd>7</kbd></dt><dd>Ir para as páginas do menu</dd><dt><kbd>Esc</kbd></dt><dd>Fechar janela</dd>' +
        '</dl></div></div>' +
      '</div>' +
      '<div class="stack">' +
        '<div class="card"><div class="card-head"><h3>Backup</h3>' + (days === null ? '<span class="badge warn">Nunca feito</span>' : days > 7 ? '<span class="badge warn">Último há ' + days + ' dias</span>' : '<span class="badge good">Em dia</span>') + '</div><div class="card-body">' +
          '<p class="muted" style="margin-top:0">Seus dados ficam <b>somente neste navegador</b>. Se limpar os dados do navegador ou trocar de computador, eles somem — faça backup com frequência.</p>' +
          '<div class="row"><button class="btn btn-primary" data-act="export">' + icon('download') + 'Baixar backup (.json)</button></div>' +
          '<div class="dropzone" id="drop" style="margin-top:14px">' + icon('upload', '') + '<div style="margin-top:6px"><b>Restaurar backup</b> — arraste o arquivo .json aqui ou clique</div><input type="file" accept=".json,application/json" id="file" hidden></div>' +
          (lb ? '<div class="muted small" style="margin-top:10px">Último backup: ' + A.fmtDate(lb.slice(0, 10)) + '</div>' : '') +
        '</div></div>' +
        '<div class="card"><div class="card-head"><h3>Seus dados</h3></div><div class="card-body">' +
          '<div class="metric-strip">' +
            [['Ofertas', counts.offers], ['Campanhas', counts.campaigns], ['Registros de gasto', counts.spend], ['Vendas', counts.sales], ['Espionadas', counts.spy], ['Custos', counts.costs]].map(([l, n]) => '<div><span>' + l + '</span><b>' + A.num(n) + '</b></div>').join('') +
          '</div>' +
          '<div class="muted small" style="margin-top:10px">Espaço usado: ' + A.num(usage / 1024, 0) + ' KB de ~5.000 KB disponíveis no navegador.</div>' +
          '<div class="row" style="margin-top:14px"><button class="btn" data-act="demo">' + icon('database') + 'Adicionar dados de exemplo</button>' +
          '<button class="btn btn-danger" data-act="reset">' + icon('trash') + 'Apagar todos os dados</button></div>' +
        '</div></div>' +
      '</div></div>';

    const form = A.$('#setForm', view);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      A.store.setSettings(ui().readForm(form, fields));
      A.app.applyTheme();
      ui().toast('Preferências salvas.');
    });
    form.elements.theme.addEventListener('change', () => { A.store.setSettings({ theme: form.elements.theme.value }); A.app.applyTheme(); });
    const drop = A.$('#drop', view), file = A.$('#file', view);
    drop.addEventListener('click', () => file.click());
    file.addEventListener('change', () => { importFile(file.files[0]); file.value = ''; });
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); importFile(e.dataTransfer.files[0]); });
    A.on(view, 'click', '[data-act]', async (e, b) => {
      const a = b.dataset.act;
      if (a === 'export') exportBackup();
      if (a === 'demo') { A.store.seedDemo(); ui().toast('Dados de exemplo adicionados.'); }
      if (a === 'reset') {
        const ok = await ui().confirm({ title: 'Apagar TODOS os dados?', html: 'Isso remove ofertas, campanhas, vendas, espionagem e custos deste navegador. <b>Recomendo baixar um backup antes.</b>', typeToConfirm: 'APAGAR', confirmLabel: 'Apagar tudo' });
        if (ok) { const snap = A.store.snapshot(); A.store.reset(); ui().toast('Todos os dados foram apagados.', { action: { label: 'Desfazer', fn: () => A.store.restore(snap) }, duration: 10000 }); }
      }
    });
  }

  A.pages.settings = { title: 'Configurações', period: false, render, exportBackup };
})(window.App);
