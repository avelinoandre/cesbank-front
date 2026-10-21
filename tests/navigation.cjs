/* Navegação: cobertura dos destinos e preservação dos registros de rota. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
function load(original){
 let random=20261020;
 const crypto={getRandomValues(array){for(let i=0;i<array.length;i++){random^=random<<13;random^=random>>>17;random^=random<<5;array[i]=random>>>0;}return array;}};
 const ctx=vm.createContext({crypto,URLSearchParams,console,structuredClone,TextEncoder,TextDecoder,location:{hash:'#inicio'},addEventListener:()=>{},localStorage:{getItem:()=>null,setItem:()=>{}},document:{addEventListener:()=>{}}});ctx.window=ctx;
 for(const [,file]of fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="([^"]+)"/g)){
  if(file==='core/js/app.js')ctx.Cesbank.UI.render=()=>{};
  const source=original&&file==='core/js/ui.js'?cp.execFileSync('git',['show','HEAD:'+file],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,file),'utf8');
  vm.runInContext(source,ctx,{filename:file});
 }
 return ctx.Cesbank;
}
const before=load(true),C=load(false);
const snapshot=c=>JSON.stringify(Object.entries(c.routes).map(([key,r])=>[key,r.title,r.group,r.render.toString()]));
assert.equal(snapshot(C),snapshot(before),'Destinos, títulos, agrupamentos originais e renderizadores preservados');
const expected=Object.entries(C.routes).filter(([,r])=>r.group).map(([key])=>key).sort();
const initialState=JSON.stringify(C.Db.get());
for(const [key]of Object.entries(C.routes)){
 const html=C.UI.navigation(key),links=[...html.matchAll(/href="#([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual([...links].sort(),expected,'Cada destino aparece exatamente uma vez: '+key);
 assert.equal((html.match(/class="active"/g)||[]).length,1,'Uma localização ativa: '+key);
 assert.ok(html.includes('aria-current='),'Localização acessível: '+key);
}
assert.equal(JSON.stringify(C.Db.get()),initialState,'Renderizar o menu não altera dados nem sessão');
C.routes['modulo-futuro']={title:'Teste <novo>',group:'Novo',render:()=>''};
assert.match(C.UI.navigation('modulo-futuro'),/data-menu-section="outros" open/);
assert.ok(C.UI.navigation('modulo-futuro').includes('Teste &lt;novo&gt;'));
console.log(expected.length+' destinos de menu preservados; '+Object.keys(before.routes).length+' rotas e renderizadores idênticos; destaque, acessibilidade e novos módulos: OK');

// Compara todos os cenários antes/depois: mesmos dados, destino e tela ou erro esperado.
function scenario(c,req){
 try{c.Demos.prepare(req.feature,req.number);const current=c.Router.current();let screen;
  try{screen=c.routes[current.path].render(c.Db.get(),current.params);}catch(error){screen={error:error.message};}
  return JSON.stringify({state:c.Db.get(),path:current.path,query:current.params.toString(),screen});
 }catch(error){return JSON.stringify({error:error.message,state:c.Db.get()});}
}
for(const req of before.Requirements)assert.equal(scenario(C,req),scenario(before,req),req.feature+' RN'+req.number+' preservada');
console.log(before.Requirements.length+' cenários: dados, destinos e conteúdo das telas idênticos à versão anterior.');
