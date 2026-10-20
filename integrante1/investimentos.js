/* Integrante 1 · F13a RN1–RN11 · serviços de produtos, aplicações e posição consolidada. */
(function (C) {
  'use strict';

  const U = C.UI,
    A = C.S.accounts,
    M = C.M,
    K = C.Clock;
  const iof = [100, 96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3, 0];
  function ensureCatalog(s) {
    s.investmentFamilies ||= [
      {id: 'f-cdb', name: 'CDB Cesbank', type: 'CDB', description: 'Certificados de depósito bancário', available: true},
      {id: 'f-fundo', name: 'Fundos Cesbank', type: 'FUNDO', description: 'Fundos de investimento', available: true},
      {id: 'f-acao', name: 'Ações', type: 'ACAO', description: 'Ativos de renda variável', available: true}
    ];
    s.products.forEach(p => {
      if (!p.family) p.family = s.investmentFamilies.find(f => f.type === p.type && !f.removed)?.id;
    });
    return s.investmentFamilies;
  }
  function saveFamily(s, d, id) {
    C.Session.requireAnalyst(s);
    const families = ensureCatalog(s);
    const name = String(d.name || '').trim(), description = String(d.description || '').trim();
    C.assert(name, 'Informe o nome do produto de investimento.');
    C.assert(['CDB', 'FUNDO', 'ACAO'].includes(d.type), 'Tipo de investimento inválido.');
    C.assert(!families.some(f => f.id !== id && !f.removed && f.name.toLowerCase() === name.toLowerCase()), 'Já existe um produto com esse nome.');
    const family = id ? families.find(f => f.id === id && !f.removed) : {id: C.Ids.uuid()};
    C.assert(family, 'Produto de investimento não encontrado.');
    if (id) C.assert(family.type === d.type || !s.products.some(p => p.family === id && !p.removed), 'O tipo de um produto com variações não pode ser alterado.');
    Object.assign(family, {name, type: d.type, description, available: !!d.available});
    if (!id) families.push(family);
    C.S.audit(s, 'familia_investimento', family.id, id ? 'Produto atualizado.' : 'Produto criado.');
    return family;
  }
  function apply(s, d) {
    C.Session.requireClient(s);
    ensureCatalog(s);
    const p = s.products.find(p => p.id === d.product && !p.removed);
    if (!p || !p.available || !s.investmentFamilies.some(f => f.id === p.family && !f.removed && f.available)) C.fail('ProdutoIndisponivel');
    const stock = p.type === 'ACAO';
    const qty = stock ? Number(d.quantity) : 0;
    C.assert(!stock || Number.isInteger(qty) && qty > 0 && qty <= 1000000, 'Quantidade de ações deve ser inteira e positiva.');
    const value = stock ? M.safe(BigInt(p.quote) * BigInt(qty)) : M.parse(d.value);
    if (value < p.minimum) C.fail('ValorAbaixoDoMinimo');
    A.check(s, s.session.account, value + (stock ? C.policy.brokerage : 0), false);
    const a = A.own(s);
    if (stock) a.total -= C.policy.brokerage;
    const app = {
      id: C.Ids.uuid(),
      account: a.id,
      product: p.id,
      productName: p.name,
      type: p.type,
      rateType: p.rateType,
      annualBp: p.annualBp || 0,
      cdiPercentBp: p.cdiPercentBp || 10000,
      ipcaBp: p.ipcaBp || 0,
      principal: value,
      balance: value,
      quantity: qty,
      buyQuote: p.quote || 0,
      created: s.now,
      originalDate: K.day(s.now),
      lastAccrual: K.day(s.now),
      maturity: K.addDays(K.day(s.now), p.waitDays || 0),
      status: 'ATIVA',
      history: [],
      note: d.note || '',
      archived: false
    };
    s.applications.push(app);
    C.S.ledger(s, a.id, value + (stock ? C.policy.brokerage : 0), 'DEBITO', 'OUTROS', stock ? 'Compra de ações + corretagem' : 'Aplicação · ' + p.name, app.id, {
      allocation: true
    });
    C.S.audit(s, 'aplicacao', app.id, 'Aplicação criada com condições contratuais imutáveis.');
    return app;
  }
  function preview(s, app, value, quantity) {
    C.S.owner(s, app);
    if (app.status === 'RESGATADA') C.fail('SaldoInsuficienteParaResgate');
    if (K.day(s.now) < app.maturity) C.fail('CarenciaNaoCumprida');
    const stock = app.type === 'ACAO';
    let gross,
      qty = 0;
    if (stock) {
      qty = Number(quantity);
      C.assert(Number.isInteger(qty) && qty > 0 && qty <= app.quantity, 'Quantidade de venda inválida.');
      gross = M.safe(BigInt(s.products.find(p => p.id === app.product).quote) * BigInt(qty));
    } else gross = M.parse(value);
    if (gross > app.balance) C.fail('SaldoInsuficienteParaResgate');
    const basis = stock ? M.mul(app.principal, qty, app.quantity) : M.mul(app.principal, gross, app.balance);
    const gain = Math.max(0, gross - basis),
      days = K.days(app.originalDate, K.day(s.now)),
      irBp = days <= 180 ? 2250 : days <= 360 ? 2000 : days <= 720 ? 1750 : 1500;
    const taxIof = stock ? 0 : M.mul(gain, iof[Math.min(30, Math.max(0, days))], 100);
    const taxIr = stock ? 0 : M.mul(gain - taxIof, irBp);
    const fee = stock ? C.policy.brokerage : 0;
    C.assert(gross >= fee, 'Valor da venda inferior à corretagem.');
    return {
      gross,
      basis,
      gain,
      days,
      irBp,
      iof: taxIof,
      ir: taxIr,
      fee,
      net: gross - taxIof - taxIr - fee,
      quantity: qty
    };
  }
  function redeem(s, id, expected) {
    C.Session.requireClient(s);
    const app = s.applications.find(p => p.id === id);
    C.assert(app, 'Aplicação não encontrada.');
    const q = preview(s, app, M.decimal(expected.gross), expected.quantity);
    C.assert(JSON.stringify(q) === JSON.stringify(expected), 'A simulação de resgate mudou; refaça a consulta.');
    const a = A.own(s);
    app.balance -= q.gross;
    app.principal = Math.max(0, app.principal - q.basis);
    app.quantity -= q.quantity;
    a.total -= q.iof + q.ir + q.fee;
    C.S.transition(s, app, 'application', app.balance === 0 ? 'RESGATADA' : 'RESGATADA_PARCIALMENTE', 'Resgate bruto ' + M.decimal(q.gross));
    C.S.ledger(s, a.id, q.net, 'CREDITO', 'OUTROS', 'Resgate de investimento', app.id, {
      allocation: true,
      taxes: q
    });
    C.S.audit(s, 'resgate', app.id, JSON.stringify(q));
    return q;
  }
  function quote(s, id, value) {
    const p = s.products.find(p => p.id === id);
    C.assert(p && p.type === 'ACAO', 'Produto não é ação.');
    p.quote = value;
    s.applications.filter(a => a.product === id && a.status !== 'RESGATADA').forEach(app => {
      const current = M.safe(BigInt(value) * BigInt(app.quantity)),
        delta = current - app.balance;
      A.account(s, app.account).total += delta;
      app.balance = current;
      if (delta) C.S.ledger(s, app.account, Math.abs(delta), delta > 0 ? 'CREDITO' : 'DEBITO', 'RENDIMENTO', 'Marcação a mercado · ' + p.name, app.id, {
        allocation: true
      });
    });
  }
  function position(s) {
    const groups = {};
    s.applications.filter(a => a.account === s.session.account && a.status !== 'RESGATADA').forEach(a => {
      const g = groups[a.product] ||= {
        name: a.productName,
        principal: 0,
        balance: 0,
        quantity: 0
      };
      g.principal += a.principal;
      g.balance += a.balance;
      g.quantity += a.quantity;
    });
    return Object.values(groups);
  }
  C.S.investments = {
    apply,
    preview,
    redeem,
    quote,
    position,
    ensureCatalog,
    saveFamily
  };
  C.processors.push(s => {
    s.applications.filter(a => a.type !== 'ACAO' && a.status !== 'RESGATADA').forEach(app => {
      let d = app.lastAccrual;
      while (d < K.day(s.now)) {
        d = K.addDays(d, 1);
        if (app.rateType === 'POS_FIXADO_CDI' && !K.business(d)) continue;
        let bp = app.annualBp;
        if (app.rateType === 'POS_FIXADO_CDI') bp = M.mul(s.indices.cdiBp, app.cdiPercentBp);
        if (app.rateType === 'HIBRIDO_IPCA') bp = app.annualBp + s.indices.ipcaBp + M.mul(app.annualBp, s.indices.ipcaBp);
        const daily = M.mul(app.balance, bp, 10000 * (app.rateType === 'POS_FIXADO_CDI' ? 252 : 365));
        if (daily) {
          app.balance += daily;
          A.account(s, app.account).total += daily;
          C.S.ledger(s, app.account, daily, 'CREDITO', 'RENDIMENTO', 'Rendimento diário · ' + app.productName, app.id, {
            allocation: true,
            accrualDate: d
          });
        }
      }
      app.lastAccrual = K.day(s.now);
    });
  });
  function saveProduct(s, d, id) {
    C.Session.requireAnalyst(s);
    const families = ensureCatalog(s);
    C.assert(d.name.trim(), 'Nome do produto obrigatório.');
    const family = families.find(f => f.id === d.family && !f.removed);
    C.assert(family, 'Escolha um produto de investimento válido.');
    C.assert(!s.products.some(p => p.id !== id && p.family === family.id && !p.removed && p.name.toLowerCase() === d.name.trim().toLowerCase()), 'Já existe uma variação com esse nome neste produto.');
    const wait = Number(d.waitDays),
      rate = Number(d.annualBp),
      cdi = Number(d.cdiPercentBp);
    C.assert(Number.isInteger(wait) && wait >= 0 && Number.isInteger(rate) && rate >= 0 && rate <= 100000 && Number.isInteger(cdi) && cdi >= 0, 'Taxas e carência devem ser inteiros não negativos.');
    C.assert(['PREFIXADO', 'POS_FIXADO_CDI', 'HIBRIDO_IPCA'].includes(d.rateType) && ['DIARIA', 'CARENCIA'].includes(d.liquidity), 'Enumeração de produto inválida.');
    const p = id ? s.products.find(p => p.id === id) : {
      id: C.Ids.uuid()
    };
    C.assert(p, 'Produto inexistente.');
    if (id) C.assert(p.family === family.id || !s.applications.some(a => a.product === id), 'O produto de uma variação já contratada não pode ser alterado.');
    Object.assign(p, {
      name: d.name.trim(),
      family: family.id,
      type: family.type,
      rateType: d.rateType,
      annualBp: rate,
      cdiPercentBp: cdi,
      minimum: M.parse(d.minimum),
      liquidity: d.liquidity,
      waitDays: d.liquidity === 'CARENCIA' ? wait : 0,
      available: !!d.available
    });
    if (!id) {
      p.quote = M.parse(d.quote);
      s.products.push(p);
    } else if (p.type === 'ACAO') quote(s, id, M.parse(d.quote));
    C.S.audit(s, 'produto', p.id, id ? 'Produto atualizado; condições das aplicações preservadas.' : 'Produto criado.');
  }
  C.S.investments.saveProduct = saveProduct;
})(Cesbank);
