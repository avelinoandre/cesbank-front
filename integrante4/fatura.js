/* Integrante 4 · F11 RN1–RN12 · ciclos, parcelas, mínimo, rotativo, mora e limite. */
(function (C) {
  'use strict';

  const U = C.UI,
    A = C.S.accounts,
    M = C.M,
    K = C.Clock;
  function cycle(s, cardId, date) {
    const card = s.cards.find(c => c.id === cardId);
    C.assert(card, 'Cartão não encontrado.');
    let month = date.slice(0, 7);
    if (Number(date.slice(8)) > 25) month = K.months(month + '-01', 1).slice(0, 7);
    let f = s.invoices.find(f => f.card === cardId && f.cycle === month);
    if (!f) {
      f = {
        id: C.Ids.uuid(),
        card: cardId,
        account: card.account,
        cycle: month,
        close: month + '-25',
        due: K.months(month + '-01', 1).slice(0, 7) + '-10',
        status: 'ABERTA',
        items: [],
        paid: 0,
        history: [{
          to: 'ABERTA',
          at: s.now,
          actor: 'SISTEMA'
        }]
      };
      s.invoices.push(f);
    }
    return f;
  }
  function total(f) {
    return Math.max(0, f.items.filter(r => !r.suspended && !r.advanced).reduce((v, r) => v + r.amount, 0));
  }
  function remaining(f) {
    return Math.max(0, total(f) - f.paid - (f.rolledAmount || 0));
  }
  function minimum(f) {
    return Math.min(remaining(f), M.mul(total(f), C.policy.minimumBp));
  }
  function recordPurchase(s, auth) {
    C.assert(!s.purchases.some(p => p.id === auth.id), 'Compra já foi incorporada à fatura.');
    const first = cycle(s, auth.card, K.day(s.now));
    const n = auth.installments;
    const plan = auth.plan || Array.from({
      length: n
    }, (_, i) => {
      const amount = Math.trunc(auth.value / n) + (i < auth.value % n ? 1 : 0);
      return {
        value: amount,
        amort: amount,
        interest: 0
      };
    });
    const purchase = {
      id: auth.id,
      account: auth.account,
      card: auth.card,
      description: auth.description,
      value: auth.value,
      principal: auth.principal || auth.value,
      at: s.now,
      items: []
    };
    s.purchases.push(purchase);
    plan.forEach((row, i) => {
      const date = K.months(first.cycle + '-01', i);
      const f = cycle(s, auth.card, date);
      const item = {
        id: C.Ids.uuid(),
        purchase: auth.id,
        number: i + 1,
        count: n,
        amount: row.value,
        principal: row.amort,
        interest: row.interest,
        description: auth.description,
        type: n > 1 ? 'COMPRA_PARCELADA' : 'COMPRA',
        at: s.now,
        suspended: false
      };
      f.items.push(item);
      purchase.items.push({
        invoice: f.id,
        item: item.id
      });
    });
    C.S.audit(s, 'compra', auth.id, 'Valor total reservado; parcelas em seus respectivos ciclos.');
  }
  function nextInvoice(s, f) {
    return cycle(s, f.card, K.months(f.cycle + '-01', 1));
  }
  function regularize(s, card) {
    const overdue = s.invoices.some(f => f.card === card.id && f.status === 'EM_ATRASO' && remaining(f) > 0);
    if (card.blockedByDebt && !overdue) {
      card.blockedByDebt = false;
      if (card.status === 'BLOQUEADO') C.S.transition(s, card, 'card', 'ATIVO', 'Inadimplência regularizada.');
    }
  }
  function addLateCharges(s, f, value) {
    const days = Math.max(0, K.days(f.due, K.day(s.now)));
    if (!days) return;
    const next = nextInvoice(s, f);
    const fine = f.fineApplied ? 0 : M.mul(value, C.policy.lateFineBp),
      mora = M.mul(value, C.policy.lateMonthBp * days, 300000);
    if (fine + mora) {
      s.cards.find(c => c.id === f.card).used += fine + mora;
      next.items.push({
        id: C.Ids.uuid(),
        amount: fine + mora,
        description: `Multa/mora · fatura ${f.cycle} · ${days} dia(s)`,
        type: 'ENCARGOS_ATRASO',
        at: s.now,
        principal: 0,
        interest: fine + mora
      });
    }
    f.fineApplied = true;
  }
  function pay(s, id, value) {
    C.Session.requireClient(s);
    const f = C.S.owner(s, s.invoices.find(f => f.id === id));
    C.assert(['FECHADA', 'EM_ATRASO', 'PAGA_PARCIALMENTE'].includes(f.status), 'Aguarde o fechamento da fatura para pagar.');
    C.assert(value >= minimum(f), 'O valor pago é menor que o valor mínimo da fatura.', 'PagamentoInferiorAoMinimo');
    C.assert(value <= remaining(f) && value > 0, 'O pagamento não pode ultrapassar o valor ainda devido.');
    const tx = C.S.move(s, {
      from: f.account,
      to: null,
      value,
      type: 'CARTAO',
      requestId: C.Ids.uuid(),
      description: 'Pagamento da fatura ' + f.cycle,
      limits: false,
      extra: {
        invoice: f.id
      }
    });
    if (tx.status !== 'EFETIVADA') return tx;
    addLateCharges(s, f, value);
    f.paid += value;
    const card = s.cards.find(c => c.id === f.card);
    card.used = Math.max(0, card.used - value);
    const target = remaining(f) === 0 ? 'PAGA' : 'PAGA_PARCIALMENTE';
    if (f.status !== target) C.S.transition(s, f, 'invoice', target, 'Liquidação confirmada · ' + M.decimal(value));
    regularize(s, card);
    C.S.audit(s, 'fatura', f.id, 'Pagamento confirmado; limite recomposto pelo valor pago.');
    return tx;
  }
  function anticipation(s, itemId) {
    C.Session.requireClient(s);
    let invoice, item;
    for (const f of s.invoices) {
      const row = f.items.find(r => r.id === itemId);
      if (row) {
        invoice = f;
        item = row;
        break;
      }
    }
    C.S.owner(s, invoice);
    C.assert(item && invoice.status === 'ABERTA' && invoice.cycle > K.day(s.now).slice(0, 7) && !item.advanced && !item.suspended, 'Apenas parcelas futuras em aberto e sem contestação podem ser antecipadas.');
    const value = item.principal ?? item.amount;
    const tx = C.S.move(s, {
      from: invoice.account,
      to: null,
      value,
      type: 'CARTAO',
      requestId: C.Ids.uuid(),
      description: 'Antecipação de parcela · ' + item.description,
      limits: false
    });
    if (tx.status !== 'EFETIVADA') return tx;
    item.advanced = true;
    item.advancedAt = s.now;
    item.discount = item.amount - value;
    const card = s.cards.find(c => c.id === invoice.card);
    card.used = Math.max(0, card.used - item.amount);
    C.S.audit(s, 'antecipacao-cartao', item.id, `Pago ${M.decimal(value)}; desconto ${M.decimal(item.discount)}; limite liberado ${M.decimal(item.amount)}.`);
    return tx;
  }
  function suspend(s, invoiceId, itemId, yes) {
    const f = s.invoices.find(f => f.id === invoiceId),
      item = f?.items.find(i => i.id === itemId);
    C.assert(item && !item.advanced, 'Lançamento não disponível para suspensão.');
    C.assert(!yes || !item.suspended, 'Cobrança já suspensa.');
    if (yes && f.rolledAmount) {
      removeCarried(s, f.id, Math.min(item.amount, f.rolledAmount));
    }
    item.suspended = yes;
    C.S.audit(s, 'fatura', f.id, yes ? 'Cobrança suspensa: excluída do total, mínimo e encargos.' : 'Cobrança restabelecida.');
  }
  function removeCarried(s, sourceId, value) {
    const source = s.invoices.find(f => f.id === sourceId);
    if (source?.rolledAmount) source.rolledAmount = Math.max(0, source.rolledAmount - value);
    s.invoices.forEach(f => f.items.filter(i => i.type === 'ROTATIVO' && i.sourceInvoice === sourceId).forEach(carry => {
      const principal = Math.min(value, carry.principal),
        interest = M.mul(carry.interest, principal, Math.max(1, carry.principal));
      carry.principal -= principal;
      carry.interest -= interest;
      carry.amount -= principal + interest;
      s.cards.find(c => c.id === f.card).used = Math.max(0, s.cards.find(c => c.id === f.card).used - interest);
      if (f.rolledAmount) removeCarried(s, f.id, principal + interest);
    }));
  }
  C.S.invoices = {
    cycle,
    total,
    remaining,
    minimum,
    recordPurchase,
    pay,
    anticipation,
    suspend,
    nextInvoice,
    regularize
  };
  C.processors.push(s => {
    s.invoices.slice().forEach(f => {
      if (f.status === 'ABERTA' && f.close < K.day(s.now)) {
        C.S.transition(s, f, 'invoice', 'FECHADA', 'Fechamento do ciclo; antecedência de no mínimo 7 dias ao vencimento.');
        f.published = s.now;
        C.S.notify(s, A.account(s, f.account).client, 'Fatura ' + f.cycle + ' fechada. Total ' + M.fmt(total(f)) + ', mínimo ' + M.fmt(minimum(f)) + '.');
        if (remaining(f) === 0 && !f.items.some(i => i.suspended)) C.S.transition(s, f, 'invoice', 'PAGA', 'Fatura sem saldo exigível.');
      }
      if (['FECHADA', 'PAGA_PARCIALMENTE'].includes(f.status) && f.due < K.day(s.now) && remaining(f) > 0) C.S.transition(s, f, 'invoice', 'EM_ATRASO', 'Vencimento sem liquidação total.');
      if (f.status === 'EM_ATRASO' && remaining(f) > 0 && K.days(f.due, K.day(s.now)) > C.policy.cardBlockDays) {
        const c = s.cards.find(c => c.id === f.card);
        c.blockedByDebt = true;
        if (c.status === 'ATIVO') C.S.transition(s, c, 'card', 'BLOQUEADO', 'Fatura em atraso há mais de 5 dias.');
      }
      const nextClose = nextInvoiceDate(f);
      if (f.due < K.day(s.now) && nextClose < K.day(s.now) && remaining(f) > 0 && !f.rolledAt) {
        const value = remaining(f),
          days = K.days(f.due, nextClose),
          interest = M.mul(value, C.policy.rotationMonthBp * days, 300000);
        const next = nextInvoice(s, f);
        next.items.push({
          id: C.Ids.uuid(),
          amount: value + interest,
          principal: value,
          interest,
          description: 'Saldo rotativo da fatura ' + f.cycle,
          type: 'ROTATIVO',
          sourceInvoice: f.id,
          at: s.now
        });
        s.cards.find(c => c.id === f.card).used += interest;
        f.rolledAmount = value;
        f.rolledAt = s.now;
        f.rotationInterest = interest;
        C.S.audit(s, 'rotativo', f.id, 'Saldo transportado ao próximo ciclo; encargos por ' + days + ' dias.');
      }
    });
  });
  function nextInvoiceDate(f) {
    return K.months(f.cycle + '-01', 1).slice(0, 7) + '-25';
  }
  /* ---- Apresentação (integrante 4): status coloridos e fluxo de pagamento destacado ---- */
  const STATUS = {
    ABERTA: 'aberta', FECHADA: 'fechada', PAGA: 'paga', PAGA_PARCIALMENTE: 'parcial',
    EM_ATRASO: 'atraso', COBRANCA_SUSPENSA: 'suspensa', ANTECIPADA: 'antecipada'
  };
  const HINT = {
    ABERTA: 'Ciclo em andamento: ainda recebe compras.',
    FECHADA: 'Pronta para pagamento.',
    PAGA: 'Quitada.',
    PAGA_PARCIALMENTE: 'Ainda há saldo a pagar.',
    EM_ATRASO: 'Vencida: pague para evitar bloqueio do cartão.'
  };
  function sBadge(v) {
    return `<span class="i4-badge st-${STATUS[v] || 'neutro'}">${U.e(String(v).replace(/_/g, ' '))}</span>`;
  }
  function sHistory(row) {
    const rows = row.history || [];
    return `<details class="i4-history"><summary>Histórico da fatura (${rows.length})</summary>` + U.table(['Data e hora', 'Situação', 'Responsável', 'Detalhe'], rows.map(h => [U.e(K.label(h.at)), sBadge(h.to), U.e(h.actor), U.e(h.detail)])) + '</details>';
  }
  function itemAction(s, f, item) {
    let out = '';
    if (item.suspended) out += sBadge('COBRANCA_SUSPENSA');
    else if (item.advanced) out += sBadge('ANTECIPADA') + `<small>Desconto ${U.money(item.discount || 0)}</small>`;
    else if (f.status === 'ABERTA' && f.cycle > K.day(s.now).slice(0, 7) && item.purchase) out += U.action('Antecipar parcela', () => U.modal('Antecipar parcela futura', `<p>Nominal: ${U.money(item.amount)} · desconto de encargos futuros: ${U.money(item.interest || 0)} · pagar: ${U.money(item.principal ?? item.amount)}.</p>` + U.action('Confirmar antecipação', () => {
      C.Db.transaction(x => anticipation(x, item.id));
      U.done('Antecipação processada; limite liberado após liquidação.');
    })), 'i4-btn-advance');
    if (item.purchase && !item.suspended) out += `<a class="button i4-btn-contest" href="#contestacoes?fatura=${U.e(f.id)}&item=${U.e(item.id)}">Contestar</a>`;
    return out;
  }
  function payBox(f) {
    if (!(['FECHADA', 'EM_ATRASO', 'PAGA_PARCIALMENTE'].includes(f.status) && remaining(f) > 0)) return '';
    return '<div class="i4-pay"><h3>Pagar esta fatura</h3>' + U.form('<div class="fields">' + U.select('mode', 'Forma de pagamento', [['TOTAL', 'Total · ' + M.fmt(remaining(f))], ['MINIMO', 'Mínimo · ' + M.fmt(minimum(f))], ['PARCIAL', 'Parcial · escolher valor']]) + U.field('value', 'Valor do pagamento parcial', M.decimal(minimum(f))) + '</div>', d => {
      let tx;
      C.Db.transaction(x => {
        const q = x.invoices.find(q => q.id === f.id);
        const value = d.mode === 'TOTAL' ? remaining(q) : d.mode === 'MINIMO' ? minimum(q) : M.parse(d.value);
        tx = pay(x, f.id, value);
      });
      U.done(tx.status === 'EFETIVADA' ? 'Fatura paga; limite recomposto após liquidação.' : 'Falha operacional com estorno; limite e fatura preservados.');
    }, 'Confirmar pagamento') + '</div>';
  }
  function invoiceCard(s, f) {
    const st = STATUS[f.status] || 'neutro';
    const head = `<div class="i4-head">${sBadge(f.status)}<span class="i4-hint">${U.e(HINT[f.status] || '')}</span></div>` +
      `<p class="i4-dates">Fechamento <b>${f.close}</b> · Vencimento <b>${f.due}</b></p>`;
    const sums = `<div class="i4-sums"><div><span>Total do ciclo</span><b>${U.money(total(f))}</b></div><div><span>Mínimo exigível</span><b>${U.money(minimum(f))}</b></div><div><span>Pago</span><b>${U.money(f.paid)}</b></div><div class="i4-due"><span>A pagar nesta fatura</span><b>${U.money(remaining(f))}</b></div></div>`;
    const rot = f.rolledAmount ? `<div class="banner warning">${U.money(f.rolledAmount)} transportados para o próximo ciclo; rotativo de ${U.money(f.rotationInterest)}. Consulte a fatura seguinte para regularizar.</div>` : '';
    const table = U.table(['Lançamento', 'Parcela', 'Principal', 'Encargos', 'Valor', 'Situação / ação'], f.items.map(item => [U.e(item.description), item.count ? item.number + '/' + item.count : '—', U.money(item.principal || 0), U.money(item.interest || 0), `<b>${U.money(item.amount)}</b>`, `<div class="i4-row-actions">${itemAction(s, f, item)}</div>`]));
    return U.card('Fatura ' + f.cycle, head + sums + rot + table + payBox(f) + sHistory(f), 'i4-invoice st-' + st);
  }
  C.Router.register('faturas', 'Faturas e compras', s => {
    const list = s.invoices.filter(f => f.account === s.session.account).sort((a, b) => a.cycle.localeCompare(b.cycle));
    const legend = '<div class="i4-legend"><span>Legenda:</span>' + ['ABERTA', 'FECHADA', 'PAGA_PARCIALMENTE', 'PAGA', 'EM_ATRASO', 'COBRANCA_SUSPENSA'].map(sBadge).join('') + '</div>';
    return U.page('Faturas e compras', 'Fechamento no dia 25; vencimento no dia 10 do mês seguinte. Mínimo de 15%.', U.balance(s) + `<div class="i4-toolbar">${U.link('cartoes', 'Simular uma compra no cartão')}${list.length ? legend : ''}</div>` + list.map(f => invoiceCard(s, f)).join('') + (!list.length ? '<div class="empty">Nenhuma fatura. Autorize e confirme uma compra para gerar os lançamentos.</div>' : ''), 'F11 · RN1–RN12');
  }, 'Cadastro e crédito');
})(Cesbank);
