/* Integrante 5 · F4 RN1–RN8; motor compartilhado com F3 RN8/RN9. */
(function (C) {
  'use strict';

  const U = C.UI,
    K = C.Clock;
  const frequencies = ['SEMANAL', 'QUINZENAL', 'MENSAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'];
  function occurrenceDate(base, freq, n) {
    return freq === 'SEMANAL' ? K.addDays(base, 7 * n) : freq === 'QUINZENAL' ? K.addDays(base, 14 * n) : K.months(base, ({
      MENSAL: 1,
      BIMESTRAL: 2,
      TRIMESTRAL: 3,
      SEMESTRAL: 6,
      ANUAL: 12
    }[freq] || 0) * n);
  }
  function create(s, d, internal = false) {
    if (!internal) C.Session.requireClient(s);
    C.assert(C.V.date(d.date) && d.date > K.day(s.now), 'A data de execução deve ser posterior à data corrente.');
    if (d.kind === 'BOLETO') C.S.boleto.validateSchedule(s, d.payload.id, d.date);else C.S.destination(s, d.payload, false);
    const recurring = d.recurring === 'SIM';
    if (recurring) {
      C.assert(frequencies.includes(d.frequency), 'Escolha uma frequência válida.');
      C.assert(d.count && /^\d+$/.test(String(d.count)) && Number(d.count) > 0 && Number(d.count) <= 120 || C.V.date(d.until) && d.until >= d.date, 'Informe até 120 ocorrências ou uma data-limite válida.');
    }
    const group = C.Ids.uuid(),
      limit = recurring ? d.count ? Number(d.count) : 120 : 1;
    let added = 0;
    for (let i = 0; i < limit; i++) {
      const requested = occurrenceDate(d.date, d.frequency || 'MENSAL', i);
      if (recurring && d.until && requested > d.until) break;
      const date = K.adjust(requested, d.previous === 'SIM');
      C.assert(date > K.day(s.now), 'O ajuste para dia útil anterior não pode resultar em data corrente ou passada.');
      if (d.kind === 'BOLETO') C.S.boleto.validateSchedule(s, d.payload.id, date);
      s.schedules.push({
        id: C.Ids.uuid(),
        series: group,
        account: s.session.account,
        kind: d.kind || 'TRANSFERENCIA',
        payload: C.Db.clone(d.payload),
        value: d.value,
        requested,
        date,
        nextAttempt: K.at(date, 10),
        status: 'PENDENTE',
        attempts: [],
        requestId: C.Ids.uuid(),
        recurring,
        frequency: d.frequency || null,
        number: i + 1,
        history: [{
          at: s.now,
          to: 'PENDENTE',
          actor: s.session.client,
          detail: 'Registro sem reserva de saldo ou limite.'
        }]
      });
      added++;
    }
    C.assert(added, 'A recorrência não possui ocorrências válidas.');
    C.S.audit(s, 'agendamento', group, added + ' ocorrência(s) criada(s).');
    return group;
  }
  function cancel(s, id, series = false) {
    const row = C.S.owner(s, s.schedules.find(r => r.id === id));
    if (!series) C.assert(row.status === 'PENDENTE' && K.day(s.now) < row.date, 'Cancele uma ocorrência pendente até a véspera da execução.');
    s.schedules.filter(r => series ? r.series === row.series && r.status === 'PENDENTE' : r.id === id).forEach(r => C.S.transition(s, r, 'schedule', 'CANCELADA', series ? 'Recorrência encerrada.' : 'Cancelada até a véspera.'));
  }
  function execute(s, row) {
    const old = s.session;
    s.session = {
      client: C.S.accounts.account(s, row.account).client,
      account: row.account,
      role: 'CLIENTE'
    };
    try {
      if (row.kind === 'BOLETO') return C.S.boleto.execute(s, row.payload.id, row.requestId);
      return C.S.transfer.execute(s, {
        ...row.payload,
        value: row.value,
        requestId: row.requestId
      });
    } finally {
      s.session = old;
    }
  }
  C.S.schedules = {
    create,
    cancel,
    occurrenceDate
  };
  C.processors.push(s => {
    s.schedules.filter(r => r.status === 'PENDENTE' && r.nextAttempt <= s.now).map(r => r.id).forEach(id => {
      let row = s.schedules.find(r => r.id === id);
      if (!row || row.status !== 'PENDENTE') return;
      const checkpoint = C.Db.clone(s);
      try {
        const tx = execute(s, row);
        C.assert(tx.status === 'EFETIVADA', 'A execução foi estornada por falha operacional.');
        row.attempts.push({
          at: s.now,
          result: 'SUCESSO',
          transaction: tx.id
        });
        row.transaction = tx.id;
        C.S.transition(s, row, 'schedule', 'EXECUTADA');
      } catch (ex) {
        // A tentativa não pode deixar débitos parciais. Falhas com estorno já possuem trilha financeira completa.
        if (!s.transactions.some(t => t.requestId === row.requestId && t.status === 'DEVOLVIDA')) {
          Object.keys(s).forEach(k => delete s[k]);
          Object.assign(s, checkpoint);
          row = s.schedules.find(r => r.id === id);
        }
        row.attempts.push({
          at: s.now,
          result: ex.code || 'ValidacaoDaRegra',
          detail: ex.message
        });
        const next = new Date(new Date(s.now).getTime() + 7200000).toISOString().replace(/\.\d{3}Z$/, 'Z');
        const retry = row.attempts.length < C.policy.retries && K.day(next) === row.date && (row.kind !== 'BOLETO' || ex.code === 'SaldoInsuficiente');
        if (retry) row.nextAttempt = next;else {
          C.S.transition(s, row, 'schedule', 'FALHADA', ex.message);
          C.S.notify(s, C.S.accounts.account(s, row.account).client, 'Falha definitiva de agendamento após ' + row.attempts.length + ' tentativa(s): ' + ex.message);
        }
      }
    });
  });
  C.Router.register('agendamentos', 'Agendamentos', s => U.page('Agendamentos e recorrências', 'Saldo e limites são consultados somente na execução; falhas não cancelam ocorrências futuras.', U.balance(s) + U.card('Novo agendamento de transferência', U.form('<div class="fields">' + U.field('date', 'Data futura', K.addDays(K.day(s.now), 1), 'date') + U.field('value', 'Valor', '100.00') + U.select('method', 'Destino', [['PIX', 'Chave Pix'], ['DADOS_BANCARIOS', 'Dados bancários']]) + U.field('key', 'Chave Pix', 'joao@cesbank.com') + U.field('branch', 'Agência', '0001') + U.field('number', 'Conta', '0007654322') + U.select('previous', 'Dia não útil', [['NAO', 'Próximo dia útil'], ['SIM', 'Dia útil anterior']]) + U.select('recurring', 'Recorrência', [['NAO', 'Avulso'], ['SIM', 'Recorrente']]) + U.select('frequency', 'Frequência', frequencies) + U.field('count', 'Número de ocorrências (ou deixe vazio para usar data-limite)', '', 'number') + U.field('until', 'Data-limite opcional', '', 'date') + '</div>', d => {
    C.Db.transaction(x => create(x, {
      ...d,
      value: C.M.parse(d.value),
      kind: 'TRANSFERENCIA',
      payload: {
        method: d.method,
        key: d.key,
        branch: d.branch,
        number: d.number,
        institution: '12345678'
      }
    }));
    U.done('Agendamento criado sem bloquear saldo ou consumir limite.');
  }, 'Agendar')) + U.card('Ocorrências', U.table(['Data / série', 'Tipo / destino', 'Valor', 'Situação', 'Ações e tentativas'], s.schedules.filter(r => r.account === s.session.account).map(r => [U.e(r.date) + `<small>Solicitada: ${U.e(r.requested)} · ocorrência ${r.number}</small>`, U.e(r.kind) + `<small>${U.e(r.payload.key || r.payload.id || r.payload.number)}</small>`, U.money(r.value), U.badge(r.status), (r.status === 'PENDENTE' ? U.action('Editar', () => U.modal('Alterar ocorrência pendente', U.form(U.field('date', 'Data', r.date, 'date') + U.field('value', 'Valor', C.M.decimal(r.value)) + (r.kind === 'TRANSFERENCIA' ? U.select('method', 'Forma de destino', [['PIX', 'Pix'], ['DADOS_BANCARIOS', 'Dados bancários']], r.payload.method) + U.field('key', 'Chave Pix', r.payload.key || '') + U.field('institution', 'Instituição', r.payload.institution || '12345678') + U.field('branch', 'Agência', r.payload.branch || '0001') + U.field('number', 'Conta', r.payload.number || '') : ''), d => {
    C.Db.transaction(x => {
      const row = C.S.owner(x, x.schedules.find(v => v.id === r.id));
      C.assert(row.status === 'PENDENTE', 'Ocorrência executada ou encerrada é imutável.');
      C.assert(C.V.date(d.date) && d.date > K.day(x.now), 'Data de execução futura obrigatória.');
      const date = K.adjust(d.date);
      if (row.kind === 'BOLETO') C.S.boleto.validateSchedule(x, row.payload.id, date);else {
        row.payload = {
          ...row.payload,
          method: d.method,
          key: d.key,
          institution: d.institution,
          branch: d.branch,
          number: d.number
        };
        C.S.destination(x, row.payload, false);
      }
      row.date = date;
      row.value = C.M.parse(d.value);
      row.nextAttempt = K.at(date, 10);
      C.S.audit(x, 'agendamento', row.id, 'Valor, data ou destino alterados antes da execução.');
    });
    U.done('Ocorrência atualizada.');
  }, 'Salvar')), 'secondary') + U.action('Cancelar ocorrência', () => {
    C.Db.transaction(x => cancel(x, r.id));
    U.done('Ocorrência cancelada.');
  }, 'danger') + (r.recurring ? U.action('Encerrar recorrência', () => {
    C.Db.transaction(x => cancel(x, r.id, true));
    U.done('Recorrência encerrada; ocorrências executadas preservadas.');
  }, 'danger') : '') : '') + (r.transaction ? U.link('comprovante?id=' + r.transaction, 'Comprovante') : '') + U.json(r.attempts) + U.history(r)]))), 'F4 · RN1–RN8 · F3 RN8/RN9'), 'Movimentar');
})(Cesbank);
