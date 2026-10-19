/* Integrante 1 · F13a RN1–RN11 · CRUD de produtos/aplicações e posição consolidada. */
(function (C) {
  'use strict';

  const U = C.UI,
    A = C.S.accounts,
    M = C.M,
    K = C.Clock;
  const iof = [100, 96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3, 0];
  function apply(s, d) {
    C.Session.requireClient(s);
    const p = s.products.find(p => p.id === d.product && !p.removed);
    if (!p || !p.available) C.fail('ProdutoIndisponivel');
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
    position
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
  function productForm(p = {}) {
    return '<div class="fields">' + U.field('name', 'Nome', p.name || 'Novo produto') + U.select('type', 'Tipo', ['CDB', 'FUNDO', 'ACAO'], p.type) + U.select('rateType', 'Rentabilidade', ['PREFIXADO', 'POS_FIXADO_CDI', 'HIBRIDO_IPCA'], p.rateType) + U.field('annualBp', 'Taxa prefixada / adicional anual (pontos-base)', p.annualBp || 1200, 'number') + U.field('cdiPercentBp', 'Percentual CDI em pontos-base (11000 = 110%)', p.cdiPercentBp || 10000, 'number') + U.field('minimum', 'Aplicação mínima', M.decimal(p.minimum || 10000)) + U.field('quote', 'Cotação da ação', M.decimal(p.quote || 2500)) + U.select('liquidity', 'Liquidez', ['DIARIA', 'CARENCIA'], p.liquidity) + U.field('waitDays', 'Carência em dias', p.waitDays || 0, 'number') + U.checkbox('available', 'Produto disponível', p.available !== false) + '</div>';
  }
  function saveProduct(s, d, id) {
    C.Session.requireAnalyst(s);
    C.assert(d.name.trim(), 'Nome do produto obrigatório.');
    const wait = Number(d.waitDays),
      rate = Number(d.annualBp),
      cdi = Number(d.cdiPercentBp);
    C.assert(Number.isInteger(wait) && wait >= 0 && Number.isInteger(rate) && rate >= 0 && rate <= 100000 && Number.isInteger(cdi) && cdi >= 0, 'Taxas e carência devem ser inteiros não negativos.');
    C.assert(['CDB', 'FUNDO', 'ACAO'].includes(d.type) && ['PREFIXADO', 'POS_FIXADO_CDI', 'HIBRIDO_IPCA'].includes(d.rateType) && ['DIARIA', 'CARENCIA'].includes(d.liquidity), 'Enumeração de produto inválida.');
    const p = id ? s.products.find(p => p.id === id) : {
      id: C.Ids.uuid()
    };
    C.assert(p, 'Produto inexistente.');
    if (id) C.assert(p.type === d.type || !s.applications.some(a => a.product === id), 'O tipo de produto com aplicações não pode ser alterado.');
    Object.assign(p, {
      name: d.name.trim(),
      type: d.type,
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
  C.Router.register('investimentos', 'Investimentos', s => U.page('Investimentos', 'Renda fixa e variável, com posição consolidada e simulação antes do resgate.', U.balance(s) + U.link('produtos', 'Administrar produtos · analista') + U.card('Aplicar ou comprar ações', U.form('<div class="fields">' + U.select('product', 'Produto', s.products.filter(p => !p.removed).map(p => [p.id, `${p.name} · mínimo ${U.money(p.minimum)} · ${p.available ? 'disponível' : 'indisponível'}`])) + U.field('value', 'Valor para renda fixa / fundo', '500.00') + U.field('quantity', 'Quantidade inteira de ações', '10', 'number') + U.field('note', 'Apelido da aplicação', '') + '</div>', d => {
    C.Db.transaction(x => apply(x, d));
    U.done('Aplicação registrada. Valor separado do saldo disponível.');
  }, 'Aplicar')) + U.card('Posição consolidada por produto', U.table(['Produto', 'Principal aplicado', 'Rendimento / variação', 'Valor atual', 'Preço médio de compra'], position(s).map(p => [U.e(p.name), U.money(p.principal), U.money(p.balance - p.principal), U.money(p.balance), p.quantity ? U.money(M.mul(p.principal, 1, p.quantity)) : '—']))) + U.card('Minhas aplicações e posição consolidada', U.table(['Produto / data original', 'Principal', 'Rendimento / variação', 'Valor atual', 'Situação / carência', 'Ações'], s.applications.filter(p => p.account === s.session.account && !p.archived).map(p => [U.e(p.note || p.productName) + `<small>${U.e(p.originalDate)} · ${U.e(p.rateType || 'Cotação de mercado')} ${p.type === 'ACAO' ? '· ' + p.quantity + ' ações · sem garantia de rentabilidade' : ''}</small>`, U.money(p.principal), U.money(p.balance - p.principal), U.money(p.balance), U.badge(p.status) + `<small>Resgate a partir de ${U.e(p.maturity)}</small>`, (p.status !== 'RESGATADA' ? U.action('Simular resgate', () => U.modal('Simular resgate', U.form(p.type === 'ACAO' ? U.field('quantity', 'Quantidade a vender', p.quantity, 'number') : U.field('value', 'Valor bruto', M.decimal(p.balance)), d => {
    const q = preview(C.Db.get(), p, d.value, d.quantity);
    U.modal('Confirme o resgate', U.table(['Bruto', 'Rendimento tributável', 'IOF', 'IR', 'Corretagem', 'Líquido'], [[U.money(q.gross), U.money(q.gain), U.money(q.iof), U.money(q.ir), U.money(q.fee), U.money(q.net)]]) + `<p>Prazo original: ${q.days} dias. IR: ${M.percent(q.irBp)}. Resgate parcial preserva a data original.</p>` + U.action('Confirmar resgate', () => {
      C.Db.transaction(x => redeem(x, p.id, q));
      U.done('Resgate realizado para a conta de origem.');
    }));
  }, 'Calcular')), 'secondary') : '') + U.action('Editar apelido', () => U.modal('Editar aplicação', U.form(U.field('note', 'Apelido', p.note), d => {
    C.Db.transaction(x => {
      const a = C.S.owner(x, x.applications.find(a => a.id === p.id));
      a.note = d.note;
      C.S.audit(x, 'aplicacao', a.id, 'Apelido atualizado.');
    });
    U.done('Aplicação atualizada.');
  }, 'Salvar')), 'secondary') + U.action('Excluir do painel', () => {
    C.Db.transaction(x => {
      const a = C.S.owner(x, x.applications.find(a => a.id === p.id));
      C.assert(a.status === 'RESGATADA', 'Resgate todo o saldo antes de excluir a aplicação do painel.');
      a.archived = true;
      C.S.audit(x, 'aplicacao', a.id, 'Remoção lógica após resgate total.');
    });
    U.done('Aplicação arquivada; histórico preservado.');
  }, 'danger') + U.history(p)]))) + U.card('Indexadores fictícios vigentes', U.form(U.field('cdi', 'CDI anual · pontos-base', s.indices.cdiBp, 'number') + U.field('ipca', 'IPCA anual · pontos-base', s.indices.ipcaBp, 'number'), d => {
    C.Db.transaction(x => {
      C.Session.requireAnalyst(x);
      C.assert([d.cdi, d.ipca].every(v => /^\d{1,5}$/.test(v)), 'Informe taxas inteiras em pontos-base.');
      x.indices = {
        cdiBp: Number(d.cdi),
        ipcaBp: Number(d.ipca)
      };
    });
    U.done('Indexadores fictícios atualizados.');
  }, 'Atualizar índices · analista', 'secondary')), 'F13a · RN1–RN11'), 'Investir');
  C.Router.register('produtos', 'Produtos de investimento', s => U.page('Produtos de investimento', 'CRUD de produtos. Edições não alteram as condições já contratadas.', U.card('Produtos', U.table(['Nome', 'Tipo', 'Situação', 'Ações'], s.products.filter(p => !p.removed).map(p => [U.e(p.name), U.e(p.type), U.badge(p.available ? 'DISPONIVEL' : 'INDISPONIVEL'), U.action('Editar', () => U.modal('Editar produto', U.form(productForm(p), d => {
    C.Db.transaction(x => saveProduct(x, d, p.id));
    U.done('Produto atualizado.');
  }, 'Salvar')), 'secondary') + U.action('Excluir', () => {
    C.Db.transaction(x => {
      C.Session.requireAnalyst(x);
      const r = x.products.find(q => q.id === p.id);
      C.assert(!x.applications.some(a => a.product === p.id && a.status !== 'RESGATADA'), 'Há posições ativas vinculadas ao produto.');
      r.removed = true;
      r.available = false;
      C.S.audit(x, 'produto', r.id, 'Remoção lógica.');
    });
    U.done('Produto removido do catálogo.');
  }, 'danger') + U.json(p)]))) + U.card('Criar produto', U.form(productForm(), d => {
    C.Db.transaction(x => saveProduct(x, d));
    U.done('Produto criado.');
  }, 'Criar produto')) + U.link('investimentos', 'Voltar aos investimentos'), 'F13a · RN1, RN2, RN8–RN10'), null);
})(Cesbank);
