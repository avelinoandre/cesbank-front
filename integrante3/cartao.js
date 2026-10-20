/* Integrante 3 · F10 RN1–RN12 · análise, emissão, virtual, limites, reserva e renovação. */
(function (C) {
  'use strict';

  const U = C.UI,
    A = C.S.accounts,
    M = C.M,
    K = C.Clock;
  const channels = ['PRESENCIAL', 'NAO_PRESENCIAL', 'APROXIMACAO'];
  function analyze(s, accountId = s.session.account) {
    const a = A.account(s, accountId),
      u = A.client(s, a.client),
      age = K.days(K.day(a.opened), K.day(s.now));
    const start = K.addDays(K.day(s.now), -90);
    const entries = s.ledger.filter(r => r.account === a.id && !r.allocation && K.day(r.at) >= start);
    const incoming = entries.filter(r => r.nature === 'CREDITO').reduce((v, r) => v + r.value, 0),
      outgoing = entries.filter(r => r.nature === 'DEBITO').reduce((v, r) => v + r.value, 0);
    let sum = 0;
    for (let i = 0; i < 90; i++) {
      const d = K.addDays(K.day(s.now), -i);
      const later = entries.filter(r => K.day(r.at) > d);
      sum += a.total - later.reduce((v, r) => v + (r.nature === 'CREDITO' ? r.value : -r.value), 0);
    }
    const average = M.mul(sum, 1, 90);
    C.assert(age >= C.policy.cardAgeDays, 'Contas sem 30 dias de relacionamento não são elegíveis.', 'CreditoRecusado');
    C.assert(!u.restriction && !s.contracts.some(c => c.client === u.id && c.status === 'EM_ATRASO') && !s.invoices.some(f => f.account === a.id && f.status === 'EM_ATRASO'), 'Restrições ou inadimplência impedem a aprovação.', 'CreditoRecusado');
    C.assert(u.income > 0 && average > 0 && incoming > 0, 'Qualificação e movimentação insuficientes para emissão.', 'CreditoRecusado');
    const ceiling = {
      BASICA: 500000,
      MEDIA: 1000000,
      ALTA: 2000000
    }[u.qualification];
    const score = u.income * 2 + M.mul(incoming, 1, 4) + M.mul(Math.max(0, average), 1, 4) - M.mul(outgoing, 1, 10);
    const limit = Math.max(10000, Math.min(ceiling, Math.trunc(score / 10000) * 10000));
    return {
      age,
      incoming,
      outgoing,
      average,
      qualification: u.qualification,
      ceiling,
      limit,
      at: s.now
    };
  }
  function pin(value, u) {
    C.assert(/^\d{4}$/.test(value), 'A senha do cartão deve ter exatamente 4 dígitos.');
    C.assert(new Set(value).size === 4 && !['0123456789', '9876543210'].includes(value), 'A senha do cartão não pode ter dígitos repetidos ou sequências.');
    C.assert(!['0123456789', '9876543210'].some(seq => seq.includes(value)), 'A senha do cartão não pode conter sequências.');
    const birth = u.birth.replace(/-/g, '');
    C.assert(![birth.slice(4), birth.slice(6) + birth.slice(4, 6), birth.slice(0, 4)].includes(value), 'A senha não pode coincidir com a data de nascimento do titular.');
  }
  function physical(s, id) {
    const c = s.cards.find(c => c.id === id);
    C.assert(c && c.account === s.session.account, 'Cartão não encontrado para a conta selecionada.');
    return c;
  }
  function issue(s) {
    C.Session.requireClient(s);
    const a = A.own(s);
    C.assert(!s.cards.some(c => c.account === a.id && c.status !== 'CANCELADO'), 'Cancele o cartão físico anterior antes de emitir um novo.');
    const result = analyze(s);
    const c = {
      id: C.Ids.uuid(),
      account: a.id,
      number: '4985' + String(parseInt(C.Ids.uuid().slice(0, 8), 16)).padStart(12, '0').slice(-12),
      status: 'INATIVO',
      limit: result.limit,
      used: 0,
      channels: Object.fromEntries(channels.map(v => [v, result.limit])),
      virtuals: [],
      issued: s.now,
      expiry: K.months(K.day(s.now), 36),
      analysis: result,
      history: [{
        to: 'INATIVO',
        at: s.now,
        actor: 'SISTEMA',
        detail: 'Emissão aprovada pelo perfil e pela movimentação.'
      }]
    };
    s.cards.push(c);
    C.S.audit(s, 'cartao', c.id, JSON.stringify(result));
    return c;
  }
  function authorize(s, d) {
    C.Session.requireClient(s);
    const c = physical(s, d.card);
    if (c.status !== 'ATIVO' || c.expiry < K.day(s.now)) C.fail('CartaoBloqueadoOuCancelado');
    C.assert(channels.includes(d.channel), 'Canal de uso inválido.');
    const principal = M.parse(d.value),
      n = Number(d.installments);
    const rateBp = Number(d.rateBp || 0);
    C.assert(Number.isInteger(rateBp) && rateBp >= 0 && rateBp <= 500, 'Encargos opcionais entre zero e 500 pontos-base ao mês.');
    C.assert(Number.isInteger(n) && n >= 1 && n <= C.policy.installments, 'Uma compra pode ter de 1 a 12 parcelas.');
    const plan = rateBp ? M.price(principal, rateBp, n) : Array.from({
      length: n
    }, (_, i) => {
      const part = Math.trunc(principal / n) + (i < principal % n ? 1 : 0);
      return {
        value: part,
        amort: part,
        interest: 0
      };
    });
    const value = plan.reduce((v, r) => v + r.value, 0);
    C.assert(Number.isInteger(n) && n >= 1 && n <= C.policy.installments, 'Uma compra pode ter de 1 a 12 parcelas.');
    C.assert(d.description.trim(), 'Informe o estabelecimento.');
    if (value > c.limit - c.used) C.fail('LimiteDeCreditoIndisponivel');
    C.assert(value <= c.channels[d.channel], 'Compra excede o limite configurado para este canal.', 'LimiteDeCreditoIndisponivel');
    if (d.virtual) {
      const v = c.virtuals.find(v => v.id === d.virtual && v.status === 'ATIVO');
      C.assert(v && d.channel === 'NAO_PRESENCIAL', 'Cartão virtual ativo permite apenas compra não presencial.');
    }
    if (d.channel === 'PRESENCIAL' || d.channel === 'APROXIMACAO' && value > C.policy.contactless) C.assert(C.Security.verify(d.pin, c.pin), 'Esta compra exige a senha correta do cartão.');
    const auth = {
      id: C.Ids.uuid(),
      card: c.id,
      account: c.account,
      virtual: d.virtual || null,
      value,
      principal,
      plan,
      rateBp,
      installments: n,
      description: d.description.trim(),
      channel: d.channel,
      status: 'RESERVADA',
      at: s.now,
      expires: new Date(new Date(s.now).getTime() + C.policy.cardReserveHours * 3600000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
      history: [{
        to: 'RESERVADA',
        at: s.now,
        actor: s.session.client
      }]
    };
    s.authorizations.push(auth);
    c.used += value;
    C.S.audit(s, 'autorizacao', auth.id, 'Reserva imediata de ' + M.decimal(value));
    return auth;
  }
  function confirm(s, id) {
    const auth = s.authorizations.find(a => a.id === id);
    C.assert(auth && auth.account === s.session.account && auth.status === 'RESERVADA' && auth.expires > s.now, 'Autorização não está reservada ou expirou.');
    C.S.invoices.recordPurchase(s, auth);
    auth.status = 'CONFIRMADA';
    auth.history.push({
      to: 'CONFIRMADA',
      at: s.now,
      actor: s.session.client
    });
    C.S.audit(s, 'autorizacao', auth.id, 'Compra confirmada e incorporada à fatura, mesmo se o cartão foi bloqueado/cancelado.');
  }
  function changeLimit(s, id, value) {
    C.Session.requireClient(s);
    const c = physical(s, id);
    C.assert(c.status !== 'CANCELADO', 'Cartão cancelado não pode ter limite alterado.');
    C.assert(value >= c.used, 'A redução não pode ficar abaixo do valor já utilizado.');
    if (value > c.limit) {
      const result = analyze(s, c.account);
      C.assert(value <= result.limit, 'Aumento não aprovado pela nova análise de crédito.', 'CreditoRecusado');
      c.analysis = result;
    }
    const before = c.limit;
    c.limit = value;
    channels.forEach(ch => c.channels[ch] = Math.min(c.channels[ch], value));
    C.S.audit(s, 'limite-cartao', c.id, `${M.decimal(before)} → ${M.decimal(value)}; ${value > before ? 'nova análise aprovada' : 'redução imediata'}`);
  }
  C.S.cards = {
    analyze,
    pin,
    physical,
    issue,
    authorize,
    confirm,
    changeLimit
  };
  C.processors.push(s => {
    s.authorizations.filter(a => a.status === 'RESERVADA' && a.expires <= s.now).forEach(auth => {
      const c = s.cards.find(c => c.id === auth.card);
      c.used -= auth.value;
      auth.status = 'EXPIRADA';
      auth.history.push({
        to: 'EXPIRADA',
        at: s.now,
        actor: 'SISTEMA'
      });
      C.S.audit(s, 'autorizacao', auth.id, 'Prazo de 48h esgotado; reserva liberada.');
    });
    s.cards.forEach(c => {
      if (c.status === 'ATIVO' && K.days(K.day(s.now), c.expiry) <= C.policy.cardRenewDays && !s.invoices.some(f => f.card === c.id && (f.status === 'EM_ATRASO' || f.due < K.day(s.now) && C.S.invoices.remaining(f) > 0))) {
        const before = c.expiry;
        c.expiry = K.months(c.expiry, 36);
        c.renewals ||= [];
        c.renewals.push({
          at: s.now,
          before,
          after: c.expiry
        });
        C.S.notify(s, A.account(s, c.account).client, 'Cartão renovado automaticamente. Nova validade: ' + c.expiry);
      }
    });
  });
  const mineCards = s => s.cards.filter(c => c.account === s.session.account);
  const live = s => mineCards(s).filter(c => c.status !== 'CANCELADO').slice(-1)[0] || null;
  const rows = items => '<div class="i3-rows">' + items.map(([k, v, cls]) => `<div class="${cls || ''}"><span>${k}</span><b>${v}</b></div>`).join('') + '</div>';
  const ex = (html, title = 'Exemplo') => `<div class="i3-example"><strong>${U.e(title)}</strong>${html}</div>`;
  const reserved = (s, c) => s.authorizations.filter(a => a.card === c.id && a.status === 'RESERVADA').reduce((v, a) => v + a.value, 0);
  const demoFields = s => s.demo.path === 'cartoes' ? s.demo.fields || {} : {};
  function visual(s, c) {
    const owner = A.client(s, A.account(s, c.account).client);
    return `<div class="i3-card"><div class="i3-card-top"><b>Cesbank</b>${U.badge(c.status)}</div><div class="i3-card-num">•••• •••• •••• ${U.e(c.number.slice(-4))}</div><div class="i3-card-foot"><span>${U.e((owner.social || owner.name).toUpperCase())}</span><span>${U.e(c.expiry.slice(5, 7) + '/' + c.expiry.slice(2, 4))}</span></div></div>`;
  }
  function limitBox(s, c) {
    const pct = c.limit ? Math.min(100, Math.round(c.used * 100 / c.limit)) : 0;
    return `<div class="i3-limit"><span>Limite disponível</span><div><strong>${U.money(Math.max(0, c.limit - c.used))}</strong><small>de ${U.money(c.limit)}</small></div><div class="i3-bar"><i style="width:${pct}%"></i></div><p class="small">Utilizado + reservado: <b>${U.money(c.used)}</b></p></div>`;
  }
  // Páginas internas só existem com um cartão físico vigente.
  const withCard = (title, subtitle, rn, body) => s => {
    const c = live(s);
    if (!c) return U.page(title, subtitle, '<div class="empty">Você ainda não tem cartão de crédito.</div><div class="actions">' + U.link('cartoes', 'Ir para Cartões') + '</div>', rn);
    return U.page(title, subtitle, body(s, c) + '<div class="actions">' + U.link('cartoes', '← Voltar ao meu cartão') + '</div>', rn);
  };
  function demoNote(s) {
    return s.demo.path === 'cartoes' && C.Router.current().path !== 'cartoes' ? `<div class="banner warning"><strong>Cenário de validação ${U.e(s.demo.code || '')}</strong><p>${U.e(s.demo.instruction || '')}</p></div>` : '';
  }
  function purchaseForm(s, c) {
    const dm = demoFields(s);
    return U.form('<div class="fields">' + `<input type="hidden" name="card" value="${U.e(c.id)}">` + U.field('description', 'Estabelecimento', dm.description ?? 'Loja fictícia') + U.field('value', 'Valor da compra', dm.value ?? '120.00') + U.field('installments', 'Parcelas', dm.installments ?? '1', 'number') + U.field('rateBp', 'Encargos opcionais da compra · pontos-base ao mês (0 = sem juros)', dm.rateBp ?? '0', 'number') + U.select('channel', 'Canal', channels, dm.channel ?? 'NAO_PRESENCIAL') + U.select('virtual', 'Cartão utilizado', [['', 'Físico'], ...c.virtuals.filter(v => v.status === 'ATIVO').map(v => [v.id, 'Virtual · ' + v.number.slice(-4)])]) + U.field('pin', 'Senha do cartão quando exigida', dm.pin ?? '', 'password') + '</div>', d => {
      const auth = C.Db.transaction(x => authorize(x, d));
      U.done('Compra autorizada. Limite reservado imediatamente.');
      U.modal('Reserva de compra', `<p>${U.money(auth.value)} reservados até ${U.e(K.label(auth.expires))}.</p>` + U.action('Confirmar compra e lançar na fatura', () => {
        C.Db.transaction(x => confirm(x, auth.id));
        U.done('Compra confirmada e parcelas lançadas nas faturas.');
      }));
    }, 'Autorizar compra');
  }
  // Tela 1 (sem cartão), tela 4 (cartão inativo: ativar) e tela 5 (meu cartão).
  C.Router.register('cartoes', 'Cartões de crédito', s => {
    const c = live(s),
      old = mineCards(s).filter(x => x.status === 'CANCELADO');
    let body;
    if (!c) body = '<div class="i3-split"><div class="i3-empty"><strong>Você ainda não tem cartão de crédito</strong><p>Veja se você é elegível pela movimentação da sua conta.</p>' + U.link('cartao-analise', 'Solicitar cartão de crédito') + '</div><aside>' + U.card('Como funciona', '<p>Analisamos entradas, saídas e saldo médio da sua conta para definir o limite. Tempo mínimo de relacionamento: 30 dias (RN 1).</p>') + ex(`<p>Conta aberta há <b>12 dias</b>: não é elegível ainda (mínimo de ${C.policy.cardAgeDays} dias).</p><p>Conta aberta há <b>6 meses</b>, com entradas e saldo médio positivos: elegível, com limite compatível com o perfil.</p>`) + '</aside></div>';
    else if (c.status === 'INATIVO') body = '<div class="i3-split"><div>' + U.card('Seu cartão', visual(s, c)) + '</div><aside>' + U.card('Crie a senha do cartão', U.form(U.field('pin', 'Senha de 4 dígitos', '', 'password', 'maxlength="4" inputmode="numeric" autocomplete="off"') + '<p class="small">Sem dígitos repetidos nem sequências. Diferente da data de nascimento do titular (RN 5).</p>', d => {
      C.Db.transaction(x => {
        C.Session.requireClient(x);
        const row = physical(x, c.id);
        pin(d.pin, A.client(x, x.session.client));
        row.pin = C.Security.credential(d.pin);
        C.S.transition(x, row, 'card', 'ATIVO', 'Ativação no perfil simulado do titular, com definição de senha.');
      });
      U.done('Cartão ativado.');
    }, 'Ativar cartão')) + ex((() => {
      const bd = A.client(s, s.session.client).birth.replace(/-/g, '');
      return `<p><b>Aceita</b>: 5962 (quatro dígitos diferentes, sem sequência).</p><p><b>Recusadas</b>: 1111 (dígitos repetidos), 1234 (sequência), ${U.e(bd.slice(4))} e ${U.e(bd.slice(6) + bd.slice(4, 6))} (dia e mês de nascimento do titular) e ${U.e(bd.slice(0, 4))} (ano de nascimento).</p>`;
    })()) + '</aside></div>' + U.history(c) + U.json(c.analysis);
    else body = '<div class="i3-split"><div>' + visual(s, c) + U.card('Seu limite', limitBox(s, c)) + '</div><aside>' + U.card('Gerenciar cartão', '<nav class="i3-menu">' + [['cartao-compras', 'Compras autorizadas'], ['cartao-virtuais', 'Cartões virtuais'], ['cartao-canais', 'Limites por canal'], ['cartao-limite-total', 'Alterar limite total'], ['cartao-bloquear', 'Bloquear ou cancelar']].map(([p, t]) => `<a href="#${p}">${t}</a>`).join('') + '</nav>') + U.card('Validade e renovação', `<p>Validade: <b>${U.e(c.expiry)}</b>. O cartão é renovado automaticamente antes do vencimento, salvo se estiver bloqueado, cancelado ou com fatura em atraso (RN 12).</p><p>Um só cartão físico ativo por conta (RN 3). <a href="#cartao-analise">Solicitar novo cartão</a></p><div class="actions">` + U.link('faturas', 'Consultar faturas') + '</div>') + '</aside></div>' + U.history(c) + U.json(c.analysis);
    return U.page('Cartões', 'Gerencie seus cartões Cesbank.', body + (old.length ? U.card('Cartões cancelados', U.table(['Cartão', 'Situação', 'Emitido em'], old.map(x => ['•••• ' + U.e(x.number.slice(-4)), U.badge(x.status), U.e(x.issued.slice(0, 10))]))) : ''), 'F10 · RN1–RN12 · F11 RN3');
  }, 'Cadastro e crédito');
  // Tela 2 · análise do perfil.
  C.Router.register('cartao-analise', 'Análise do perfil', s => {
    const a = A.own(s),
      age = K.days(K.day(a.opened), K.day(s.now));
    let r, err;
    try {
      r = analyze(s);
    } catch (ex) {
      err = C.errorData(ex);
    }
    const state = (ok, text) => `<span class="badge ${ok ? 'good' : 'bad'}">${text}</span>`;
    return U.page('Análise do perfil', 'Analisando sua conta.', '<div class="i3-split"><div>' + U.card('Movimentação da conta', '<div class="i3-rows"><div><span>Relacionamento · ' + age + ' dias (mínimo ' + C.policy.cardAgeDays + ')</span>' + state(age >= C.policy.cardAgeDays, age >= C.policy.cardAgeDays ? 'Atende' : 'Não atende') + '</div><div><span>Entradas e saídas · 90 dias</span>' + (r ? `<b>${U.money(r.incoming)} / ${U.money(r.outgoing)}</b>` : state(false, 'Insuficiente')) + '</div><div><span>Saldo médio</span>' + (r ? `<b>${U.money(r.average)}</b>` : state(false, 'Insuficiente')) + '</div></div>' + (r ? '<div class="banner success"><strong>Você é elegível</strong><p>Podemos oferecer um limite compatível com o seu perfil.</p></div><div class="actions">' + U.link('cartao-limite', 'Ver meu limite') + '</div>' : `<div class="banner error"><strong>Não elegível · ${U.e(err.codigo)}</strong><p>${U.e(err.detalhe)}</p></div>`)) + U.link('cartoes', '← Voltar') + '</div><aside>' + U.card('Critérios', '<p>Sem o tempo mínimo de relacionamento, a conta não é elegível (RN 1).</p><p>A análise considera entradas, saídas, saldo médio, qualificação cadastral e inadimplência.</p>') + ex(`<p>Esta conta tem <b>${age} dias</b> de relacionamento: ${age >= C.policy.cardAgeDays ? 'atende ao mínimo de ' + C.policy.cardAgeDays + ' dias.' : 'ainda não atende ao mínimo de ' + C.policy.cardAgeDays + ' dias.'}</p><p>Uma conta com 12 dias seria recusada com CreditoRecusado, mesmo com bom saldo.</p>`) + '</aside></div>', 'F10 · RN1');
  }, null);
  // Tela 3 · limite aprovado e emissão.
  C.Router.register('cartao-limite', 'Limite aprovado', s => {
    let r, err;
    try {
      r = analyze(s);
    } catch (ex) {
      err = C.errorData(ex);
    }
    return U.page('Limite aprovado', 'Resultado da análise.', r ? '<div class="i3-split"><div>' + U.card('Limite do seu cartão', `<div class="i3-big">${U.money(r.limit)}</div><p>Definido pela análise (RN 2), dentro do teto de ${U.money(r.ceiling)} da faixa ${U.e(r.qualification)}.</p><div class="i3-info">O cartão será emitido inativo e só funciona depois da ativação (RN 4).</div><div class="actions">` + U.action('Emitir cartão', () => {
      C.Db.transaction(x => issue(x));
      C.Router.go('cartoes');
      U.render();
      U.flash('Cartão emitido inativo. Defina a senha para ativar.');
    }) + '</div>' + U.json(r)) + U.link('cartoes', '← Voltar') + '</div><aside>' + ex(`<p>Faixas de limite por qualificação do cadastro (RN 2):</p>` + rows([['Básica', 'até ' + U.money(500000)], ['Média', 'até ' + U.money(1000000)], ['Alta', 'até ' + U.money(2000000)]]) + `<p>Você está na faixa <b>${U.e(r.qualification)}</b>. Mesmo que a análise sugerisse mais, o limite nunca passa do teto de ${U.money(r.ceiling)}.</p>`) + '</aside></div>' : `<div class="banner error"><strong>Não elegível · ${U.e(err.codigo)}</strong><p>${U.e(err.detalhe)}</p></div>` + U.link('cartoes', '← Voltar'), 'F10 · RN2, RN4');
  }, null);
  // Tela 6 · compras autorizadas e reserva de limite.
  C.Router.register('cartao-compras', 'Compras autorizadas', withCard('Compras autorizadas', 'Cada compra reserva o limite na hora.', 'F10 · RN9', (s, c) => demoNote(s) + '<div class="i3-split"><div>' + U.card('Autorizações e reservas', U.table(['Compra', 'Valor', 'Prazo', 'Situação', 'Ações'], s.authorizations.filter(a => a.card === c.id).map(a => [U.e(a.description), U.money(a.value), U.e(K.label(a.expires)), U.badge(a.status), a.status === 'RESERVADA' ? U.action('Confirmar incorporação', () => {
    C.Db.transaction(x => {
      C.Session.requireClient(x);
      confirm(x, a.id);
    });
    U.done('Compra incorporada às faturas.');
  }, 'secondary') + U.json(a) : U.json(a)])) + '<p class="small">A reserva é liberada se a compra não for confirmada dentro de 48 horas (RN 9).</p>') + (c.status === 'ATIVO' ? U.card('Simular compra', purchaseForm(s, c)) : '') + '</div><aside>' + U.card('Limite do cartão', rows([['Limite total', U.money(c.limit)], ['Na fatura', U.money(c.used - reserved(s, c))], ['Reservado', U.money(reserved(s, c))], ['Disponível', U.money(Math.max(0, c.limit - c.used)), 'total']])) + ex(`<p>Compra de <b>${U.money(60000)}</b> em 3x sem juros, estabelecimento "Loja fictícia", canal não presencial.</p><p>Ao autorizar, o valor fica reservado na hora: o disponível passa de ${U.money(Math.max(0, c.limit - c.used))} para ${U.money(Math.max(0, c.limit - c.used - 60000))}, antes de a compra entrar na fatura.</p><p>Depois de confirmada, vira 3 parcelas de ${U.money(20000)}, uma em cada fatura. Sem confirmação em 48 horas, a reserva é liberada.</p>`) + '</aside></div>'), null);
  // Tela 7 · cartões virtuais.
  C.Router.register('cartao-virtuais', 'Cartões virtuais', withCard('Cartões virtuais', 'Para compras não presenciais.', 'F10 · RN6', (s, c) => '<div class="i3-split"><div>' + U.card('Meus cartões virtuais', U.table(['Cartão virtual', 'Situação', 'Ação'], c.virtuals.map(v => [`<strong>Virtual •••• ${U.e(v.number.slice(-4))}</strong><small>Número fictício ${U.e(v.number)}</small>`, U.badge(v.status), v.status === 'ATIVO' ? U.action('Descartar', () => {
    C.Db.transaction(x => {
      C.Session.requireClient(x);
      const r = physical(x, c.id).virtuals.find(a => a.id === v.id);
      r.status = 'CANCELADO';
      r.cancelled = x.now;
      C.S.audit(x, 'virtual', r.id, 'Descarte individual.');
    });
    U.done('Virtual descartado; cartão físico preservado.');
  }, 'danger') : ''])) + '<div class="actions">' + U.action('Gerar cartão virtual', () => {
    C.Db.transaction(x => {
      C.Session.requireClient(x);
      const row = physical(x, c.id);
      C.assert(row.status === 'ATIVO', 'Ative o cartão físico antes de gerar um virtual.', 'CartaoBloqueadoOuCancelado');
      row.virtuals.push({
        id: C.Ids.uuid(),
        number: '4986' + String(parseInt(C.Ids.uuid().slice(0, 8), 16)).padStart(12, '0').slice(-12),
        status: 'ATIVO',
        at: x.now
      });
      C.S.audit(x, 'virtual', row.id, 'Novo cartão virtual; limite compartilhado.');
    });
    U.done('Cartão virtual gerado.');
  }, 'secondary') + '</div>') + '</div><aside>' + U.card('Como funciona', '<p>Usam o mesmo limite do cartão. Só valem em compras não presenciais (RN 6).</p><p>Cada cartão virtual pode ser descartado sem afetar o cartão físico.</p>') + ex('<p>Gere um cartão virtual para <b>compras online</b> e outro para uma <b>assinatura</b>. Cada um tem número próprio.</p><p>Se o número da assinatura vazar, descarte só aquele virtual. O cartão físico e o outro virtual continuam funcionando.</p><p>Compra presencial com um virtual é recusada: só vale no canal não presencial.</p>') + '</aside></div>'), null);
  // Tela 8 · limites por canal.
  const channelNames = {
    PRESENCIAL: 'Compra presencial',
    NAO_PRESENCIAL: 'Compra não presencial',
    APROXIMACAO: 'Aproximação'
  };
  C.Router.register('cartao-canais', 'Limites por canal', withCard('Limites por canal', 'Configure quanto cada canal pode usar do limite total.', 'F10 · RN7, RN8', (s, c) => '<div class="i3-split"><div>' + U.card('Limite total: ' + U.money(c.limit), U.form('<div class="fields">' + channels.map(ch => U.field(ch, channelNames[ch], M.decimal(c.channels[ch]))).join('') + '</div>', d => {
    C.Db.transaction(x => {
      C.Session.requireClient(x);
      const row = physical(x, c.id);
      channels.forEach(ch => {
        const v = M.parse(d[ch], true);
        C.assert(v <= row.limit, 'Os limites por canal devem ser subordinados ao limite total.');
        row.channels[ch] = v;
      });
      C.S.audit(x, 'limites-canal', row.id, JSON.stringify(row.channels));
    });
    U.done('Limites por canal atualizados.');
  }, 'Salvar limites')) + '</div><aside>' + U.card('Regras', `<p>Cada limite fica abaixo do limite total do cartão (RN 7).</p><p>Aproximação acima de ${U.money(C.policy.contactless)} exige senha, independentemente do limite por canal (RN 8).</p>`) + ex(`<p>Com limite total de <b>${U.money(c.limit)}</b>:</p>` + rows([['Compra presencial', U.money(Math.round(c.limit * 0.6 / 100) * 100)], ['Compra não presencial', U.money(Math.round(c.limit * 0.4 / 100) * 100)], ['Aproximação', U.money(Math.round(c.limit * 0.1 / 100) * 100)]]) + `<p>Esses valores são aceitos. Colocar ${U.money(c.limit + 100000)} em qualquer canal é recusado, porque passa do limite total.</p><p>Aproximação (RN 8): compra de ${U.money(15000)} passa sem senha; compra de ${U.money(25000)} pede senha, mesmo dentro do limite do canal.</p>`) + '</aside></div>'), null);
  // Tela 9 · alterar limite total.
  C.Router.register('cartao-limite-total', 'Alterar limite total', withCard('Alterar limite total', 'Reduza na hora ou peça aumento.', 'F10 · RN11', (s, c) => '<div class="i3-split"><div>' + U.card('Limite do cartão', rows([['Limite atual', U.money(c.limit)], ['Utilizado + reservado', U.money(c.used)]]) + U.form(U.field('limit', 'Novo limite', M.decimal(c.limit)), d => {
    C.Db.transaction(x => changeLimit(x, c.id, M.parse(d.limit, true)));
    U.done('Limite total atualizado após as verificações.');
  }, 'Solicitar alteração')) + '</div><aside>' + U.card('Regras', '<p>Reduzir vale na hora, sem ficar abaixo do utilizado.</p><p>Aumentar depende de nova análise e só passa a valer após a aprovação (RN 11).</p>') + ex(`<p>Limite atual <b>${U.money(c.limit)}</b>, utilizado e reservado <b>${U.money(c.used)}</b>.</p><p>Reduzir para <b>${U.money(Math.max(c.used, Math.round(c.limit / 2 / 100) * 100))}</b>: vale na hora, pois não fica abaixo do utilizado.</p>${c.used > 0 ? `<p>Reduzir para ${U.money(Math.max(0, c.used - 10000))}: recusado, pois fica abaixo do que já foi usado.</p>` : ''}<p>Aumentar para <b>${U.money(c.limit + 500000)}</b>: o sistema faz uma nova análise e só aprova se o seu perfil comportar.</p>`) + '</aside></div>'), null);
  // Tela 10 · bloquear ou cancelar.
  C.Router.register('cartao-bloquear', 'Bloquear ou cancelar', withCard('Bloquear ou cancelar', 'Controle do cartão.', 'F10 · RN10', (s, c) => '<div class="i3-split"><div>' + visual(s, c) + '<p class="small">Compras já autorizadas seguem para a fatura.</p></div><aside>' + (c.status !== 'INATIVO' ? '<div class="i3-box warn"><strong>' + (c.status === 'BLOQUEADO' ? 'Desbloquear cartão' : 'Bloquear temporariamente') + '</strong><p>' + (c.status === 'BLOQUEADO' ? 'O cartão volta a ficar ativo.' : 'Impede novas transações. Reversível por você.') + '</p>' + U.action(c.status === 'BLOQUEADO' ? 'Desbloquear' : 'Bloquear', () => {
    C.Db.transaction(x => {
      C.Session.requireClient(x);
      const row = physical(x, c.id);
      C.assert(row.status !== 'INATIVO', 'Ative o cartão antes de bloquear.');
      if (row.status === 'BLOQUEADO') C.assert(!row.blockedByDebt, 'Regularize todas as faturas em atraso antes de desbloquear.');
      C.S.transition(x, row, 'card', row.status === 'BLOQUEADO' ? 'ATIVO' : 'BLOQUEADO', 'Solicitação do titular.');
    });
    U.done('Situação do cartão atualizada.');
  }, 'secondary') + '</div>' : '') + '<div class="i3-box danger"><strong>Cancelar cartão</strong><p>Definitivo e sem volta. Exige nova emissão (RN 10).</p>' + U.action('Cancelar cartão', () => U.modal('Cancelar cartão', `<p>As compras já autorizadas ainda poderão compor a fatura. O cancelamento exige nova emissão para voltar a comprar.</p>` + U.action('Confirmar cancelamento', () => {
    C.Db.transaction(x => {
      C.Session.requireClient(x);
      C.S.transition(x, physical(x, c.id), 'card', 'CANCELADO', 'Cancelamento definitivo pelo titular.');
    });
    C.Router.go('cartoes');
    U.render();
    U.flash('Cartão cancelado definitivamente.');
  }, 'danger')), 'danger') + '</div>' + ex('<p><b>Bloquear</b>: você perdeu o cartão e quer parar novas compras por algumas horas. Ao encontrar, é só desbloquear.</p><p><b>Cancelar</b>: o cartão foi roubado ou você não quer mais usá-lo. Não tem volta, e é preciso pedir um novo.</p><p>Nos dois casos, uma compra de R$ 600,00 autorizada antes continua indo para a fatura.</p>') + '</aside></div>'), null);
})(Cesbank);