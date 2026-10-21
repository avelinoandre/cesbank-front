/* Núcleo · telas, confirmações explícitas, mensagens de RN e acessibilidade. */
(function (C) {
  'use strict';

  let handlers = {},
    serial = 0,
    notice;
  const e = v => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
  const money = C.M.fmt;
  function action(label, fn, style = 'primary') {
    const id = 'act' + ++serial;
    handlers[id] = fn;
    return `<button type="button" class="${e(style)}" data-action="${id}">${e(label)}</button>`;
  }
  function form(body, fn, label = 'Continuar', style = 'primary') {
    const id = 'act' + ++serial;
    handlers[id] = fn;
    return `<form data-action="${id}" novalidate>${body}<div class="actions"><button class="${style}" type="submit">${e(label)}</button></div></form>`;
  }
  function field(name, label, value = '', type = 'text', attrs = '') {
    return `<label>${e(label)}<input name="${e(name)}" type="${e(type)}" value="${e(value)}" ${attrs}></label>`;
  }
  function select(name, label, options, value = '') {
    return `<label>${e(label)}<select name="${e(name)}">${options.map(o => {
      const [v, t] = Array.isArray(o) ? o : [o, o];
      return `<option value="${e(v)}" ${String(v) === String(value) ? 'selected' : ''}>${e(t)}</option>`;
    }).join('')}</select></label>`;
  }
  function checkbox(name, label, checked = false) {
    return `<label class="check"><input type="checkbox" name="${e(name)}" ${checked ? 'checked' : ''}>${e(label)}</label>`;
  }
  function table(headers, rows) {
    return rows.length ? `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<div class="empty">Nenhum registro para exibir.</div>';
  }
  function card(title, body, cls = '') {
    return `<section class="card ${cls}"><h2>${e(title)}</h2>${body}</section>`;
  }
  function badge(v) {
    return `<span class="badge ${/ATIVA|ATIVO|PAGA$|EFETIVADA|CONCLUIDA|EXECUTADA/.test(v) ? 'good' : /REJEIT|ATRASO|CANCEL|FALHA/.test(v) ? 'bad' : ''}">${e(v.replace(/_/g, ' '))}</span>`;
  }
  function json(v) {
    return `<details><summary>Ver dados e auditoria</summary><pre>${e(JSON.stringify(v, null, 2))}</pre></details>`;
  }
  function flash(text, type = 'success') {
    notice = {
      text,
      type,
      path: location.hash
    };
    document.getElementById('messages').innerHTML = `<div class="banner ${type}" role="status">${e(text)}</div>`;
  }
  function error(ex) {
    const d = C.errorData(ex);
    const html = `<div class="banner error" role="alert"><strong>${e(d.codigo)} · ${e(d.titulo)}</strong><p>${e(d.detalhe)}</p><small>Requisição ${e(d.idRequisicao)} · ${e(C.Clock.label(d.dataHora))}</small></div>`;
    document.getElementById('messages').innerHTML = html;
    const dialog = document.querySelector('#modal .modal');
    if (dialog) {
      dialog.querySelector('.banner.error')?.remove();
      dialog.insertAdjacentHTML('afterbegin', html);
    }
  }
  function modal(title, body) {
    document.getElementById('modal').innerHTML = `<div class="modal-backdrop"><section role="dialog" aria-modal="true" aria-label="${e(title)}" class="modal"><h2>${e(title)}</h2>${body}<div class="actions">${action('Fechar', close, 'secondary')}</div></section></div>`;
    document.querySelector('#modal input, #modal button')?.focus();
  }
  function close() {
    document.getElementById('modal').innerHTML = '';
  }
  function balance(s, id = s.session.account) {
    const b = C.S.accounts.balance(s, id);
    return `<div class="balance"><span>Saldo disponível</span><strong>${money(b.available)}</strong><div class="composition"><span>Total <b>${money(b.total)}</b></span><span>Bloqueado <b>${money(b.blocked)}</b></span><span>Investido <b>${money(b.invested)}</b></span><span>Caixinhas <b>${money(b.boxes)}</b></span></div><small>Disponível = total − bloqueado − investido − caixinhas</small></div>`;
  }
  function page(title, subtitle, body, rn = '') {
    return `<header class="page-heading"><div><small>CESBANK / ${e(C.Router.current().path.replace(/-/g, ' '))}</small><h1>${e(title)}</h1><p>${e(subtitle)}</p></div>${rn ? `<a class="rn" href="#validacao">${e(rn)}</a>` : ''}</header>${body}`;
  }
  function history(row) {
    return table(['Data e hora', 'Situação', 'Responsável', 'Detalhe'], (row.history || []).map(h => [e(C.Clock.label(h.at)), badge(h.to), e(h.actor), e(h.detail)]));
  }
  function link(path, text) {
    return `<a class="button secondary" href="#${e(path)}">${e(text)}</a>`;
  }
  function demoTools(s) {
    return `<details class="demo-tools"><summary>Ferramentas de demonstração · ${e(C.Clock.label(s.now))}</summary><p>O relógio é compartilhado por todos os módulos. Avançar processa prazos, pagamentos e rendimentos.</p><div class="actions">${action('+ 1 hora', () => {
      C.Clock.advance(new Date(new Date(C.Clock.now()).getTime() + 3600000).toISOString().replace(/\.\d{3}Z$/, 'Z'));
      render();
    })}${action('+ 1 dia', () => {
      C.Clock.advance(new Date(new Date(C.Clock.now()).getTime() + 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z'));
      render();
    })}${action('+ 30 dias', () => {
      C.Clock.advance(new Date(new Date(C.Clock.now()).getTime() + 2592000000).toISOString().replace(/\.\d{3}Z$/, 'Z'));
      render();
    })}${link('cenarios', 'Como experimentar')}</div>${form(field('when', 'Avançar para data e hora de Brasília', C.Clock.local(s.now).toISOString().replace(/\.\d{3}Z$/, 'Z').slice(0, 16), 'datetime-local'), d => {
      C.assert(d.when, 'Informe a data.');
      C.Clock.advance(new Date(d.when + ':00-03:00').toISOString().replace(/\.\d{3}Z$/, 'Z'));
      render();
    }, 'Aplicar relógio', 'secondary')}<div class="actions">${action('Reiniciar dados do protótipo', () => modal('Reiniciar dados do protótipo', '<p>Os registros fictícios deste protótipo serão restaurados.</p>' + action('Confirmar reinicialização', () => {
      C.Db.reset();
      close();
      C.Router.go('inicio');
      render();
      flash('Dados fictícios restaurados.');
    }, 'danger')), 'danger')}</div></details>`;
  }
  /* Somente organização do menu: nenhuma rota ou permissão é modificada. */
  function navigation(path) {
    const sections = [
      ['visao', 'Visão geral', ['inicio', 'notificacoes']],
      ['pagamentos', 'Pagamentos e Pix', ['transferencia', 'boletos', 'agendamentos', 'favoritos', 'chaves']],
      ['consultas', 'Extratos e histórico', ['extrato', 'operacoes']],
      ['investimentos', 'Investimentos', ['investimentos']],
      ['credito', 'Crédito e cartões', ['emprestimo', 'contratos', 'cartoes', 'faturas']],
      ['conta', 'Minha conta', ['dados', 'limites', 'abrir-conta', 'encerrar-conta']],
      ['suporte', 'Contestações', ['contestacoes']],
      ['administracao', 'Área do analista', ['atendimento', 'admin-contas']],
      ['demonstracao', 'Demonstração e perfis', ['perfis', 'sair', 'cenarios', 'validacao']]
    ];
    const parents = {
      'comprovante':'operacoes', 'boleto-codigo':'boletos', 'boleto-confirmar':'boletos',
      'boleto-agendar':'boletos', 'boleto-rejeitar':'boletos', 'boleto-recurso':'boletos', 'beneficiario':'boletos',
      'consulta-pix':'chaves', 'reivindicacoes':'chaves',
      'caixinhas':'investimentos', 'caixinha':'investimentos', 'aplicacao':'investimentos', 'gerenciar-investimentos':'investimentos',
      'dados-editar':'dados', 'alterar-senha':'dados', 'limites-historico':'limites'
    };
    const active = parents[path] || (path.startsWith('cartao-') ? 'cartoes' : path);
    const seen = new Set();
    const entry = key => {
      const route = C.routes[key];
      if (!route?.group || seen.has(key)) return '';
      seen.add(key);
      return '<a href="#' + e(key) + '"' + (active === key ? ' class="active"' + (path === key ? ' aria-current="page"' : ' aria-current="location"') : '') + '>' + e(route.title) + '</a>';
    };
    const section = (id, title, keys) => {
      const links = keys.map(entry).join('');
      if (!links) return '';
      if (id === 'visao') return '<div class="menu-overview"><span class="nav-group">' + e(title) + '</span>' + links + '</div>';
      return '<details class="menu-section" data-menu-section="' + e(id) + '"' + (keys.includes(active) ? ' open' : '') + '><summary>' + e(title) + '</summary><div class="menu-links">' + links + '</div></details>';
    };
    const html = sections.map(([id,title,keys]) => section(id,title,keys)).join('');
    // Novos módulos com entrada no menu continuam acessíveis sem atualizar esta lista.
    const remaining = Object.keys(C.routes).filter(key => C.routes[key].group && !seen.has(key));
    return html + section('outros', 'Outros serviços', remaining);
  }
  function render() {
    handlers = {};
    close();
    const s = C.Db.get();
    const current = C.Router.current();
    const route = C.routes[current.path];
    const u = C.S.accounts.client(s, s.session.client);
    document.getElementById('identity').innerHTML = `<strong>${e(u.social || u.name)}</strong><small>${e(s.session.role)} · Agência 0001 · ${e(s.accounts.find(a => a.id === s.session.account).number)}</small>`;
    document.getElementById('menu').innerHTML = navigation(current.path);
    document.getElementById('messages').innerHTML = '';
    if (notice?.path === location.hash) flash(notice.text, notice.type);else notice = null;
    try {
      document.getElementById('content').innerHTML = route ? route.render(s, current.params) : page('Página não encontrada', 'Use o menu para continuar.', link('inicio', 'Ir ao início'));
    } catch (ex) {
      document.getElementById('content').innerHTML = page('Não foi possível abrir esta tela', 'Confira a mensagem abaixo.', link('inicio', 'Ir ao início'));
      error(ex);
    }
    document.body.dataset.route = current.path;
    if (s.demo.path === current.path) {
      const content = document.getElementById('content');
      content.insertAdjacentHTML('afterbegin', `<div class="banner warning"><strong>Cenário de validação ${e(s.demo.code || '')}</strong><p>${e(s.demo.instruction || '')}</p></div>`);
      Object.entries(s.demo.fields || {}).forEach(([key, value]) => {
        content.querySelectorAll('[name="' + key + '"]').forEach(el => {
          if (el.type === 'checkbox') el.checked = !!value;else if (el.type !== 'file') el.value = String(value);
        });
      });
    }
    document.getElementById('tools').innerHTML = demoTools(s);
    if (C.storageWarning) flash('Armazenamento local indisponível. Os dados serão mantidos somente durante esta sessão.', 'warning');
    document.title = (route?.title || 'Início') + ' · Cesbank';
  }
  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-action]');
    if (!el || el.tagName === 'FORM') return;
    ev.preventDefault();
    try {
      Promise.resolve(handlers[el.dataset.action]?.()).catch(error);
    } catch (ex) {
      error(ex);
    }
  });
  document.addEventListener('submit', ev => {
    const formEl = ev.target.closest('form[data-action]');
    if (!formEl) return;
    ev.preventDefault();
    const data = Object.fromEntries(new FormData(formEl));
    try {
      Promise.resolve(handlers[formEl.dataset.action]?.(data, formEl)).catch(error);
    } catch (ex) {
      error(ex);
    }
  });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') close();
  });
  C.UI = {
    e,
    money,
    action,
    form,
    field,
    select,
    checkbox,
    table,
    card,
    badge,
    json,
    flash,
    error,
    modal,
    close,
    balance,
    page,
    history,
    link,
    render,
    navigation,
    done(text) {
      close();
      C.UI.render();
      flash(text);
      window.scrollTo(0, 0);
    }
  };
})(Cesbank);
