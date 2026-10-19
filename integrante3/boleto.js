/* Integrante 3 · F3 RN1–RN14 · duas entradas, confirmação única, fraude e recurso. */
(function (C) {
  'use strict';

  const U = C.UI,
    A = C.S.accounts,
    K = C.Clock,
    M = C.M;
  function find(s, id) {
    const b = s.boletos.find(b => b.id === id);
    C.assert(b, 'Boleto não encontrado no cadastro fictício.');
    C.V.boleto(b.line);
    return b;
  }
  function allowed(s, b) {
    if (b.status === 'PAGO') C.fail('BoletoJaLiquidado');
    C.assert(b.status === 'ABERTO', 'Boleto rejeitado ou recorrido não pode ser pago enquanto a rejeição vigorar.');
    C.assert(b.cpf === A.client(s, s.session.client).cpf, 'Boleto não pertence ao CPF do cliente selecionado.');
  }
  function settlement(s) {
    const today = K.day(s.now);
    return !K.business(today) || K.hour(s.now) >= C.policy.boletoCutoff ? K.adjust(K.addDays(today, K.business(today) ? 1 : 0)) : today;
  }
  function quote(s, id, date = settlement(s)) {
    const b = find(s, id),
      code = C.V.boleto(b.line);
    allowed(s, b);
    const delay = K.days(code.due, date);
    if (delay > C.policy.boletoOverdueDays) C.fail('BoletoVencidoForaDoPrazo', 'Solicite a emissão de segunda via ao beneficiário.');
    const fine = delay > 0 ? M.mul(code.value, b.fineBp) : 0;
    const interest = delay > 0 ? M.mul(code.value, b.dailyMillion * delay, 1000000) : 0;
    const discount = delay < 0 ? M.mul(code.value, b.discountBp) : 0;
    return {
      id: b.id,
      nominal: code.value,
      due: code.due,
      line: code.line,
      barcode: code.barcode,
      date,
      fine,
      interest,
      discount,
      total: code.value + fine + interest - discount,
      label: b.label
    };
  }
  function validateSchedule(s, id, date) {
    const b = find(s, id);
    allowed(s, b);
    C.assert(C.V.date(date) && date > K.day(s.now) && date <= C.V.boleto(b.line).due, 'A data agendada deve ser futura e anterior ou igual ao vencimento.');
  }
  function execute(s, id, requestId) {
    C.Session.requireClient(s);
    if (s.requests[requestId]) return C.S.request(s, requestId, () => null);
    C.assert(K.business(K.day(s.now)) && K.hour(s.now) < C.policy.boletoCutoff, 'Liquidação somente em dia útil antes das 17h.', 'ForaDoHorarioDeLiquidacao');
    const b = find(s, id),
      q = quote(s, id, K.day(s.now));
    const tx = C.S.move(s, {
      from: s.session.account,
      to: b.beneficiary,
      value: q.total,
      type: 'BOLETO',
      requestId,
      description: 'Boleto · ' + b.label,
      resolution: 'LINHA_DIGITAVEL',
      extra: {
        boleto: id,
        line: q.line,
        nominal: q.nominal,
        fine: q.fine,
        interest: q.interest,
        discount: q.discount,
        settlementDate: q.date
      }
    });
    if (tx.status === 'EFETIVADA') {
      C.S.transition(s, b, 'boleto', 'PAGO');
      b.transaction = tx.id;
      if (b.rejectedAt) b.rejectionClosed = s.now;
    }
    return tx;
  }
  C.S.boleto = {
    find,
    quote,
    validateSchedule,
    execute
  };
  async function attachments(files) {
    C.assert(files.length > 0, 'Anexe ao menos uma evidência da compra.');
    C.assert(Array.from(files).every(f => f.size <= 2 * 1024 * 1024) && Array.from(files).reduce((v, f) => v + f.size, 0) <= 4 * 1024 * 1024, 'Anexos fictícios: até 2 MB por arquivo e 4 MB por recurso.');
    return Promise.all(Array.from(files, f => new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve({
        name: f.name,
        size: f.size,
        type: f.type,
        data: r.result
      });
      r.onerror = () => reject(new Error('Não foi possível ler o anexo.'));
      r.readAsDataURL(f);
    })));
  }
  function evidences(s, b) {
    U.modal('Evidências do recurso', `<p>${U.e(b.appeal?.justification || 'Nenhum recurso apresentado.')}</p>` + U.table(['Arquivo', 'Tamanho', 'Anexo'], (b.appeal?.files || []).map(f => [U.e(f.name), U.e(f.size) + ' bytes', `<a class="button secondary" href="${U.e(f.data)}" download="${U.e(f.name)}">Baixar evidência</a>`])) + (b.status === 'REJEITADO_RECORRIDO' ? U.action('Reconhecer e revisar pagamento', () => {
      C.Db.transaction(x => {
        const row = find(x, b.id);
        C.assert(row.cpf === A.client(x, x.session.client).cpf, 'Somente o pagador pode reconhecer o boleto.');
        C.S.transition(x, row, 'boleto', 'ABERTO', 'Cliente reconheceu o boleto após examinar evidências.');
        row.rejectionRecognized = x.now;
      });
      U.close();
      C.Router.go('boleto-confirmar?id=' + b.id);
    }, 'primary') + U.action('Manter rejeição', () => {
      C.Db.transaction(x => {
        const row = find(x, b.id);
        C.assert(row.cpf === A.client(x, x.session.client).cpf, 'Somente o pagador pode manter a rejeição.');
        C.S.transition(x, row, 'boleto', 'REJEITADO', 'Rejeição mantida após análise das evidências.');
        row.rejectionFinal = true;
        C.S.notify(x, A.account(x, row.beneficiary).client, 'O cliente manteve a rejeição do boleto ' + row.label + '.');
      });
      U.done('Rejeição mantida. Boleto segue não pagável.');
    }, 'danger') : ''));
  }
  C.Router.register('boletos', 'Pagar boletos', s => U.page('Meus boletos', 'Boletos vinculados ao seu CPF. As duas entradas levam à mesma confirmação.', U.link('boleto-codigo', 'Pagar com código de barras ou linha digitável') + U.card('Boletos do meu CPF', U.table(['Beneficiário / descrição', 'Nominal / vencimento', 'Situação', 'Ações'], s.boletos.filter(b => b.cpf === A.client(s, s.session.client).cpf).map(b => {
    const code = C.V.boleto(b.line);
    return [U.e(A.client(s, A.account(s, b.beneficiary).client).name) + `<small>${U.e(b.label)}</small>`, U.money(code.value) + `<small>${code.due}</small>`, U.badge(b.status), (b.status === 'ABERTO' ? U.link('boleto-confirmar?id=' + b.id, 'Pagar ou agendar') + U.action('Não reconheço', () => U.modal('Rejeitar boleto por suspeita de fraude', U.form(U.field('reason', 'Motivo da rejeição'), d => {
      C.Db.transaction(x => {
        C.Session.requireClient(x);
        const row = find(x, b.id);
        allowed(x, row);
        C.assert(d.reason.trim(), 'Informe o motivo da rejeição.');
        row.rejectedAt = x.now;
        row.rejectionReason = d.reason.trim();
        C.S.transition(x, row, 'boleto', 'REJEITADO', row.rejectionReason);
        C.S.notify(x, A.account(x, row.beneficiary).client, 'Boleto rejeitado por suspeita de fraude: ' + row.label + '. Prazo de recurso: 5 dias corridos.');
      });
      U.done('Boleto rejeitado; beneficiário notificado.');
    }, 'Confirmar rejeição', 'danger')), 'danger') : '') + (b.appeal ? U.action('Ver evidências', () => evidences(s, b), 'secondary') : '') + (b.transaction ? U.link('comprovante?id=' + b.transaction, 'Comprovante') : '') + U.json({
      line: b.line,
      history: b.history
    })];
  }))) + U.link('beneficiario', 'Visão do beneficiário'), 'F3 · RN3, RN5, RN10–RN14'), 'Movimentar');
  C.Router.register('boleto-codigo', 'Pagar com código', s => U.page('Pagar com código', 'Validação local dos três dígitos de campo e do dígito geral do código de barras.', U.card('Linha digitável ou código de barras', U.form(U.field('code', '47 dígitos da linha ou 44 do código de barras', s.boletos[0].line), d => {
    const decoded = C.V.boleto(d.code);
    const b = C.Db.get().boletos.find(b => C.V.boleto(b.line).barcode === decoded.barcode);
    C.assert(b, 'Boleto não encontrado no cadastro fictício.');
    C.Router.go('boleto-confirmar?id=' + b.id);
  }, 'Consultar e revisar')), 'F3 · RN1, RN2, RN11'), null);
  C.Router.register('boleto-confirmar', 'Confirmar boleto', (s, p) => {
    const id = p.get('id'),
      q = quote(s, id);
    return U.page('Confirme o pagamento do boleto', q.label, U.balance(s) + U.card('Detalhes e encargos na liquidação', U.table(['Nominal', 'Vencimento', 'Liquidação', 'Multa', 'Juros', 'Desconto', 'Total'], [[U.money(q.nominal), q.due, q.date, U.money(q.fine), U.money(q.interest), U.money(q.discount), U.money(q.total)]]) + `<p class="small">Linha digitável: ${U.e(q.line)}</p>` + (q.date !== K.day(s.now) ? '<div class="banner warning">ForaDoHorarioDeLiquidacao · A operação será liquidada no próximo dia útil.</div>' : '') + U.action('Confirmar pagamento', () => {
      const current = C.Db.get(),
        fresh = quote(current, id);
      if (JSON.stringify(fresh) !== JSON.stringify(q)) {
        U.render();
        U.flash('Encargos ou data mudaram. Revise os valores novamente.', 'warning');
        return;
      }
      if (fresh.date !== K.day(current.now)) {
        C.Db.transaction(x => C.S.schedules.create(x, {
          date: fresh.date,
          kind: 'BOLETO',
          payload: {
            id
          },
          value: fresh.total,
          recurring: 'NAO'
        }));
        U.done('Pagamento programado para a liquidação informada.');
      } else {
        const tx = C.Db.transaction(x => execute(x, id, C.Ids.uuid()));
        C.Router.go('comprovante?id=' + tx.id);
        U.render();
        U.flash(tx.status === 'EFETIVADA' ? 'Boleto pago com sucesso.' : 'Operação estornada automaticamente; boleto continua aberto.', tx.status === 'EFETIVADA' ? 'success' : 'warning');
      }
    })) + U.card('Agendar para outra data', U.form(U.field('date', 'Data futura até o vencimento', K.addDays(K.day(s.now), 1), 'date'), d => {
      C.Db.transaction(x => C.S.schedules.create(x, {
        date: d.date,
        kind: 'BOLETO',
        payload: {
          id
        },
        value: q.nominal,
        recurring: 'NAO'
      }));
      U.done('Boleto agendado. Saldo e limite serão verificados somente na execução.');
    }, 'Agendar')), 'F3 · RN1–RN10 · RN11');
  }, null);
  C.Router.register('beneficiario', 'Área do beneficiário', s => U.page('Área do beneficiário', 'Selecione o perfil Loja Exemplo para apresentar recursos e anexos.', U.card('Boletos emitidos', U.table(['Boleto', 'Situação', 'Rejeição / prazo', 'Recurso'], s.boletos.filter(b => b.beneficiary === s.session.account).map(b => [U.e(b.label), U.badge(b.status), U.e(b.rejectionReason || 'Sem rejeição') + (b.rejectedAt ? `<small>Até ${K.addDays(K.day(b.rejectedAt), C.policy.appealDays)}</small>` : ''), (b.status === 'REJEITADO' && !b.rejectionFinal && !b.appeal ? U.action('Apresentar recurso', () => U.modal('Recurso do beneficiário', U.form('<label>Justificativa<textarea name="justification"></textarea></label>' + U.field('files', 'Evidências fictícias', '', 'file', 'multiple'), async (d, f) => {
    C.assert(d.justification.trim(), 'A justificativa é obrigatória.');
    const files = await attachments(f.elements.files.files);
    C.Db.transaction(x => {
      C.assert(x.session.role === 'BENEFICIARIO' && x.session.account === b.beneficiary, 'Selecione o perfil Beneficiário para recorrer.');
      const row = find(x, b.id);
      C.assert(row.status === 'REJEITADO' && !row.appeal && !row.rejectionFinal, 'Recurso indisponível nesta situação.');
      C.assert(K.days(K.day(row.rejectedAt), K.day(x.now)) <= C.policy.appealDays, 'Prazo de 5 dias corridos para recurso expirado.');
      row.appeal = {
        at: x.now,
        justification: d.justification.trim(),
        files
      };
      C.S.transition(x, row, 'boleto', 'REJEITADO_RECORRIDO');
      C.S.notify(x, x.clients.find(c => c.cpf === row.cpf).id, 'Beneficiário apresentou recurso para ' + row.label + '. Consulte as evidências.');
    });
    U.done('Recurso apresentado; boleto continua não pagável até decisão do pagador.');
  }, 'Enviar recurso')), 'secondary') : '') + (b.appeal ? U.action('Consultar evidências', () => evidences(s, b), 'secondary') : '')]))), 'F3 · RN12–RN14'), null);
})(Cesbank);
