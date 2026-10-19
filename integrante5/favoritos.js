/* Integrante 5 · F8 RN1–RN7 · destinos validados, revalidação e remoção lógica. */
(function (C) {
  'use strict';

  const U = C.UI,
    A = C.S.accounts;
  function save(s, d, id) {
    C.Session.requireClient(s);
    C.assert(d.alias.trim(), 'Todo favorito exige apelido e uma forma de destino.');
    const aliases = s.favorites.filter(f => f.client === s.session.client && !f.removed && f.id !== id);
    C.assert(!aliases.some(f => f.alias.toLowerCase() === d.alias.trim().toLowerCase()), 'O apelido do favorito não pode se repetir dentro da lista do mesmo cliente.');
    const destination = {
      method: d.method,
      key: d.key?.trim(),
      institution: d.institution,
      branch: d.branch,
      number: d.number,
      document: d.document
    };
    const a = C.S.destination(s, destination);
    if (d.method !== 'PIX') {
      C.assert(/^\d{8}$/.test(d.institution) && C.V.branch(d.branch) && C.V.account(d.number) && (/^[0-9]{11}$/.test(d.document) || /^[A-Za-z0-9]{14}$/.test(d.document)), 'Dados bancários e documento do titular são obrigatórios.');
      C.assert(A.client(s, a.client).cpf === d.document, 'O documento não corresponde ao titular da conta.');
    }
    C.assert(!aliases.some(f => f.destinationAccount === a.id), 'O mesmo destino não pode ser cadastrado duas vezes pelo mesmo cliente.');
    const f = id ? s.favorites.find(v => v.id === id && v.client === s.session.client) : {
      id: C.Ids.uuid(),
      client: s.session.client
    };
    C.assert(f, 'Favorito não encontrado.');
    Object.assign(f, {
      alias: d.alias.trim(),
      destination,
      destinationAccount: a.id,
      name: C.V.name(A.client(s, a.client).social || A.client(s, a.client).name),
      invalid: false,
      removed: false,
      updated: s.now
    });
    if (!id) s.favorites.push(f);
    C.S.audit(s, 'favorito', f.id, id ? 'Editado/revalidado sem alterar operações anteriores.' : 'Cadastrado e validado.');
    return f;
  }
  C.S.favorites = {
    save
  };
  function fields(f = {}) {
    const d = f.destination || {};
    return '<div class="fields">' + U.field('alias', 'Apelido', f.alias || '') + U.select('method', 'Forma de destino', [['PIX', 'Pix'], ['DADOS_BANCARIOS', 'Dados bancários']], d.method) + U.field('key', 'Chave Pix', d.key || 'joao@cesbank.com') + U.field('institution', 'Instituição', d.institution || '12345678') + U.field('branch', 'Agência', d.branch || '0001') + U.field('number', 'Conta', d.number || '0007654322') + U.field('document', 'Documento do titular (dados bancários)', d.document || '11144477735') + '</div>';
  }
  C.Router.register('favoritos', 'Favoritos', s => U.page('Destinatários favoritos', 'Edição e remoção preservam os dados históricos das transferências.', U.card('Minha lista', U.table(['Apelido', 'Titular / destino', 'Situação', 'Ações'], s.favorites.filter(f => f.client === s.session.client && !f.removed).map(f => [U.e(f.alias), U.e(f.name) + `<small>${U.e(f.destination.key || f.destination.number)}</small>`, U.badge(f.invalid ? 'INVALIDO' : 'VALIDO'), (f.invalid ? '' : U.link('transferencia?favorito=' + f.id, 'Transferir')) + U.action(f.invalid ? 'Revalidar' : 'Editar', () => U.modal('Editar e revalidar favorito', U.form(fields(f), d => {
    C.Db.transaction(x => save(x, d, f.id));
    U.done('Favorito atualizado e revalidado.');
  }, 'Salvar')), 'secondary') + U.action('Remover', () => {
    C.Db.transaction(x => {
      C.Session.requireClient(x);
      const row = x.favorites.find(v => v.id === f.id && v.client === x.session.client);
      C.assert(row, 'Favorito não encontrado.');
      row.removed = true;
      C.S.audit(x, 'favorito', row.id, 'Remoção lógica.');
    });
    U.done('Favorito removido da lista. Histórico preservado.');
  }, 'danger')]))) + U.card('Cadastrar favorito', U.form(fields(), d => {
    C.Db.transaction(x => save(x, d));
    U.done('Favorito cadastrado.');
  }, 'Cadastrar')), 'F8 · RN1–RN7'), 'Movimentar');
})(Cesbank);
