/* Integrante 1 · investimento unificado para clientes e gestão simples para analistas. */
(function (C) {
  'use strict';
  const U = C.UI, M = C.M, I = C.S.investments;
  const analyst = s => s.session.role === 'ANALISTA';
  const money = n => U.money(n || 0);
  function grid(rows) {
    return U.table(['Campo', 'Valor'], rows.map(row => [U.e(row[0]), row[1]]));
  }
  function rentabilidade(p) {
    if (p.type === 'ACAO') return 'Cotação de mercado · rentabilidade não garantida';
    if (p.rateType === 'POS_FIXADO_CDI') return M.percent(p.cdiPercentBp || 10000) + ' do CDI';
    if (p.rateType === 'HIBRIDO_IPCA') return 'IPCA + ' + M.percent(p.annualBp || 0) + ' ao ano';
    return M.percent(p.annualBp || 0) + ' ao ano · prefixado';
  }
  function productForm(s, p = {}) {
    const families = I.ensureCatalog(s).filter(f => !f.removed);
    const family = families.find(f => f.id === p.family) || families[0];
    return '<div class="invest-product-form" data-type="' + U.e(family?.type || 'CDB') + '" data-rate="' + U.e(p.rateType || 'PREFIXADO') + '" data-liquidity="' + U.e(p.liquidity || 'DIARIA') + '"><div class="fields">' + U.field('name', 'Nome do produto', p.name || '') +
      U.select('family', 'Categoria', families.map(f => [f.id, f.name + ' · ' + f.type]), p.family || family?.id) +
      '<div class="invest-rate">' + U.select('rateType', 'Tipo de rentabilidade da renda fixa', ['PREFIXADO', 'POS_FIXADO_CDI', 'HIBRIDO_IPCA'], p.rateType) + '</div>' +
      '<div class="invest-annual">' + U.field('annualBp', 'Taxa prefixada ou adicional anual (pontos-base)', p.annualBp ?? 1200, 'number') + '</div>' +
      '<div class="invest-cdi">' + U.field('cdiPercentBp', 'Percentual do CDI (11000 = 110%)', p.cdiPercentBp ?? 10000, 'number') + '</div>' +
      U.field('minimum', 'Aplicação mínima (R$)', M.decimal(p.minimum ?? 10000)) +
      '<div class="invest-quote">' + U.field('quote', 'Cotação da ação (R$)', M.decimal(p.quote || 2500)) + '</div>' +
      '<div class="invest-liquidity">' + U.select('liquidity', 'Liquidez', ['DIARIA', 'CARENCIA'], p.liquidity) + '</div>' +
      '<div class="invest-wait">' + U.field('waitDays', 'Carência em dias', p.waitDays ?? 0, 'number') + '</div>' +
      U.checkbox('available', 'Disponível para novas aplicações', p.available !== false) + '</div></div>';
  }
  function saveProduct(d, id) {
    C.Db.transaction(s => I.saveProduct(s, d, id));
    U.done(id ? 'Produto atualizado. Aplicações existentes preservadas.' : 'Produto adicionado.');
  }
  function addProductButton() {
    return U.action('Adicionar produto', () => U.modal('Adicionar produto',
      U.form(productForm(C.Db.get()), d => saveProduct(d), 'Criar produto')));
  }
  function familyForm(f = {}) {
    return '<div class="fields">' +
      U.field('name', 'Nome da categoria', f.name || '') +
      U.select('type', 'Tipo de ativo', ['CDB', 'FUNDO', 'ACAO'], f.type) +
      U.field('description', 'Descrição da categoria', f.description || '') +
      U.checkbox('available', 'Disponível para novas aplicações', f.available !== false) + '</div>';
  }
  function saveFamily(d, id) {
    C.Db.transaction(s => I.saveFamily(s, d, id));
    U.done(id ? 'Categoria atualizada.' : 'Categoria adicionada.');
  }
  function familyActions(f) {
    return U.action('Editar categoria', () => U.modal('Editar categoria',
      U.form(familyForm(f), d => saveFamily(d, f.id), 'Salvar categoria')), 'secondary') +
      U.action('Remover categoria', () => U.modal('Remover categoria',
        '<p>Remova antes os produtos desta categoria. O histórico permanece preservado.</p>' +
        U.action('Confirmar remoção', () => {
          C.Db.transaction(s => {
            C.Session.requireAnalyst(s);
            I.ensureCatalog(s);
            const family = s.investmentFamilies.find(x => x.id === f.id && !x.removed);
            C.assert(family, 'Produto de investimento não encontrado.');
            C.assert(!s.products.some(p => p.family === f.id && !p.removed),
              'Este produto ainda possui variações no catálogo.');
            family.removed = true;
            family.available = false;
            C.S.audit(s, 'familia_investimento', f.id, 'Remoção lógica.');
          });
          C.Router.go('gerenciar-investimentos');
          U.done('Categoria removida.');
        }, 'Remover categoria', 'danger')), 'danger');
  }
  function productActions(p) {
    return U.action('Editar produto', () => U.modal('Editar produto', U.form(productForm(C.Db.get(), p), d => saveProduct(d, p.id), 'Salvar produto')), 'secondary') +
      U.action('Remover produto', () => U.modal('Remover produto', '<p>Esta operação retira o produto da oferta e preserva o histórico. Produtos com posições ativas não podem ser removidos.</p>' +
        U.action('Confirmar remoção', () => {
          C.Db.transaction(s => {
            C.Session.requireAnalyst(s);
            const product = s.products.find(x => x.id === p.id && !x.removed);
            C.assert(product, 'Produto não encontrado.');
            C.assert(!s.applications.some(a => a.product === p.id && a.status !== 'RESGATADA'), 'Há posições ativas vinculadas ao produto.');
            product.removed = true;
            product.available = false;
            C.S.audit(s, 'produto', p.id, 'Remoção lógica.');
          });
          C.Router.go('gerenciar-investimentos');
          U.done('Produto removido do catálogo.');
        }, 'Remover produto', 'danger')), 'danger');
  }
  function applicationActions(a) {
    if (a.status === 'RESGATADA') return '';
    return U.action('Simular resgate', () => U.modal('Simular resgate', '<p>Informe o valor bruto ou a quantidade de ações a vender.</p>' +
      U.form(a.type === 'ACAO' ? U.field('quantity', 'Quantidade de ações', a.quantity, 'number') : U.field('value', 'Valor bruto (R$)', M.decimal(a.balance)), d => {
        const q = I.preview(C.Db.get(), a, d.value, d.quantity);
        U.modal('Confirmar resgate', grid([
          ['Valor bruto', money(q.gross)], ['Rendimento tributável', money(q.gain)],
          ['IOF', money(q.iof)], ['Imposto de renda', money(q.ir)],
          ['Corretagem', money(q.fee)], ['Valor líquido a receber', money(q.net)],
          ['Prazo desde a aplicação', U.e(q.days + ' dias')]
        ]) + '<p>O resgate parcial mantém a data original para contagem dos tributos.</p>' +
          U.action('Confirmar resgate', () => {
            C.Db.transaction(s => I.redeem(s, a.id, q));
            U.done('Resgate realizado para a conta de origem.');
          }));
      }, 'Calcular resgate')), 'secondary');
  }
  C.Router.register('investimentos', 'Investimentos', s => {
    I.ensureCatalog(s);
    const own = s.applications.filter(a => a.account === s.session.account);
    const products = s.products.filter(p => !p.removed && p.available && s.investmentFamilies.some(f => f.id === p.family && !f.removed && f.available));
    const offered = products.map(p => [
      U.e(s.investmentFamilies.find(f => f.id === p.family)?.name || p.type), U.e(p.name),
      U.e(rentabilidade(p)), p.type === 'ACAO' ? money(p.quote) + ' por ação' : '—',
      money(p.minimum)
    ]);
    const offers = U.card('Outros produtos disponíveis',
      U.table(['Categoria', 'Produto', 'Rentabilidade', 'Cotação atual', 'Aplicação mínima'], offered) +
      '<p class="small">O valor das aplicações acompanha o rendimento apurado; ações acompanham a cotação atual.</p>');
    if (analyst(s)) return U.page('Investimentos',
      'Veja os produtos disponíveis e faça a manutenção do catálogo em uma única área.',
      '<div class="actions">' + addProductButton() + U.link('gerenciar-investimentos', 'Gerenciar produtos') + '</div>' +
      offers, 'F13a · RN1–RN11');
    const boxes = s.boxes.filter(b => b.account === s.session.account);
    const boxTotal = boxes.reduce((sum, b) => sum + b.balance, 0);
    const boxCard = U.card('Caixinhas', '<p>Guarde dinheiro para suas metas e acompanhe o rendimento.</p>' +
      '<p class="metric">' + money(boxTotal) + '</p><p>' + boxes.length + ' caixinha(s) na conta.</p>' +
      U.link('caixinhas', 'Ver ou criar caixinhas'));
    const rows = own.map(a => [U.e(a.note || a.productName), U.e(a.originalDate), money(a.principal),
      money(a.balance - a.principal), money(a.balance), U.badge(a.status),
      U.link('aplicacao?id=' + a.id, 'Ver posição')]);
    const groups = I.position(s).map(p => [U.e(p.name), money(p.principal), money(p.balance - p.principal),
      money(p.balance), p.quantity ? money(M.mul(p.principal, 1, p.quantity)) : '—']);
    const create = U.form('<div class="invest-application-form" data-type="' + U.e(products[0]?.type || 'CDB') + '"><div class="fields">' +
      U.select('product', 'Produto disponível', products.map(p => [p.id,
        (s.investmentFamilies.find(f => f.id === p.family)?.name || p.type) + ' / ' + p.name + ' · mínimo ' + money(p.minimum)])) +
      '<div class="invest-value">' + U.field('value', 'Valor para CDB ou fundo (R$)', '500.00') + '</div>' +
      '<div class="invest-quantity">' + U.field('quantity', 'Quantidade de ações', '10', 'number') + '</div>' +
      U.field('note', 'Apelido (opcional)', '') + '</div></div>' +
      '<p class="small">A compra de ações usa a cotação vigente mais corretagem; renda fixa usa o valor informado.</p>', d => {
        const app = C.Db.transaction(x => I.apply(x, d));
        C.Router.go('aplicacao?id=' + app.id);
        U.done('Aplicação criada; valor separado do saldo disponível.');
      }, 'Criar aplicação');
    return U.page('Investimentos', 'Caixinhas, produtos disponíveis e sua carteira em um só lugar.',
      U.balance(s) + boxCard + offers +
      (s.session.role === 'CLIENTE' ? U.card('Investir em outro produto', products.length ? create : '<p>Nenhum produto disponível.</p>') : '') +
      U.card('Minhas aplicações', U.table(['Aplicação', 'Data', 'Principal', 'Rendimento / variação', 'Valor atual', 'Situação', 'Consulta'], rows)) +
      U.card('Posição consolidada por produto', U.table(['Produto', 'Principal', 'Rendimento / variação', 'Valor atual', 'Preço médio de compra'], groups)),
      'F13a · RN1–RN11');
  }, 'Investir');
  C.Router.register('aplicacao', 'Detalhes da aplicação', (s, params) => {
    const a = s.applications.find(x => x.id === params.get('id') && x.account === s.session.account);
    C.assert(a, 'Aplicação não encontrada nesta conta.');
    const p = s.products.find(x => x.id === a.product);
    const rows = [
      ['Identificador', U.e(a.id)], ['Produto contratado', U.e(a.productName) + ' · ' + U.e(a.type)],
      ['Apelido', U.e(a.note || 'Não informado')],
      ['Situação', U.badge(a.status)],
      ['Data original', U.e(a.originalDate)], ['Principal remanescente', money(a.principal)],
      ['Rendimento / variação', money(a.balance - a.principal)], ['Valor atual', money(a.balance)],
      ['Condição contratada', U.e(rentabilidade(a))], ['Resgate a partir de', U.e(a.maturity)]
    ];
    if (a.type === 'ACAO') rows.push(['Quantidade de ações', U.e(a.quantity)],
      ['Preço de compra por ação', money(a.buyQuote)], ['Cotação atual', money(p?.quote)],
      ['Corretagem por ordem', money(C.policy.brokerage)]);
    else rows.push(['Última apuração', U.e(a.lastAccrual)]);
    return U.page('Aplicação · ' + (a.note || a.productName), 'Condições contratadas, posição atual e histórico de resgates.',
      U.card('Dados da aplicação', grid(rows)) +
      (s.session.role === 'CLIENTE' && a.status !== 'RESGATADA' ? U.card('Resgate da posição',
        '<p>O investimento contratado mantém suas condições originais.</p><div class="actions">' + applicationActions(a) + '</div>') : '') +
      U.card('Histórico da aplicação', U.history(a)) +
      '<div class="actions">' + U.link('investimentos', 'Voltar às aplicações') + '</div>', 'F13a · RN1–RN11');
  }, null);
  C.Router.register('gerenciar-investimentos', 'Gerenciar produtos', s => {
    C.Session.requireAnalyst(s);
    const families = I.ensureCatalog(s).filter(f => !f.removed);
    const categories = families.map(f => [
      U.e(f.name), U.e(f.type), U.badge(f.available ? 'DISPONIVEL' : 'INDISPONIVEL'),
      U.e(s.products.filter(p => p.family === f.id && !p.removed).length),
      '<div class="actions">' + familyActions(f) + '</div>'
    ]);
    const products = s.products.filter(p => !p.removed).map(p => [
      U.e(families.find(f => f.id === p.family)?.name || p.type),
      U.e(p.name), U.e(rentabilidade(p)), money(p.minimum),
      p.type === 'ACAO' ? money(p.quote) : '—',
      U.badge(p.available ? 'DISPONIVEL' : 'INDISPONIVEL'),
      '<div class="actions">' + productActions(p) + '</div>'
    ]);
    const indices = U.form(U.field('cdi', 'CDI anual · pontos-base', s.indices.cdiBp, 'number') +
      U.field('ipca', 'IPCA anual · pontos-base', s.indices.ipcaBp, 'number'), d => {
      C.Db.transaction(x => {
        C.Session.requireAnalyst(x);
        C.assert([d.cdi, d.ipca].every(v => /^\d{1,5}$/.test(v)), 'Informe taxas inteiras em pontos-base.');
        x.indices = {cdiBp: Number(d.cdi), ipcaBp: Number(d.ipca)};
      });
      U.done('Indexadores atualizados.');
    }, 'Atualizar indexadores', 'secondary');
    return U.page('Gerenciar investimentos',
      'Cadastre categorias e produtos oferecidos. As caixinhas não fazem parte deste cadastro.',
      U.card('Categorias de investimento', U.table(['Categoria', 'Tipo', 'Situação', 'Produtos', 'Ações'], categories) +
        '<details class="invest-create"><summary>Adicionar categoria</summary>' +
        U.form(familyForm(), d => saveFamily(d), 'Adicionar categoria') + '</details>') +
      U.card('Produtos disponíveis para os clientes',
        '<div class="actions">' + addProductButton() + '</div>' +
        U.table(['Categoria', 'Produto', 'Rentabilidade', 'Mínimo', 'Cotação', 'Situação', 'Ações'], products)) +
      U.card('Valores de referência', '<p>CDI e IPCA alimentam o rendimento diário. A cotação de uma ação é editada no próprio produto.</p>' + indices) +
      '<div class="actions">' + U.link('investimentos', 'Voltar a investimentos') + '</div>',
      'F13a · RN1–RN4, RN8–RN10');
  }, null);
  document.addEventListener('change', event => {
    const form = event.target.closest('.invest-product-form, .invest-application-form');
    if (!form) return;
    if (event.target.name === 'family') {
      const family = I.ensureCatalog(C.Db.get()).find(f => f.id === event.target.value);
      if (family) form.dataset.type = family.type;
    }
    if (event.target.name === 'rateType') form.dataset.rate = event.target.value;
    if (event.target.name === 'liquidity') form.dataset.liquidity = event.target.value;
    if (event.target.name === 'product') {
      const product = C.Db.get().products.find(p => p.id === event.target.value);
      if (product) form.dataset.type = product.type;
    }
  });
})(Cesbank);
