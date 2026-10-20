/* Integrante 5 · F8 RN1–RN7 · destinos validados, revalidação e remoção lógica. */
(function (C) {
  'use strict';

  // Dependências do módulo
  const U = C.UI,
    A = C.S.accounts;

  // Cadastro, edição e revalidação
  function save(s, d, id) {
    C.Session.requireClient(s);
    C.assert(d.alias.trim(), 'Todo favorito exige apelido e uma forma de destino.');

    const aliases = s.favorites.filter(f => f.client === s.session.client && !f.removed && f.id !== id);

    C.assert(
      !aliases.some(f => f.alias.toLowerCase() === d.alias.trim().toLowerCase()),
      'O apelido do favorito não pode se repetir dentro da lista do mesmo cliente.'
    );

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
      C.assert(
        /^\d{8}$/.test(d.institution) &&
          C.V.branch(d.branch) &&
          C.V.account(d.number) && (
          /^[0-9]{11}$/.test(d.document) || /^[A-Za-z0-9]{14}$/.test(d.document)),
        'Dados bancários e documento do titular são obrigatórios.'
      );
      C.assert(A.client(s, a.client).cpf === d.document, 'O documento não corresponde ao titular da conta.');
    }

    C.assert(
      !aliases.some(f => f.destinationAccount === a.id),
      'O mesmo destino não pode ser cadastrado duas vezes pelo mesmo cliente.'
    );

    const f = id
      ? s.favorites.find(v => v.id === id && v.client === s.session.client)
      : {
        id: C.Ids.uuid(),
        client: s.session.client
      };

    C.assert(f, 'Favorito não encontrado.');
    Object.assign(
      f,
      {
        alias: d.alias.trim(),
        destination,
        destinationAccount: a.id,
        name: C.V.name(A.client(s, a.client).social || A.client(s, a.client).name),
        invalid: false,
        removed: false,
        updated: s.now
      }
    );

    if (!id) s.favorites.push(f);

    C.S.audit(
      s,
      'favorito',
      f.id,
      id ? 'Editado/revalidado sem alterar operações anteriores.' : 'Cadastrado e validado.'
    );

    return f;
  }

  // Serviço compartilhado
  C.S.favorites = {
    save
  };

  // Campos e tela de favoritos
  function fields(f = {}) {
    const d = f.destination || {};

    return '<div class="fields">' +
      U.field('alias', 'Apelido', f.alias || '') +
      U.select('method', 'Forma de destino', [
        ['PIX', 'Pix'],
        ['DADOS_BANCARIOS', 'Dados bancários']
      ], d.method) +
      U.field('key', 'Chave Pix', d.key || 'joao@cesbank.com') +
      U.field('institution', 'Instituição', d.institution || '12345678') +
      U.field('branch', 'Agência', d.branch || '0001') +
      U.field('number', 'Conta', d.number || '0007654322') +
      U.field('document', 'Documento do titular (dados bancários)', d.document || '11144477735') +
      '</div>';
  }

  // Exemplos usam destinatários ativos da base fictícia, sem salvar automaticamente.
  function examples(s) {
    const recipients = s.accounts.filter(account => account.status === 'ATIVA' && account.id !== s.session.account).slice(0, 3);

    return U.card('Exemplos para demonstrar', '<p>Escolha um destinatário para preencher o cadastro. Clique em Cadastrar para salvar; depois experimente editar, transferir ou remover.</p><div class="i5-examples">' +
      recipients.map((account, index) => {
        const person = A.client(s, account.client);
        const key = s.keys.find(row => row.account === account.id && row.status === 'ATIVA' && row.type === 'EMAIL');
        const method = index === 1 || !key ? 'DADOS_BANCARIOS' : 'PIX';
        const title = person.name.split(' ')[0] + (method === 'PIX' ? ' por Pix' : ' por conta');

        return '<article><h3>' + U.e(title) + '</h3><p>' + U.e(method === 'PIX' ? key.value : 'Agência ' + account.branch + ' · conta ' + account.number) + '</p>' +
          U.action('Usar exemplo: ' + title, () => {
            const form = document.querySelector('#content form');
            const values = { alias: person.name.split(' ')[0], method, key: key?.value || '', institution: account.institution, branch: account.branch, number: account.number, document: person.cpf };

            Object.entries(values).forEach(([name, value]) => {
              form.elements.namedItem(name).value = value;
            });
            form.scrollIntoView({ behavior: 'smooth', block: 'center' });
            form.elements.namedItem('alias').focus({ preventScroll: true });
            U.flash('Exemplo preenchido. Revise o apelido e clique em Cadastrar.');
          }, 'secondary') + '</article>';
      }).join('') + '</div>');
  }

  C.Router.register(
    'favoritos',
    'Favoritos',
    s => U.page(
      'Destinatários favoritos',
      'Edição e remoção preservam os dados históricos das transferências.',
      examples(s) + U.card(
        'Minha lista',
        U.table(
          ['Apelido', 'Titular / destino', 'Situação', 'Ações'],
          s.favorites.filter(f => f.client === s.session.client && !f.removed).map(
            f => [
              U.e(f.alias),
              U.e(f.name) + `<small>${U.e(f.destination.key || f.destination.number)}</small>`,
              U.badge(f.invalid ? 'INVALIDO' : 'VALIDO'),
              (f.invalid ? '' : U.link('transferencia?favorito=' + f.id, 'Transferir')) +
                U.action(
                  f.invalid ? 'Revalidar' : 'Editar',
                  () => U.modal(
                    'Editar e revalidar favorito',
                    U.form(
                      fields(f),
                      d => {
                        C.Db.transaction(x => save(x, d, f.id));
                        U.done('Favorito atualizado e revalidado.');
                      },
                      'Salvar'
                    )
                  ),
                  'secondary'
                ) +
                U.action(
                  'Remover',
                  () => {
                    C.Db.transaction(
                      x => {
                        C.Session.requireClient(x);

                        const row = x.favorites.find(v => v.id === f.id && v.client === x.session.client);

                        C.assert(row, 'Favorito não encontrado.');
                        row.removed = true;
                        C.S.audit(x, 'favorito', row.id, 'Remoção lógica.');
                      }
                    );
                    U.done('Favorito removido da lista. Histórico preservado.');
                  },
                  'danger'
                )
            ]
          )
        )
      ) +
        U.card(
          'Cadastrar favorito',
          U.form(
            fields(),
            d => {
              C.Db.transaction(x => save(x, d));
              U.done('Favorito cadastrado.');
            },
            'Cadastrar'
          )
        ),
      'F8 · RN1–RN7'
    ),
    'Movimentar'
  );
})(
  Cesbank
);
