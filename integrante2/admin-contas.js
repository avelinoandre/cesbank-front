/* Integrante 2 · F5 RN2/RN10/RN11/RN12 · consulta e administração simulada. */
(function (C) {
  'use strict';

  const U = C.UI;
  C.Router.register('admin-contas', 'Administração de contas', s => U.page('Administração e consulta de contas', 'A área de analista consulta a base fictícia e registra restrições usadas nas análises.', U.card('Contas', U.table(['Titular', 'CPF / CNPJ', 'Conta / tipo', 'Situação', 'Qualificação', 'Consulta e ações'], s.accounts.map(a => {
    const u = C.S.accounts.client(s, a.client);
    return [U.e(u.social || u.name), U.e(C.V.mask(u.cpf)), U.e(a.branch + ' / ' + a.number) + `<small>${U.e(a.registrationType)} · ${U.e(a.subtype)}</small>`, U.badge(a.status), U.e(u.qualification), U.action('Consultar', () => {
      C.Session.requireAnalyst(C.Db.get());
      U.modal('Consulta cadastral e financeira', U.json({
        account: a,
        client: {
          ...u,
          credential: undefined,
          passwordHistory: undefined
        },
        balance: C.S.accounts.balance(s, a.id)
      }));
    }, 'secondary') + U.action(u.restriction ? 'Retirar restrição' : 'Registrar restrição', () => {
      C.Db.transaction(x => {
        C.Session.requireAnalyst(x);
        const who = C.S.accounts.client(x, u.id);
        who.restriction = !who.restriction;
        C.S.audit(x, 'compliance', who.id, who.restriction ? 'Restrição fictícia registrada.' : 'Restrição retirada.');
      });
      U.done('Situação cadastral atualizada.');
    }, 'secondary')];
  }))) + U.card('Decisões cadastrais imutáveis', U.table(['Protocolo', 'Situação', 'Motivo / critério'], s.registrations.filter(r => r.status !== 'RASCUNHO').map(r => [U.e(r.id), U.badge(r.status), U.e(r.reason) + '<small>' + U.e(r.criterion || 'Critérios atendidos') + '</small>']))), 'F5 · RN2, RN10–RN12'), 'Cadastro e crédito');
})(Cesbank);
