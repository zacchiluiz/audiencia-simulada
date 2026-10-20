/* Componentes de interface: modal, formulários, tabelas, toasts, confirmação. */
(function (A) {
  'use strict';
  const { esc, icon } = A;

  /* ---------- Toast ---------- */
  function toast(msg, opts) {
    opts = opts || {};
    const root = document.getElementById('toasts');
    const t = document.createElement('div');
    t.className = 'toast' + (opts.error ? ' error' : '');
    t.innerHTML = '<span>' + esc(msg) + '</span>' + (opts.action ? '<button type="button">' + esc(opts.action.label) + '</button>' : '');
    root.appendChild(t);
    const close = () => { t.remove(); };
    if (opts.action) t.querySelector('button').addEventListener('click', () => { opts.action.fn(); close(); });
    setTimeout(close, opts.duration || (opts.action ? 6000 : 2600));
  }

  /* ---------- Modal ---------- */
  const stack = [];
  function modal(opts) {
    const root = document.getElementById('modalRoot');
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML =
      '<form class="modal ' + (opts.size || '') + '" novalidate>' +
        '<div class="modal-head"><h2>' + esc(opts.title) + '</h2><button type="button" class="icon-btn" data-close aria-label="Fechar">' + icon('x') + '</button></div>' +
        '<div class="modal-body">' + (opts.body || '') + '</div>' +
        (opts.noFoot ? '' : '<div class="modal-foot"><div class="left">' + (opts.left || '') + '</div>' +
          '<button type="button" class="btn" data-close>' + esc(opts.cancelLabel || 'Cancelar') + '</button>' +
          (opts.onSubmit ? '<button type="submit" class="btn ' + (opts.danger ? 'btn-danger-solid' : 'btn-primary') + '">' + esc(opts.submitLabel || 'Salvar') + '</button>' : '') +
        '</div>') +
      '</form>';
    root.appendChild(wrap);
    const form = wrap.querySelector('form');
    const close = () => {
      wrap.remove();
      const i = stack.indexOf(close); if (i >= 0) stack.splice(i, 1);
      A.charts.tip.hide();
      if (opts.onClose) opts.onClose();
    };
    stack.push(close);
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap && !opts.sticky) close(); });
    A.on(form, 'click', '[data-close]', close);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!opts.onSubmit) return;
      if (!validate(form)) return;
      const r = opts.onSubmit(form, close);
      if (r !== false) close();
    });
    if (opts.onMount) opts.onMount(form, close);
    const first = form.querySelector('.modal-body input:not([type=hidden]):not([type=checkbox]), .modal-body select, .modal-body textarea');
    if (first && !opts.noAutofocus) setTimeout(() => first.focus(), 30);
    return { form, close };
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stack.length) { e.preventDefault(); stack[stack.length - 1](); } });
  const hasModal = () => stack.length > 0;

  function validate(form) {
    let ok = true;
    form.querySelectorAll('[data-required]').forEach((inp) => {
      const empty = !String(inp.value || '').trim();
      inp.style.borderColor = empty ? 'var(--bad)' : '';
      if (empty && ok) { inp.focus(); ok = false; }
    });
    if (!ok) toast('Preencha os campos obrigatórios.', { error: true });
    return ok;
  }

  function confirm(opts) {
    return new Promise((resolve) => {
      let done = false;
      modal({
        title: opts.title || 'Confirmar', size: 'narrow', danger: opts.danger !== false,
        body: '<p style="margin:0">' + (opts.html || esc(opts.message)) + '</p>' +
          (opts.typeToConfirm ? '<label class="field" style="margin-top:14px"><span>Digite <b>' + esc(opts.typeToConfirm) + '</b> para confirmar</span><input class="input" name="confirm" autocomplete="off"></label>' : ''),
        submitLabel: opts.confirmLabel || 'Excluir',
        noAutofocus: !opts.typeToConfirm,
        onSubmit: (form) => {
          if (opts.typeToConfirm && form.confirm.value.trim().toUpperCase() !== opts.typeToConfirm.toUpperCase()) { toast('Texto de confirmação incorreto.', { error: true }); return false; }
          done = true; resolve(true);
        },
        onClose: () => { if (!done) resolve(false); },
      });
    });
  }

  /** Exclui com opção de desfazer. */
  async function removeWithUndo(coll, id, label, extraMsg) {
    const okd = await confirm({ title: 'Excluir ' + label + '?', html: (extraMsg ? esc(extraMsg) + '<br><br>' : '') + 'Você poderá desfazer logo em seguida.' });
    if (!okd) return false;
    const snap = A.store.remove(coll, id);
    toast('Excluído: ' + label, { action: { label: 'Desfazer', fn: () => { A.store.restore(snap); toast('Restaurado.'); } } });
    return true;
  }

  /* ---------- Formulários declarativos ---------- */
  const opt = (o) => (Array.isArray(o) ? o : [o, o]);
  function fieldHtml(f, v) {
    const span = f.span ? ' span-' + f.span : '';
    if (f.type === 'section') return '<div class="form-section">' + esc(f.label) + '</div>';
    if (f.type === 'html') return '<div class="' + span.trim() + '">' + f.html + '</div>';
    const req = f.required ? ' data-required' : '';
    const ph = f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '';
    const nm = ' name="' + f.name + '" id="f_' + f.name + '"';
    let input;
    switch (f.type) {
      case 'textarea':
        input = '<textarea class="input"' + nm + ph + ' rows="' + (f.rows || 3) + '">' + esc(v) + '</textarea>'; break;
      case 'select': {
        const opts = (typeof f.options === 'function' ? f.options() : f.options).map(opt);
        input = '<select class="input"' + nm + req + '>' + (f.empty !== undefined ? '<option value="">' + esc(f.empty) + '</option>' : '') +
          opts.map(([k, l]) => '<option value="' + esc(k) + '"' + (String(v) === String(k) ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>';
        break;
      }
      case 'money':
        input = '<div class="input-prefix"><b>' + (A.store.state.settings.currency === 'BRL' ? 'R$' : esc(A.store.state.settings.currency)) + '</b><input class="input tnum" inputmode="decimal" autocomplete="off"' + nm + req + ph + ' value="' + esc(A.toInput(v)) + '"></div>'; break;
      case 'percent':
        input = '<div class="input-suffix"><input class="input tnum" inputmode="decimal" autocomplete="off"' + nm + req + ph + ' value="' + esc(A.toInput(v)) + '"><b>%</b></div>'; break;
      case 'int':
        input = '<input class="input tnum" inputmode="numeric" autocomplete="off"' + nm + req + ph + ' value="' + esc(v ? A.num(v) : '') + '">'; break;
      case 'checkbox':
        return '<label class="check' + span + '"><input type="checkbox"' + nm + (v ? ' checked' : '') + '> <span>' + esc(f.label) + '</span></label>';
      case 'tags':
        input = '<input class="input"' + nm + ' placeholder="' + esc(f.placeholder || 'separe por vírgula') + '" value="' + esc((v || []).join(', ')) + '">'; break;
      case 'rating': {
        const n = Number(v) || 0;
        input = '<div class="rating-input" data-rating="' + f.name + '"><input type="hidden"' + nm + ' value="' + n + '">' +
          [1, 2, 3, 4, 5].map((i) => '<button type="button" data-star="' + i + '" class="' + (i <= n ? 'on' : '') + '" aria-label="' + i + ' estrela(s)">★</button>').join('') + '</div>';
        break;
      }
      case 'date':
        input = '<input type="date" class="input"' + nm + req + ' value="' + esc(v || '') + '">'; break;
      default:
        input = '<input type="' + (f.type === 'url' ? 'url' : 'text') + '" class="input" autocomplete="off"' + nm + req + ph + ' value="' + esc(v) + '">';
    }
    return '<label class="field' + span + '"><span>' + esc(f.label) + (f.required ? ' *' : '') + '</span>' + input + (f.hint ? '<small>' + esc(f.hint) + '</small>' : '') + '</label>';
  }
  function formHtml(fields, values) {
    values = values || {};
    return '<div class="form-grid">' + fields.map((f) => fieldHtml(f, values[f.name] !== undefined ? values[f.name] : f.default)).join('') + '</div>';
  }
  function readForm(form, fields) {
    const out = {};
    fields.forEach((f) => {
      if (!f.name || f.type === 'section' || f.type === 'html') return;
      const inp = form.elements[f.name];
      if (!inp) return;
      switch (f.type) {
        case 'money': case 'percent': out[f.name] = A.parseNum(inp.value); break;
        case 'int': out[f.name] = Math.round(A.parseNum(inp.value)); break;
        case 'rating': out[f.name] = Number(inp.value) || 0; break;
        case 'checkbox': out[f.name] = inp.checked; break;
        case 'tags': out[f.name] = inp.value.split(',').map((s) => s.trim()).filter(Boolean); break;
        default: out[f.name] = inp.value.trim();
      }
    });
    return out;
  }
  function bindRating(form) {
    A.on(form, 'click', '[data-star]', (e, b) => {
      const box = b.closest('[data-rating]');
      const inp = box.querySelector('input');
      const n = Number(b.dataset.star);
      inp.value = Number(inp.value) === n ? 0 : n;
      box.querySelectorAll('[data-star]').forEach((s) => s.classList.toggle('on', Number(s.dataset.star) <= Number(inp.value)));
    });
  }

  /** Modal de formulário completo. */
  function formModal(opts) {
    return modal({
      title: opts.title, size: opts.size,
      body: (opts.before || '') + formHtml(opts.fields, opts.values) + (opts.after || ''),
      submitLabel: opts.submitLabel || 'Salvar',
      left: opts.left,
      sticky: true,
      onMount: (form, close) => { bindRating(form); if (opts.onMount) opts.onMount(form, close); },
      onSubmit: (form, close) => opts.onSave(readForm(form, opts.fields), form, close),
    });
  }

  /* ---------- Tabela ordenável ---------- */
  function sortState(id, def) {
    const all = A.store.ui.sort || {};
    return all[id] || def || { key: null, dir: 'desc' };
  }
  function table(opts) {
    const st = sortState(opts.id, opts.defaultSort);
    let rows = opts.rows.slice();
    const col = opts.columns.find((c) => c.key === st.key);
    if (col && col.sort) {
      rows.sort((a, b) => {
        let x = col.sort(a), y = col.sort(b);
        if (typeof x === 'string' || typeof y === 'string') return (st.dir === 'asc' ? 1 : -1) * String(x || '').localeCompare(String(y || ''), 'pt-BR');
        x = Number.isFinite(x) ? x : -Infinity; y = Number.isFinite(y) ? y : -Infinity;
        return st.dir === 'asc' ? x - y : y - x;
      });
    }
    if (!rows.length) return opts.empty || '<div class="empty"><p>Nada por aqui.</p></div>';
    const th = opts.columns.map((c) => {
      const cls = [c.num ? 'num' : '', c.sort ? 'sortable' : '', c.cls || ''].join(' ');
      const arrow = st.key === c.key ? '<span class="arrow">' + (st.dir === 'asc' ? '↑' : '↓') + '</span>' : '';
      return '<th class="' + cls + '"' + (c.sort ? ' data-sort="' + c.key + '" data-table="' + opts.id + '"' : '') + (c.title ? ' title="' + esc(c.title) + '"' : '') + '>' + esc(c.label) + arrow + '</th>';
    }).join('');
    const body = rows.map((r) => '<tr ' + (opts.rowAttr ? opts.rowAttr(r) : '') + '>' + opts.columns.map((c) => '<td class="' + [c.num ? 'num' : '', c.cls || ''].join(' ') + '">' + c.html(r) + '</td>').join('') + '</tr>').join('');
    const foot = opts.footer ? '<tfoot><tr>' + opts.columns.map((c) => '<td class="' + (c.num ? 'num' : '') + '">' + (opts.footer[c.key] != null ? opts.footer[c.key] : '') + '</td>').join('') + '</tr></tfoot>' : '';
    return '<div class="table-wrap"><table class="table"><thead><tr>' + th + '</tr></thead><tbody>' + body + '</tbody>' + foot + '</table></div>';
  }
  /** Liga cliques de ordenação; chamar uma vez por container. */
  function bindSort(root, rerender) {
    A.on(root, 'click', 'th[data-sort]', (e, th) => {
      const id = th.dataset.table, key = th.dataset.sort;
      const all = Object.assign({}, A.store.ui.sort || {});
      const cur = all[id] || {};
      all[id] = { key, dir: cur.key === key && cur.dir === 'desc' ? 'asc' : 'desc' };
      A.store.setUI({ sort: all });
      rerender();
    });
  }

  /* ---------- Pequenos helpers de HTML ---------- */
  const deltaBadge = (d, invert) => {
    if (d === null || d === undefined || !Number.isFinite(d)) return '';
    if (Math.abs(d) < 0.0005) return '<span class="delta flat">0%</span>';
    const good = invert ? d < 0 : d > 0;
    return '<span class="delta ' + (good ? 'up' : 'down') + '">' + (d > 0 ? '▲' : '▼') + ' ' + A.pct(Math.abs(d), Math.abs(d) >= 10 ? 0 : 1) + '</span>';
  };
  const signed = (v) => '<span class="' + (v > 0.004 ? 'pos' : v < -0.004 ? 'neg' : '') + '">' + A.money(v) + '</span>';
  const signedPct = (v) => (Number.isFinite(v) ? '<span class="' + (v > 0 ? 'pos' : v < 0 ? 'neg' : '') + '">' + A.pct(v) + '</span>' : '<span class="muted">—</span>');
  const roasHtml = (v) => (Number.isFinite(v) ? '<span class="' + (v >= 1 ? '' : 'neg') + '">' + A.ratioX(v) + '</span>' : '<span class="muted">—</span>');
  const colorDot = (slot) => '<span class="dot" style="background:' + A.charts.color(slot) + '"></span>';
  const tagsHtml = (tags) => (tags || []).map((t) => '<span class="tag">' + esc(t) + '</span>').join('');
  const extLink = (url, label) => { const u = A.safeUrl(url); return u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer" class="row" style="gap:4px;display:inline-flex" data-stop>' + icon('external') + (label ? esc(label) : '') + '</a>' : ''; };
  function emptyState(ic, title, text, btn) {
    return '<div class="empty"><div class="empty-icon">' + icon(ic) + '</div><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' + (btn || '') + '</div>';
  }

  A.ui = {
    toast, modal, confirm, removeWithUndo, formHtml, readForm, formModal, bindRating, hasModal,
    table, bindSort, deltaBadge, signed, signedPct, roasHtml, colorDot, tagsHtml, extLink, emptyState,
  };
})(window.App);
