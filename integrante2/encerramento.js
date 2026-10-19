/* Integrante 2 · integração F5 com F1, F9 e saldos segregados. */
(function (C) {
  'use strict';

  const U = C.UI;
  C.S.closure = function (s) {
    C.Session.requireClient(s);
    const a = C.S.accounts.own(s);
    C.assert(a.total === 0 && a.blocked === 0, 'O encerramento exige saldo total zero, sem valores bloqueados, investimentos ou caixinhas com saldo.');
    C.assert(!s.contracts.some(c => c.client === a.client && ['ATIVO', 'EM_ATRASO', 'APROVADO', 'EM_ANALISE'].includes(c.status)), 'Não é possível encerrar conta com empréstimo ativo ou em análise.');
    C.assert(!s.cards.some(c => c.account === a.id && c.used > 0), 'Quite os débitos do cartão antes de encerrar a conta.');
    C.S.pix.closeAccount(s, a.id);
    s.schedules.filter(r => r.account === a.id && r.status === 'PENDENTE').forEach(r => C.S.transition(s, r, 'schedule', 'CANCELADA', 'ACCOUNT_CLOSURE'));
    s.cards.filter(c => c.account === a.id && c.status !== 'CANCELADO').forEach(c => C.S.transition(s, c, 'card', 'CANCELADO', 'ACCOUNT_CLOSURE'));
    a.status = 'ENCERRADA';
    a.closed = s.now;
    C.S.audit(s, 'conta', a.id, 'Encerrada; chaves inativadas automaticamente por ACCOUNT_CLOSURE.');
    return a;
  };
  C.Router.register('encerrar-conta', 'Encerrar conta', s => U.page('Encerrar conta', 'Saldo zero e ausência de empréstimos ativos são obrigatórios.', U.balance(s) + U.card('Solicitação de encerramento', '<p>O encerramento inativa as chaves Pix, cancela agendamentos pendentes e preserva os registros históricos.</p>' + U.action('Revisar encerramento', () => U.modal('Confirme o encerramento da conta', U.form(U.checkbox('agree', 'Confirmo que desejo encerrar esta conta fictícia.'), d => {
    C.assert(d.agree, 'Confirme o encerramento.');
    C.Db.transaction(x => C.S.closure(x));
    U.close();
    C.Router.go('perfis');
    U.render();
    U.flash('Conta encerrada. Chaves Pix inativadas por ACCOUNT_CLOSURE.');
  }, 'Confirmar encerramento', 'danger')), 'danger')), 'F5 · RN10–RN12 · integração F1 RN7'), 'Cadastro e crédito');
})(Cesbank);
