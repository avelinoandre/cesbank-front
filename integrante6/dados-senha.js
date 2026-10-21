/* Integrante 6 · F6 RN1–RN7 · dados imutáveis, senha e contatos confirmados. */
(function (C) {
  'use strict';

  const U = C.UI,
    A = C.S.accounts;
  function policy(value, u) {
    C.assert(value.length >= 8 && /[A-Za-z]/.test(value) && /[0-9]/.test(value), 'A senha deve ter ao menos 8 caracteres e combinar letras e números.');
    const lower = value.toLowerCase(),
      birth = u.birth.replace(/-/g, '');
    C.assert(!value.includes(u.cpf) && !value.includes(birth) && !value.includes(birth.slice(6) + birth.slice(4, 6) + birth.slice(0, 4)) && !value.includes(birth.slice(4)) && !value.includes(birth.slice(0, 4)), 'A senha não pode conter CPF ou data de nascimento.');
    const sequences = ['0123456789', '9876543210', 'abcdefghijklmnopqrstuvwxyz', 'zyxwvutsrqponmlkjihgfedcba'];
    C.assert(!sequences.some(seq => Array.from({
      length: seq.length - 2
    }, (_, i) => seq.slice(i, i + 3)).some(x => lower.includes(x))) && !/(.)\1\1/.test(lower), 'A senha não pode conter sequências simples ou três caracteres iguais.');
  }
  function fieldFeedback(form,names,error) {
    if(!form?.elements)return;
    form.querySelectorAll('.i6-inline-error').forEach(el=>el.remove());
    form.querySelectorAll('[aria-invalid]').forEach(el=>{el.removeAttribute('aria-invalid');el.removeAttribute('aria-describedby');});
    if(!error)return;
    names.forEach(name=>{
      const input=form.elements[name];if(!input)return;
      input.setAttribute('aria-invalid','true');
      const message=document.createElement('span');message.className='i6-inline-error';message.id='i6-error-'+name;message.textContent=error.message;message.setAttribute('role','alert');
      input.setAttribute('aria-describedby',message.id);input.closest('label')?.insertAdjacentElement('afterend',message);
    });
  }
  const maskContact=(kind,value)=>kind==='email'?String(value).slice(0,2)+'***@'+String(value).split('@')[1]:'*******'+String(value).slice(-4);
  function beginContacts(s,d) {
    C.Session.requireClient(s);
    const u=A.client(s,s.session.client), normalized={email:String(d.email || '').trim().toLowerCase(),phone:String(d.phone || '').trim().replace(/[ ()-]/g,'')};
    C.assert(C.V.key('EMAIL',normalized.email) && C.V.key('PHONE',normalized.phone),'Informe e-mail e telefone válidos.');
    const changed=['email','phone'].filter(kind=>normalized[kind]!==u[kind]);
    C.assert(changed.length,'Nenhum contato foi alterado.');
    const batch=C.Ids.uuid();
    return changed.map(kind=>{
      const otp=C.Security.otp(s,'CONTATO',normalized[kind]);
      Object.assign(otp,{kind,client:s.session.client,account:s.session.account,batch,before:u[kind],verified:false});
      return otp;
    });
  }
  function contact(s,id,code) {
    C.Session.requireClient(s);
    const pending=s.codes.find(o=>o.id===id && o.scope==='CONTATO');
    C.assert(pending && pending.client===s.session.client && (!pending.account || pending.account===s.session.account) && !pending.superseded && ['email','phone'].includes(pending.kind),'Confirmação indisponível para este cliente.');
    C.assert(pending.expires>s.now,'Código inválido ou expirado.');
    const otp=C.Security.confirm(s,id,'CONTATO',code), u=A.client(s,s.session.client);
    otp.verified=true;
    const batch=otp.batch?s.codes.filter(o=>o.batch===otp.batch && !o.superseded):[otp];
    if(batch.some(o=>!o.verified))return {pending:true};
    batch.forEach(o=>{
      C.assert(o.before===undefined || u[o.kind]===o.before,'O contato atual mudou. Solicite novos códigos antes de continuar.');
      C.assert(C.V.key(o.kind==='email'?'EMAIL':'PHONE',o.target),'Contato fora do formato válido.');
    });
    batch.forEach(o=>{
      const before=u[o.kind];u[o.kind]=o.target;
      if(u.contacts)u.contacts[o.kind==='email'?'emailPrincipal':'phonePrincipal']=o.target;
      C.S.audit(s,'contato',u.id,JSON.stringify({field:o.kind,before:maskContact(o.kind,before)}));
    });
    return {pending:false,at:s.now};
  }
  function resendContact(s,id) {
    C.Session.requireClient(s);
    const old=s.codes.find(o=>o.id===id && o.scope==='CONTATO');
    C.assert(old && old.client===s.session.client && old.account===s.session.account && !old.used && !old.superseded,'Confirmação indisponível para este cliente.');
    const next=C.Security.otp(s,'CONTATO',old.target);
    Object.assign(next,{kind:old.kind,client:old.client,account:old.account,batch:old.batch,before:old.before,verified:false});
    old.used=true;old.superseded=true;
    return next;
  }
  C.S.profile = {
    password(s,d) {
      C.Session.requireClient(s);
      const u=A.client(s,s.session.client);
      C.assert(C.Security.verify(d.current,u.credential),'Senha atual incorreta.');
      C.assert(d.password===d.confirm,'A confirmação da nova senha é divergente.');
      policy(d.password,u);
      C.assert(![u.credential,...u.passwordHistory.slice(-4)].some(cred=>C.Security.verify(d.password,cred)),'A nova senha não pode coincidir com as últimas 5 senhas.');
      u.passwordHistory.push(u.credential);u.passwordHistory=u.passwordHistory.slice(-5);
      u.credential=C.Security.credential(d.password);
      C.S.audit(s,'senha',u.id,'Valor anterior: ********; nova senha armazenada como SHA-256 com sal.');
      return u.credential;
    },contact,beginContacts,resendContact
  };
  function audit(s) {
    return U.table(['Data e hora','Canal','Alteração','Valor anterior'],s.audit.filter(r=>r.entity===s.session.client && ['senha','contato','correcao'].includes(r.type)).slice().reverse().map(r=>{
      let before='********',kind=r.type==='senha'?'Troca de senha':r.type==='correcao'?'Solicitação de correção':'Contato';
      if(r.type==='contato'){try{const data=JSON.parse(r.detail);before=data.before;kind=data.field==='email'?'E-mail':'Telefone';}catch(_){before='Mascarado';}}
      return [U.e(C.Clock.label(r.at)),U.e(r.channel),U.e(kind),U.e(before)];
    }));
  }
  function correction() {
    U.modal('Solicitar correção cadastral','<p>CPF, nascimento e nome civil permanecem preservados até a análise da nova documentação.</p>'+U.form(U.field('reason','Correção desejada')+U.field('files','Novos documentos fictícios','','file','multiple'),(d,f)=>{
      C.Db.transaction(s=>{
        C.Session.requireClient(s);
        C.assert(d.reason.trim() && f.elements.files.files.length,'Descreva a correção e anexe os documentos.');
        const r={id:C.Ids.protocol(s),client:s.session.client,at:s.now,reason:d.reason,files:Array.from(f.elements.files.files,v=>({name:v.name,size:v.size})),status:'PENDENTE'};
        s.corrections.push(r);C.S.audit(s,'correcao',s.session.client,'Nova documentação apresentada · protocolo '+r.id);
      });
      U.done('Solicitação de correção registrada; dados civis preservados até análise.');
    },'Enviar solicitação')+U.action('Cancelar',U.close,'secondary'));
  }
  const passwordHelp='<p>Mínimo de 8 caracteres, combinando letras e números. Sem sequências simples, CPF ou data de nascimento; sem reutilizar as últimas 5 senhas. A senha é armazenada como resumo criptográfico com sal e não pode ser recuperada.</p>';
  function passwordForm() {
    return U.form(U.field('current','Senha atual','','password','autocomplete="current-password"')+U.field('password','Nova senha','','password','autocomplete="new-password"')+U.field('confirm','Confirmar nova senha','','password','autocomplete="new-password"'),(d,form)=>{
      fieldFeedback(form,[],null);
      try{C.Db.transaction(s=>C.S.profile.password(s,d));}catch(error){fieldFeedback(form,[error.message.includes('atual')?'current':error.message.includes('confirmação')?'confirm':'password'],error);throw error;}
      U.done('Senha alterada com sucesso.');
      U.modal('Senha alterada','<div class="i6-result-icon" aria-hidden="true">✓</div>'+U.table(['Informação','Valor'],[['Alteração','Senha de acesso'],['Data e hora',U.e(C.Clock.label(C.Db.get().now))],['Canal','Aplicativo local']])+'<p>Use sua nova senha nos próximos acessos ao protótipo.</p>');
    },'Alterar senha')+passwordHelp;
  }
  function contactCodes(codes,index=0) {
    const otp=codes[index];
    U.modal('Confirmar novo contato','<span class="i6-confirmation" aria-hidden="true"></span><p>Enviamos um código de '+(otp.kind==='email'?'e-mail':'SMS')+' para <strong>'+U.e(otp.target)+'</strong>. '+(codes.length>1?'Confirmação '+(index+1)+' de '+codes.length+'.':'')+'</p><div class="banner warning">Demonstração local · código <strong>'+U.e(otp.code)+'</strong> · válido por 5 minutos.</div><p>Os contatos anteriores permanecem válidos até a confirmação de todos os novos contatos.</p>'+U.form(U.field('code','Código de confirmação','','text','inputmode="numeric" maxlength="6" autocomplete="one-time-code"'),(d,form)=>{
      let result;fieldFeedback(form,[],null);
      try{result=C.Db.transaction(s=>contact(s,otp.id,d.code));}catch(error){fieldFeedback(form,['code'],error);throw error;}
      if(result.pending){contactCodes(codes,index+1);return;}
      U.done('Contato atualizado com sucesso.');
      const s=C.Db.get(),u=A.client(s,s.session.client);
      U.modal('Contato atualizado','<div class="i6-result-icon" aria-hidden="true">✓</div>'+U.table(['Contato','Valor'],[['E-mail',U.e(u.email)],['Telefone',U.e(u.phone)],['Data e hora',U.e(C.Clock.label(s.now))]])+'<p>Os novos contatos já estão em vigor. O histórico preserva os valores anteriores mascarados.</p>');
    },'Confirmar')+U.action('Reenviar código',()=>{
      const next=C.Db.transaction(s=>resendContact(s,otp.id));
      const updated=codes.slice();updated[index]=next;contactCodes(updated,index);
    },'secondary')+U.action('Cancelar',U.close,'secondary'));
  }
  function contactForm(u) {
    return U.form(U.field('phone','Telefone',u.phone)+U.field('email','E-mail',u.email)+'<p>A alteração só é efetivada após confirmação por código enviado a cada novo contato. CPF, nascimento e nome civil não são editáveis aqui.</p>',(d,form)=>{fieldFeedback(form,[],null);try{contactCodes(C.Db.transaction(s=>beginContacts(s,d)));}catch(error){fieldFeedback(form,['email','phone'],error);throw error;}},'Salvar e confirmar');
  }
  C.Router.register('dados','Dados e senha',s=>{
    const u=A.client(s,s.session.client);
    return U.page('Meus dados cadastrais','Dados do titular e contatos atuais.','<div class="grid i6-grid">'+U.card('Dados do titular',U.field('name','Nome civil',u.name,'text','disabled')+U.field('cpf','CPF / CNPJ',u.cpf,'text','disabled')+U.field('birth','Data de nascimento',u.birth,'date','disabled')+'<p>Estes dados não podem ser alterados pelo aplicativo. A correção exige nova apresentação de documentos.</p>'+U.action('Solicitar correção cadastral',correction,'secondary'))+U.card('Contato atual',U.table(['Contato','Valor'],[['Telefone',U.e(u.phone)],['E-mail',U.e(u.email)]])+'<div class="actions">'+U.link('dados-editar','Alterar contato')+U.link('alterar-senha','Alterar senha')+'</div>')+'</div>','F6 · RN5–RN7');
  },'Conta e segurança');
  C.Router.register('dados-editar','Dados cadastrais e senha',s=>{
    const u=A.client(s,s.session.client);
    return U.page('Dados cadastrais e senha','Atualize sua senha de acesso e seus dados de contato.','<div class="grid i6-grid">'+U.card('Alterar senha',passwordForm())+U.card('Atualizar contato',contactForm(u))+'</div>'+U.card('Auditoria de alterações',audit(s))+U.link('dados','Voltar aos meus dados'),'F6 · RN1–RN7');
  },null);
  C.Router.register('alterar-senha','Alterar senha',s=>U.page('Alterar senha','Atualize sua senha de acesso.','<div class="grid i6-grid">'+U.card('Alterar senha',passwordForm())+U.card('Requisitos da nova senha',passwordHelp)+'</div>'+U.card('Auditoria de alterações',audit(s))+U.link('dados','Voltar aos meus dados'),'F6 · RN1–RN4'),null);
})(Cesbank);
