/* Integrante 5 · F14 RN1–RN8 · CSV/PDF sem bibliotecas, segunda via e backup local. */
(function (C) {
  'use strict';

  const U = C.UI,
    K = C.Clock;
  const types = ['PIX', 'TED', 'TRANSFERENCIA_MESMA_INSTITUICAO', 'BOLETO', 'SAQUE', 'DEPOSITO', 'CARTAO', 'EMPRESTIMO', 'TARIFA_SERVICOS_AVULSOS', 'RENDIMENTO', 'OUTROS'];
  function filter(s, d) {
    const today = K.day(s.now),
      start = d.start || K.months(today, -1),
      end = d.end || today;
    C.assert(!d.start && !d.end || d.start && d.end, 'Informada uma das datas, a outra passa a ser obrigatória.', 'PeriodoInvalido');
    C.assert(C.V.date(start) && C.V.date(end) && start <= end && end <= today && start >= K.months(today, -12) && end <= K.months(start, 12), 'O período deve ser válido, de até 12 meses e dentro dos últimos 12 meses.', 'PeriodoInvalido');
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
    return s.ledger.filter(r => r.account === s.session.account && K.day(r.at) >= f.start && K.day(r.at) <= f.end && (!f.types.length || f.types.includes(r.type)) && (!f.nature || r.nature === f.nature));
  }
  function csv(lines) {
    return '\uFEFF' + lines.map(row => row.map(cell => '"' + String(cell ?? '').replace(/"/g, '""') + '"').join(';')).join('\r\n');
  }
  function pdf(lines) {
    const ascii = v => String(v).replace(/[·—–]/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '?');
    const chunks = [];
    lines.forEach(line => {
      let t = ascii(line);
      while (t.length > 100) {
        chunks.push(t.slice(0, 100));
        t = t.slice(100);
      }
      chunks.push(t);
    });
    const pages = [];
    for (let i = 0; i < chunks.length; i += 43) pages.push(chunks.slice(i, i + 43));
    if (!pages.length) pages.push(['Sem lancamentos.']);
    const objects = ['', '<< /Type /Catalog /Pages 2 0 R >>', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>'];
    const pageIds = [];
    pages.forEach(page => {
      const p = objects.length;
      pageIds.push(p);
      objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${p + 1} 0 R >>`);
      const content = 'BT /F1 9 Tf 40 798 Td 16 TL ' + page.map((l, i) => (i ? 'T* ' : '') + '(' + l.replace(/([\\()])/g, '\\$1') + ') Tj').join('\n') + ' ET';
      objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    });
    objects[2] = `<< /Type /Pages /Kids [${pageIds.map(i => i + ' 0 R').join(' ')}] /Count ${pageIds.length} >>`;
    let out = '%PDF-1.4\n';
    const offsets = [0];
    for (let i = 1; i < objects.length; i++) {
      offsets[i] = out.length;
      out += `${i} 0 obj\n${objects[i]}\nendobj\n`;
    }
    const xref = out.length;
    out += `xref\n0 ${objects.length}\n0000000000 65535 f \n` + offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return out;
  }
  function download(record) {
    C.assert(record.expires >= C.Db.get().now && record.content, 'Arquivo descartado após 30 dias. Faça uma nova solicitação.');
    const url = URL.createObjectURL(new Blob([record.content], {
      type: record.format === 'PDF' ? 'application/pdf' : 'text/csv;charset=utf-8'
    }));
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
      C.assert(tx.status === 'EFETIVADA' || tx.status === 'DEVOLVIDA', 'Apenas operações concluídas possuem comprovante.');
      receipt = C.Db.clone(tx.receipt || tx);
      selected = s.ledger.filter(r => r.transaction === tx.id && r.account === a.id);
    }
    const title = receipt ? 'SEGUNDA VIA DE COMPROVANTE' : 'EXTRATO DE CONTA';
    const heading = [[title], ['Protótipo · dados fictícios'], ['Conta', a.branch, a.number], ['Período', f.start, f.end], ['Filtros', f.types.join(', ') || 'TODOS', f.nature || 'TODAS'], ['Total de lançamentos', selected.length]];
    const data = selected.map(r => [r.at, r.type, r.nature, C.M.decimal(r.value), 'BRL', r.description, r.transaction, r.counterparty?.name || '', r.counterparty?.document || '', r.counterparty?.number || '']);
    const lines = [...heading, ['Data', 'Tipo', 'Natureza', 'Valor', 'Moeda', 'Descrição', 'Identificador', 'Contraparte', 'Documento mascarado', 'Conta truncada'], ...data];
    if (receipt) {
      lines.push(['Operação original', receipt.id], ['Data e hora original', receipt.at], ['Valor original', C.M.decimal(receipt.value), 'BRL'], ['Forma de destino', receipt.resolution || 'Lançamento interno']);
      if (receipt.from) lines.push(['Origem', receipt.from.name, receipt.from.branch, receipt.from.number]);
      if (receipt.receiver) lines.push(['Recebedor', receipt.receiver.name, receipt.receiver.document, receipt.receiver.number]);
      if (receipt.line) lines.push(['Linha digitável', receipt.line], ['Nominal', C.M.decimal(receipt.nominal), 'BRL'], ['Multa', C.M.decimal(receipt.fine || 0), 'BRL'], ['Juros', C.M.decimal(receipt.interest || 0), 'BRL'], ['Desconto', C.M.decimal(receipt.discount || 0), 'BRL'], ['Liquidação', receipt.settlementDate]);
    }
    const printable = heading.map(row => row.join(' | '));
    printable.push('', 'LANCAMENTOS', '');
    selected.forEach((r, i) => {
      printable.push(String(i + 1) + '. ' + r.at + ' | ' + r.type + ' | ' + r.nature, 'Valor: ' + C.M.decimal(r.value) + ' BRL | ' + r.description, 'Identificador: ' + r.transaction);
      if (r.counterparty) printable.push('Contraparte: ' + r.counterparty.name + ' | Documento: ' + r.counterparty.document + ' | Conta: ' + r.counterparty.number);
      printable.push('');
    });
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
    C.S.audit(s, 'exportacao', record.id, JSON.stringify({
      filters: f,
      format,
      transactionId
    }));
    return record;
  }
  C.S.exports = {
    filter,
    rows,
    generate,
    download,
    pdf,
    csv
  };
  C.processors.push(s => s.exports.forEach(r => {
    if (r.expires < s.now) r.content = null;
  }));
  C.Router.register('extrato', 'Extrato e comprovantes', (s, p) => {
    const input = {
      start: p.get('inicio') || '',
      end: p.get('fim') || '',
      nature: p.get('natureza') || '',
      types: p.getAll('tipo')
    };
    const f = filter(s, input),
      list = rows(s, f);
    return U.page('Extrato e comprovantes', 'Os mesmos filtros são aplicados à tela, ao PDF e ao CSV. Arquivos disponíveis por 30 dias.', U.balance(s) + U.card('Filtros do extrato', U.form('<div class="fields">' + U.field('start', 'Data inicial', f.start, 'date') + U.field('end', 'Data final', f.end, 'date') + U.select('nature', 'Natureza', [['', 'Créditos e débitos'], 'CREDITO', 'DEBITO'], f.nature) + `<label>Tipos (Ctrl para selecionar mais de um)<select name="types" multiple size="5">${types.map(t => `<option value="${t}" ${f.types.includes(t) ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>`, (d, el) => {
      const values = new FormData(el);
      d.types = values.getAll('types');
      const nf = filter(C.Db.get(), d);
      C.Router.go('extrato?inicio=' + nf.start + '&fim=' + nf.end + '&natureza=' + nf.nature + nf.types.map(t => '&tipo=' + t).join(''));
    }, 'Aplicar filtros', 'secondary') + `<div class="actions">${['CSV', 'PDF'].map(format => U.action('Exportar ' + format, () => {
      const r = C.Db.transaction(x => generate(x, f, format));
      U.done('Solicitação ' + r.id + ' registrada no histórico.');
      download(r);
    }, 'primary')).join('')}</div>`) + U.card(list.length + ' lançamentos', U.table(['Data', 'Tipo', 'Descrição / contraparte', 'Natureza', 'Valor', 'Comprovante'], list.map(r => [U.e(K.label(r.at)), U.e(r.type), U.e(r.description) + `<small>${U.e(r.counterparty?.name || '')} ${U.e(r.counterparty?.document || '')} ${U.e(r.counterparty?.number || '')}</small>`, U.e(r.nature), U.money(r.value), s.transactions.some(t => t.id === r.transaction) ? U.link('comprovante?id=' + r.transaction, 'Consultar') + U.action('Segunda via PDF', () => {
      const record = C.Db.transaction(x => generate(x, f, 'PDF', r.transaction));
      U.done('Segunda via gerada com dados originais.');
      download(record);
    }, 'secondary') : 'Lançamento de alocação / rendimento']))) + U.card('Histórico e backup dos arquivos', U.table(['Protocolo', 'Data', 'Formato', 'Disponível até', 'Arquivo'], s.exports.filter(r => r.account === s.session.account).map(r => [U.e(r.id), U.e(K.label(r.at)), U.e(r.format), U.e(K.label(r.expires)), r.content ? U.action('Baixar novamente', () => download(r), 'secondary') : U.badge('EXPIRADO')]))), 'F14 · RN1–RN8');
  }, 'Movimentar');
})(Cesbank);
