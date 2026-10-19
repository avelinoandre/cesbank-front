/* Núcleo · seleção de perfis fictícios e autorização local por papel. */
(function (C) {
  'use strict';

  C.Session = {
    select(id, role = 'CLIENTE') {
      C.Db.transaction(s => {
        const a = s.accounts.find(a => a.client === id && a.status === 'ATIVA');
        C.assert(a, 'Este perfil não possui conta ativa.');
        s.session = {
          client: id,
          role,
          account: a.id
        };
      });
    },
    requireClient(s) {
      C.assert(s.session.role === 'CLIENTE', 'Selecione um cliente de demonstração para realizar esta operação.');
      C.S.accounts.own(s);
    },
    requireAnalyst(s) {
      C.assert(s.session.role === 'ANALISTA', 'Selecione o perfil Analista Cesbank.');
    }
  };
})(Cesbank);
