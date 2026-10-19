/* Núcleo · F2 RN1–14, F7, F12 RN10, F14 · serviços integrados e máquinas de estado. */
(function (C) {
  'use strict';

  const M = C.M,
    K = C.Clock;
  const graphs = {
    transaction: {
      EM_PROCESSAMENTO: ['EFETIVADA', 'REJEITADA', 'DEVOLVIDA'],
      EFETIVADA: ['DEVOLVIDA'],
      REJEITADA: [],
      DEVOLVIDA: []
    },
    schedule: {
      PENDENTE: ['EXECUTADA', 'FALHADA', 'CANCELADA'],
      EXECUTADA: [],
      FALHADA: [],
      CANCELADA: []
    },
    claim: {
      ABERTA: ['AGUARDANDO_RESOLUCAO', 'CANCELADA'],
      AGUARDANDO_RESOLUCAO: ['CONFIRMADA', 'CANCELADA'],
      CONFIRMADA: ['CONCLUIDA', 'CANCELADA'],
      CONCLUIDA: [],
      CANCELADA: []
    },
    card: {
      INATIVO: ['ATIVO', 'CANCELADO'],
      ATIVO: ['BLOQUEADO', 'CANCELADO'],
      BLOQUEADO: ['ATIVO', 'CANCELADO'],
      CANCELADO: []
    },
    contract: {
      EM_ANALISE: ['APROVADO', 'RECUSADO', 'CANCELADO'],
      APROVADO: ['ATIVO', 'CANCELADO'],
      RECUSADO: [],
      ATIVO: ['EM_ATRASO', 'LIQUIDADO'],
      EM_ATRASO: ['ATIVO', 'LIQUIDADO'],
      LIQUIDADO: [],
      CANCELADO: []
    },
    invoice: {
      ABERTA: ['FECHADA'],
      FECHADA: ['PAGA', 'PAGA_PARCIALMENTE', 'EM_ATRASO'],
      PAGA_PARCIALMENTE: ['PAGA', 'EM_ATRASO'],
      EM_ATRASO: ['PAGA', 'PAGA_PARCIALMENTE'],
      PAGA: []
    },
    dispute: {
      ABERTA: ['EM_ANALISE'],
      EM_ANALISE: ['PROCEDENTE', 'IMPROCEDENTE'],
      PROCEDENTE: ['ENCERRADA'],
      IMPROCEDENTE: ['ENCERRADA'],
      ENCERRADA: []
    },
    boleto: {
      ABERTO: ['PAGO', 'REJEITADO'],
      REJEITADO: ['REJEITADO_RECORRIDO'],
      REJEITADO_RECORRIDO: ['ABERTO', 'REJEITADO'],
      PAGO: []
    },
    application: {
      ATIVA: ['RESGATADA_PARCIALMENTE', 'RESGATADA'],
      RESGATADA_PARCIALMENTE: ['RESGATADA_PARCIALMENTE', 'RESGATADA'],
      RESGATADA: []
    },
    box: {
      ATIVA: ['CONCLUIDA', 'ENCERRADA'],
      CONCLUIDA: ['ATIVA', 'ENCERRADA'],
      ENCERRADA: []
    }
  };
  function audit(s, type, id, detail) {
    s.audit.push({
      id: C.Ids.uuid(),
      at: s.now,
      actor: s.systemProcessing ? 'SISTEMA' : s.session.role === 'ANALISTA' ? 'ANALISTA_CESBANK' : s.session.client,
      role: s.session.role,
      channel: 'PROTOTIPO_LOCAL',
      type,
      entity: id,
      detail
    });
  }
  function transition(s, row, kind, to, detail = '') {
    const before = row.status;
    C.assert(graphs[kind]?.[before]?.includes(to), `Transição não permitida: ${before} → ${to}.`);
    row.status = to;
    (row.history ||= []).push({
      from: before,
      to,
      at: s.now,
      actor: s.systemProcessing ? 'SISTEMA' : s.session.role === 'ANALISTA' ? 'ANALISTA_CESBANK' : s.session.client,
      detail
    });
    audit(s, kind, row.id, `${before} → ${to}: ${detail}`);
  }
  const account = (s, id) => {
    const a = s.accounts.find(a => a.id === id);
    if (!a || a.status !== 'ATIVA') C.fail('ContaInexistenteOuInativa');
    return a;
  };
  const client = (s, id) => s.clients.find(c => c.id === id);
  function balance(s, id) {
    const a = s.accounts.find(a => a.id === id);
    C.assert(a, 'Conta não encontrada.');
    const invested = s.applications.filter(p => p.account === id && p.status !== 'RESGATADA').reduce((v, p) => v + p.balance, 0);
    const boxes = s.boxes.filter(b => b.account === id && b.status !== 'ENCERRADA').reduce((v, b) => v + b.balance, 0);
    return {
      total: a.total,
      blocked: a.blocked,
      invested,
      boxes,
      available: a.total - a.blocked - invested - boxes
    };
  }
  function ceilings(s, id) {
    const q = client(s, account(s, id).client).qualification;
    return q === 'ALTA' ? {
      daily: 5000000,
      per: 2000000,
      night: 300000,
      withdraw: 500000
    } : q === 'MEDIA' ? {
      daily: 2000000,
      per: 1000000,
      night: 200000,
      withdraw: 300000
    } : {
      daily: 500000,
      per: 200000,
      night: 50000,
      withdraw: 100000
    };
  }
  function consumption(s, id, date = K.day(s.now)) {
    return s.transactions.filter(t => t.from === id && t.consumesLimit && t.status === 'EFETIVADA' && K.day(t.at) === date).reduce((v, t) => v + t.value, 0);
  }
  function check(s, id, value, limits = true) {
    C.assert(Number.isSafeInteger(value) && value > 0, 'O valor deve ser maior que zero.');
    const a = account(s, id);
    if (balance(s, id).available < value) C.fail('SaldoInsuficiente');
    if (!limits) return;
    if (value > a.limits.per) C.fail('LimitePorTransacaoExcedido');
    if (value + consumption(s, id) > a.limits.daily) C.fail('LimiteDiarioExcedido');
    if ((K.hour(s.now) >= 20 || K.hour(s.now) < 6) && value > a.limits.night) C.fail('LimiteNoturnoExcedido');
  }
  function ledger(s, acc, value, nature, type, description, transaction, extra = {}) {
    const row = {
      id: C.Ids.uuid(),
      account: acc,
      value,
      nature,
      type,
      description,
      transaction,
      at: s.now,
      status: 'TRANSACAO_EFETIVADA',
      ...extra
    };
    s.ledger.push(row);
    return row;
  }
  function request(s, id, fn) {
    C.assert(C.Ids.valid(id), 'O identificador de requisição deve ser UUID versão 4.');
    if (s.requests[id]) return {
      ...s.requests[id],
      duplicate: true,
      code: 'RequisicaoDuplicada'
    };
    const result = fn();
    s.requests[id] = C.Db.clone(result);
    return result;
  }
  function notify(s, who, text, channel = 'PUSH') {
    s.notifications.push({
      id: C.Ids.uuid(),
      client: who,
      text,
      channel,
      at: s.now,
      read: false
    });
  }
  function move(s, {
    from,
    to,
    value,
    type = 'PIX',
    requestId,
    description = 'Transferência',
    resolution = 'DADOS_BANCARIOS',
    limits = true,
    extra = {}
  }) {
    return request(s, requestId, () => {
      const a = account(s, from),
        b = to ? account(s, to) : null;
      C.assert(!b || a.id !== b.id, 'Origem e destino não podem ser a mesma conta.');
      check(s, from, value, limits);
      const tx = {
        id: C.Ids.e2e(s),
        requestId,
        from,
        to: to || null,
        value,
        type,
        description,
        resolution,
        at: s.now,
        status: 'EM_PROCESSAMENTO',
        history: [{
          to: 'EM_PROCESSAMENTO',
          at: s.now,
          actor: s.systemProcessing ? 'SISTEMA' : s.session.role === 'ANALISTA' ? 'ANALISTA_CESBANK' : s.session.client
        }],
        consumesLimit: limits,
        receiver: b ? {
          name: C.V.name(client(s, b.client).social || client(s, b.client).name),
          document: C.V.mask(client(s, b.client).cpf),
          number: '***' + b.number.slice(-4),
          branch: b.branch,
          institution: b.institution,
          type: b.type
        } : null,
        ...extra
      };
      s.transactions.push(tx);
      a.total -= value;
      ledger(s, from, value, 'DEBITO', type, description, tx.id, {
        counterparty: tx.receiver
      });
      if (s.demo.failAfterDebit) {
        s.demo.failAfterDebit = false;
        a.total += value;
        const reversal = {
          id: C.Ids.e2e(s, 'D'),
          from: null,
          to: from,
          value,
          type: 'OUTROS',
          description: 'Estorno automático · BE08',
          at: s.now,
          status: 'EFETIVADA',
          original: tx.id,
          reason: 'BE08',
          history: [{
            to: 'EFETIVADA',
            at: s.now,
            actor: 'SISTEMA'
          }]
        };
        s.transactions.push(reversal);
        ledger(s, from, value, 'CREDITO', 'OUTROS', reversal.description, reversal.id);
        transition(s, tx, 'transaction', 'DEVOLVIDA', 'BE08 · falha simulada após débito; saldo integralmente restaurado');
        notify(s, a.client, 'Falha operacional: estorno automático BE08 concluído.');
        return tx;
      }
      if (b) {
        b.total += value;
        ledger(s, to, value, 'CREDITO', type, description, tx.id, {
          counterparty: {
            name: C.V.name(client(s, a.client).social || client(s, a.client).name),
            document: C.V.mask(client(s, a.client).cpf),
            number: '***' + a.number.slice(-4)
          }
        });
      }
      transition(s, tx, 'transaction', 'EFETIVADA');
      tx.receipt = {
        id: tx.id,
        at: tx.at,
        value,
        description,
        resolution,
        from: {
          branch: a.branch,
          number: a.number,
          name: client(s, a.client).social || client(s, a.client).name
        },
        receiver: tx.receiver,
        ...extra
      };
      return tx;
    });
  }
  function credit(s, id, value, type, description, extra = {}) {
    const a = account(s, id);
    C.assert(value >= 0 && Number.isSafeInteger(value), 'Crédito inválido.');
    a.total += value;
    const tx = {
      id: C.Ids.e2e(s),
      from: null,
      to: id,
      value,
      type,
      description,
      at: s.now,
      status: 'EFETIVADA',
      history: [{
        to: 'EFETIVADA',
        at: s.now,
        actor: 'SISTEMA'
      }],
      ...extra
    };
    s.transactions.push(tx);
    ledger(s, id, value, 'CREDITO', type, description, tx.id);
    return tx;
  }
  function owner(s, entity) {
    C.assert(entity && entity.account === s.session.account && s.session.role === 'CLIENTE', 'Operação permitida apenas ao titular da conta selecionada.');
    return entity;
  }
  C.S.audit = audit;
  C.S.transition = transition;
  C.S.notify = notify;
  C.S.request = request;
  C.S.owner = owner;
  C.S.ledger = ledger;
  C.S.move = move;
  C.S.credit = credit;
  C.S.recordRejection = function (s, d, ex) {
    if (s.requests[d.requestId]) return s.requests[d.requestId];
    if (!C.Ids.valid(d.requestId) || !Number.isSafeInteger(d.value)) return null;
    const tx = {
      id: C.Ids.e2e(s),
      requestId: d.requestId,
      from: s.session.account,
      to: null,
      value: d.value,
      type: d.method === 'PIX' ? 'PIX' : 'TRANSFERENCIA_MESMA_INSTITUICAO',
      description: d.description || 'Transferência recusada',
      at: s.now,
      status: 'EM_PROCESSAMENTO',
      history: [{
        to: 'EM_PROCESSAMENTO',
        at: s.now,
        actor: s.systemProcessing ? 'SISTEMA' : s.session.role === 'ANALISTA' ? 'ANALISTA_CESBANK' : s.session.client
      }],
      error: C.errorData(ex)
    };
    s.transactions.push(tx);
    transition(s, tx, 'transaction', 'REJEITADA', tx.error.codigo + ' · ' + tx.error.detalhe);
    s.requests[d.requestId] = C.Db.clone(tx);
    return tx;
  };
  C.S.accounts = {
    account,
    client,
    balance,
    ceilings,
    consumption,
    check,
    own(s) {
      return account(s, s.session.account);
    },
    resolve(s, branch, number, institution = '12345678') {
      C.assert(C.V.branch(branch) && C.V.account(number) && /^\d{8}$/.test(institution), 'Dados bancários fora do formato do Anexo A.7.');
      const a = s.accounts.find(a => a.branch === branch && a.number === number && a.institution === institution && a.status === 'ATIVA');
      if (!a) C.fail('ContaInexistenteOuInativa');
      return a;
    }
  };
  C.processors.push(s => {
    s.limitChanges.filter(r => r.status === 'EM_CARENCIA' && r.effective <= s.now).forEach(r => {
      const a = account(s, r.account);
      const next = {
        ...a.limits,
        [r.kind]: r.value
      };
      if (next.night > next.per) {
        r.status = 'CANCELADA';
        r.reason = 'Incompatível com limite noturno vigente.';
      } else {
        a.limits = next;
        r.status = 'APLICADA';
        r.applied = s.now;
        notify(s, a.client, 'Aumento de limite entrou em vigor.');
      }
      audit(s, 'limite', r.id, r.status);
    });
  });
})(Cesbank);
