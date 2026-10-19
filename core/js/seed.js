/* Núcleo · dados fictícios de demonstração para F1–F14; relógio compatível com A.8. */
(function (C) {
  'use strict';

  C.policy = {
    keyMax: 5,
    keyQueries: 10,
    boxMax: 5,
    limitWaitHours: 24,
    proposalMinutes: 30,
    loanMin: 10000,
    loanMax: 5000000,
    loanMinMonths: 2,
    loanMaxMonths: 60,
    loanRateBp: 250,
    incomeBp: 3000,
    iofFixedBp: 38,
    iofDailyMillion: 82,
    loanFee: 2500,
    lateFineBp: 200,
    lateMonthBp: 100,
    rotationMonthBp: 1200,
    minimumBp: 1500,
    cardBlockDays: 5,
    cardAgeDays: 30,
    cardReserveHours: 48,
    cardRenewDays: 30,
    contactless: 20000,
    installments: 12,
    disputeDays: 80,
    appealDays: 5,
    boletoOverdueDays: 90,
    boletoCutoff: 17,
    retries: 3,
    exportDays: 30,
    boxDailyMillion: 165,
    brokerage: 490
  };
  C.seed = function () {
    const now = '2025-02-03T13:00:00Z';
    const clients = [['maria', 'Maria Souza', '52998224725', 800000, '1990-05-18', 'maria@cesbank.com', '+5581999998888'], ['joao', 'João P. Andrade', '11144477735', 500000, '1985-08-22', 'joao@cesbank.com', '+5511999998877'], ['carlos', 'Carlos Mendes', '12345678909', 300000, '1997-10-12', 'carlos@cesbank.com', '+5521999997766'], ['beneficiario', 'Loja Exemplo Ltda.', '12345678000190', 1200000, '1990-01-01', 'loja@exemplo.com', '+5511999887766']].map(([id, name, cpf, income, birth, email, phone]) => ({
      id,
      name,
      social: '',
      cpf,
      income,
      periodicity: 'MENSAL',
      birth,
      email,
      phone,
      occupation: 'EMPREGADO',
      restriction: false,
      credential: C.Security.credential('Cesbank9!'),
      passwordHistory: [],
      joined: '2024-08-01',
      qualification: income >= 700000 ? 'ALTA' : income >= 400000 ? 'MEDIA' : 'BASICA'
    }));
    const accounts = clients.map((u, i) => ({
      id: 'a' + i,
      client: u.id,
      branch: '0001',
      number: String(7654321 + i).padStart(10, '0'),
      institution: '12345678',
      type: 'CACC',
      registrationType: 'CONTA_DEPOSITO_A_VISTA',
      subtype: 'INDIVIDUAL',
      status: 'ATIVA',
      opened: '2024-08-01T13:00:00Z',
      total: [2500000, 1000000, 350000, 5000000][i],
      blocked: 0,
      limits: {
        daily: 1000000,
        per: 500000,
        night: 100000,
        withdraw: 100000
      }
    }));
    accounts.forEach((a, i) => {
      if (i === 2) a.limits = {
        daily: 300000,
        per: 150000,
        night: 30000,
        withdraw: 50000
      };
    });
    const transactions = [],
      ledger = [];
    accounts.forEach((a, i) => {
      for (const [nature, value, type, at, label] of [['CREDITO', a.total + 30000, 'DEPOSITO', '2025-01-03T13:00:00Z', 'Depósito fictício inicial'], ['DEBITO', 30000, 'SAQUE', '2025-01-20T13:00:00Z', 'Saque fictício']]) {
        const id = 'E12345678' + at.replace(/\D/g, '').slice(0, 12) + C.Ids.uuid().replace(/-/g, '').slice(0, 11);
        transactions.push({
          id,
          from: nature === 'DEBITO' ? a.id : null,
          to: nature === 'CREDITO' ? a.id : null,
          value,
          type,
          description: label,
          at,
          status: 'EFETIVADA',
          history: [{
            to: 'EFETIVADA',
            at,
            actor: 'SISTEMA'
          }]
        });
        ledger.push({
          id: C.Ids.uuid(),
          account: a.id,
          value,
          nature,
          type,
          description: label,
          transaction: id,
          at,
          status: 'TRANSACAO_EFETIVADA'
        });
      }
    });
    const keys = clients.flatMap((u, i) => [{
      id: C.Ids.uuid(),
      value: u.email,
      type: 'EMAIL',
      account: 'a' + i,
      status: 'ATIVA',
      reason: 'USER_REQUESTED',
      history: []
    }, {
      id: C.Ids.uuid(),
      value: u.cpf,
      type: i === 3 ? 'CNPJ' : 'CPF',
      account: 'a' + i,
      status: 'ATIVA',
      reason: 'USER_REQUESTED',
      history: []
    }]);
    const boletos = [{
      factor: 9999,
      value: 18590,
      label: 'Internet residencial',
      free: '1234567890123456789012345'
    }, {
      factor: 9985,
      value: 45000,
      label: 'Material de escritório',
      free: '2234567890123456789012345'
    }, {
      factor: 9800,
      value: 80000,
      label: 'Boleto vencido fora do prazo',
      free: '3234567890123456789012345'
    }].map((b, i) => ({
      id: 'b' + i,
      line: C.V.makeBoleto(b.factor, b.value, b.free),
      cpf: clients[0].cpf,
      beneficiary: 'a3',
      label: b.label,
      status: 'ABERTO',
      fineBp: 200,
      dailyMillion: 330,
      discountBp: 100,
      history: []
    }));
    return {
      schema: 1,
      now,
      sequence: 0,
      session: {
        client: 'maria',
        role: 'CLIENTE',
        account: 'a0'
      },
      clients,
      accounts,
      keys,
      claims: [],
      queryCounts: {},
      transactions,
      ledger,
      requests: {},
      notifications: [],
      audit: [],
      codes: [],
      limitChanges: [],
      favorites: [],
      schedules: [],
      exports: [],
      applications: [],
      products: [{
        id: 'p1',
        name: 'CDB Prefixado',
        type: 'CDB',
        rateType: 'PREFIXADO',
        annualBp: 1200,
        cdiPercentBp: 10000,
        ipcaBp: 450,
        minimum: 10000,
        liquidity: 'DIARIA',
        waitDays: 0,
        available: true,
        quote: 0
      }, {
        id: 'p2',
        name: 'CDB 110% CDI',
        type: 'CDB',
        rateType: 'POS_FIXADO_CDI',
        annualBp: 1300,
        cdiPercentBp: 11000,
        minimum: 50000,
        liquidity: 'CARENCIA',
        waitDays: 30,
        available: true,
        quote: 0
      }, {
        id: 'p3',
        name: 'CDB IPCA + 6%',
        type: 'CDB',
        rateType: 'HIBRIDO_IPCA',
        annualBp: 600,
        ipcaBp: 450,
        minimum: 10000,
        liquidity: 'DIARIA',
        waitDays: 0,
        available: true,
        quote: 0
      }, {
        id: 'p4',
        name: 'CESB3 · ação fictícia',
        type: 'ACAO',
        minimum: 1,
        quote: 2500,
        available: true,
        liquidity: 'DIARIA',
        waitDays: 0
      }, {
        id: 'p5',
        name: 'Fundo Ces Renda',
        type: 'FUNDO',
        rateType: 'PREFIXADO',
        annualBp: 900,
        minimum: 10000,
        liquidity: 'DIARIA',
        waitDays: 0,
        available: true
      }],
      boxes: [],
      boletos,
      cards: [],
      authorizations: [],
      invoices: [],
      purchases: [],
      disputes: [],
      proposals: [],
      contracts: [],
      registrations: [],
      corrections: [],
      indices: {
        cdiBp: 1300,
        ipcaBp: 450
      },
      demo: {
        failAfterDebit: false
      }
    };
  };
})(Cesbank);
