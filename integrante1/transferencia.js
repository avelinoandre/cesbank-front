/* Integrante 1 · F2 RN1–RN14 · resolução compartilhada, confirmação e comprovante. */
(function (C) {
  'use strict';

  const U = C.UI,
    A = C.S.accounts;
  C.S.destination = function (s, d, count = true) {
    if (d.favorite) {
      const f = s.favorites.find(f => f.id === d.favorite && f.client === s.session.client && !f.removed);
      C.assert(f && !f.invalid, 'Favorito inválido: revalide antes de novo uso.');
      d = f.destination;
    }
    if (d.method === 'PIX') return A.account(s, C.S.pix.resolve(s, d.key, count).accountId);
    return A.resolve(s, d.branch, d.number, d.institution || '12345678');
  };
  C.S.transfer = {
    execute(s, d) {
      C.Session.requireClient(s);
      if (s.requests[d.requestId]) return C.S.request(s, d.requestId, () => null);
      const favorite = d.favorite ? s.favorites.find(f => f.id === d.favorite && f.client === s.session.client && !f.removed) : null;
      const payload = favorite ? favorite.destination : d;
      const b = C.S.destination(s, d, false);
      if (d.confirmedAccount) C.assert(b.id === d.confirmedAccount, 'O vínculo do destino mudou. Revise os dados novamente.');
      return C.S.move(s, {
        from: s.session.account,
        to: b.id,
        value: d.value,
        type: payload.method === 'PIX' ? 'PIX' : 'TRANSFERENCIA_MESMA_INSTITUICAO',
        requestId: d.requestId,
        description: d.description || 'Transferência Cesbank',
        resolution: payload.method
      });
    }
  };
  function invalidate(d, ex) {
    C.Db.transaction(s => C.S.recordRejection(s, d, ex));
    if (d.favorite && ['ContaInexistenteOuInativa', 'ChaveNaoEncontrada'].includes(ex.code)) C.Db.transaction(s => {
      const f = s.favorites.find(f => f.id === d.favorite);
      if (f) {
        f.invalid = true;
        C.S.audit(s, 'favorito', f.id, 'Destino inexistente na última tentativa.');
      }
    });
  }
  C.Router.register('transferencia', 'Transferir', (s, p) => {
    const favs = s.favorites.filter(f => f.client === s.session.client && !f.removed);
    return U.page('Transferir dinheiro', 'Use uma chave Pix ou os dados bancários do destinatário.', U.balance(s) + U.card('Dados da transferência', U.form('<div class="fields">' + U.select('method', 'Forma de destino', [['PIX', 'Chave Pix'], ['DADOS_BANCARIOS', 'Agência e conta']]) + U.field('key', 'Chave Pix', 'joao@cesbank.com') + U.field('institution', 'Instituição', '12345678') + U.field('branch', 'Agência', '0001') + U.field('number', 'Conta de destino', '0007654322') + U.select('favorite', 'Ou utilizar favorito', [['', 'Não utilizar'], ...favs.map(f => [f.id, f.alias + (f.invalid ? ' · exige revalidação' : '')])], p.get('favorito') || '') + U.field('value', 'Valor (BRL)', '100.00') + U.field('description', 'Descrição', 'Transferência Cesbank') + U.field('requestId', 'UUID v4 da requisição', C.Ids.uuid()) + '</div>', d => {
      d.value = C.M.parse(d.value);
      const previous = C.Db.get().requests[d.requestId];
      if (previous) {
        C.assert(previous.from === C.Db.get().session.account, 'A requisição pertence a outra conta.');
        C.Router.go('comprovante?id=' + previous.id);
        U.render();
        U.flash('RequisicaoDuplicada · resultado original devolvido sem nova movimentação.');
        return;
      }
      let b;
      try {
        C.Db.transaction(x => {
          C.Session.requireClient(x);
          b = C.S.destination(x, d);
          C.assert(b.id !== x.session.account, 'Origem e destino não podem ser a mesma conta.');
          A.check(x, x.session.account, d.value);
        });
      } catch (ex) {
        invalidate(d, ex);
        throw ex;
      }
      const x = C.Db.get(),
        who = A.client(x, b.client);
      d.confirmedAccount = b.id;
      U.modal('Confirme o recebedor', `<p><strong>${U.e(C.V.name(who.social || who.name))}</strong><br>Documento: ${U.e(C.V.mask(who.cpf))}<br>CESBANK · ${U.e(b.institution)} · tipo ${U.e(b.type)}<br>Agência ${U.e(b.branch)} · conta ***${U.e(b.number.slice(-4))}</p><p class="metric">${U.money(d.value)}</p>` + U.action('Confirmar transferência', () => {
        let tx;
        try {
          tx = C.Db.transaction(v => C.S.transfer.execute(v, d));
        } catch (ex) {
          invalidate(d, ex);
          throw ex;
        }
        U.close();
        C.Router.go('comprovante?id=' + tx.id);
        U.render();
        U.flash(tx.duplicate ? 'RequisicaoDuplicada · resultado original devolvido.' : tx.status === 'DEVOLVIDA' ? 'Falha simulada. Estorno automático BE08 concluído.' : 'Transferência efetivada.', tx.status === 'DEVOLVIDA' ? 'warning' : 'success');
      }));
    }, 'Revisar transferência')), 'F2 · RN1–RN14');
  }, 'Movimentar');
  C.Router.register('comprovante', 'Comprovante', (s, p) => {
    const tx = s.transactions.find(t => t.id === p.get('id') && (t.from === s.session.account || t.to === s.session.account));
    C.assert(tx, 'Operação não encontrada para esta conta.');
    const r = tx.receipt || {
      id: tx.id,
      at: tx.at,
      value: tx.value,
      description: tx.description,
      reason: tx.reason,
      original: tx.original
    };
    return U.page(tx.status === 'REJEITADA' ? 'Operação rejeitada' : 'Comprovante da operação', C.Clock.label(tx.at), U.card(tx.description, `<p>${U.badge(tx.status)}</p><p class="metric">${U.money(tx.value)}</p><p>Identificador de ponta a ponta<br><strong>${U.e(tx.id)}</strong></p>` + U.table(['Informação', 'Conteúdo'], [['Identificador', U.e(r.id)], ['Data e hora', U.e(C.Clock.label(r.at))], ['Valor', U.money(r.value)], ['Descrição', U.e(r.description)], ['Forma de destino', U.e(r.resolution || 'Lançamento interno')], ...(r.from ? [['Origem', U.e(r.from.name + ' · agência ' + r.from.branch + ' · conta ' + r.from.number)]] : []), ...(r.receiver ? [['Recebedor', U.e(r.receiver.name + ' · ' + r.receiver.document)], ['Conta de destino', U.e(r.receiver.institution + ' · agência ' + r.receiver.branch + ' · conta ' + r.receiver.number + ' · ' + r.receiver.type)]] : []), ...(r.line ? [['Linha digitável', U.e(r.line)], ['Valor nominal', U.money(r.nominal)], ['Multa', U.money(r.fine || 0)], ['Juros', U.money(r.interest || 0)], ['Desconto', U.money(r.discount || 0)], ['Data de liquidação', U.e(r.settlementDate)]] : []), ...(r.reason ? [['Motivo da devolução', U.e(r.reason)]] : []), ...(r.original ? [['Operação original', U.e(r.original)]] : [])]) + U.link('extrato', 'Extrato e segunda via')) + U.card('Histórico da transação', (tx.error ? '<div class="banner error">' + U.e(tx.error.codigo + ' · ' + tx.error.detalhe) + '</div>' : '') + U.history(tx)), 'F2 · RN10–RN14 · F3 RN10');
  }, null);
  C.Router.register('operacoes', 'Histórico de operações', s => U.page('Histórico de operações', 'Operações concluídas, rejeitadas e devolvidas, com estados auditáveis.', U.card('Operações da conta', U.table(['Data', 'Descrição', 'Valor', 'Situação', 'Consulta'], s.transactions.filter(t => t.from === s.session.account || t.to === s.session.account).slice().reverse().map(t => [U.e(C.Clock.label(t.at)), U.e(t.description), U.money(t.value), U.badge(t.status), U.link('comprovante?id=' + t.id, 'Ver detalhes')]))), 'F2 RN10–RN14'), 'Movimentar');
})(Cesbank);
