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
  function purchaseForm(s, c) {
    return U.form('<div class="fields">' + `<input type="hidden" name="card" value="${U.e(c.id)}">` + U.field('description', 'Estabelecimento', 'Loja fictícia') + U.field('value', 'Valor da compra', '120.00') + U.field('installments', 'Parcelas', '1', 'number') + U.field('rateBp', 'Encargos opcionais da compra · pontos-base ao mês (0 = sem juros)', '0', 'number') + U.select('channel', 'Canal', channels, 'NAO_PRESENCIAL') + U.select('virtual', 'Cartão utilizado', [['', 'Físico'], ...c.virtuals.filter(v => v.status === 'ATIVO').map(v => [v.id, 'Virtual · ' + v.number.slice(-4)])]) + U.field('pin', 'Senha do cartão quando exigida', '', 'password') + '</div>', d => {
      const auth = C.Db.transaction(x => authorize(x, d));
      U.done('Compra autorizada. Limite reservado imediatamente.');
      U.modal('Reserva de compra', `<p>${U.money(auth.value)} reservados até ${U.e(K.label(auth.expires))}.</p>` + U.action('Confirmar compra e lançar na fatura', () => {
        C.Db.transaction(x => confirm(x, auth.id));
        U.done('Compra confirmada e parcelas lançadas nas faturas.');
      }));
    }, 'Autorizar compra');
  }
  C.Router.register('cartoes', 'Cartões de crédito', s => U.page('Cartões de crédito', 'Emissão e compras simuladas, com limite compartilhado entre cartões físicos e virtuais.', U.card('Solicitar cartão', '<p>Tempo mínimo de relacionamento: 30 dias. A análise consulta entradas, saídas, saldo médio, qualificação e inadimplência.</p>' + U.action('Analisar perfil e emitir', () => {
    const c = C.Db.transaction(x => issue(x));
    U.done('Cartão emitido inativo. Defina a senha para ativar.');
    U.modal('Critério de aprovação e limite', U.json(c.analysis));
  })) + s.cards.filter(c => c.account === s.session.account).map(c => U.card('Cesbank ·•••• ' + c.number.slice(-4), U.badge(c.status) + `<p>Validade: ${U.e(c.expiry)}</p><div class="composition"><span>Limite total<b>${U.money(c.limit)}</b></span><span>Utilizado e reservado<b>${U.money(c.used)}</b></span><span>Disponível<b>${U.money(Math.max(0, c.limit - c.used))}</b></span></div>` + (c.status === 'INATIVO' ? U.form(U.field('pin', 'Defina uma senha de 4 dígitos', '', 'password'), d => {
    C.Db.transaction(x => {
      C.Session.requireClient(x);
      const row = physical(x, c.id);
      pin(d.pin, A.client(x, x.session.client));
      row.pin = C.Security.credential(d.pin);
      C.S.transition(x, row, 'card', 'ATIVO', 'Ativação no perfil simulado do titular, com definição de senha.');
    });
    U.done('Cartão ativado.');
  }, 'Ativar cartão') : '') + (c.status !== 'CANCELADO' ? '<div class="actions">' + U.action(c.status === 'BLOQUEADO' ? 'Desbloquear' : 'Bloquear temporariamente', () => {
    C.Db.transaction(x => {
      C.Session.requireClient(x);
      const row = physical(x, c.id);
      C.assert(row.status !== 'INATIVO', 'Ative o cartão antes de bloquear.');
      if (row.status === 'BLOQUEADO') C.assert(!row.blockedByDebt, 'Regularize todas as faturas em atraso antes de desbloquear.');
      C.S.transition(x, row, 'card', row.status === 'BLOQUEADO' ? 'ATIVO' : 'BLOQUEADO', 'Solicitação do titular.');
    });
    U.done('Situação do cartão atualizada.');
  }, 'secondary') + U.action('Cancelar definitivamente', () => U.modal('Cancelar cartão', `<p>As compras já autorizadas ainda poderão compor a fatura. O cancelamento exige nova emissão para voltar a comprar.</p>` + U.action('Confirmar cancelamento', () => {
    C.Db.transaction(x => {
      C.Session.requireClient(x);
      C.S.transition(x, physical(x, c.id), 'card', 'CANCELADO', 'Cancelamento definitivo pelo titular.');
    });
    U.done('Cartão cancelado definitivamente.');
  }, 'danger')), 'danger') + '</div>' : '') + U.json(c.analysis) + U.history(c) + (c.status !== 'CANCELADO' ? U.form(U.field('limit', 'Novo limite total', M.decimal(c.limit)), d => {
    C.Db.transaction(x => changeLimit(x, c.id, M.parse(d.limit, true)));
    U.done('Limite total atualizado após as verificações.');
  }, 'Alterar limite total', 'secondary') + U.form('<div class="fields">' + channels.map(ch => U.field(ch, 'Limite ' + ch, M.decimal(c.channels[ch]))).join('') + '</div>', d => {
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
  }, 'Salvar limites por canal', 'secondary') : '') + U.card('Cartões virtuais', U.action('Gerar virtual', () => {
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
  }, 'secondary') + U.table(['Número fictício', 'Situação', 'Ação'], c.virtuals.map(v => [U.e(v.number), U.badge(v.status), v.status === 'ATIVO' ? U.action('Descartar', () => {
    C.Db.transaction(x => {
      C.Session.requireClient(x);
      const r = physical(x, c.id).virtuals.find(a => a.id === v.id);
      r.status = 'CANCELADO';
      r.cancelled = x.now;
      C.S.audit(x, 'virtual', r.id, 'Descarte individual.');
    });
    U.done('Virtual descartado; cartão físico preservado.');
  }, 'danger') : '']))) + (c.status === 'ATIVO' ? U.card('Simular compra', purchaseForm(s, c)) : ''))).join('') + U.card('Autorizações e reservas', U.table(['Compra', 'Valor', 'Prazo', 'Situação', 'Ações'], s.authorizations.filter(a => a.account === s.session.account).map(a => [U.e(a.description), U.money(a.value), U.e(K.label(a.expires)), U.badge(a.status), a.status === 'RESERVADA' ? U.action('Confirmar incorporação', () => {
    C.Db.transaction(x => {
      C.Session.requireClient(x);
      confirm(x, a.id);
    });
    U.done('Compra incorporada às faturas.');
  }, 'secondary') + U.json(a) : U.json(a)]))) + U.link('faturas', 'Consultar faturas'), 'F10 · RN1–RN12 · F11 RN3'), 'Cadastro e crédito');
})(Cesbank);
