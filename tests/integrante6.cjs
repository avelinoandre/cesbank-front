/* Regressões do integrante 6: documento de telas v2, F6 e F7. */
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
global.window=global;global.location={hash:'#inicio'};global.addEventListener=()=>{};
global.localStorage={getItem:()=>null,setItem:()=>{}};global.document={addEventListener:()=>{}};
for(const [,src] of fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="([^"]+)"/g)){
 if(src!=='core/js/app.js')vm.runInThisContext(fs.readFileSync(path.join(root,src),'utf8'),{filename:src});
}
const C=Cesbank,results=[];
function test(name,fn){try{C.Db.isolated(()=>fn(C.Db.get()));results.push({name,pass:true});}catch(e){results.push({name,pass:false,detail:e.message});}}
const state=()=>C.Db.get();
const values=(s,change)=>({...s.accounts.find(a=>a.id===s.session.account).limits,...change});
test('Valores negativos, acima do teto e noturno incompatível são recusados',s=>{
 assert.throws(()=>C.S.limits.begin(s,values(s,{daily:-1})));
 assert.throws(()=>C.S.limits.begin(s,values(s,{daily:5000001})));
 assert.throws(()=>C.S.limits.begin(s,values(s,{night:300000,per:200000})));
});
test('Sem alteração não emite código nem cria histórico',s=>{
 assert.throws(()=>C.S.limits.begin(s,values(s,{})));assert.equal(s.codes.length,0);assert.equal(s.limitChanges.length,0);
});
test('Código inválido e expirado não mudam limites',s=>{
 const v=values(s,{daily:900000}),otp=C.S.limits.begin(s,v),before=JSON.stringify(s.accounts[0].limits);
 assert.throws(()=>C.S.limits.request(s,v,otp.id,'000000'));
 s.now=otp.expires;assert.throws(()=>C.S.limits.request(s,v,otp.id,otp.code));assert.equal(JSON.stringify(s.accounts[0].limits),before);
});
test('Confirmação de limites é vinculada ao cliente e aos valores',s=>{
 const v=values(s,{daily:900000}),otp=C.S.limits.begin(s,v);
 assert.throws(()=>C.S.limits.request(s,{...v,daily:800000},otp.id,otp.code));
 s.session={client:'joao',account:'a1',role:'CLIENTE'};assert.throws(()=>C.S.limits.request(s,v,otp.id,otp.code));assert.equal(otp.used,false);
});
test('Redução imediata, aumento em carência e histórico simultâneos',()=>{
 const otp=C.Db.transaction(s=>C.S.limits.begin(s,values(s,{daily:900000,per:600000,night:90000,withdraw:120000})));
 C.Db.transaction(s=>C.S.limits.request(s,otp.payload,otp.id,otp.code));
 assert.equal(state().accounts[0].limits.daily,900000);assert.equal(state().accounts[0].limits.per,500000);
 assert.equal(state().limitChanges.length,4);
 C.Clock.advance('2025-02-04T12:59:00Z');assert.equal(state().accounts[0].limits.per,500000);
 C.Clock.advance('2025-02-04T13:00:00Z');assert.equal(state().accounts[0].limits.per,600000);
});
test('Carência é contada da solicitação e não da confirmação',s=>{
 const v=values(s,{daily:1100000}),otp=C.S.limits.begin(s,v);s.now='2025-02-03T13:03:00Z';
 const rows=C.S.limits.request(s,v,otp.id,otp.code);assert.equal(rows[0].requested,'2025-02-03T13:00:00Z');assert.equal(rows[0].effective,'2025-02-04T13:00:00Z');
});
test('Novo limite vigente exige nova revisão de confirmação',s=>{
 const v=values(s,{daily:900000}),otp=C.S.limits.begin(s,v);s.accounts[0].limits.daily=800000;
 assert.throws(()=>C.S.limits.request(s,v,otp.id,otp.code));assert.equal(otp.used,false);
});
test('Senha atual e confirmação obrigatórias',s=>{
 assert.throws(()=>C.S.profile.password(s,{current:'errada',password:'Forte9!Z7',confirm:'Forte9!Z7'}));
 assert.throws(()=>C.S.profile.password(s,{current:'Cesbank9!',password:'Forte9!Z7',confirm:'Outra9!Z7'}));
});
test('Composição, dados pessoais e histórico de senha',s=>{
 for(const password of ['Abc12345','curta1','52998224725Z','Senha1990X','Cesbank9!'])assert.throws(()=>C.S.profile.password(s,{current:'Cesbank9!',password,confirm:password}));
 C.S.profile.password(s,{current:'Cesbank9!',password:'Forte9!Z7',confirm:'Forte9!Z7'});
 assert.throws(()=>C.S.profile.password(s,{current:'Forte9!Z7',password:'Cesbank9!',confirm:'Cesbank9!'}));
 const u=s.clients[0];assert.equal(C.Security.verify('Forte9!Z7',u.credential),true);assert.equal(JSON.stringify(u).includes('Forte9!Z7'),false);
});
test('Novo contato só é efetivado após código válido',s=>{
 const u=s.clients[0],before=u.email,codes=C.S.profile.beginContacts(s,{email:'NOVO@EXEMPLO.COM',phone:u.phone});
 assert.equal(u.email,before);assert.throws(()=>C.S.profile.contact(s,codes[0].id,'000000'));assert.equal(u.email,before);
 C.S.profile.contact(s,codes[0].id,codes[0].code);assert.equal(u.email,'novo@exemplo.com');assert.throws(()=>C.S.profile.contact(s,codes[0].id,codes[0].code));
 assert.equal(s.audit.at(-1).detail.includes(before),false);
});
test('Mudança conjunta exige confirmar os dois contatos',s=>{
 const u=s.clients[0],before={email:u.email,phone:u.phone},codes=C.S.profile.beginContacts(s,{email:'novo@exemplo.com',phone:'+55 81 98888-7777'});
 assert.equal(C.S.profile.contact(s,codes[0].id,codes[0].code).pending,true);
 assert.equal(u.email,before.email);assert.equal(u.phone,before.phone);
 assert.equal(C.S.profile.contact(s,codes[1].id,codes[1].code).pending,false);
 assert.equal(u.email,'novo@exemplo.com');assert.equal(u.phone,'+5581988887777');assert.equal(s.audit.filter(r=>r.type==='contato').length,2);
});
test('Reenvio invalida código anterior e permite confirmar após expiração',s=>{
 const u=s.clients[0],codes=C.S.profile.beginContacts(s,{email:'novo@exemplo.com',phone:u.phone}),old=codes[0];
 s.now=old.expires;assert.throws(()=>C.S.profile.contact(s,old.id,old.code));
 const next=C.S.profile.resendContact(s,old.id);assert.throws(()=>C.S.profile.contact(s,old.id,old.code));
 C.S.profile.contact(s,next.id,next.code);assert.equal(u.email,'novo@exemplo.com');
});
test('Outro cliente não confirma nem reenvia o código de contato',s=>{
 const u=s.clients[0],codes=C.S.profile.beginContacts(s,{email:'novo@exemplo.com',phone:u.phone});s.session={client:'joao',account:'a1',role:'CLIENTE'};
 assert.throws(()=>C.S.profile.contact(s,codes[0].id,codes[0].code));assert.throws(()=>C.S.profile.resendContact(s,codes[0].id));assert.equal(codes[0].used,false);
});
test('Contato concorrente não é sobrescrito por confirmação antiga',()=>{
 const codes=C.Db.transaction(s=>C.S.profile.beginContacts(s,{email:'novo@exemplo.com',phone:s.clients[0].phone}));
 C.Db.transaction(s=>{s.clients[0].email='recente@exemplo.com';});
 assert.throws(()=>C.Db.transaction(s=>C.S.profile.contact(s,codes[0].id,codes[0].code)));
 assert.equal(state().clients[0].email,'recente@exemplo.com');assert.equal(state().codes[0].used,false);
});
test('Resumo preserva dados civis imutáveis e separa formulários',s=>{
 const summary=C.routes.dados.render(s,new URLSearchParams());assert.ok(summary.includes('disabled'));assert.ok(summary.includes('#dados-editar'));assert.ok(summary.includes('#alterar-senha'));assert.ok(!summary.includes('name="password"'));
 const edit=C.routes['dados-editar'].render(s,new URLSearchParams());assert.ok(edit.includes('name="phone"'));assert.ok(edit.includes('name="email"'));assert.ok(edit.includes('Auditoria de alterações'));
});
test('Redução de limite é respeitada pela transferência Pix',s=>{
 const v=values(s,{daily:10000}),otp=C.S.limits.begin(s,v);C.S.limits.request(s,v,otp.id,otp.code);
 assert.throws(()=>C.S.transfer.execute(s,{method:'PIX',key:'joao@cesbank.com',value:20000,requestId:C.Ids.uuid()}),e=>e.code==='LimiteDiarioExcedido');
});
test('Atualização de contato preserva todos os vínculos Pix',s=>{
 const keys=JSON.stringify(s.keys),codes=C.S.profile.beginContacts(s,{email:'novo@exemplo.com',phone:s.clients[0].phone});
 C.S.profile.contact(s,codes[0].id,codes[0].code);assert.equal(JSON.stringify(s.keys),keys);
});
test('Limites zero são válidos e a confirmação não pode ser reutilizada',s=>{
 const v=values(s,{daily:0,per:0,night:0,withdraw:0}),otp=C.S.limits.begin(s,v);C.S.limits.request(s,v,otp.id,otp.code);
 assert.equal(s.accounts[0].limits.daily,0);assert.throws(()=>C.S.limits.request(s,v,otp.id,otp.code));
});
const original=C.Tests.run();
const report={original:{total:original.total,passed:original.passed,failed:original.results.filter(r=>!r.pass)},additional:{total:results.length,passed:results.filter(r=>r.pass).length,results}};
console.log(JSON.stringify(report,null,2));
if(process.env.CESBANK_TEST_REPORT)fs.writeFileSync(process.env.CESBANK_TEST_REPORT,JSON.stringify(report,null,2));
if(original.total!==original.passed || results.some(r=>!r.pass))process.exitCode=1;
