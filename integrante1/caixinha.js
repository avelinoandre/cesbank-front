/* Integrante 1 no consolidado; fonte integrante 6 · F13b RN1–RN10 e roteiro de 20 telas. */
(function (C) {
  'use strict';

  const U = C.UI,
    A = C.S.accounts,
    M = C.M,
    K = C.Clock;
  function anniversary(created, from) {
    const day = Number(K.day(created).slice(8));
    let next = K.months(from, 1).slice(0, 7) + '-' + String(day >= 29 ? 1 : day).padStart(2, '0');
    if (day >= 29) next = K.months(from, 1).slice(0, 7) + '-01';
    return next;
  }
  function accrue(s, b, to = s.now) {
    const seconds = Math.max(0, Math.trunc((new Date(to) - new Date(b.accrualAt)) / 1000));
    b.pending = String(BigInt(b.pending || '0') + BigInt(b.balance) * BigInt(C.policy.boxDailyMillion) * BigInt(seconds));
    b.accrualAt = to;
  }
  function entry(s, b, type, value) {
    b.entries.push({
      id: C.Ids.uuid(),
      at: s.now,
      type,
      value,
      balance: b.balance
    });
    C.S.ledger(s, b.account, value, type === 'RESGATE' ? 'CREDITO' : 'DEBITO', type === 'RENDIMENTO' ? 'RENDIMENTO' : 'OUTROS', `${type} · caixinha ${b.name}`, b.id, {
      allocation: true
    });
  }
  function status(s, b) {
    const next = b.balance >= b.goal ? 'CONCLUIDA' : 'ATIVA';
    if (b.status !== next) C.S.transition(s, b, 'box', next, next === 'CONCLUIDA' ? 'Meta atingida.' : 'Saldo abaixo da meta.');
  }
  function create(s, d) {
    C.Session.requireClient(s);
    const name = d.name.trim(),
      goal = M.parse(d.goal);
    C.assert(name, 'Nome da caixinha obrigatório.');
    C.assert(!s.boxes.some(b => b.account === s.session.account && b.name.toLowerCase() === name.toLowerCase()), 'O nome não pode se repetir entre as caixinhas do mesmo cliente.');
    C.assert(s.boxes.filter(b => b.account === s.session.account && b.status !== 'ENCERRADA').length < C.policy.boxMax, 'Limite de 5 caixinhas ativas por conta atingido.');
    if (d.target) C.assert(C.V.date(d.target) && d.target >= K.day(s.now), 'Data-alvo inválida.');
    const b = {
      id: C.Ids.uuid(),
      account: s.session.account,
      name,
      goal,
      target: d.target || null,
      balance: 0,
      status: 'ATIVA',
      created: s.now,
      accrualAt: s.now,
      pending: '0',
      nextBirthday: anniversary(s.now, K.day(s.now)),
      entries: [],
      history: []
    };
    s.boxes.push(b);
    C.S.audit(s, 'caixinha', b.id, 'Criação.');
    return b;
  }
  function move(s, id, value, direction) {
    C.Session.requireClient(s);
    const b = C.S.owner(s, s.boxes.find(b => b.id === id));
    C.assert(b.status !== 'ENCERRADA', 'Caixinha encerrada permite somente consulta.');
    C.assert(Number.isSafeInteger(value) && value > 0, 'O valor deve ser maior que zero.');
    accrue(s, b);
    if (direction === 'DEPOSITO') {
      A.check(s, b.account, value, false);
      b.balance += value;
    } else {
      C.assert(value <= b.balance, 'O valor solicitado no resgate é maior que o saldo da caixinha.', 'SaldoInsuficienteParaResgate');
      b.balance -= value;
    }
    entry(s, b, direction, value);
    status(s, b);
    return b;
  }
  function close(s, id) {
    const b = C.S.owner(s, s.boxes.find(b => b.id === id));
    C.assert(b.status !== 'ENCERRADA', 'Caixinha já encerrada.');
    if (b.balance) move(s, id, b.balance, 'RESGATE');
    C.S.transition(s, b, 'box', 'ENCERRADA', 'Resgate integral automático para a conta de origem.');
    C.S.audit(s, 'caixinha', b.id, 'Histórico preservado; rendimento não creditado fora do aniversário.');
  }
  C.S.boxes = {
    create,
    move,
    close,
    accrue
  };
  C.processors.push(s => s.boxes.filter(b => b.status !== 'ENCERRADA').forEach(b => {
    while (b.nextBirthday <= K.day(s.now)) {
      const birthdayAt = K.at(b.nextBirthday, 0);
      accrue(s, b, birthdayAt);
      const amount = M.safe(M.div(BigInt(b.pending), 86400000000n));
      b.pending = '0';
      if (amount) {
        b.balance += amount;
        A.account(s, b.account).total += amount;
        b.entries.push({
          id: C.Ids.uuid(),
          at: birthdayAt,
          type: 'RENDIMENTO',
          value: amount,
          balance: b.balance
        });
        C.S.ledger(s, b.account, amount, 'CREDITO', 'RENDIMENTO', 'Rendimento de aniversário · ' + b.name, b.id, {
          allocation: true,
          anniversary: b.nextBirthday
        });
        C.S.notify(s, A.account(s, b.account).client, 'Rendimento de ' + M.fmt(amount) + ' creditado na caixinha ' + b.name + '.');
        status(s, b);
      }
      b.nextBirthday = anniversary(b.created, b.nextBirthday);
    }
    accrue(s, b);
  }));
  C.Router.register('caixinhas', 'Caixinhas', s => U.page('Caixinhas de economia', 'Guarde para uma meta e consulte os movimentos mesmo depois do encerramento.', U.balance(s) + `<div class="grid">${s.boxes.filter(b => b.account === s.session.account).map(b => U.card(b.name, `${U.badge(b.status)}<p class="metric">${U.money(b.balance)}</p><p>Meta ${U.money(b.goal)} · ${M.mul(b.balance, 10000, b.goal) / 100}% alcançado</p><progress value="${b.balance}" max="${b.goal}"></progress><p class="small">Próximo aniversário: ${U.e(b.nextBirthday)}</p>` + U.link('caixinha?id=' + b.id, 'Abrir caixinha'))).join('') || '<div class="empty">Você ainda não criou nenhuma caixinha.</div>'}</div>` + U.card('Nova caixinha', U.form('<div class="fields">' + U.field('name', 'Nome da caixinha') + U.field('goal', 'Meta (BRL)', '1000.00') + U.field('target', 'Data-alvo opcional', '', 'date') + '</div>', d => {
    const b = C.Db.transaction(x => create(x, d));
    C.Router.go('caixinha?id=' + b.id);
    U.render();
    U.flash('Caixinha criada com sucesso.');
  }, 'Criar caixinha')) + U.link('investimentos', 'Voltar a investimentos'), 'F13b · RN1, RN2, RN4, RN8'), null);
  C.Router.register('caixinha', 'Detalhe da caixinha', (s, p) => {
    const b = s.boxes.find(b => b.id === p.get('id') && b.account === s.session.account);
    C.assert(b, 'Caixinha não encontrada.');
    const filter = {
      start: p.get('inicio') || '',
      end: p.get('fim') || '',
      type: p.get('tipo') || ''
    };
    const rows = b.entries.filter(r => (!filter.start || K.day(r.at) >= filter.start) && (!filter.end || K.day(r.at) <= filter.end) && (!filter.type || r.type === filter.type));
    return U.page(b.name, b.status === 'ENCERRADA' ? 'Caixinha encerrada · somente consulta.' : 'Deposite e resgate a qualquer momento. O rendimento só é creditado no aniversário.', U.balance(s) + U.card('Resumo', `${U.badge(b.status)}<p class="metric">${U.money(b.balance)}</p><p>Meta: ${U.money(b.goal)} · ${U.e(b.target || 'Sem data-alvo')}<br>Aniversário: ${U.e(b.nextBirthday)}<br>Taxa fictícia diária: 0,0165%, apurada por saldo e tempo, com crédito mensal.</p><progress value="${b.balance}" max="${b.goal}"></progress>` + (b.status !== 'ENCERRADA' ? '<div class="actions">' + ['DEPOSITO', 'RESGATE'].map(type => U.action(type === 'DEPOSITO' ? 'Depositar' : 'Resgatar', () => U.modal(type === 'DEPOSITO' ? 'Depositar na caixinha' : 'Resgatar para a conta de origem', U.form(U.field('value', 'Valor', '100.00'), d => {
      C.Db.transaction(x => move(x, b.id, M.parse(d.value), type));
      U.done(type === 'DEPOSITO' ? 'Depósito realizado com sucesso.' : 'Resgate realizado com sucesso.');
    }, 'Confirmar')), 'secondary')).join('') + U.action('Encerrar caixinha', () => U.modal('Confirmar encerramento', `<p>Todo o saldo de ${U.money(b.balance)} será resgatado para a conta de origem. O histórico continuará disponível.</p>` + U.action('Confirmar encerramento', () => {
      C.Db.transaction(x => close(x, b.id));
      U.done('Caixinha encerrada com sucesso. Consulte o histórico abaixo.');
    }, 'danger')), 'danger') + '</div>' : '')) + U.card('Extrato da caixinha', U.form('<div class="fields">' + U.field('start', 'Data inicial', filter.start, 'date') + U.field('end', 'Data final', filter.end, 'date') + U.select('type', 'Movimento', [['', 'Todos'], 'DEPOSITO', 'RESGATE', 'RENDIMENTO'], filter.type) + '</div>', d => {
      C.assert(!d.start || !d.end || d.start <= d.end, 'A data inicial não pode ser posterior à final.', 'PeriodoInvalido');
      C.Router.go('caixinha?id=' + b.id + '&inicio=' + d.start + '&fim=' + d.end + '&tipo=' + d.type);
    }, 'Filtrar', 'secondary') + U.table(['Data', 'Tipo', 'Valor', 'Saldo após'], rows.map(r => [U.e(K.label(r.at)), U.e(r.type), U.money(r.value), U.money(r.balance)]))) + U.card('Histórico de situações', U.history(b)) + U.link('caixinhas', 'Todas as caixinhas') + U.link('investimentos', 'Voltar a investimentos'), 'F13b · RN3–RN10');
  }, null);
})(Cesbank);
