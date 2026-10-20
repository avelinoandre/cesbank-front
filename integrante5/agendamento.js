/* Integrante 5 · F4 RN1–RN8; motor compartilhado com F3 RN8/RN9. */
(function (C) {
  'use strict';

  // Constantes e frequências
  const U = C.UI,
    K = C.Clock;
  const frequencies = ['SEMANAL', 'QUINZENAL', 'MENSAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'];

  // Datas e operações de agendamento
  function occurrenceDate(base, freq, n) {
    return freq === 'SEMANAL'
      ? K.addDays(base, 7 * n)
      : freq === 'QUINZENAL'
        ? K.addDays(base, 14 * n)
        : K.months(
          base,
          ({
            MENSAL: 1,
            BIMESTRAL: 2,
            TRIMESTRAL: 3,
            SEMESTRAL: 6,
            ANUAL: 12
          }[freq] || 0) * n
        );
  }

  function create(s, d, internal = false) {
    if (!internal) C.Session.requireClient(s);

    C.assert(C.V.date(d.date) && d.date > K.day(s.now), 'A data de execução deve ser posterior à data corrente.');

    if (d.kind === 'BOLETO') C.S.boleto.validateSchedule(s, d.payload.id, d.date);
    else C.S.destination(s, d.payload, false);

    const recurring = d.recurring === 'SIM';

    if (recurring) {
      C.assert(frequencies.includes(d.frequency), 'Escolha uma frequência válida.');
      C.assert(
        d.count && /^\d+$/.test(String(d.count)) && Number(d.count) > 0 && Number(d.count) <= 120 ||
          C.V.date(d.until) && d.until >= d.date,
        'Informe até 120 ocorrências ou uma data-limite válida.'
      );
    }

    const group = C.Ids.uuid(),
      limit = recurring ? d.count ? Number(d.count) : 120 : 1;
    let added = 0;

    for (let i = 0; i < limit; i++) {
      const requested = occurrenceDate(d.date, d.frequency || 'MENSAL', i);

      if (recurring && d.until && requested > d.until) break;

      const date = K.adjust(requested, d.previous === 'SIM');

      C.assert(
        date > K.day(s.now),
        'O ajuste para dia útil anterior não pode resultar em data corrente ou passada.'
      );

      if (d.kind === 'BOLETO') C.S.boleto.validateSchedule(s, d.payload.id, date);

      s.schedules.push(
        {
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
          history: [
            {
              at: s.now,
              to: 'PENDENTE',
              actor: s.session.client,
              detail: 'Registro sem reserva de saldo ou limite.'
            }
          ]
        }
      );
      added++;
    }

    C.assert(added, 'A recorrência não possui ocorrências válidas.');
    C.S.audit(s, 'agendamento', group, added + ' ocorrência(s) criada(s).');

    return group;
  }

  function cancel(s, id, series = false) {
    const row = C.S.owner(s, s.schedules.find(r => r.id === id));

    if (!series) C.assert(
      row.status === 'PENDENTE' && K.day(s.now) < row.date,
      'Cancele uma ocorrência pendente até a véspera da execução.'
    );

    s.schedules.filter(r => series ? r.series === row.series && r.status === 'PENDENTE' : r.id === id).forEach(
      r => C.S.transition(s, r, 'schedule', 'CANCELADA', series ? 'Recorrência encerrada.' : 'Cancelada até a véspera.')
    );
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

      return C.S.transfer.execute(
        s,
        {
          ...row.payload,
          value: row.value,
          requestId: row.requestId
        }
      );
    } finally {
      s.session = old;
    }
  }

  // Serviço compartilhado
  C.S.schedules = {
    create,
    cancel,
    occurrenceDate
  };
  // Processamento das ocorrências e novas tentativas
  C.processors.push(
    s => {
      s.schedules.filter(r => r.status === 'PENDENTE' && r.nextAttempt <= s.now).map(r => r.id).forEach(
        id => {
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

            row.attempts.push(
              {
                at: s.now,
                result: ex.code || 'ValidacaoDaRegra',
                detail: ex.message
              }
            );

            const next = new Date(new Date(s.now).getTime() + 7200000).toISOString().replace(/\.\d{3}Z$/, 'Z');
            const retry = row.attempts.length < C.policy.retries &&
              K.day(next) === row.date && (
              row.kind !== 'BOLETO' || ex.code === 'SaldoInsuficiente');

            if (retry) row.nextAttempt = next;
            else {
              C.S.transition(s, row, 'schedule', 'FALHADA', ex.message);
              C.S.notify(
                s,
                C.S.accounts.account(s, row.account).client,
                'Falha definitiva de agendamento após ' + row.attempts.length + ' tentativa(s): ' + ex.message
              );
            }
          }
        }
      );
    }
  );
  // Exemplos preenchem o formulário sem criar operações automaticamente.
  function examples(s) {
    const recipient = s.accounts.find(account => account.status === 'ATIVA' && account.id !== s.session.account);
    if (!recipient) return '';

    const person = C.S.accounts.client(s, recipient.client);
    const key = s.keys.find(row => row.account === recipient.id && row.status === 'ATIVA' && row.type === 'EMAIL');
    const tomorrow = K.addDays(K.day(s.now), 1);
    const options = [
      ['Pagamento avulso', 'R$ 50,00 para ' + person.name + ', com uma única execução amanhã.', '50.00', key ? 'PIX' : 'DADOS_BANCARIOS', 'NAO', ''],
      ['Pagamento mensal', 'R$ 150,00 por mês, durante 3 ocorrências. Mostre a lista e o encerramento da recorrência.', '150.00', key ? 'PIX' : 'DADOS_BANCARIOS', 'SIM', '3'],
      ['Por dados bancários', 'R$ 90,00 usando agência e conta. Compare esta forma de destino com o Pix.', '90.00', 'DADOS_BANCARIOS', 'NAO', '']
    ];

    return U.card('Exemplos para demonstrar', '<p>Os exemplos apenas preenchem os campos. Revise e clique em Agendar para criar. A data acompanha o relógio da demonstração.</p><div class="i5-examples">' +
      options.map(([title, text, value, method, recurring, count]) => '<article><h3>' + title + '</h3><p>' + U.e(text) + '</p>' +
        U.action('Usar exemplo: ' + title, () => {
          const form = document.querySelector('#content form');
          const values = { date: tomorrow, value, method, key: key?.value || '', branch: recipient.branch, number: recipient.number, previous: 'NAO', recurring, frequency: 'MENSAL', count, until: '' };

          Object.entries(values).forEach(([name, value]) => {
            form.elements.namedItem(name).value = value;
          });
          form.scrollIntoView({ behavior: 'smooth', block: 'center' });
          form.elements.namedItem('value').focus({ preventScroll: true });
          U.flash('Exemplo preenchido. Revise os dados e clique em Agendar.');
        }, 'secondary') + '</article>'
      ).join('') + '</div>');
  }

  // Cadastro e acompanhamento têm espaços separados na mesma página.
  function newSchedule(s) {
    return U.card(
      'Novo agendamento de transferência',
      U.form(
        '<div class="fields">' +
          U.field('date', 'Data futura', K.addDays(K.day(s.now), 1), 'date') +
          U.field('value', 'Valor', '100.00') +
          U.select('method', 'Destino', [
            ['PIX', 'Chave Pix'],
            ['DADOS_BANCARIOS', 'Dados bancários']
          ]) +
          U.field('key', 'Chave Pix', 'joao@cesbank.com') +
          U.field('branch', 'Agência', '0001') +
          U.field('number', 'Conta', '0007654322') +
          U.select('previous', 'Dia não útil', [
            ['NAO', 'Próximo dia útil'],
            ['SIM', 'Dia útil anterior']
          ]) +
          U.select('recurring', 'Recorrência', [
            ['NAO', 'Avulso'],
            ['SIM', 'Recorrente']
          ]) +
          U.select('frequency', 'Frequência', frequencies) +
          U.field('count', 'Número de ocorrências (ou deixe vazio para usar data-limite)', '', 'number') +
          U.field('until', 'Data-limite opcional', '', 'date') +
          '</div>',
        d => {
          C.Db.transaction(
            x => create(
              x,
              {
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
              }
            )
          );
          C.Router.go('agendamentos?aba=ocorrencias');
          U.done('Agendamento criado sem bloquear saldo ou consumir limite.');
        },
        'Agendar'
      )
    );
  }

  function occurrenceActions(s, r) {
    let actions = '';

    if (r.status === 'PENDENTE') {
      actions += U.action(
        'Editar',
        () => U.modal(
          'Alterar ocorrência pendente',
          U.form(
            U.field('date', 'Data', r.date, 'date') +
              U.field('value', 'Valor', C.M.decimal(r.value)) + (
              r.kind === 'TRANSFERENCIA'
                ? U.select(
                  'method',
                  'Forma de destino',
                  [
                    ['PIX', 'Pix'],
                    ['DADOS_BANCARIOS', 'Dados bancários']
                  ],
                  r.payload.method
                ) +
                  U.field('key', 'Chave Pix', r.payload.key || '') +
                  U.field('institution', 'Instituição', r.payload.institution || '12345678') +
                  U.field('branch', 'Agência', r.payload.branch || '0001') +
                  U.field('number', 'Conta', r.payload.number || '')
                : ''),
            d => {
              C.Db.transaction(
                x => {
                  const row = C.S.owner(x, x.schedules.find(v => v.id === r.id));

                  C.assert(row.status === 'PENDENTE', 'Ocorrência executada ou encerrada é imutável.');
                  C.assert(C.V.date(d.date) && d.date > K.day(x.now), 'Data de execução futura obrigatória.');

                  const date = K.adjust(d.date);

                  if (row.kind === 'BOLETO') C.S.boleto.validateSchedule(x, row.payload.id, date);
                  else {
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
                }
              );
              U.done('Ocorrência atualizada.');
            },
            'Salvar'
          )
        ),
        'secondary'
      );

      if (K.day(s.now) < r.date) {
        actions += U.action('Cancelar só esta ocorrência', () => {
          U.modal('Cancelar esta ocorrência?',
            '<p>Somente o pagamento de <strong>' + U.e(r.date) + '</strong> será cancelado. ' + (r.recurring ? 'As outras ocorrências da recorrência continuam agendadas.' : 'Este é um agendamento avulso, sem outras ocorrências.') + '</p>' +
            U.action('Confirmar cancelamento desta ocorrência', () => {
              C.Db.transaction(x => cancel(x, r.id));
              U.done(r.recurring ? 'Ocorrência cancelada. As demais datas da recorrência foram preservadas.' : 'Agendamento avulso cancelado.');
            }, 'danger'));
        }, 'danger');
      }

      if (r.recurring) {
        actions += U.action('Encerrar toda a recorrência', () => {
          U.modal('Encerrar toda a recorrência?',
            '<p>Todas as ocorrências pendentes desta série serão canceladas. Os pagamentos já executados e seus comprovantes serão preservados.</p>' +
            U.action('Confirmar encerramento da recorrência', () => {
              C.Db.transaction(x => cancel(x, r.id, true));
              U.done('Recorrência encerrada. Todas as suas ocorrências pendentes foram canceladas.');
            }, 'danger'));
        }, 'danger');
      }
    }

    if (r.transaction) actions += U.link('comprovante?id=' + r.transaction, 'Comprovante');

    return '<div class="i5-occurrence-actions">' + actions + '</div>';
  }

  // A consulta completa fica em um card separado, sem expandir a linha da tabela.
  function occurrenceDetails(id) {
    const s = C.Db.get();
    const r = C.S.owner(s, s.schedules.find(row => row.id === id));
    const statusLabels = { PENDENTE: 'Pendente', EXECUTADA: 'Executada', CANCELADA: 'Cancelada', FALHADA: 'Falhada' };
    const account = s.accounts.find(row => row.id === r.account);
    const transaction = s.transactions.find(row => row.id === r.transaction);
    const fields = entries => '<dl class="i5-detail-fields">' + entries.map(([label, value]) =>
      '<div><dt>' + U.e(label) + '</dt><dd>' + U.e(value ?? 'Não informado') + '</dd></div>'
    ).join('') + '</dl>';
    const summary = [
      ['Valor', C.M.fmt(r.value)],
      ['Situação', statusLabels[r.status] || r.status],
      ['Data solicitada', r.requested],
      ['Data de execução ajustada', r.date],
      ['Agendamento', r.recurring ? 'Recorrente · ' + r.frequency : 'Avulso'],
      ['Número da ocorrência', r.number],
      ['Conta de origem', 'Agência ' + account.branch + ' · conta ' + account.number],
      ['Próxima tentativa', r.status === 'PENDENTE' ? K.label(r.nextAttempt) : 'Não há tentativa pendente']
    ];
    const destination = r.kind === 'BOLETO'
      ? [['Forma de pagamento', 'Boleto'], ['Boleto', r.payload.id], ['Descrição', s.boletos.find(row => row.id === r.payload.id)?.label]]
      : r.payload.method === 'PIX'
        ? [['Forma de destino', 'Pix'], ['Chave Pix', r.payload.key]]
        : [['Forma de destino', 'Dados bancários'], ['Instituição', r.payload.institution], ['Agência', r.payload.branch], ['Conta', r.payload.number]];

    if (transaction?.receiver) {
      destination.push(['Recebedor', transaction.receiver.name], ['Documento do recebedor', transaction.receiver.document]);
    }

    const history = r.history.length
      ? '<ol class="i5-detail-timeline">' + r.history.map(item => '<li><strong>' + U.e(statusLabels[item.to] || item.to) + '</strong><small>' +
        U.e(K.label(item.at)) + ' · ' + U.e(item.actor) + '</small><p>' + U.e(item.detail || 'Atualização da situação da ocorrência.') + '</p></li>').join('') + '</ol>'
      : '<p>Nenhuma alteração registrada.</p>';
    const attempts = r.attempts.length
      ? '<ol class="i5-detail-timeline">' + r.attempts.map((attempt, index) => '<li><strong>Tentativa ' + (index + 1) + ' · ' + U.e(attempt.result) + '</strong><small>' +
        U.e(K.label(attempt.at)) + '</small><p>' + U.e(attempt.detail || 'Pagamento executado com sucesso.') + '</p>' +
        (attempt.transaction ? '<small>Transação: ' + U.e(attempt.transaction) + '</small>' : '') + '</li>').join('') + '</ol>'
      : '<p>Nenhuma tentativa de execução realizada.</p>';

    U.modal('Detalhes da ocorrência', '<div class="i5-occurrence-detail">' +
      '<div class="i5-detail-top"><span class="i5-status" data-status="' + U.e(r.status) + '">' + U.e(statusLabels[r.status] || r.status) + '</span>' +
      U.action('Fechar detalhes', U.close, 'secondary') + '</div>' +
      U.card('Resumo do agendamento', fields(summary)) +
      U.card('Destino do pagamento', fields(destination)) +
      U.card('Histórico da ocorrência', history) +
      U.card('Tentativas de execução · ' + r.attempts.length, attempts) +
      U.card('Identificadores', fields([['Ocorrência', r.id], ['Série', r.series], ['Requisição', r.requestId], ['Transação gerada', r.transaction || 'Nenhuma transação gerada']])) +
      (r.status === 'PENDENTE' || r.transaction ? U.card('Ações disponíveis', occurrenceActions(s, r)) : '') + '</div>');
  }

  function occurrencePanel(s, p) {
    const own = s.schedules.filter(r => r.account === s.session.account);
    const status = p.get('situacao') || 'PENDENTE';
    const kind = p.get('tipo') || '';
    const start = p.get('de') || '';
    const end = p.get('ate') || '';
    const destination = p.get('destino') || '';
    const labels = { PENDENTE: 'Pendente', EXECUTADA: 'Executada', CANCELADA: 'Cancelada', FALHADA: 'Falhada' };
    const descriptions = {
      PENDENTE: 'Aguardando execução na data agendada.',
      EXECUTADA: 'Pagamento realizado. Consulte o comprovante.',
      CANCELADA: 'Cancelamento concluído. Não será executada.',
      FALHADA: 'Tentativas encerradas sem efetivar o pagamento.'
    };
    const list = own.filter(r =>
      (status === 'TODAS' || r.status === status) &&
      (!kind || (kind === 'RECORRENTE' ? r.recurring : !r.recurring)) &&
      (!start || r.date >= start) && (!end || r.date <= end) &&
      (!destination || String(r.payload.key || r.payload.number || r.payload.id || '').toLowerCase().includes(destination.toLowerCase()))
    ).sort((a, b) => a.date.localeCompare(b.date) || a.number - b.number);

    const counts = '<div class="i5-status-summary">' + Object.entries(labels).map(([value, label]) =>
      '<a class="i5-status-count ' + (status === value ? 'active' : '') + '" href="#agendamentos?' + U.e(new URLSearchParams({ ...Object.fromEntries(p), aba: 'ocorrencias', situacao: value }).toString()) + '">' +
      '<strong>' + own.filter(r => r.status === value).length + '</strong><span>' + label + 's</span></a>'
    ).join('') + '</div>';

    const filters = U.form('<div class="fields">' +
      U.select('status', 'Situação da ocorrência', [['TODAS', 'Todas as situações'], ...Object.entries(labels)], status) +
      U.select('kind', 'Forma de agendamento', [['', 'Avulsos e recorrentes'], ['AVULSO', 'Avulso'], ['RECORRENTE', 'Recorrente']], kind) +
      U.field('start', 'Execução a partir de', start, 'date') +
      U.field('end', 'Execução até', end, 'date') +
      U.field('destination', 'Buscar destino (chave, conta ou boleto)', destination) + '</div>', d => {
        C.assert(!d.start || C.V.date(d.start), 'Informe uma data inicial válida.');
        C.assert(!d.end || C.V.date(d.end), 'Informe uma data final válida.');
        C.assert(!d.start || !d.end || d.start <= d.end, 'A data inicial não pode ser posterior à final.');
        C.Router.go('agendamentos?' + new URLSearchParams({ aba: 'ocorrencias', situacao: d.status, tipo: d.kind, de: d.start, ate: d.end, destino: d.destination }));
      }, 'Filtrar ocorrências', 'secondary');

    const controls = filters.replace('</div></form>', U.link('agendamentos?aba=ocorrencias&situacao=TODAS', 'Limpar filtros') + '</div></form>');

    return counts + U.card('Filtros das ocorrências', controls) +
      U.card('Ocorrências · ' + list.length + ' resultado(s)',
        '<p>Pendente significa que o pagamento ainda aguarda execução. Cancelar uma ocorrência afeta apenas uma data; encerrar a recorrência cancela todas as datas ainda pendentes da série.</p>' +
        (list.length ? U.table(['Execução / série', 'Destino', 'Valor', 'Situação', 'Detalhes'], list.map(r => [
          U.e(r.date) + '<small>' + (r.recurring ? 'Recorrente · ' + U.e(r.frequency) : 'Avulso') + ' · ocorrência ' + r.number + '</small><small>Série ' + U.e(r.series.slice(0, 8)) + '</small>',
          U.e(r.payload.key || r.payload.number || r.payload.id) + '<small>' + (r.kind === 'BOLETO' ? 'Boleto' : 'Transferência') + '</small>',
          U.money(r.value),
          '<span class="i5-status" data-status="' + U.e(r.status) + '">' + U.e(labels[r.status] || r.status) + '</span><small>' + U.e(descriptions[r.status]) + '</small>',
          '<div class="i5-row-details">' + U.action('Detalhes', () => occurrenceDetails(r.id), 'secondary') + '</div>'
        ])) : '<div class="empty">Nenhuma ocorrência corresponde aos filtros selecionados.</div>'), 'i5-occurrences');
  }

  // Navegação entre o formulário e a consulta de ocorrências.
  C.Router.register('agendamentos', 'Agendamentos', (s, p) => {
    const occurrences = p.get('aba') === 'ocorrencias';
    const count = s.schedules.filter(r => r.account === s.session.account).length;
    const tabs = '<nav class="i5-tabs" aria-label="Seções de agendamentos">' +
      '<a href="#agendamentos" ' + (!occurrences ? 'aria-current="page"' : '') + '>Novo agendamento</a>' +
      '<a href="#agendamentos?aba=ocorrencias" ' + (occurrences ? 'aria-current="page"' : '') + '>Ocorrências (' + count + ')</a></nav>';

    return U.page('Agendamentos e recorrências',
      'Saldo e limites são consultados somente na execução; falhas não cancelam ocorrências futuras.',
      tabs + (occurrences ? occurrencePanel(s, p) : U.balance(s) + examples(s) + newSchedule(s)),
      'F4 · RN1–RN8 · F3 RN8/RN9');
  }, 'Movimentar');
})(Cesbank);
