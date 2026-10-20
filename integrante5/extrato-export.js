/* Integrante 5 · F14 RN1–RN8 · CSV/PDF sem bibliotecas, segunda via e backup local. */
(function (C) {
  'use strict';

  // Dependências e tipos de transação
  const U = C.UI,
    K = C.Clock;
  const types = [
    'PIX',
    'TED',
    'TRANSFERENCIA_MESMA_INSTITUICAO',
    'BOLETO',
    'SAQUE',
    'DEPOSITO',
    'CARTAO',
    'EMPRESTIMO',
    'TARIFA_SERVICOS_AVULSOS',
    'RENDIMENTO',
    'OUTROS'
  ];

  const typeLabels = {
    PIX: 'Pix',
    TED: 'TED',
    TRANSFERENCIA_MESMA_INSTITUICAO: 'Transferência interna',
    BOLETO: 'Boleto',
    SAQUE: 'Saque',
    DEPOSITO: 'Depósito',
    CARTAO: 'Cartão',
    EMPRESTIMO: 'Empréstimo',
    TARIFA_SERVICOS_AVULSOS: 'Tarifas',
    RENDIMENTO: 'Rendimento',
    OUTROS: 'Outros'
  };

  // Seleção por caixas de marcação, também acessível por teclado e celular.
  function typeOptions(selected) {
    return '<fieldset class="i5-types" aria-describedby="i5-types-help">' +
      '<legend>Tipos de transação</legend>' +
      '<p id="i5-types-help">Marque quantos tipos quiser. Sem seleção, todos os tipos são exibidos.</p>' +
      '<div class="i5-type-options">' + types.map(type =>
        `<label class="i5-type-option"><input type="checkbox" name="types" value="${type}" ${selected.includes(type) ? 'checked' : ''}><span>${typeLabels[type]}</span></label>`
      ).join('') + '</div><div class="actions">' +
      U.action('Marcar todos', () => setTypes(true), 'secondary') +
      U.action('Limpar seleção', () => setTypes(false), 'secondary') +
      '</div></fieldset>';
  }

  function setTypes(checked) {
    document.querySelectorAll('#content .i5-types input').forEach(input => {
      input.checked = checked;
    });
  }

  function examples(s) {
    const end = K.day(s.now);
    const start = K.months(end, -1);
    const options = [
      ['Visão geral', 'Veja entradas e saídas do último mês e experimente exportar em PDF ou CSV.', '', []],
      ['Entradas da conta', 'Mostre os depósitos recebidos e compare os filtros da tela com o arquivo exportado.', 'CREDITO', ['DEPOSITO']],
      ['Saídas da conta', 'Consulte os saques e abra uma operação para demonstrar a segunda via do comprovante.', 'DEBITO', ['SAQUE']]
    ];

    return U.card('Exemplos para demonstrar', '<p>Escolha um filtro pronto para consultar os dados fictícios da conta. Nenhuma movimentação é criada.</p><div class="i5-examples">' +
      options.map(([title, text, nature, selected]) => '<article><h3>' + title + '</h3><p>' + text + '</p>' +
        U.action('Usar exemplo: ' + title, () => {
          const params = new URLSearchParams({ inicio: start, fim: end, natureza: nature });
          selected.forEach(type => params.append('tipo', type));
          C.Router.go('extrato?' + params);
        }, 'secondary') + '</article>'
      ).join('') + '</div>');
  }

  // Filtros e seleção de lançamentos
  function filter(s, d) {
    const today = K.day(s.now),
      start = d.start || K.months(today, -1),
      end = d.end || today;

    C.assert(
      !d.start && !d.end || d.start && d.end,
      'Informada uma das datas, a outra passa a ser obrigatória.',
      'PeriodoInvalido'
    );
    C.assert(
      C.V.date(start) &&
        C.V.date(end) &&
        start <= end &&
        end <= today &&
        start >= K.months(today, -12) &&
        end <= K.months(start, 12),
      'O período deve ser válido, de até 12 meses e dentro dos últimos 12 meses.',
      'PeriodoInvalido'
    );

    const selected = Array.isArray(d.types) ? d.types : d.types ? [d.types] : [];

    C.assert(selected.every(t => types.includes(t)), 'Tipo de transação inválido.');

    return {
      start,
      end,
      types: selected,
      nature: d.nature || ''
    };
  }

  function rows(s, f) {
    return s.ledger.filter(
      r => r.account === s.session.account &&
        K.day(r.at) >= f.start &&
        K.day(r.at) <= f.end && (
        !f.types.length || f.types.includes(r.type)) && (
        !f.nature || r.nature === f.nature)
    );
  }

  // Geração dos arquivos CSV e PDF
  function csv(lines) {
    return '\uFEFF' +
      lines.map(row => row.map(cell => '"' + String(cell ?? '').replace(/"/g, '""') + '"').join(';')).join('\r\n');
  }

  function pdf(lines) {
    const ascii = v => String(v).replace(/[·—–]/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(
      /[^\x20-\x7E]/g,
      '?'
    );
    const chunks = [];

    lines.forEach(
      line => {
        let t = ascii(line);

        while (t.length > 100) {
          chunks.push(t.slice(0, 100));
          t = t.slice(100);
        }

        chunks.push(t);
      }
    );

    const pages = [];

    for (let i = 0; i < chunks.length; i += 43) pages.push(chunks.slice(i, i + 43));

    if (!pages.length) pages.push(['Sem lancamentos.']);

    const objects = [
      '',
      '<< /Type /Catalog /Pages 2 0 R >>',
      '',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>'
    ];
    const pageIds = [];

    pages.forEach(
      page => {
        const p = objects.length;

        pageIds.push(p);
        objects.push(
          `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${p + 1} 0 R >>`
        );

        const content = 'BT /F1 9 Tf 40 798 Td 16 TL ' +
          page.map((l, i) => (i ? 'T* ' : '') + '(' + l.replace(/([\\()])/g, '\\$1') + ') Tj').join('\n') +
          ' ET';

        objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
      }
    );
    objects[2] = `<< /Type /Pages /Kids [${pageIds.map(i => i + ' 0 R').join(' ')}] /Count ${pageIds.length} >>`;

    let out = '%PDF-1.4\n';
    const offsets = [0];

    for (let i = 1; i < objects.length; i++) {
      offsets[i] = out.length;
      out += `${i} 0 obj\n${objects[i]}\nendobj\n`;
    }

    const xref = out.length;

    out += `xref\n0 ${objects.length}\n0000000000 65535 f \n` +
      offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('') +
      `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

    return out;
  }

  // Download e registro da emissão
  function download(record) {
    C.assert(
      record.expires >= C.Db.get().now && record.content,
      'Arquivo descartado após 30 dias. Faça uma nova solicitação.'
    );

    const url = URL.createObjectURL(
      new Blob([record.content], {
        type: record.format === 'PDF' ? 'application/pdf' : 'text/csv;charset=utf-8'
      })
    );
    const a = document.createElement('a');

    a.href = url;
    a.download = 'cesbank-' + record.id + '.' + record.format.toLowerCase();
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function generate(s, f, format, transactionId) {
    C.Session.requireClient(s);
    C.assert(['PDF', 'CSV'].includes(format), 'Formato inválido.');

    const a = C.S.accounts.own(s);
    let selected = rows(s, f),
      receipt;

    if (transactionId) {
      const tx = s.transactions.find(t => t.id === transactionId && (t.from === a.id || t.to === a.id));

      C.assert(tx, 'Operação não encontrada ou de outro titular.');
      C.assert(
        tx.status === 'EFETIVADA' || tx.status === 'DEVOLVIDA',
        'Apenas operações concluídas possuem comprovante.'
      );
      receipt = C.Db.clone(tx.receipt || tx);
      selected = s.ledger.filter(r => r.transaction === tx.id && r.account === a.id);
    }

    const title = receipt ? 'SEGUNDA VIA DE COMPROVANTE' : 'EXTRATO DE CONTA';
    const heading = [
      [title],
      ['Protótipo · dados fictícios'],
      ['Conta', a.branch, a.number],
      ['Período', f.start, f.end],
      ['Filtros', f.types.join(', ') || 'TODOS', f.nature || 'TODAS'],
      ['Total de lançamentos', selected.length]
    ];
    const data = selected.map(
      r => [
        r.at,
        r.type,
        r.nature,
        C.M.decimal(r.value),
        'BRL',
        r.description,
        r.transaction,
        r.counterparty?.name || '',
        r.counterparty?.document || '',
        r.counterparty?.number || ''
      ]
    );
    const lines = [
      ...heading,
      [
        'Data',
        'Tipo',
        'Natureza',
        'Valor',
        'Moeda',
        'Descrição',
        'Identificador',
        'Contraparte',
        'Documento mascarado',
        'Conta truncada'
      ],
      ...data
    ];

    if (receipt) {
      lines.push(
        ['Operação original', receipt.id],
        ['Data e hora original', receipt.at],
        ['Valor original', C.M.decimal(receipt.value), 'BRL'],
        ['Forma de destino', receipt.resolution || 'Lançamento interno']
      );

      if (receipt.from) lines.push(['Origem', receipt.from.name, receipt.from.branch, receipt.from.number]);

      if (receipt.receiver) lines.push(['Recebedor', receipt.receiver.name, receipt.receiver.document, receipt.receiver.number]);

      if (receipt.line) lines.push(
        ['Linha digitável', receipt.line],
        ['Nominal', C.M.decimal(receipt.nominal), 'BRL'],
        ['Multa', C.M.decimal(receipt.fine || 0), 'BRL'],
        ['Juros', C.M.decimal(receipt.interest || 0), 'BRL'],
        ['Desconto', C.M.decimal(receipt.discount || 0), 'BRL'],
        ['Liquidação', receipt.settlementDate]
      );
    }

    const printable = heading.map(row => row.join(' | '));

    printable.push('', 'LANCAMENTOS', '');
    selected.forEach(
      (r, i) => {
        printable.push(
          String(i + 1) + '. ' + r.at + ' | ' + r.type + ' | ' + r.nature,
          'Valor: ' + C.M.decimal(r.value) + ' BRL | ' + r.description,
          'Identificador: ' + r.transaction
        );

        if (r.counterparty) printable.push(
          'Contraparte: ' +
            r.counterparty.name +
            ' | Documento: ' +
            r.counterparty.document +
            ' | Conta: ' +
            r.counterparty.number
        );

        printable.push('');
      }
    );

    if (receipt) {
      printable.push('SEGUNDA VIA - DADOS ORIGINAIS');
      lines.slice(heading.length + 1 + data.length).forEach(row => printable.push(row.join(' | ')));
    }

    const content = format === 'CSV' ? csv(lines) : pdf(printable);
    const record = {
      id: C.Ids.protocol(s),
      account: a.id,
      at: s.now,
      filters: C.Db.clone(f),
      format,
      transactionId: transactionId || null,
      expires: new Date(new Date(s.now).getTime() + C.policy.exportDays * 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
      content,
      receipt
    };

    s.exports.push(record);
    C.S.audit(
      s,
      'exportacao',
      record.id,
      JSON.stringify({
        filters: f,
        format,
        transactionId
      })
    );

    return record;
  }

  // Serviço compartilhado
  C.S.exports = {
    filter,
    rows,
    generate,
    download,
    pdf,
    csv
  };
  // Descarte de arquivos expirados
  C.processors.push(s => s.exports.forEach(r => {
    if (r.expires < s.now) r.content = null;
  }));
  // Histórico de arquivos tem filtros independentes dos lançamentos do extrato.
  function exportTabs(s, p) {
    const history = p.get('aba') === 'arquivos';
    const params = new URLSearchParams(p);
    params.delete('aba');
    const statement = 'extrato?' + params;
    params.set('aba', 'arquivos');
    const count = s.exports.filter(record => record.account === s.session.account).length;

    return '<nav class="i5-tabs" aria-label="Seções do extrato">' +
      '<a href="#' + U.e(statement) + '" ' + (!history ? 'aria-current="page"' : '') + '>Consultar extrato</a>' +
      '<a href="#extrato?' + U.e(params.toString()) + '" ' + (history ? 'aria-current="page"' : '') + '>Histórico de arquivos (' + count + ')</a></nav>';
  }

  // Exemplos geram somente arquivos: não criam nem alteram movimentações.
  function historyExamples(s, p) {
    const transaction = s.transactions.filter(row =>
      (row.from === s.session.account || row.to === s.session.account) &&
      ['EFETIVADA', 'DEVOLVIDA'].includes(row.status)
    ).sort((a, b) => b.at.localeCompare(a.at))[0];

    function createExample(receipt) {
      const record = C.Db.transaction(x => {
        const today = K.day(x.now);
        const f = filter(x, { start: K.months(today, -12), end: today });
        const generated = generate(x, f, receipt ? 'PDF' : 'CSV', receipt ? transaction.id : undefined);
        generated.example = true;
        return generated;
      });
      const params = new URLSearchParams(p);
      [...params.keys()].filter(key => key.startsWith('arquivo_')).forEach(key => params.delete(key));
      params.set('aba', 'arquivos');
      C.Router.go('extrato?' + params);
      U.done('Exemplo ' + record.id + ' salvo no histórico. Use Baixar novamente para abrir o arquivo.');
    }

    return U.card('Dois exemplos para o histórico',
      '<p>Gere arquivos com os dados fictícios da conta atual. Os exemplos ficam no histórico e podem ser baixados, sem criar pagamentos nem alterar saldos.</p>' +
      '<div class="i5-history-examples">' +
      '<article><span class="badge">CSV · EXTRATO</span><h3>Extrato da conta</h3><p>Entradas e saídas dos últimos 12 meses, com período, conta e total de lançamentos.</p>' +
      U.action('Gerar exemplo de extrato', () => createExample(false), 'secondary') + '</article>' +
      '<article><span class="badge">PDF · COMPROVANTE</span><h3>Segunda via de comprovante</h3><p>' +
      (transaction ? 'Reemita a operação “' + U.e(transaction.description) + '”, de ' + U.e(C.M.fmt(transaction.value)) + ', preservando os dados originais.' : 'Realize uma operação na conta para disponibilizar um comprovante de exemplo.') + '</p>' +
      (transaction ? U.action('Gerar exemplo de comprovante', () => createExample(true), 'secondary') : '<button type="button" class="secondary" disabled>Comprovante indisponível</button>') + '</article>' +
      '</div>');
  }

  function historyPanel(s, p) {
    const format = p.get('arquivo_formato') || '';
    const kind = p.get('arquivo_tipo') || '';
    const status = p.get('arquivo_status') || '';
    const start = p.get('arquivo_de') || '';
    const end = p.get('arquivo_ate') || '';
    const protocol = p.get('arquivo_protocolo') || '';
    const available = record => Boolean(record.content && record.expires >= s.now);
    const list = s.exports.filter(record => record.account === s.session.account &&
      (!format || record.format === format) &&
      (!kind || (kind === 'COMPROVANTE' ? record.transactionId : !record.transactionId)) &&
      (!status || (status === 'DISPONIVEL' ? available(record) : !available(record))) &&
      (!start || K.day(record.at) >= start) && (!end || K.day(record.at) <= end) &&
      (!protocol || record.id.toLowerCase().includes(protocol.toLowerCase()))
    ).sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));

    const fields = '<div class="fields">' +
      U.select('format', 'Formato do arquivo', [['', 'Todos os formatos'], 'PDF', 'CSV'], format) +
      U.select('kind', 'Tipo de documento', [['', 'Extratos e comprovantes'], ['EXTRATO', 'Extrato'], ['COMPROVANTE', 'Segunda via de comprovante']], kind) +
      U.select('status', 'Disponibilidade', [['', 'Todos os arquivos'], ['DISPONIVEL', 'Disponível para download'], ['EXPIRADO', 'Expirado']], status) +
      U.field('protocol', 'Buscar protocolo', protocol) +
      U.field('start', 'Gerado a partir de', start, 'date') +
      U.field('end', 'Gerado até', end, 'date') + '</div>';
    const filters = U.form(fields, d => {
      C.assert(!d.start || C.V.date(d.start), 'Informe uma data inicial válida.');
      C.assert(!d.end || C.V.date(d.end), 'Informe uma data final válida.');
      C.assert(!d.start || !d.end || d.start <= d.end, 'A data inicial não pode ser posterior à final.');
      const params = new URLSearchParams(p);
      params.set('aba', 'arquivos');
      Object.entries({ arquivo_formato: d.format, arquivo_tipo: d.kind, arquivo_status: d.status, arquivo_de: d.start, arquivo_ate: d.end, arquivo_protocolo: d.protocol }).forEach(([key, value]) => {
        if (value) params.set(key, value);
        else params.delete(key);
      });
      C.Router.go('extrato?' + params);
    }, 'Filtrar histórico', 'secondary');
    const clear = new URLSearchParams(p);
    [...clear.keys()].filter(key => key.startsWith('arquivo_')).forEach(key => clear.delete(key));
    clear.set('aba', 'arquivos');

    const controls = filters.replace('</div></form>', U.link('extrato?' + clear, 'Limpar filtros do histórico') + '</div></form>');

    return historyExamples(s, p) + U.card('Filtros do histórico de arquivos', '<p>Filtre pela data em que o arquivo foi gerado. Estes filtros não alteram os lançamentos do extrato.</p>' + controls) +
      U.card('Histórico e backup · ' + list.length + ' arquivo(s)',
        (list.length ? U.table(['Protocolo / geração', 'Documento / período', 'Formato', 'Disponibilidade', 'Arquivo'], list.map(record => [
          U.e(record.id) + '<small>' + U.e(K.label(record.at)) + '</small>',
          (record.transactionId ? 'Segunda via de comprovante' : 'Extrato') + (record.example ? ' <span class="badge">Exemplo</span>' : '') + '<small>' + U.e(record.filters.start) + ' a ' + U.e(record.filters.end) + '</small>' +
            '<details><summary>Filtros da emissão</summary><p>Tipos: ' + U.e(record.filters.types.map(type => typeLabels[type] || type).join(', ') || 'Todos') + '<br>Natureza: ' + U.e(record.filters.nature || 'Créditos e débitos') + '</p></details>',
          U.e(record.format),
          available(record) ? U.badge('DISPONIVEL') + '<small>Até ' + U.e(K.label(record.expires)) + '</small>' : U.badge('EXPIRADO') + '<small>Solicite um novo arquivo na consulta do extrato.</small>',
          available(record) ? U.action('Baixar novamente', () => download(record), 'secondary') : U.link('extrato', 'Consultar para emitir novamente')
        ])) : '<div class="empty">Nenhum arquivo corresponde aos filtros selecionados. Para gerar arquivos, acesse Consultar extrato e exporte em PDF ou CSV.</div>'), 'i5-file-history');
  }

  // Tela de extrato e histórico de arquivos
  C.Router.register(
    'extrato',
    'Extrato e comprovantes',
    (s, p) => {
      const input = {
        start: p.get('inicio') || '',
        end: p.get('fim') || '',
        nature: p.get('natureza') || '',
        types: p.getAll('tipo')
      };
      const f = filter(s, input),
        list = rows(s, f);

      return U.page(
        'Extrato e comprovantes',
        'Os mesmos filtros são aplicados à tela, ao PDF e ao CSV. Arquivos disponíveis por 30 dias.',
        exportTabs(s, p) + (p.get('aba') === 'arquivos' ? historyPanel(s, p) : U.balance(s) + examples(s) +
          U.card(
            'Filtros do extrato',
            U.form(
              '<div class="fields">' +
                U.field('start', 'Data inicial', f.start, 'date') +
                U.field('end', 'Data final', f.end, 'date') +
                U.select('nature', 'Natureza', [
                  ['', 'Créditos e débitos'],
                  'CREDITO',
                  'DEBITO'
                ], f.nature) +
                typeOptions(f.types) + '</div>',
              (d, el) => {
                const values = new FormData(el);

                d.types = values.getAll('types');

                const nf = filter(C.Db.get(), d);

                C.Router.go(
                  'extrato?inicio=' +
                    nf.start +
                    '&fim=' +
                    nf.end +
                    '&natureza=' +
                    nf.nature +
                    nf.types.map(t => '&tipo=' + t).join('')
                );
              },
              'Aplicar filtros',
              'secondary'
            ) +
              `<div class="actions">${['CSV', 'PDF'].map(
                format => U.action(
                  'Exportar ' + format,
                  () => {
                    const r = C.Db.transaction(x => generate(x, f, format));

                    U.done('Solicitação ' + r.id + ' registrada no histórico.');
                    download(r);
                  },
                  'primary'
                )
              ).join(
                ''
              )}</div>`
          ) +
          U.card(
            list.length + ' lançamentos',
            U.table(
              ['Data', 'Tipo', 'Descrição / contraparte', 'Natureza', 'Valor', 'Comprovante'],
              list.map(
                r => [
                  U.e(K.label(r.at)),
                  U.e(r.type),
                  U.e(r.description) +
                    `<small>${U.e(r.counterparty?.name || '')} ${U.e(r.counterparty?.document || '')} ${U.e(r.counterparty?.number || '')}</small>`,
                  U.e(r.nature),
                  U.money(r.value),
                  s.transactions.some(t => t.id === r.transaction)
                    ? U.link('comprovante?id=' + r.transaction, 'Consultar') +
                      U.action(
                        'Segunda via PDF',
                        () => {
                          const record = C.Db.transaction(x => generate(x, f, 'PDF', r.transaction));

                          U.done('Segunda via gerada com dados originais.');
                          download(record);
                        },
                        'secondary'
                      )
                    : 'Lançamento de alocação / rendimento'
                ]
              )
            )
          )),
        'F14 · RN1–RN8'
      );
    },
    'Movimentar'
  );
})(
  Cesbank
);
