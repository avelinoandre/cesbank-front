/* Integrante 2 · F9 RN1–RN12 · Price, CET, IOF, análise, débito e liquidação antecipada. */
(function (C) {
  'use strict';

  const U = C.UI,
    A = C.S.accounts,
    M = C.M,
    K = C.Clock;
  function simulate(s, value, months) {
    C.Session.requireClient(s);
    C.assert(value >= C.policy.loanMin && value <= C.policy.loanMax && Number.isInteger(months) && months >= C.policy.loanMinMonths && months <= C.policy.loanMaxMonths, 'Empréstimo entre R$ 100,00 e R$ 50.000,00, em 2 a 60 meses inteiros.');
    const u = A.client(s, s.session.client),
      rateBp = {
        ALTA: 200,
        MEDIA: 250,
        BASICA: 300
      }[u.qualification];
    const first = K.addDays(K.day(s.now), 30);
    const base = M.price(value, rateBp, months);
    const tax = M.mul(value, C.policy.iofFixedBp) + base.reduce((v, row, i) => v + M.mul(row.amort, C.policy.iofDailyMillion * Math.min(365, K.days(K.day(s.now), K.months(first, i))), 1000000), 0);
    const financed = value + tax + C.policy.loanFee;
    const rows = M.price(financed, rateBp, months).map((r, i) => ({
      ...r,
      due: K.months(first, i),
      paid: 0,
      status: 'PENDENTE'
    }));
    const cet = M.irr(value, rows);
    return {
      id: C.Ids.uuid(),
      client: u.id,
      value,
      months,
      rateBp,
      tax,
      fee: C.policy.loanFee,
      financed,
      rows,
      cet,
      total: rows.reduce((v, r) => v + r.value, 0),
      at: s.now,
      expires: new Date(new Date(s.now).getTime() + C.policy.proposalMinutes * 60000).toISOString().replace(/\.\d{3}Z$/, 'Z')
    };
  }
  function existingCommitment(s, id) {
    return s.contracts.filter(c => c.client === id && ['ATIVO', 'EM_ATRASO'].includes(c.status)).reduce((v, c) => v + Math.max(0, ...c.rows.filter(r => r.status !== 'PAGA').map(r => r.value)), 0);
  }
  function analysis(s, proposalId) {
    C.Session.requireClient(s);
    const q = s.proposals.find(q => q.id === proposalId && q.client === s.session.client);
    C.assert(q, 'Simulação prévia obrigatória antes da contratação.');
    if (q.expires <= s.now) C.fail('PropostaExpirada');
    C.assert(!q.submitted, 'Esta simulação já foi submetida. Faça nova simulação.');
    q.submitted = true;
    const u = A.client(s, s.session.client);
    const incoming = s.ledger.filter(r => r.account === s.session.account && r.nature === 'CREDITO' && K.days(K.day(r.at), K.day(s.now)) <= 90).reduce((v, r) => v + r.value, 0);
    const active = s.contracts.filter(c => c.client === u.id && ['ATIVO', 'EM_ATRASO'].includes(c.status));
    const capacity = Math.min(C.policy.loanMax, u.income * 6 + M.mul(incoming, 1, 2));
    let reason = '',
      code = '';
    let approved = q;
    if (u.restriction || active.some(c => c.status === 'EM_ATRASO') || s.invoices.some(f => f.account === s.session.account && f.status === 'EM_ATRASO')) {
      reason = 'Restrição cadastral, contrato ou fatura em atraso na base fictícia.';
      code = 'CreditoRecusado';
    } else if (q.value > capacity) {
      if (capacity < C.policy.loanMin) {
        reason = 'Movimentação e qualificação insuficientes para o valor mínimo.';
        code = 'CreditoRecusado';
      } else approved = simulate(s, capacity, q.months);
    }
    if (!reason && existingCommitment(s, u.id) + approved.rows[0].value > M.mul(u.income, C.policy.incomeBp)) {
      reason = 'A soma das parcelas ativas e da nova proposta ultrapassa 30% da renda mensal.';
      code = 'ComprometimentoDeRendaExcedido';
    }
    const contract = {
      id: C.Ids.protocol(s),
      client: u.id,
      account: s.session.account,
      status: 'EM_ANALISE',
      history: [{
        to: 'EM_ANALISE',
        at: s.now,
        actor: 'SISTEMA'
      }],
      proposalId: q.id,
      offer: approved,
      reason,
      code,
      reduced: approved.value < q.value,
      rows: [],
      created: s.now,
      analysis: {
        income: u.income,
        incoming,
        activeContracts: active.length,
        capacity,
        commitment: existingCommitment(s, u.id),
        qualification: u.qualification
      }
    };
    s.contracts.push(contract);
    C.S.transition(s, contract, 'contract', reason ? 'RECUSADO' : 'APROVADO', reason || (contract.reduced ? 'Aprovação com valor reduzido por capacidade e movimentação.' : 'Aprovado pela qualificação, movimentação e ausência de restrições.'));
    return contract;
  }
  function accept(s, id, accountId) {
    C.Session.requireClient(s);
    const c = s.contracts.find(c => c.id === id && c.client === s.session.client);
    C.assert(c && c.status === 'APROVADO', 'Contrato precisa estar aprovado e aguardando aceite.');
    const a = A.account(s, accountId);
    C.assert(a.client === c.client && a.institution === '12345678', 'Crédito permitido apenas em conta ativa do próprio titular na mesma instituição.');
    if (c.offer.expires <= s.now) C.fail('PropostaExpirada');
    const u = A.client(s, c.client);
    C.assert(existingCommitment(s, c.client) + c.offer.rows[0].value <= M.mul(u.income, C.policy.incomeBp), 'A soma das parcelas ativas supera a política de renda.', 'ComprometimentoDeRendaExcedido');
    c.account = a.id;
    c.rows = C.Db.clone(c.offer.rows);
    c.start = s.now;
    c.lastInterest = K.day(s.now);
    C.S.credit(s, a.id, c.offer.value, 'EMPRESTIMO', 'Liberação do empréstimo ' + c.id, {
      contract: c.id
    });
    C.S.transition(s, c, 'contract', 'ATIVO', 'Aceite explícito; cronograma completo gerado.');
  }
  function late(s, row) {
    const days = Math.max(0, K.days(row.due, K.day(s.now)));
    return days > 0 ? M.mul(row.value, C.policy.lateFineBp) + M.mul(row.value, C.policy.lateMonthBp * days, 300000) : 0;
  }
  function debt(s, c) {
    const due = c.rows.filter(r => r.status !== 'PAGA');
    const today = K.day(s.now);
    let principal = due.reduce((v, r) => v + r.amort, 0),
      interest = 0,
      penalty = 0;
    due.forEach(r => {
      const i = c.rows.indexOf(r),
        previous = i ? c.rows[i - 1].due : K.day(c.start);
      const elapsed = Math.max(0, Math.min(K.days(previous, today), K.days(previous, r.due)));
      interest += M.mul(r.interest, elapsed, Math.max(1, K.days(previous, r.due)));
      penalty += late(s, r);
    });
    return {
      principal,
      interest,
      penalty,
      total: principal + interest + penalty,
      contractual: due.reduce((v, r) => v + r.value, 0)
    };
  }
  function settle(s, id, d) {
    C.Session.requireClient(s);
    const c = s.contracts.find(c => c.id === id && c.client === s.session.client);
    C.assert(c && ['ATIVO', 'EM_ATRASO'].includes(c.status), 'Contrato não está ativo.');
    C.assert(c.account === s.session.account, 'Selecione a conta vinculada ao contrato.');
    const q = debt(s, c),
      value = d.mode === 'TOTAL' ? q.total : M.parse(d.value);
    C.assert(value <= q.total, 'Valor superior ao saldo devedor para quitação.');
    C.assert(d.mode === 'TOTAL' || value > q.interest + q.penalty, 'A liquidação parcial deve quitar os juros incorridos e encargos antes de amortizar o principal.');
    const tx = C.S.move(s, {
      from: c.account,
      to: null,
      value,
      type: 'EMPRESTIMO',
      requestId: C.Ids.uuid(),
      description: 'Liquidação antecipada · ' + c.id,
      limits: false,
      extra: {
        contract: c.id
      }
    });
    if (tx.status !== 'EFETIVADA') return tx;
    const remaining = q.total - value;
    if (remaining === 0) {
      c.rows.forEach(r => {
        if (r.status !== 'PAGA') {
          r.status = 'PAGA';
          r.paidAt = s.now;
          r.settledEarly = true;
        }
      });
      C.S.transition(s, c, 'contract', 'LIQUIDADO', 'Quitação total com juros futuros descontados.');
    } else {
      const outstanding = c.rows.filter(r => r.status !== 'PAGA');
      const newPrincipal = q.principal - (value - q.interest - q.penalty);
      let n = outstanding.length;
      if (d.strategy === 'PRAZO') {
        const target = outstanding[0].value;
        for (let i = 1; i <= outstanding.length; i++) {
          if (M.price(newPrincipal, c.offer.rateBp, i)[0].value <= target) {
            n = i;
            break;
          }
        }
      }
      const newRows = M.price(newPrincipal, c.offer.rateBp, n);
      c.restructurings ||= [];
      c.restructurings.push({
        at: s.now,
        before: C.Db.clone(outstanding),
        payment: value,
        strategy: d.strategy,
        discount: Math.max(0, q.contractual - q.total)
      });
      const paid = c.rows.filter(r => r.status === 'PAGA');
      const first = K.months(K.day(s.now), 1);
      c.rows = [...paid, ...newRows.map((r, i) => ({
        ...r,
        number: paid.length + i + 1,
        due: K.months(first, i),
        paid: 0,
        status: 'PENDENTE'
      }))];
      if (c.status === 'EM_ATRASO') C.S.transition(s, c, 'contract', 'ATIVO', 'Atrasos regularizados na liquidação parcial.');
    }
    C.S.audit(s, 'contrato', c.id, 'Liquidação ' + d.mode + ' · ' + M.decimal(value));
    return tx;
  }
  function payInstallment(s, id, number, early = false) {
    const c = s.contracts.find(c => c.id === id);
    C.assert(c && c.account === s.session.account, 'Contrato não pertence à conta selecionada.');
    const row = c.rows.find(r => r.number === number);
    C.assert(row && row.status !== 'PAGA', 'Parcela inexistente ou já paga.');
    const before = number === 1 ? K.day(c.start) : c.rows.find(r => r.number === number - 1)?.due || K.day(c.start);
    const fraction = Math.max(0, Math.min(K.days(before, K.day(s.now)), K.days(before, row.due)));
    const discounted = early && K.day(s.now) < row.due ? row.amort + M.mul(row.interest, fraction, Math.max(1, K.days(before, row.due))) : row.value + late(s, row);
    const tx = C.S.move(s, {
      from: c.account,
      to: null,
      value: discounted,
      type: 'EMPRESTIMO',
      requestId: C.Ids.uuid(),
      description: (early ? 'Antecipação' : 'Pagamento') + ' parcela ' + number + ' · ' + c.id,
      limits: false
    });
    if (tx.status === 'EFETIVADA') {
      row.status = 'PAGA';
      row.paid = discounted;
      row.paidAt = s.now;
      if (c.rows.every(r => r.status === 'PAGA')) C.S.transition(s, c, 'contract', 'LIQUIDADO');else if (c.status === 'EM_ATRASO' && !c.rows.some(r => r.status === 'EM_ATRASO')) C.S.transition(s, c, 'contract', 'ATIVO');
    }
    return tx;
  }
  C.S.loans = {
    simulate,
    analysis,
    accept,
    debt,
    settle,
    payInstallment,
    late,
    existingCommitment
  };
  C.processors.push(s => s.contracts.filter(c => ['ATIVO', 'EM_ATRASO'].includes(c.status)).forEach(c => {
    const old = s.session;
    s.session = {
      client: c.client,
      account: c.account,
      role: 'CLIENTE'
    };
    try {
      c.rows.filter(r => r.status === 'PENDENTE' && r.due <= K.day(s.now)).forEach(row => {
        if (A.balance(s, c.account).available >= row.value) {
          const tx = payInstallment(s, c.id, row.number);
          if (tx.status !== 'EFETIVADA') {
            row.status = 'EM_ATRASO';
            row.failure = 'BE08';
          }
        } else {
          row.status = 'EM_ATRASO';
          row.failure = 'SaldoInsuficiente';
          C.S.notify(s, c.client, 'Parcela ' + row.number + ' do contrato ' + c.id + ' em atraso por saldo insuficiente.');
        }
        if (row.status === 'EM_ATRASO' && c.status === 'ATIVO') C.S.transition(s, c, 'contract', 'EM_ATRASO', 'Falha no débito automático.');
      });
    } finally {
      s.session = old;
    }
  }));
  function offer(q) {
    return U.table(['Solicitado', 'Financiado', 'IOF', 'Tarifa', 'Prazo', 'Parcela inicial', 'Total', 'Juros a.m.', 'CET a.m. / a.a.'], [[U.money(q.value), U.money(q.financed), U.money(q.tax), U.money(q.fee), q.months + ' meses', U.money(q.rows[0].value), U.money(q.total), M.percent(q.rateBp), M.percent(q.cet.monthBp) + ' / ' + M.percent(q.cet.yearBp)]]) + `<p class="small">Validade até ${U.e(K.label(q.expires))}. Primeira parcela: ${q.rows[0].due}. A última parcela absorve o ajuste de centavos.</p>`;
  }
  C.Router.register('emprestimo', 'Empréstimo', s => U.page('Simule seu empréstimo', 'Compare a parcela, o custo efetivo e o cronograma antes de solicitar análise.', U.balance(s) + U.card('Nova simulação', U.form('<div class="fields">' + U.field('value', 'Valor solicitado', '3000.00') + U.field('months', 'Prazo em meses', '12', 'number') + '</div>', d => {
    const q = C.Db.transaction(x => {
      const v = simulate(x, M.parse(d.value), Number(d.months));
      x.proposals.push(v);
      return v;
    });
    U.done('Simulação calculada. Revise os valores antes da análise.');
    U.modal('Simulação de empréstimo', offer(q) + U.action('Submeter proposta à análise', () => {
      const c = C.Db.transaction(x => analysis(x, q.id));
      U.close();
      C.Router.go('contratos?id=' + c.id);
      U.render();
      U.flash(c.status === 'RECUSADO' ? c.code + ' · ' + c.reason : 'Proposta aprovada' + (c.reduced ? ' com valor reduzido. Revise a nova oferta.' : '. Aguarda seu aceite.'), c.status === 'RECUSADO' ? 'error' : 'success');
    }));
  }, 'Calcular simulação')) + U.card('Simulações recentes', U.table(['Data', 'Valor', 'Prazo', 'Validade', 'Ações'], s.proposals.filter(q => q.client === s.session.client).map(q => [U.e(K.label(q.at)), U.money(q.value), q.months + ' meses', U.e(K.label(q.expires)), U.action('Consultar simulação', () => U.modal('Simulação', offer(q) + (!q.submitted ? U.action('Submeter análise', () => {
    C.Db.transaction(x => analysis(x, q.id));
    U.close();
    C.Router.go('contratos');
    U.render();
  }) : '')), 'secondary')]))), 'F9 · RN1–RN7'), 'Cadastro e crédito');
  C.Router.register('contratos', 'Meus contratos', s => U.page('Meus contratos', 'Acompanhe as parcelas, os atrasos e o desconto por quitação antecipada.', U.balance(s) + s.contracts.filter(c => c.client === s.session.client).map(c => U.card('Contrato ' + c.id, U.badge(c.status) + `<p>${U.e(c.reason || c.history.at(-1)?.detail || '')}</p>` + offer(c.offer) + (c.status === 'APROVADO' ? U.form(U.select('account', 'Conta própria para liberação', s.accounts.filter(a => a.client === s.session.client && a.status === 'ATIVA').map(a => [a.id, a.branch + ' / ' + a.number])), d => {
    C.Db.transaction(x => accept(x, c.id, d.account));
    U.done('Crédito liberado em conta; cronograma e débito automático ativados.');
  }, 'Aceitar e contratar') + U.action('Cancelar proposta aprovada', () => {
    C.Db.transaction(x => {
      const q = x.contracts.find(v => v.id === c.id && v.client === x.session.client);
      C.assert(q, 'Contrato não encontrado.');
      C.S.transition(x, q, 'contract', 'CANCELADO', 'Cancelado pelo cliente antes da liberação.');
    });
    U.done('Proposta cancelada.');
  }, 'danger') : '') + (c.rows.length ? U.table(['Nº', 'Vencimento', 'Parcela', 'Juros', 'Amortização', 'Saldo principal', 'Situação / pagamento'], c.rows.map(r => [r.number, r.due, U.money(r.value), U.money(r.interest), U.money(r.amort), U.money(r.balance), U.badge(r.status) + (r.status !== 'PAGA' ? U.action(r.due > K.day(s.now) ? 'Antecipar parcela' : 'Pagar parcela', () => {
    C.Db.transaction(x => {
      C.Session.requireClient(x);
      payInstallment(x, c.id, r.number, r.due > K.day(x.now));
    });
    U.done('Pagamento de parcela processado.');
  }, 'secondary') : '')])) : '') + (['ATIVO', 'EM_ATRASO'].includes(c.status) ? (() => {
    const q = debt(s, c);
    return `<p>Quitação hoje: <strong>${U.money(q.total)}</strong> · principal ${U.money(q.principal)}, juros incorridos ${U.money(q.interest)}, multa/mora ${U.money(q.penalty)}. Redução de juros futuros: ${U.money(Math.max(0, q.contractual - q.total))}.</p>` + U.form(U.select('mode', 'Tipo de liquidação', [['TOTAL', 'Quitação total'], ['PARCIAL', 'Amortização parcial']]) + U.field('value', 'Valor para liquidação parcial', '100.00') + U.select('strategy', 'Na liquidação parcial', [['PARCELA', 'Reduzir parcelas'], ['PRAZO', 'Reduzir prazo']]), d => U.modal('Confirmar liquidação antecipada', `<p>Valor atualizado para quitação total: ${U.money(debt(C.Db.get(), C.Db.get().contracts.find(v => v.id === c.id)).total)}. Confira o saldo antes de confirmar.</p>` + U.action('Confirmar liquidação', () => {
      C.Db.transaction(x => settle(x, c.id, d));
      U.done('Liquidação processada com redução proporcional dos juros futuros.');
    })), 'Revisar liquidação');
  })() : '') + U.history(c) + U.json(c.analysis))).join('') + (!s.contracts.some(c => c.client === s.session.client) ? '<div class="empty">Você ainda não possui contratos.</div>' : ''), 'F9 · RN5–RN12'), 'Cadastro e crédito');
})(Cesbank);
