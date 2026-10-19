/* Integrante 4 · F12 RN1–RN12 · protocolo, análise, bloqueio, devolução e notificação. */
(function (C) {
  'use strict';

  const U = C.UI,
    A = C.S.accounts,
    M = C.M,
    K = C.Clock;
  function reference(s, d) {
    if (d.kind === 'CARTAO') {
      const f = s.invoices.find(f => f.id === d.invoice && f.account === s.session.account),
        item = f?.items.find(i => i.id === d.item);
      C.assert(item && item.purchase && !item.advanced, 'O lançamento deve existir e pertencer ao cliente.');
      const purchase = s.purchases.find(p => p.id === item.purchase);
      return {
        ref: item.id,
        invoice: f.id,
        item: item.id,
        value: item.amount,
        at: purchase.at,
        receiver: null
      };
    }
    const tx = s.transactions.find(t => t.id === d.transaction && t.from === s.session.account && t.status === 'EFETIVADA');
    C.assert(tx, 'A transação deve existir, estar efetivada e pertencer ao cliente.');
    return {
      ref: tx.id,
      transaction: tx.id,
      value: tx.value,
      at: tx.at,
      receiver: tx.to
    };
  }
  function open(s, d) {
    C.Session.requireClient(s);
    const r = reference(s, d);
    if (K.days(K.day(r.at), K.day(s.now)) > C.policy.disputeDays) C.fail('PrazoDeContestacaoExpirado');
    if (s.disputes.some(q => q.ref === r.ref && !['ENCERRADA'].includes(q.status))) C.fail('ContestacaoJaEmAberto');
    C.assert(d.description.trim(), 'Descreva o motivo da contestação.');
    if (d.fraud && r.receiver) {
      if (A.balance(s, r.receiver).available < r.value) C.fail('SaldoInsuficiente', 'O destinatário não possui saldo disponível integral para o bloqueio cautelar desta demonstração.');
      A.account(s, r.receiver).blocked += r.value;
    }
    const paidPortion = r.invoice ? Math.min(r.value, M.mul(s.invoices.find(f => f.id === r.invoice).paid, r.value, Math.max(1, C.S.invoices.total(s.invoices.find(f => f.id === r.invoice))))) : 0;
    const q = {
      id: C.Ids.protocol(s),
      paidPortion,
      account: s.session.account,
      client: s.session.client,
      kind: d.kind || 'CONTA',
      ...r,
      status: 'ABERTA',
      description: d.description.trim(),
      fraud: !!d.fraud,
      blocked: d.fraud && r.receiver ? r.value : 0,
      at: s.now,
      deadline: K.businessAdd(K.day(s.now), 10),
      extended: false,
      history: [{
        to: 'ABERTA',
        at: s.now,
        actor: s.session.client,
        detail: d.description.trim()
      }]
    };
    s.disputes.push(q);
    if (q.kind === 'CARTAO') C.S.invoices.suspend(s, q.invoice, q.item, true);
    C.S.notify(s, q.client, 'Contestação ' + q.id + ' aberta. Resposta até ' + q.deadline + '.');
    C.S.audit(s, 'contestacao', q.id, 'Abertura com vínculo e prazo validados.');
    return q;
  }
  function extend(s, id, reason) {
    C.Session.requireAnalyst(s);
    const q = s.disputes.find(q => q.id === id);
    C.assert(q && ['ABERTA', 'EM_ANALISE'].includes(q.status) && !q.extended, 'É admitida uma única prorrogação de 10 dias úteis.');
    C.assert(reason.trim(), 'A prorrogação exige justificativa.');
    q.extended = true;
    q.extension = {
      at: s.now,
      actor: s.session.client,
      reason
    };
    q.deadline = K.businessAdd(q.deadline, 10);
    C.S.audit(s, 'contestacao', q.id, 'Prazo prorrogado: ' + reason);
    C.S.notify(s, q.client, 'Contestação ' + q.id + ' prorrogada até ' + q.deadline + '. Motivo: ' + reason);
  }
  function state(s, id, to, d = {}) {
    C.Session.requireAnalyst(s);
    const q = s.disputes.find(q => q.id === id);
    C.assert(q, 'Ocorrência inexistente.');
    if (to === 'PROCEDENTE') {
      C.assert(['MD06', 'BE08', 'FR01'].includes(d.reason), 'Informe motivo codificado de devolução.');
      const value = M.parse(d.value);
      C.assert(value <= q.value, 'A devolução parcial ou total não pode superar o valor contestado.');
      q.decision = s.now;
      q.returnValue = value;
      q.reason = d.reason;
      q.startBy = new Date(new Date(s.now).getTime() + (d.reason === 'BE08' ? 0 : 72 * 3600000)).toISOString().replace(/\.\d{3}Z$/, 'Z');
      q.executeBy = new Date(new Date(s.now).getTime() + (d.reason === 'BE08' ? 48 : 78) * 3600000).toISOString().replace(/\.\d{3}Z$/, 'Z');
      q.returnRequested = s.now;
      q.returnDue = new Date(new Date(s.now).getTime() + (d.reason === 'BE08' ? 48 : 6) * 3600000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    }
    if (to === 'IMPROCEDENTE') {
      C.assert(d.justification?.trim(), 'Decisão improcedente exige justificativa.');
      q.decision = s.now;
      q.decisionReason = d.justification;
      release(s, q);
      if (q.kind === 'CARTAO') {
        const f = s.invoices.find(f => f.id === q.invoice),
          item = f.items.find(i => i.id === q.item),
          next = C.S.invoices.cycle(s, f.card, K.months(K.day(s.now), 1));
        const unpaid = Math.max(0, q.value - (q.paidPortion || 0));
        const days = Math.max(0, K.days(K.day(q.at), K.day(s.now))),
          charges = M.mul(unpaid, C.policy.rotationMonthBp * days, 300000);
        item.reinstated = true;
        s.cards.find(c => c.id === f.card).used += charges;
        if (unpaid + charges) next.items.push({
          id: C.Ids.uuid(),
          amount: unpaid + charges,
          principal: unpaid,
          interest: charges,
          description: 'Contestação improcedente · ' + q.id,
          type: 'CONTESTACAO_RETORNO',
          at: s.now
        });
      }
    }
    if (to === 'ENCERRADA') C.assert(q.status === 'IMPROCEDENTE' || q.returnTransaction, 'A devolução procedente precisa ser efetivada antes do encerramento.');
    C.S.transition(s, q, 'dispute', to, d.justification || d.reason || '');
    C.S.notify(s, q.client, 'Contestação ' + q.id + ': ' + to.replace(/_/g, ' ') + '.');
    return q;
  }
  function release(s, q) {
    if (q.blocked && q.receiver) {
      A.account(s, q.receiver).blocked -= q.blocked;
      q.blocked = 0;
    }
  }
  function refund(s, q) {
    C.assert(q.status === 'PROCEDENTE' && !q.returnTransaction, 'Devolução não está pendente.');
    if (q.kind === 'CARTAO') {
      const f = s.invoices.find(f => f.id === q.invoice),
        card = s.cards.find(c => c.id === f.card);
      const item = f.items.find(i => i.id === q.item);
      item.refunded = q.returnValue;
      item.suspended = false;
      f.items.push({
        id: C.Ids.uuid(),
        amount: -q.returnValue,
        principal: -q.returnValue,
        interest: 0,
        description: 'Estorno ' + q.reason + ' · ' + q.id,
        type: 'ESTORNO',
        at: s.now
      });
      const cashRefund = Math.min(q.paidPortion || 0, q.returnValue);
      f.paid = Math.max(0, f.paid - cashRefund);
      card.used = Math.max(0, card.used - (q.returnValue - cashRefund));
      if (cashRefund) C.S.credit(s, q.account, cashRefund, 'CARTAO', 'Devolução de compra já paga · ' + q.id, {
        original: q.ref,
        reason: q.reason
      });
      const tx = {
        id: C.Ids.e2e(s, 'D'),
        from: null,
        to: q.account,
        value: q.returnValue,
        type: 'CARTAO',
        description: 'Crédito de estorno em fatura · ' + q.id,
        at: s.now,
        status: 'EFETIVADA',
        original: q.ref,
        reason: q.reason,
        history: [{
          to: 'EFETIVADA',
          at: s.now,
          actor: 'SISTEMA'
        }]
      };
      s.transactions.push(tx);
      C.S.ledger(s, q.account, q.returnValue, 'CREDITO', 'CARTAO', tx.description, tx.id, {
        cardCredit: true,
        affectsCash: false
      });
      q.returnTransaction = tx.id;
    } else {
      release(s, q);
      if (q.receiver) {
        A.check(s, q.receiver, q.returnValue, false);
        const previous = s.session;
        s.session = {
          client: A.account(s, q.receiver).client,
          account: q.receiver,
          role: 'CLIENTE'
        };
        let tx;
        try {
          tx = C.S.move(s, {
            from: q.receiver,
            to: q.account,
            value: q.returnValue,
            type: 'OUTROS',
            requestId: C.Ids.uuid(),
            description: 'Devolução · ' + q.reason + ' · ' + q.id,
            limits: false,
            extra: {
              original: q.transaction,
              reason: q.reason
            }
          });
        } finally {
          s.session = previous;
        }
        if (tx.status !== 'EFETIVADA') C.fail('FalhaOperacional', 'Falha no estorno. Nova tentativa permanece pendente.');
        q.returnTransaction = tx.id;
      } else {
        q.returnTransaction = C.S.credit(s, q.account, q.returnValue, 'OUTROS', 'Devolução operacional · ' + q.reason, {
          original: q.transaction,
          reason: q.reason
        }).id;
      }
      const original = s.transactions.find(t => t.id === q.transaction);
      if (original && q.returnValue === q.value) C.S.transition(s, original, 'transaction', 'DEVOLVIDA', 'Devolução vinculada ' + q.returnTransaction);
    }
    q.refundedAt = s.now;
    C.S.notify(s, q.client, 'Devolução de ' + M.fmt(q.returnValue) + ' efetivada. Contestação ' + q.id + '.');
    C.S.audit(s, 'devolucao', q.id, JSON.stringify({
      transaction: q.returnTransaction,
      reason: q.reason,
      value: q.returnValue
    }));
  }
  C.S.disputes = {
    open,
    extend,
    state,
    refund
  };
  C.processors.push(s => {
    s.disputes.map(q => q.id).forEach(id => {
      const q = s.disputes.find(q => q.id === id);
      if (['ABERTA', 'EM_ANALISE'].includes(q.status) && K.day(s.now) > q.deadline && !q.overdueNotice) {
        q.overdueNotice = s.now;
        C.S.notify(s, q.client, 'Prazo de análise excedido na ocorrência ' + q.id + '. Atendimento deve registrar resposta.');
      }
      if (q.status === 'PROCEDENTE' && !q.returnTransaction && q.returnDue <= s.now) {
        const checkpoint = C.Db.clone(s);
        try {
          refund(s, q);
        } catch (ex) {
          Object.keys(s).forEach(k => delete s[k]);
          Object.assign(s, checkpoint);
          const current = s.disputes.find(v => v.id === q.id);
          s.demo.failAfterDebit = false;
          current.refundFailure = {
            at: s.now,
            code: ex.code || 'ValidacaoDaRegra',
            detail: ex.message
          };
          if (!current.failureNotice) {
            current.failureNotice = s.now;
            C.S.notify(s, current.client, 'Devolução pendente: ' + ex.message + ' O analista deve regularizar o saldo devolvedor.');
          }
        }
      }
    });
  });
  function record(q) {
    return U.table(['Protocolo', 'Situação', 'Abertura', 'Resposta até', 'Valor', 'Motivo'], [[U.e(q.id), U.badge(q.status), U.e(K.label(q.at)), q.deadline, U.money(q.value), U.e(q.description)]]) + U.history(q) + (q.returnValue ? `<p>Devolução ${U.money(q.returnValue)} · ${U.e(q.reason)} · solicitada ${U.e(K.label(q.returnRequested))} · efetivar até ${U.e(K.label(q.returnDue))}.</p>` : '') + (q.returnTransaction ? U.link('comprovante?id=' + q.returnTransaction, 'Comprovante da devolução') : '') + (q.refundFailure ? U.json(q.refundFailure) : '');
  }
  C.Router.register('contestacoes', 'Contestações', (s, p) => {
    const transactions = s.transactions.filter(t => t.from === s.session.account && t.status === 'EFETIVADA');
    const invoiceItems = s.invoices.filter(f => f.account === s.session.account).flatMap(f => f.items.filter(i => i.purchase && !i.advanced).map(i => ({
      invoice: f,
      item: i
    })));
    return U.page('Contestações e devoluções', 'Prazo para abertura: 80 dias. Análise em 10 dias úteis, com uma prorrogação justificada.', U.card('Abrir contestação de transação', U.form(U.select('transaction', 'Transação', transactions.map(t => [t.id, t.description + ' · ' + U.money(t.value) + ' · ' + K.day(t.at)])) + '<label>Motivo<textarea name="description"></textarea></label>' + U.checkbox('fraud', 'Há indício de fraude: solicitar bloqueio cautelar do valor no destinatário.'), d => {
      const q = C.Db.transaction(x => open(x, {
        ...d,
        kind: 'CONTA'
      }));
      U.done('Contestação aberta. Protocolo ' + q.id + '.');
    }, 'Abrir ocorrência')) + U.card('Contestar lançamento do cartão', U.form(U.select('reference', 'Lançamento de fatura', invoiceItems.map(({
      invoice: f,
      item: i
    }) => [f.id + '|' + i.id, `${f.cycle} · ${i.description} · ${U.money(i.amount)}`]), (p.get('fatura') || '') + '|' + (p.get('item') || '')) + '<label>Motivo<textarea name="description"></textarea></label>', d => {
      const [invoice, item] = d.reference.split('|');
      const q = C.Db.transaction(x => open(x, {
        kind: 'CARTAO',
        invoice,
        item,
        description: d.description
      }));
      U.done('Protocolo ' + q.id + '. Cobrança suspensa até a decisão.');
    }, 'Contestar e suspender cobrança')) + U.card('Minhas ocorrências', s.disputes.filter(q => q.client === s.session.client).map(q => record(q)).join('') || '<div class="empty">Nenhuma contestação aberta.</div>') + U.link('atendimento', 'Área de atendimento · analista'), 'F12 · RN1–RN5, RN11, RN12');
  }, 'Movimentar');
  C.Router.register('atendimento', 'Atendimento simulado', s => U.page('Atendimento Cesbank', 'Selecione o perfil Analista Cesbank para analisar e decidir as ocorrências.', s.disputes.map(q => U.card('Ocorrência ' + q.id, record(q) + (q.status === 'ABERTA' ? U.action('Iniciar análise', () => {
    C.Db.transaction(x => state(x, q.id, 'EM_ANALISE'));
    U.done('Ocorrência em análise; cliente notificado.');
  }, 'secondary') : '') + (['ABERTA', 'EM_ANALISE'].includes(q.status) && !q.extended ? U.form(U.field('reason', 'Justificativa da prorrogação'), d => {
    C.Db.transaction(x => extend(x, q.id, d.reason));
    U.done('Prazo prorrogado uma única vez por 10 dias úteis.');
  }, 'Prorrogar prazo', 'secondary') : '') + (q.status === 'EM_ANALISE' ? U.form(U.select('decision', 'Decisão', ['PROCEDENTE', 'IMPROCEDENTE']) + U.select('reason', 'Motivo codificado', ['MD06', 'BE08', 'FR01']) + U.field('value', 'Valor da devolução total/parcial', M.decimal(q.value)) + U.field('justification', 'Justificativa da decisão'), d => {
    C.Db.transaction(x => state(x, q.id, d.decision, d));
    U.done('Decisão registrada; prazos e notificações atualizados.');
  }, 'Registrar decisão') : '') + (['PROCEDENTE', 'IMPROCEDENTE'].includes(q.status) ? U.action('Encerrar ocorrência', () => {
    C.Db.transaction(x => state(x, q.id, 'ENCERRADA'));
    U.done('Ocorrência encerrada; histórico preservado.');
  }, 'secondary') : '') + U.json({
    blocked: q.blocked,
    extended: q.extended,
    startBy: q.startBy,
    executeBy: q.executeBy,
    refundedAt: q.refundedAt
  }))).join('') || '<div class="empty">Nenhuma ocorrência para análise.</div>', 'F12 · RN6–RN10, RN12'), 'Conta e segurança');
})(Cesbank);
