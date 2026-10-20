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
    return '<div class="loan-summary">' + U.table(['Empréstimo', 'Valor'], [
      ['Valor solicitado', U.money(q.value)], ['Valor financiado', U.money(q.financed)],
      ['Prazo', q.months + ' meses'], ['Parcela mensal', U.money(q.rows[0].value)],
      ['Primeiro vencimento', q.rows[0].due]
    ]) + U.table(['Custo efetivo', 'Valor'], [
      ['Taxa de juros a.m.', M.percent(q.rateBp)], ['CET a.m. / a.a.', M.percent(q.cet.monthBp) + ' / ' + M.percent(q.cet.yearBp)],
      ['IOF', U.money(q.tax)], ['Tarifa', U.money(q.fee)], ['Total a pagar', U.money(q.total)]
    ]) + '</div>' + `<p class="small">Simulação válida até ${U.e(K.label(q.expires))}. A última parcela absorve o ajuste de centavos.</p>`;
  }
  function schedule(rows) {
    return U.table(['Nº', 'Vencimento', 'Parcela', 'Juros', 'Amortização', 'Saldo principal', 'Situação'], rows.map(r => [r.number, r.due, U.money(r.value), U.money(r.interest), U.money(r.amort), U.money(r.balance), U.badge(r.status)]));
  }
  function sendProposal(id) {
    const c = C.Db.transaction(x => analysis(x, id));
    U.close();
    C.Router.go('contratos?id=' + c.id);
  }
  function simulation(q, s) {
    const expired = q.expires <= s.now;
    return U.card('Resultado da simulação', offer(q) + '<p>Parcelas pelo sistema de amortização francês (Price). O CET incorpora juros, tributos e tarifas.</p>' + (expired ? '<div class="banner error">PropostaExpirada · Faça uma nova simulação.</div>' : '') + '<div class="actions">' + (!q.submitted && !expired ? U.action('Enviar proposta para análise', () => sendProposal(q.id)) : '') + U.action('Ver parcelas', () => U.modal('Cronograma da simulação', schedule(q.rows)), 'secondary') + U.link('emprestimo', 'Nova simulação') + '</div>');
  }
  C.Router.register('emprestimo', 'Empréstimo', (s, p) => {
    const q = s.proposals.find(q => q.id === p.get('id') && q.client === s.session.client);
    const u = A.client(s, s.session.client);
    return U.page('Contratar empréstimo', 'Simule, revise os custos e envie sua proposta para análise.', '<div class="grid">' + U.card('Simule seu empréstimo', U.form(U.field('value', 'Valor desejado (R$)', q ? M.decimal(q.value) : '3000.00') + U.field('months', 'Prazo em meses', q?.months || '12', 'number', 'min="2" max="60" step="1"') + '<p>Primeiro vencimento em 30 dias.</p>', d => {
      const result = C.Db.transaction(x => {
        const proposal = simulate(x, M.parse(d.value), Number(d.months));
        x.proposals.push(proposal);
        return proposal;
      });
      C.Router.go('emprestimo?id=' + result.id);
    }, 'Simular')) + U.card('Condições da modalidade', U.table(['Condição', 'Valor'], [
      ['Valor permitido', U.money(C.policy.loanMin) + ' a ' + U.money(C.policy.loanMax)],
      ['Prazo', C.policy.loanMinMonths + ' a ' + C.policy.loanMaxMonths + ' meses'],
      ['Taxa da sua faixa a.m.', M.percent({ALTA:200,MEDIA:250,BASICA:300}[u.qualification])],
      ['Comprometimento de renda', U.money(existingCommitment(s, u.id)) + ' de ' + U.money(M.mul(u.income, C.policy.incomeBp))],
      ['Validade da simulação', C.policy.proposalMinutes + ' minutos']
    ])) + '</div>' + (q ? simulation(q, s) : '') + U.card('Simulações recentes', U.table(['Data', 'Valor', 'Prazo', 'Situação', 'Acesso'], s.proposals.filter(q => q.client === s.session.client).slice().reverse().map(q => [U.e(K.label(q.at)), U.money(q.value), q.months + ' meses', q.submitted ? 'Enviada' : q.expires <= s.now ? 'Expirada' : 'Válida', U.link('emprestimo?id=' + q.id, 'Consultar simulação')]))), 'F9 · RN1–RN7');
  }, 'Cadastro e crédito');
  function currentContract(s, id) {
    const c = s.contracts.find(c => c.id === id && c.client === s.session.client);
    C.assert(c, 'Contrato não encontrado para este cliente.');
    return c;
  }
  // Preview runs the same calculation on an isolated copy; no balance is changed.
  function previewPayment(id, d) {
    const state = C.Db.get(), c = currentContract(state, id);
    C.assert(c.account === state.session.account, 'Selecione a conta vinculada ao contrato.');
    const copy = C.Db.clone(state), original = debt(state, c);
    const tx = settle(copy, id, d);
    C.assert(tx.status === 'EFETIVADA', 'Não foi possível simular a liquidação.');
    const after = currentContract(copy, id), pending = after.rows.filter(r => r.status !== 'PAGA');
    const value = d.mode === 'TOTAL' ? original.total : M.parse(d.value);
    U.modal('Confirmar quitação antecipada', U.table(['Simulação da quitação', 'Valor'], [
      ['Principal', U.money(original.principal)], ['Juros incorridos', U.money(original.interest)],
      ['Multa e mora', U.money(original.penalty)], ['Valor a pagar hoje', U.money(value)],
      ['Saldo devedor após pagamento', U.money(Math.max(0, original.total - value))],
      ['Estratégia', d.mode === 'TOTAL' ? 'Quitação total' : d.strategy === 'PRAZO' ? 'Reduzir prazo' : 'Reduzir parcelas'],
      ['Parcelas restantes', d.mode === 'TOTAL' ? 0 : pending.length],
      ['Nova parcela', d.mode === 'TOTAL' ? U.money(0) : U.money(pending[0].value)]
    ]) + '<p>Juros futuros retirados do saldo para recálculo: ' + U.money(Math.max(0, original.contractual - original.total)) + '.</p>' + U.action('Confirmar quitação', () => {
      C.Db.transaction(x => {
        C.assert(x.now === state.now && JSON.stringify(currentContract(x, id)) === JSON.stringify(c), 'Os valores mudaram. Calcule novamente antes de confirmar.');
        const result = settle(x, id, d);
        C.assert(result.status === 'EFETIVADA', 'Liquidação não efetivada.');
      });
      U.done('Quitação efetivada. Cronograma e situação atualizados.');
    }));
  }
  function previewInstallments(id, count) {
    const state = C.Db.get(), c = currentContract(state, id);
    const pending = c.rows.filter(r => r.status !== 'PAGA');
    C.assert(Number.isInteger(count) && count > 0 && count <= pending.length, 'Informe uma quantidade inteira entre 1 e ' + pending.length + '.');
    const selected = pending.slice(0, count), copy = C.Db.clone(state);
    for (const row of selected) C.assert(payInstallment(copy, id, row.number, true).status === 'EFETIVADA', 'Antecipação não efetivada.');
    const after = currentContract(copy, id);
    const total = selected.reduce((sum, r) => sum + after.rows.find(v => v.number === r.number).paid, 0);
    const original = selected.reduce((sum, r) => sum + r.value, 0);
    U.modal('Confirmar antecipação de parcelas', U.table(['Simulação da antecipação', 'Valor'], [
      ['Parcelas selecionadas', selected.map(r => r.number).join(', ')],
      ['Valor a pagar hoje', U.money(total)], ['Economia de juros', U.money(Math.max(0, original - total))]
    ]) + U.action('Confirmar antecipação de ' + count + ' parcelas', () => {
      C.Db.transaction(x => {
        C.Session.requireClient(x);
        C.assert(x.now === state.now && JSON.stringify(currentContract(x, id)) === JSON.stringify(c), 'Os valores mudaram. Calcule novamente.');
        for (const row of selected) C.assert(payInstallment(x, id, row.number, true).status === 'EFETIVADA', 'Antecipação não efetivada.');
      });
      U.done('Parcelas antecipadas com redução de juros. Cronograma atualizado.');
    }));
  }
  function settlementDialog(c) {
    U.modal('Quitação antecipada', U.form(U.select('mode', 'Tipo de quitação', [['TOTAL','Quitação total'],['PARCIAL','Quitação parcial por valor'],['PARCELAS','Adiantar parcelas específicas']]) + U.field('value', 'Valor a antecipar (somente parcial)', '100.00') + U.field('count', 'Quantidade de parcelas a antecipar (modo parcelas específicas)', '1', 'number', 'min="1" step="1"') + U.select('strategy', 'Na quitação parcial', [['PARCELA','Reduzir valor das parcelas'],['PRAZO','Reduzir prazo restante']]), d => d.mode === 'PARCELAS' ? previewInstallments(c.id, Number(d.count)) : previewPayment(c.id, d), 'Calcular') + '<p>Para antecipar parcelas específicas, use as ações do cronograma. Nenhum débito ocorre antes da confirmação.</p>');
  }
  function installmentDialog(id, number) {
    const state = C.Db.get(), c = currentContract(state, id), row = c.rows.find(r => r.number === number);
    const early = row.due > K.day(state.now), copy = C.Db.clone(state);
    const tx = payInstallment(copy, id, number, early);
    C.assert(tx.status === 'EFETIVADA', 'Não foi possível simular o pagamento.');
    const paid = currentContract(copy, id).rows.find(r => r.number === number).paid;
    U.modal(early ? 'Antecipar parcela' : 'Pagar parcela', U.table(['Parcela ' + number, 'Valor'], [['Vencimento', row.due], ['Valor original', U.money(row.value)], ['Valor a pagar hoje', U.money(paid)], ['Redução de juros', U.money(Math.max(0, row.value - paid))]]) + U.action('Confirmar pagamento', () => {
      C.Db.transaction(x => {
        C.Session.requireClient(x);
        C.assert(x.now === state.now && JSON.stringify(currentContract(x, id)) === JSON.stringify(c), 'Os valores mudaram. Revise novamente.');
        const result = payInstallment(x, id, number, early);
        C.assert(result.status === 'EFETIVADA', 'Pagamento não efetivado.');
      });
      U.done('Parcela paga. Cronograma atualizado.');
    }));
  }
  C.Router.register('contratos', 'Meus contratos', (s, p) => {
    const own = s.contracts.filter(c => c.client === s.session.client);
    if (!p.get('id')) return U.page('Meus contratos', 'Selecione um contrato para acompanhar as parcelas.', U.link('emprestimo', 'Novo empréstimo') + U.card('Contratos', U.table(['Contrato', 'Valor', 'Prazo', 'Situação', 'Acesso'], own.map(c => [U.e(c.id), U.money(c.offer.value), c.offer.months + ' meses', U.badge(c.status), U.link('contratos?id=' + c.id, 'Ver contrato')]))), 'F9 · RN12');
    const c = currentContract(s, p.get('id'));
    let body = U.link('contratos', 'Voltar aos contratos') + U.card(c.status === 'RECUSADO' ? 'Proposta recusada' : 'Resumo do contrato', U.badge(c.status) + '<p>' + U.e(c.code ? c.code + ' · ' + c.reason : c.history.at(-1)?.detail || c.reason) + '</p>' + offer(c.offer));
    if (c.status === 'RECUSADO' || c.status === 'CANCELADO') body += U.link('emprestimo', 'Nova simulação');
    if (c.status === 'APROVADO') body += U.card(c.reduced ? 'Oferta aprovada com valor reduzido' : 'Proposta aprovada', '<p>Confira os custos e escolha sua conta antes de aceitar. O crédito será liberado após a confirmação.</p>' + (c.offer.expires <= s.now ? '<div class="banner error">PropostaExpirada · Faça uma nova simulação.</div>' + U.link('emprestimo','Nova simulação') : U.form(U.select('account', 'Conta própria para liberação', s.accounts.filter(a => a.client === s.session.client && a.status === 'ATIVA').map(a => [a.id,a.branch + ' / ' + a.number])), d => {
      C.Db.transaction(x => accept(x,c.id,d.account));
      U.done('Crédito liberado em conta; cronograma e débito automático ativados.');
    }, 'Aceitar e contratar')) + U.action('Cancelar proposta', () => {
      C.Db.transaction(x => C.S.transition(x, currentContract(x,c.id), 'contract','CANCELADO','Cancelado pelo cliente antes da liberação.'));
      U.done('Proposta cancelada.');
    }, 'danger'));
    if (c.rows.length) {
      const a = s.accounts.find(a => a.id === c.account);
      const active = ['ATIVO','EM_ATRASO'].includes(c.status);
      body += U.card('Conta vinculada e pagamentos', '<p>Agência ' + U.e(a.branch) + ' · conta ' + U.e(a.number) + ' · saldo disponível ' + U.money(A.balance(s,a.id).available) + '</p><p>Débito automático na data de vencimento. Sem saldo, a parcela fica em atraso e acumula multa e mora.</p>' + (active ? U.action('Quitar antecipadamente', () => settlementDialog(c)) : ''));
      body += U.card('Cronograma de parcelas', schedule(c.rows) + (active ? '<div class="actions">' + c.rows.filter(r => r.status !== 'PAGA').map(r => U.action((r.due > K.day(s.now) ? 'Antecipar' : 'Pagar') + ' parcela ' + r.number, () => installmentDialog(c.id,r.number),'secondary')).join('') + '</div>' : ''));
    }
    body += U.card('Histórico de situações', U.history(c));
    return U.page('Contrato ' + c.id, 'Acompanhe a liberação, os vencimentos e as quitações.', body, 'F9 · RN5–RN12');
  }, 'Cadastro e crédito');
})(Cesbank);
