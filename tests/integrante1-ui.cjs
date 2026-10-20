const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

global.window = global;
global.location = {hash: '#investimentos'};
global.addEventListener = () => {};
global.localStorage = {getItem: () => null, setItem: () => {}};
global.document = {addEventListener: () => {}};

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const [, src] of html.matchAll(/<script src="([^"]+)"/g)) {
  if (src === 'core/js/app.js') continue;
  vm.runInThisContext(fs.readFileSync(path.join(root, src), 'utf8'), {filename: src});
}

const C = Cesbank;
let forms = [], actions = [], modal = '';
C.UI.form = (body, fn, label) => {
  forms.push({fn, label});
  return body;
};
C.UI.action = (label, fn) => {
  actions.push({label, fn});
  return label;
};
C.UI.modal = (title, body) => { modal = title + ' ' + body; };
C.UI.render = () => {};
C.UI.done = () => {};
C.UI.close = () => {};
C.UI.flash = () => {};
function render(route, query = '') {
  forms = [];
  actions = [];
  return C.routes[route].render(C.Db.get(), new URLSearchParams(query));
}
function action(label, last = false) {
  const matches = actions.filter(a => a.label === label);
  const target = last ? matches.at(-1) : matches[0];
  assert.ok(target, 'Ação ausente: ' + label);
  target.fn();
}

C.Db.reset();
assert.match(render('investimentos'), /Caixinhas/);
assert.match(render('investimentos'), /Outros produtos disponíveis/);
assert.match(render('investimentos'), /Minhas aplicações/);
assert.doesNotMatch(render('investimentos'), /Gerenciar produtos/);
assert.doesNotMatch(render('investimentos'), /Adicionar produto/);
assert.ok(forms.some(f => f.label === 'Criar aplicação'));
assert.equal(C.routes.caixinhas.group, null);
assert.match(render('caixinhas'), /Voltar a investimentos/);
assert.throws(() => render('gerenciar-investimentos'), /Selecione o perfil Analista/);

C.Session.select('maria', 'ANALISTA');
assert.match(render('investimentos'), /Gerenciar produtos/);
assert.match(render('investimentos'), /Adicionar produto/);
assert.match(render('gerenciar-investimentos'), /Categorias de investimento/);
assert.ok(actions.some(a => a.label === 'Adicionar produto'));
forms.find(f => f.label === 'Adicionar categoria').fn({
  name: 'CDB de validação', type: 'CDB', description: 'Família de teste', available: 'on'
});
const family = C.Db.get().investmentFamilies.find(f => f.name === 'CDB de validação');
assert.ok(family);
assert.match(render('gerenciar-investimentos'), /CDB de validação/);
action('Editar categoria', true);
assert.match(modal, /Editar categoria/);
forms.find(f => f.label === 'Salvar categoria').fn({
  name: 'CDB de validação', type: 'CDB', description: 'Família revisada', available: 'on'
});
assert.equal(C.Db.get().investmentFamilies.find(f => f.id === family.id).description, 'Família revisada');

render('investimentos');
action('Adicionar produto');
assert.match(modal, /Adicionar produto/);
forms.find(f => f.label === 'Criar produto').fn({
  name: 'CDB Prefixado de validação', family: family.id, rateType: 'PREFIXADO',
  annualBp: '1200', cdiPercentBp: '10000', minimum: '100.00',
  quote: '25.00', liquidity: 'DIARIA', waitDays: '0', available: 'on'
});
const product = C.Db.get().products.find(p => p.name === 'CDB Prefixado de validação');
assert.ok(product);
assert.equal(product.family, family.id);
assert.match(render('gerenciar-investimentos'), /CDB Prefixado de validação/);
action('Editar produto', true);
assert.match(modal, /Editar produto/);

C.Session.select('maria');
assert.match(render('investimentos'), /CDB Prefixado de validação/);
forms.find(f => f.label === 'Criar aplicação').fn({
  product: product.id, value: '500.00', quantity: '10', note: 'Reserva'
});
const app = C.Db.get().applications.find(a => a.product === product.id);
assert.ok(app);
assert.match(render('aplicacao', 'id=' + app.id), /Condição contratada/);
assert.doesNotMatch(render('aplicacao', 'id=' + app.id), /Editar aplicação/);

C.Session.select('maria', 'ANALISTA');
render('gerenciar-investimentos');
action('Editar produto', true);
forms.find(f => f.label === 'Salvar produto').fn({
  name: product.name, family: family.id, rateType: 'PREFIXADO',
  annualBp: '1800', cdiPercentBp: '10000', minimum: '100.00',
  quote: '25.00', liquidity: 'DIARIA', waitDays: '0', available: 'on'
});
assert.equal(C.Db.get().products.find(p => p.id === product.id).annualBp, 1800);
assert.equal(C.Db.get().applications.find(a => a.id === app.id).annualBp, 1200);
render('gerenciar-investimentos');
action('Remover produto', true);
assert.throws(() => action('Confirmar remoção'), /posições ativas/);

C.Session.select('maria');
render('aplicacao', 'id=' + app.id);
action('Simular resgate');
forms.find(f => f.label === 'Calcular resgate').fn({value: '500.00'});
assert.match(modal, /Valor líquido a receber/);
action('Confirmar resgate');
assert.equal(C.Db.get().applications.find(a => a.id === app.id).status, 'RESGATADA');
assert.match(render('aplicacao', 'id=' + app.id), /RESGATADA/);

C.Session.select('maria', 'ANALISTA');
render('gerenciar-investimentos');
action('Remover produto', true);
action('Confirmar remoção');
assert.equal(C.Db.get().products.find(p => p.id === product.id).removed, true);
render('gerenciar-investimentos');
action('Remover categoria', true);
action('Confirmar remoção');
assert.equal(C.Db.get().investmentFamilies.find(f => f.id === family.id).removed, true);

C.Db.transaction(s => {
  delete s.investmentFamilies;
  s.products.forEach(p => { delete p.family; });
});
assert.match(render('gerenciar-investimentos'), /CDB Cesbank/);
assert.match(render('investimentos'), /CDB Prefixado/);

console.log('F13: entrada única, gestão do analista, contrato preservado, aplicação e resgate: OK');
