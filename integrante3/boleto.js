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
  const labelOf = (s, b) => U.e(A.client(s, A.account(s, b.beneficiary).client).name);
  const rows = items => '<div class="i3-rows">' + items.map(([k, v, cls]) => `<div class="${cls || ''}"><span>${k}</span><b>${v}</b></div>`).join('') + '</div>';
  const mine = s => s.boletos.filter(b => b.cpf === A.client(s, s.session.client).cpf);
  const back = (path, text) => U.link(path, text);
  const ex = (html, title = 'Exemplo') => `<div class="i3-example"><strong>${U.e(title)}</strong>${html}</div>`;
  const fill = (name, value) => () => {
    const el = document.querySelector('[name="' + name + '"]');
    if (el) el.value = value;
  };
  function evidences(s, b) {
    const code = C.V.boleto(b.line);
    U.modal('Recurso do beneficiário', `<p class="i3-sub">${U.e(b.label)} · vence ${U.e(code.due)}</p><h3>Justificativa</h3><div class="i3-quote">${U.e(b.appeal?.justification || 'Nenhum recurso apresentado.')}</div><h3>Anexos</h3>` + U.table(['Arquivo', 'Tamanho', 'Anexo'], (b.appeal?.files || []).map(f => [U.e(f.name), U.e(f.size) + ' bytes', `<a class="button secondary" href="${U.e(f.data)}" download="${U.e(f.name)}">Baixar evidência</a>`])) + (b.status === 'REJEITADO_RECORRIDO' ? '<p class="small">Depois de analisar as evidências, você pode pagar o boleto, o que encerra a rejeição, ou manter a rejeição (RN 14).</p><div class="actions">' + U.action('Pagar boleto', () => {
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
    }, 'danger') + '</div>' : ''));
  }
  // Tela 1 · lista do CPF (entrada A) e acesso à entrada por código (entrada B).
  C.Router.register('boletos', 'Pagar boletos', s => U.page('Meus boletos', 'Em aberto no seu CPF. Pela lista ou pelo código, você chega à mesma confirmação do pagamento.', '<div class="i3-split"><div>' + U.card('Boletos do meu CPF', U.table(['Boleto', 'Vencimento', 'Valor', 'Situação', 'Ações'], mine(s).map(b => {
    const code = C.V.boleto(b.line);
    return [`<strong>${U.e(b.label)}</strong><small>${labelOf(s, b)}</small>`, U.e(code.due), '<strong>' + U.money(code.value) + '</strong>', U.badge(b.status), (b.status === 'ABERTO' ? U.link('boleto-confirmar?id=' + b.id, 'Pagar') + U.link('boleto-rejeitar?id=' + b.id, 'Rejeitar') : '') + (b.status === 'REJEITADO_RECORRIDO' ? U.action('Ver recurso', () => evidences(s, b), 'secondary') : b.appeal ? U.action('Ver evidências', () => evidences(s, b), 'secondary') : '') + (b.transaction ? U.link('comprovante?id=' + b.transaction, 'Comprovante') : '') + U.json({
      line: b.line,
      history: b.history
    })];
  })) + '<p class="small">Boleto rejeitado ou recorrido continua listado, mas não pode ser pago enquanto a rejeição vigorar.</p>') + '</div><aside>' + U.card('Tem o código do boleto?', '<p>Digite ou cole a linha digitável, ou o código de barras, para pagar um boleto que não está na lista.</p><div class="actions">' + U.link('boleto-codigo', 'Pagar com código de barras') + '</div>') + U.card('Acompanhe', '<div class="actions">' + U.link('agendamentos', 'Meus agendamentos') + U.link('beneficiario', 'Visão do beneficiário') + '</div>') + '</aside></div>', 'F3 · RN3, RN5, RN10–RN14'), 'Movimentar');
  // Tela 2 · entrada por código.
  C.Router.register('boleto-codigo', 'Pagar com código', s => U.page('Pagar boleto', 'Informe a linha digitável ou o código de barras.', '<div class="i3-split"><div>' + U.card('Código do boleto', U.form(U.field('code', '47 dígitos da linha digitável ou 44 do código de barras', s.boletos[0].line, 'text', 'autocomplete="off"'), d => {
    const decoded = C.V.boleto(d.code);
    const b = C.Db.get().boletos.find(b => C.V.boleto(b.line).barcode === decoded.barcode);
    C.assert(b, 'Boleto não encontrado no cadastro fictício.');
    C.Router.go('boleto-confirmar?id=' + b.id);
  }, 'Continuar')) + back('boletos', '← Voltar à lista') + '</div><aside>' + U.card('O que acontece depois', '<p>Valor e vencimento são lidos do próprio código (RN 2).</p><p>Dígito inválido ou boleto já pago é recusado (RN 1 e 3).</p>') + ex(`<p><b>Código válido</b> (${U.e(s.boletos[0].label)}): o valor e o vencimento aparecem prontos na confirmação.</p><code>${U.e(s.boletos[0].line)}</code><p><b>Código inválido</b>: mesmo código com o último dígito trocado. O sistema recusa com BoletoInvalido.</p><code>${U.e(s.boletos[0].line.slice(0, -1) + (s.boletos[0].line.at(-1) === '0' ? '1' : '0'))}</code><div class="actions">` + U.action('Usar exemplo válido', fill('code', s.boletos[0].line), 'secondary') + U.action('Usar exemplo inválido', fill('code', s.boletos[0].line.slice(0, -1) + (s.boletos[0].line.at(-1) === '0' ? '1' : '0')), 'secondary') + '</div>') + '</aside></div>', 'F3 · RN1, RN2, RN11'), null);
  // Tela 3 · confirmação única das duas entradas.
  C.Router.register('boleto-confirmar', 'Confirmar boleto', (s, p) => {
    const id = p.get('id'),
      q = quote(s, id),
      b = find(s, id);
    const at = d => {
      try {
        return U.money(quote(s, id, d).total);
      } catch (e) {
        return '—';
      }
    };
    const sample = ex('<p>O valor final muda com a data de liquidação (RN 4). Para este boleto:</p>' + rows([['5 dias antes do vencimento (desconto)', at(K.addDays(q.due, -5))], ['No vencimento', at(q.due)], ['10 dias depois (multa + juros)', at(K.addDays(q.due, 10))]]) + '<p>Horário (RN 6): pagamento confirmado em dia útil antes das 17h liquida no mesmo dia. Confirmado às 18h de uma sexta-feira, liquida na segunda-feira.</p>');
    return U.page('Confirmar pagamento', 'Revise os valores antes de confirmar.', U.balance(s) + (q.date !== K.day(s.now) ? `<div class="banner warning">ForaDoHorarioDeLiquidacao · Confirmado após o horário limite: a operação será liquidada no próximo dia útil, ${U.e(q.date)} (RN 6).</div>` : '') + '<div class="i3-split"><div>' + U.card('Resumo do boleto', rows([['Beneficiário', labelOf(s, b)], ['Descrição', U.e(q.label)], ['Linha digitável', U.e(q.line)], ['Valor nominal', U.money(q.nominal)], ['Vencimento', U.e(q.due)], ['Multa (RN 4)', '+ ' + U.money(q.fine)], ['Juros de mora (RN 4)', '+ ' + U.money(q.interest)], ['Desconto (RN 4)', '− ' + U.money(q.discount)], ['Liquidação', U.e(q.date)], ['Valor final', U.money(q.total), 'total']])) + back('boletos', '← Voltar à lista') + '</div><aside>' + U.card('Próximo passo', '<p>O saldo e o limite diário são conferidos na data de execução (RN 7).</p><div class="i3-box danger"><strong>Se algo falhar</strong><p>Saldo insuficiente: o pagamento não é efetivado (RN 7). Boleto vencido além do prazo é recusado, com orientação para emitir segunda via (RN 5).</p></div><div class="actions">' + U.action('Confirmar pagamento', () => {
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
    }) + U.link('boleto-agendar?id=' + id, 'Agendar para outra data') + '</div>') + sample + '</aside></div>', 'F3 · RN1–RN10 · RN11');
  }, null);
  // Tela 4 · agendamento para data futura.
  C.Router.register('boleto-agendar', 'Agendar pagamento', (s, p) => {
    const id = p.get('id'),
      q = quote(s, id);
    return U.page('Agendar pagamento', 'Escolha a data de execução.', '<div class="i3-split"><div>' + U.card('Boleto', `<p><strong>${U.e(q.label)}</strong><br>Vence ${U.e(q.due)} · ${U.money(q.nominal)}</p>` + U.form(U.field('date', 'Data do pagamento', K.addDays(K.day(s.now), 1), 'date') + '<p class="small">Até o vencimento (RN 8).</p>', d => {
      C.Db.transaction(x => C.S.schedules.create(x, {
        date: d.date,
        kind: 'BOLETO',
        payload: {
          id
        },
        value: q.nominal,
        recurring: 'NAO'
      }));
      C.Router.go('agendamentos');
      U.render();
      U.flash('Boleto agendado. Saldo e limite serão verificados somente na execução.');
    }, 'Agendar pagamento')) + back('boleto-confirmar?id=' + id, '← Voltar à confirmação') + '</div><aside>' + U.card('Como funciona', '<p>O saldo só é conferido na data agendada. Agora validamos apenas o boleto (RN 8).</p><p>Se a execução falhar por saldo, tentamos de novo no mesmo dia; o agendamento pode ser cancelado até a véspera (RN 9).</p>' + '<div class="actions">' + U.link('agendamentos', 'Meus agendamentos') + '</div>') + ex(`<p>Este boleto vence em <b>${U.e(q.due)}</b>.</p><p>Agendar para <b>${U.e(K.addDays(q.due, -1))}</b> (um dia antes): aceito. Nada é debitado hoje.</p><p>Agendar para <b>${U.e(K.addDays(q.due, 1))}</b> (um dia depois): recusado, pois a data passa do vencimento.</p><p>Se no dia agendado o saldo for insuficiente, o sistema tenta de novo no mesmo dia, até ${C.policy.retries} vezes, e avisa você se a falha for definitiva.</p>`) + '</aside></div>', 'F3 · RN8, RN9');
  }, null);
  // Tela 7 · rejeição por suspeita de fraude.
  const reasons = {
    NAO_RECONHECO: 'Não reconheço o boleto',
    SUSPEITA_FRAUDE: 'Suspeita de fraude',
    OUTRO: 'Outro motivo'
  };
  C.Router.register('boleto-rejeitar', 'Rejeitar boleto', (s, p) => {
    const b = find(s, p.get('id')),
      code = C.V.boleto(b.line);
    return U.page('Rejeitar boleto', 'Informe o motivo da rejeição.', '<div class="i3-split"><div>' + U.card('Boleto', `<p><strong>${U.e(b.label)}</strong><br>Vence ${U.e(code.due)} · ${U.money(code.value)}</p>` + U.form('<fieldset class="i3-radios"><legend>Por que você rejeita?</legend>' + Object.entries(reasons).map(([v, t], i) => `<label class="check"><input type="radio" name="type" value="${v}" ${i === 0 ? 'checked' : ''}>${U.e(t)}</label>`).join('') + '</fieldset><label>Detalhes (opcional)<textarea name="detail"></textarea></label>', d => {
      C.Db.transaction(x => {
        C.Session.requireClient(x);
        const row = find(x, b.id);
        allowed(x, row);
        C.assert(reasons[d.type], 'Informe o motivo da rejeição.');
        row.rejectedAt = x.now;
        row.rejectionReason = reasons[d.type] + (d.detail && d.detail.trim() ? ' — ' + d.detail.trim() : '');
        C.S.transition(x, row, 'boleto', 'REJEITADO', row.rejectionReason);
        C.S.notify(x, A.account(x, row.beneficiary).client, 'Boleto rejeitado por suspeita de fraude: ' + row.label + '. Prazo de recurso: 5 dias corridos.');
      });
      C.Router.go('boletos');
      U.render();
      U.flash('Boleto rejeitado; beneficiário notificado.');
    }, 'Rejeitar boleto', 'danger')) + back('boletos', '← Voltar à lista') + '</div><aside>' + U.card('Depois de rejeitar', '<p>O beneficiário será avisado e pode recorrer (RN 12 e 13).</p><p>O boleto não poderá ser pago enquanto a rejeição vigorar. A rejeição só vale para boleto ainda não pago.</p>') + ex('<p><b>Não reconheço o boleto</b>: chegou uma cobrança de um serviço que você nunca contratou.</p><p><b>Suspeita de fraude</b>: o valor ou o beneficiário parecem estranhos, ou você recebeu o boleto por um contato desconhecido.</p><p><b>Outro motivo</b>: descreva em detalhes. Exemplo: "Já paguei este boleto em outro banco".</p>') + '</aside></div>', 'F3 · RN12');
  }, null);
  // Tela 8 · visão do beneficiário e formulário de recurso.
  C.Router.register('beneficiario', 'Área do beneficiário', s => U.page('Área do beneficiário', 'Selecione o perfil Loja Exemplo para apresentar recursos e anexos.', U.card('Boletos emitidos', U.table(['Boleto', 'Situação', 'Rejeição / prazo', 'Recurso'], s.boletos.filter(b => b.beneficiary === s.session.account).map(b => [U.e(b.label), U.badge(b.status), U.e(b.rejectionReason || 'Sem rejeição') + (b.rejectedAt ? `<small>Até ${K.addDays(K.day(b.rejectedAt), C.policy.appealDays)}</small>` : ''), (b.status === 'REJEITADO' && !b.rejectionFinal && !b.appeal ? U.link('boleto-recurso?id=' + b.id, 'Apresentar recurso') : '') + (b.appeal ? U.action('Consultar evidências', () => evidences(s, b), 'secondary') : '')]))), 'F3 · RN12–RN14'), null);
  C.Router.register('boleto-recurso', 'Recurso do beneficiário', (s, p) => {
    const b = find(s, p.get('id')),
      code = C.V.boleto(b.line);
    return U.page('Recurso do beneficiário', 'Boleto rejeitado pelo pagador.', '<div class="i3-split"><div>' + U.card('Boleto rejeitado', `<p><strong>${U.e(b.label)}</strong> · vence ${U.e(code.due)} · ${U.money(code.value)}<br>Motivo da rejeição: ${U.e(b.rejectionReason || '—')}<br>${U.badge(b.status)} ${b.rejectedAt ? 'Responder até ' + K.addDays(K.day(b.rejectedAt), C.policy.appealDays) : ''}</p>` + U.form('<label>Justificativa<textarea name="justification"></textarea></label>' + U.field('files', 'Anexos: evidências fictícias da compra e da necessidade do boleto', '', 'file', 'multiple'), async (d, f) => {
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
      C.Router.go('beneficiario');
      U.render();
      U.flash('Recurso apresentado; boleto continua não pagável até decisão do pagador.');
    }, 'Enviar recurso')) + back('beneficiario', '← Voltar') + '</div><aside>' + U.card('Regras do recurso', '<p>Anexe provas da compra e da necessidade do boleto (RN 13).</p><p>Com o recurso, o boleto passa a Rejeitado · recorrido e continua não pagável.</p><p>Sem recurso no prazo, a rejeição é mantida. A rejeição e o recurso não suspendem o vencimento (RN 5).</p>') + ex(`<p><b>Justificativa</b>: "O cliente contratou o serviço em 10/01 e o boleto é da mensalidade em aberto. Contrato e comprovante de entrega anexos."</p><p><b>Anexos</b>: contrato.pdf e comprovante-entrega.png (até 2 MB por arquivo e 4 MB no total).</p><div class="actions">` + U.action('Preencher justificativa de exemplo', fill('justification', 'O cliente contratou o serviço em 10/01 e o boleto é da mensalidade em aberto. Contrato e comprovante de entrega anexos.'), 'secondary') + '</div>') + '</aside></div>', 'F3 · RN13');
  }, null);
})(Cesbank);