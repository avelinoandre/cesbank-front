const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.resolve(__dirname, '..');
global.window = global; global.location={hash:'#inicio'}; global.addEventListener=()=>{};
global.localStorage={getItem:()=>null,setItem:()=>{}};
global.document={addEventListener:()=>{}};
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for (const [,src] of html.matchAll(/<script src="([^"]+)"/g)) {
 if(src==='core/js/app.js') continue;
 vm.runInThisContext(fs.readFileSync(path.join(root,src),'utf8'),{filename:src});
}
const results=Cesbank.Tests.run();
console.log(JSON.stringify({total:results.total,passed:results.passed,failed:results.results.filter(r=>!r.pass)},null,2));

if(results.total!==results.passed)process.exitCode=1;

const assert = require('assert/strict'), C = Cesbank;
let forms=[], actions=[], modal='';
C.UI.form=(body,fn,label)=>{forms.push({fn,label});return body;};
C.UI.action=(label,fn)=>{actions.push({label,fn});return label;};
C.UI.render=()=>{};C.UI.flash=()=>{};C.UI.done=()=>{};C.UI.close=()=>{};
C.UI.modal=(title,body)=>{modal=title+' '+body;};
function render(route,query='') { forms=[];actions=[];return C.routes[route].render(C.Db.get(),new URLSearchParams(query)); }
function action(label) { const a=actions.find(a=>a.label===label);assert.ok(a,label);a.fn(); }
C.Db.reset();
const r=C.Db.transaction(s=>C.Demos.registration(s,1));
for(let step=1;step<=5;step++) {
  const html=render('abrir-conta','id='+r.id);
  assert.ok(html.includes(['','Dados pessoais','Endereço e contatos','Qualificação e conta','Documentos','Termos e envio'][step]));
  const d=C.Db.get().registrations.find(q=>q.id===r.id).data;
  if(step===2) {assert.ok(html.includes('Telefone principal'));assert.ok(html.includes('Logradouro'));}
  if(step===3) {assert.ok(html.includes('Renda declarada'));assert.ok(!html.includes('name="terms"'));}
  if(step===5) {assert.ok(html.includes('Confira seus dados'));assert.ok(!html.includes('name="income"'));}
  forms[0].fn({...d,terms:'on'}, {elements:{identityFile:{files:[]},addressFile:{files:[]}}});
}
assert.equal(C.Db.get().registrations.find(q=>q.id===r.id).status,'APROVADO');
assert.ok(render('abrir-conta','id='+r.id).includes('Conta criada com sucesso'));
C.Db.reset();
render('emprestimo');forms[0].fn({value:'3000.00',months:'12'});
const q=C.Db.get().proposals[0];
assert.ok(render('emprestimo','id='+q.id).includes('Resultado da simulação'));
action('Ver parcelas');assert.ok(modal.includes('Amortização'));
render('emprestimo','id='+q.id);action('Enviar proposta para análise');
const c=C.Db.get().contracts[0];
assert.ok(render('contratos').includes('Ver contrato'));
assert.ok(!render('contratos').includes('Cronograma de parcelas'));
render('contratos','id='+c.id);forms[0].fn({account:c.account});
assert.equal(C.Db.get().contracts[0].status,'ATIVO');
for(const strategy of ['PARCELA','PRAZO']) {
  render('contratos','id='+c.id);action('Quitar antecipadamente');
  const before=JSON.stringify(C.Db.get());
  forms.at(-1).fn({mode:'PARCIAL',value:'100.00',strategy});
  assert.equal(JSON.stringify(C.Db.get()),before,'Preview must not mutate state');
  assert.ok(modal.includes('Nova parcela'));
}
render('contratos','id='+c.id);action('Quitar antecipadamente');
const before=C.Db.get().accounts[0].total;
forms.at(-1).fn({mode:'PARCELAS',count:'3'});
assert.equal(C.Db.get().accounts[0].total,before);
action('Confirmar antecipação de 3 parcelas');
assert.equal(C.Db.get().contracts[0].rows.filter(r=>r.status==='PAGA').length,3);
render('contratos','id='+c.id);action('Quitar antecipadamente');
forms.at(-1).fn({mode:'TOTAL'});action('Confirmar quitação');
assert.equal(C.Db.get().contracts[0].status,'LIQUIDADO');
assert.throws(()=>render('contratos','id=unknown'));
console.log('Fluxos integrante 2: cadastro em cinco etapas, revisão, aprovação, lista/detalhe, simulação, aceite, prévias sem débito, antecipação e quitação: OK');
// Error paths must preserve the draft and prevent loan acceptance.
C.Db.reset();
const rejected=C.Db.transaction(s=>C.Demos.registration(s,5));
render('abrir-conta','id='+rejected.id);
assert.throws(()=>forms[0].fn({terms:undefined}),/./);
assert.equal(C.Db.get().registrations[0].status,'RASCUNHO');
render('abrir-conta','id='+rejected.id);forms[0].fn({terms:'on',blocked:'on'});
assert.equal(C.Db.get().registrations[0].status,'RECUSADO');
assert.ok(render('abrir-conta','id='+rejected.id).includes('Criar nova solicitação'));
C.Db.reset();
const expired=C.Db.transaction(s=>{const q=C.S.loans.simulate(s,100000,12);q.expires=s.now;s.proposals.push(q);return q;});
assert.ok(render('emprestimo','id='+expired.id).includes('PropostaExpirada'));
assert.ok(!actions.some(a=>a.label==='Enviar proposta para análise'));
C.Db.reset();
const refused=C.Db.transaction(s=>{s.clients.find(u=>u.id===s.session.client).restriction=true;const q=C.S.loans.simulate(s,100000,12);s.proposals.push(q);return C.S.loans.analysis(s,q.id);});
assert.ok(render('contratos','id='+refused.id).includes('Proposta recusada'));
assert.ok(!forms.some(f=>f.label==='Aceitar e contratar'));
console.log('Recusa, consentimento ausente, expiração e bloqueio de aceite: OK');
