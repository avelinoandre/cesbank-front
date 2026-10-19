/* Integrante 6 · F6 RN1–RN7 · senha, confirmação de contato e auditoria. */
(function (C) {
  'use strict';

  const U = C.UI,
    A = C.S.accounts;
  function policy(value, u) {
    C.assert(value.length >= 8 && /[A-Za-z]/.test(value) && /[0-9]/.test(value), 'A senha deve ter ao menos 8 caracteres e combinar letras e números.');
    const lower = value.toLowerCase(),
      birth = u.birth.replace(/-/g, '');
    C.assert(!value.includes(u.cpf) && !value.includes(birth) && !value.includes(birth.slice(6) + birth.slice(4, 6) + birth.slice(0, 4)) && !value.includes(birth.slice(4)) && !value.includes(birth.slice(0, 4)), 'A senha não pode conter CPF ou data de nascimento.');
    const sequences = ['0123456789', '9876543210', 'abcdefghijklmnopqrstuvwxyz', 'zyxwvutsrqponmlkjihgfedcba'];
    C.assert(!sequences.some(seq => Array.from({
      length: seq.length - 2
    }, (_, i) => seq.slice(i, i + 3)).some(x => lower.includes(x))) && !/(.)\1\1/.test(lower), 'A senha não pode conter sequências simples ou três caracteres iguais.');
  }
  C.S.profile = {
    password(s, d) {
      C.Session.requireClient(s);
      const u = A.client(s, s.session.client);
      C.assert(C.Security.verify(d.current, u.credential), 'Senha atual incorreta.');
      C.assert(d.password === d.confirm, 'A confirmação da nova senha é divergente.');
      policy(d.password, u);
      C.assert(![u.credential, ...u.passwordHistory.slice(-4)].some(cred => C.Security.verify(d.password, cred)), 'A nova senha não pode coincidir com as últimas 5 senhas.');
      u.passwordHistory.push(u.credential);
      u.passwordHistory = u.passwordHistory.slice(-5);
      u.credential = C.Security.credential(d.password);
      C.S.audit(s, 'senha', u.id, 'Valor anterior: ********; nova senha armazenada como SHA-256 com sal.');
      return u.credential;
    },
    contact(s, id, code) {
      C.Session.requireClient(s);
      const otp = C.Security.confirm(s, id, 'CONTATO', code);
      C.assert(otp.client === s.session.client, 'Código pertence a outro cliente.');
      const u = A.client(s, s.session.client);
      const before = u[otp.kind];
      u[otp.kind] = otp.target;
      C.S.audit(s, 'contato', u.id, JSON.stringify({
        field: otp.kind,
        before: otp.kind === 'email' ? before.slice(0, 2) + '***@' + before.split('@')[1] : '*******' + before.slice(-4)
      }));
    }
  };
  C.Router.register('dados', 'Dados e senha', s => {
    const u = A.client(s, s.session.client);
    return U.page('Meus dados e senha', 'Os dados civis exigem nova apresentação de documentos para correção.', U.card('Dados cadastrais', '<div class="fields">' + U.field('name', 'Nome civil', u.name, 'text', 'disabled') + U.field('cpf', 'CPF / CNPJ', u.cpf, 'text', 'disabled') + U.field('birth', 'Data de nascimento', u.birth, 'date', 'disabled') + U.field('email', 'E-mail principal', u.email, 'text', 'disabled') + U.field('phone', 'Telefone principal', u.phone, 'text', 'disabled') + '</div>' + U.action('Solicitar correção de dados civis', () => U.modal('Correção com novos documentos', U.form(U.field('reason', 'Correção desejada') + U.field('files', 'Novos documentos fictícios', '', 'file', 'multiple'), (d, f) => {
      C.Db.transaction(x => {
        C.Session.requireClient(x);
        C.assert(d.reason.trim() && f.elements.files.files.length, 'Descreva a correção e anexe os documentos.');
        const r = {
          id: C.Ids.protocol(x),
          client: x.session.client,
          at: x.now,
          reason: d.reason,
          files: Array.from(f.elements.files.files, v => ({
            name: v.name,
            size: v.size
          })),
          status: 'PENDENTE'
        };
        x.corrections.push(r);
        C.S.audit(x, 'correcao', r.id, 'Nova documentação apresentada.');
      });
      U.done('Solicitação de correção registrada; dados civis preservados até análise.');
    }, 'Enviar solicitação')), 'secondary')) + `<div class="grid">` + U.card('Alterar senha', `<p class="small">Senha fictícia inicial: Cesbank9! · mínimo 8 caracteres; letras e números; histórico de 5 senhas.</p>` + U.form(U.field('current', 'Senha atual', '', 'password') + U.field('password', 'Nova senha', '', 'password') + U.field('confirm', 'Confirmar nova senha', '', 'password'), d => {
      const cred = C.Db.transaction(x => C.S.profile.password(x, d));
      U.done('Senha alterada com sucesso.');
      U.modal('Armazenamento local demonstrativo', '<p>Não há autenticação real. A senha não é guardada em texto claro.</p>' + U.json(cred));
    }, 'Alterar senha')) + U.card('Atualizar contato', U.form(U.select('kind', 'Tipo', [['email', 'E-mail'], ['phone', 'Telefone internacional']]) + U.field('value', 'Novo contato'), d => {
      let otp;
      C.Db.transaction(x => {
        C.Session.requireClient(x);
        let value = d.value.trim();
        if (d.kind === 'email') value = value.toLowerCase();
        C.assert(C.V.key(d.kind === 'email' ? 'EMAIL' : 'PHONE', value), 'Contato fora do formato válido.');
        otp = C.Security.otp(x, 'CONTATO', value);
        otp.kind = d.kind;
        otp.client = x.session.client;
      });
      U.modal('Confirmar posse do novo contato', `<div class="banner warning">Simulação de ${d.kind === 'email' ? 'e-mail' : 'SMS'} para ${U.e(otp.target)}: <strong>${U.e(otp.code)}</strong>. Expira em 5 minutos.</div><p>O contato anterior permanece válido até a confirmação.</p>` + U.form(U.field('code', 'Código'), v => {
        C.Db.transaction(x => C.S.profile.contact(x, otp.id, v.code));
        U.done('Contato principal atualizado com sucesso.');
      }, 'Confirmar contato'));
    }, 'Enviar código simulado')) + '</div>' + U.card('Histórico de alterações', U.table(['Data', 'Alteração', 'Canal', 'Valor anterior / detalhe'], s.audit.filter(r => r.entity === u.id && ['senha', 'contato', 'correcao'].includes(r.type)).map(r => [U.e(C.Clock.label(r.at)), U.e(r.type), U.e(r.channel), U.e(r.detail)]))), 'F6 · RN1–RN7');
  }, 'Conta e segurança');
})(Cesbank);
