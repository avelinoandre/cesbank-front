/* Integrante 6 · F1 RN1–10 derivadas do Anexo A, F2 e F8; ver ASSUNCOES.md. */
(function (C) {
  'use strict';

  const U = C.UI,
    A = C.S.accounts,
    K = C.Clock;
  const reasons = ['USER_REQUESTED', 'ACCOUNT_CLOSURE', 'BRANCH_TRANSFER', 'RECONCILIATION', 'FRAUD'];
  const open = r => !['CONCLUIDA', 'CANCELADA'].includes(r.status);
  function resolve(s, value, count = true) {
    if (count) {
      const period = s.session.client + ':' + K.day(s.now);
      if ((s.queryCounts[period] || 0) >= C.policy.keyQueries) C.fail('ConsultasExcedidas');
      s.queryCounts[period] = (s.queryCounts[period] || 0) + 1;
    }
    const key = s.keys.find(k => k.value === (value.includes('@') ? value.toLowerCase() : value) && k.status === 'ATIVA');
    if (!key) C.fail('ChaveNaoEncontrada');
    if (s.claims.some(r => r.key === key.id && open(r))) C.fail('ChaveBloqueadaPorReivindicacao');
    const a = A.account(s, key.account),
      u = A.client(s, a.client);
    return {
      dataResposta: s.now,
      chave: {
        valor: key.value,
        tipo: key.type,
        situacao: 'ATIVA',
        conta: {
          instituicao: a.institution,
          agencia: a.branch,
          numero: a.number,
          tipoConta: a.type
        },
        titular: {
          nome: C.V.name(u.social || u.name),
          documento: C.V.mask(u.cpf)
        }
      },
      estatisticas: {
        consultasNoPeriodo: s.queryCounts[s.session.client + ':' + K.day(s.now)] || 0,
        reivindicacoesAbertas: s.claims.filter(r => r.key === key.id && open(r)).length,
        contestacoes: s.disputes.filter(r => r.receiver === a.id).length
      },
      accountId: a.id
    };
  }
  function add(s, d) {
    C.Session.requireClient(s);
    const a = A.own(s),
      u = A.client(s, a.client);
    return C.S.request(s, d.requestId, () => {
      let value = d.type === 'EVP' ? C.Ids.uuid() : String(d.value).trim();
      if (d.type === 'EMAIL') value = value.toLowerCase();
      if (!C.V.key(d.type, value)) C.fail('ChaveInvalida');
      C.assert(reasons.includes(d.reason), 'Motivo de operação inválido.');
      if (s.keys.some(k => k.value === value && k.status === 'ATIVA')) C.fail('ChaveJaExiste');
      if (s.keys.filter(k => k.account === a.id && k.status === 'ATIVA').length >= C.policy.keyMax) C.fail('LimiteDeChavesExcedido');
      if (['CPF', 'CNPJ'].includes(d.type) && value !== u.cpf || d.type === 'PHONE' && value !== u.phone || d.type === 'EMAIL' && value !== u.email.toLowerCase()) C.fail('ChaveDeOutroTitular');
      const key = {
        id: C.Ids.uuid(),
        value,
        type: d.type,
        account: a.id,
        status: 'ATIVA',
        reason: d.reason,
        at: s.now,
        history: []
      };
      s.keys.push(key);
      const request = {
        chave: {
          valor: value,
          tipo: d.type,
          conta: {
            instituicao: a.institution,
            agencia: a.branch,
            numero: a.number,
            tipoConta: a.type,
            dataAbertura: a.opened
          },
          titular: {
            tipoPessoa: u.cpf.length === 11 ? 'PESSOA_NATURAL' : 'PESSOA_JURIDICA',
            documento: u.cpf,
            nome: u.name
          }
        },
        motivo: d.reason,
        idRequisicao: d.requestId
      };
      key.request = request;
      C.S.audit(s, 'chave', key.id, 'Cadastro · ' + d.reason);
      return key;
    });
  }
  function remove(s, id, reason) {
    const key = s.keys.find(k => k.id === id);
    C.assert(key && key.status === 'ATIVA', 'Chave não está ativa.');
    C.assert(reasons.includes(reason), 'Motivo inválido.');
    if (s.claims.some(r => r.key === id && open(r))) C.fail('ChaveBloqueadaPorReivindicacao');
    key.status = 'INATIVA';
    key.reason = reason;
    key.history.push({
      at: s.now,
      actor: s.session.client,
      to: 'INATIVA',
      detail: reason
    });
    C.S.audit(s, 'chave', id, 'Inativada · ' + reason);
  }
  C.S.pix = {
    resolve,
    add,
    remove,
    closeAccount(s, id) {
      s.keys.filter(k => k.account === id && k.status === 'ATIVA').forEach(k => {
        s.claims.filter(r => r.key === k.id && open(r)).forEach(r => C.S.transition(s, r, 'claim', 'CANCELADA', 'ACCOUNT_CLOSURE'));
        remove(s, k.id, 'ACCOUNT_CLOSURE');
      });
    }
  };
  C.Router.register('chaves', 'Minhas chaves Pix', s => U.page('Minhas chaves Pix', 'Cadastre, consulte e acompanhe reivindicações. Até 5 chaves ativas por conta.', U.card('Chaves cadastradas', U.table(['Tipo', 'Chave', 'Situação', 'Ações'], s.keys.filter(k => k.account === s.session.account).map(k => [U.e(k.type), U.e(k.value), U.badge(k.status), k.status === 'ATIVA' ? U.action('Excluir', () => U.modal('Excluir chave Pix', U.form(U.select('reason', 'Motivo', reasons), d => {
    C.Db.transaction(x => {
      C.Session.requireClient(x);
      C.S.owner(x, k);
      remove(x, k.id, d.reason);
    });
    U.done('Chave inativada; histórico preservado.');
  }, 'Confirmar exclusão', 'danger')), 'secondary') + U.json(k) : U.json(k)]))) + U.card('Cadastrar chave', U.form('<div class="fields">' + U.select('type', 'Tipo de chave', ['CPF', 'CNPJ', 'PHONE', 'EMAIL', 'EVP']) + U.field('value', 'Chave · EVP será gerada pelo sistema', '') + U.select('reason', 'Motivo', reasons) + U.field('requestId', 'Identificador da requisição UUID v4', C.Ids.uuid()) + '</div>', d => {
    const r = C.Db.transaction(x => add(x, d));
    U.done(r.duplicate ? 'RequisicaoDuplicada · resultado original devolvido.' : 'Chave cadastrada.');
    U.modal('Requisição de cadastro · Anexo A.2', U.json(r));
  }, 'Cadastrar')) + U.link('consulta-pix', 'Consultar chave') + U.link('reivindicacoes', 'Reivindicar chave'), 'F1 · RN1–RN10'), 'Conta e segurança');
  C.Router.register('consulta-pix', 'Consultar chave', s => U.page('Consulta de chave Pix', 'Até 10 consultas por cliente por dia da simulação.', U.card('Resolver chave', U.form(U.field('value', 'Chave Pix', 'joao@cesbank.com'), d => {
    let r, ex;
    C.Db.transaction(x => {
      try {
        r = resolve(x, d.value);
      } catch (e) {
        ex = e;
      }
    });
    if (ex) throw ex;
    U.modal('Resposta da consulta · Anexo A.3', U.json(r));
  }, 'Consultar')), 'F1 · RN1, RN4, RN5, RN9'), null);
  C.Router.register('reivindicacoes', 'Reivindicações Pix', s => U.page('Reivindicações de chave', 'Uma chave com reivindicação aberta fica bloqueada para resolução.', U.card('Abrir reivindicação', U.form(U.field('value', 'Chave vinculada a outra conta', '') + U.select('type', 'Tipo', ['OWNERSHIP', 'PORTABILITY']) + U.checkbox('proof', 'Confirmo a posse fictícia do contato e a documentação da reivindicação.'), d => {
    C.Db.transaction(x => {
      C.Session.requireClient(x);
      C.assert(d.proof, 'Confirme a prova de posse simulada.');
      const key = x.keys.find(k => k.value === d.value && k.status === 'ATIVA');
      if (!key) C.fail('ChaveNaoEncontrada');
      if (x.claims.some(r => r.key === key.id && open(r))) C.fail('ChaveBloqueadaPorReivindicacao');
      C.assert(key.account !== x.session.account, 'A chave já pertence à conta selecionada.');
      const current = A.client(x, A.account(x, key.account).client),
        u = A.client(x, x.session.client);
      if (d.type === 'PORTABILITY') C.assert(current.cpf === u.cpf, 'Portabilidade exige o mesmo titular.', 'ChaveDeOutroTitular');else C.assert(key.type === 'EMAIL' && key.value === u.email || key.type === 'PHONE' && key.value === u.phone, 'Reivindicação de posse exige telefone/e-mail do novo titular.', 'ChaveDeOutroTitular');
      const r = {
        id: C.Ids.uuid(),
        key: key.id,
        account: x.session.account,
        type: d.type,
        status: 'ABERTA',
        at: x.now,
        history: []
      };
      x.claims.push(r);
      C.S.notify(x, current.id, 'Reivindicação aberta para a chave ' + key.value);
    });
    U.done('Reivindicação aberta; chave bloqueada.');
  }, 'Abrir reivindicação')) + U.card('Acompanhamento', U.table(['Chave', 'Tipo', 'Situação', 'Evolução'], s.claims.filter(r => r.account === s.session.account || s.session.role === 'ANALISTA').map(r => {
    const next = {
      ABERTA: 'AGUARDANDO_RESOLUCAO',
      AGUARDANDO_RESOLUCAO: 'CONFIRMADA',
      CONFIRMADA: 'CONCLUIDA'
    }[r.status];
    return [U.e(s.keys.find(k => k.id === r.key).value), U.e(r.type), U.badge(r.status), (next ? U.action('Avançar: ' + next, () => {
      C.Db.transaction(x => {
        C.Session.requireAnalyst(x);
        const q = x.claims.find(v => v.id === r.id);
        if (next === 'CONCLUIDA') C.assert(x.keys.filter(k => k.account === q.account && k.status === 'ATIVA').length < C.policy.keyMax, 'A conta receptora já atingiu o limite de chaves.', 'LimiteDeChavesExcedido');
        C.S.transition(x, q, 'claim', next);
        if (next === 'CONCLUIDA') {
          const key = x.keys.find(k => k.id === q.key);
          key.account = q.account;
          key.reason = 'BRANCH_TRANSFER';
          C.S.audit(x, 'chave', key.id, 'Vínculo transferido por reivindicação concluída.');
        }
      });
      U.done('Situação atualizada.');
    }, 'secondary') : '') + (open(r) ? U.action('Cancelar', () => {
      C.Db.transaction(x => {
        const q = x.claims.find(v => v.id === r.id);
        C.assert(q.account === x.session.account || x.session.role === 'ANALISTA', 'Sem permissão.');
        C.S.transition(x, q, 'claim', 'CANCELADA');
      });
      U.done('Reivindicação cancelada.');
    }, 'danger') : '') + U.history(r)];
  }))), 'F1 · RN6–RN10'), null);
})(Cesbank);
