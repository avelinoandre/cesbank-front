/* Integrante 6 · F7 RN1–RN7 · confirmação, vigência e histórico. */
(function (C) {
  'use strict';
  const U=C.UI, A=C.S.accounts, K=C.Clock;
  const labels={daily:'Limite diário de transferência',per:'Limite por transação',night:'Limite noturno — 20h às 6h',withdraw:'Limite de saque'};
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
  function validate(s,values) {
    const cap=A.ceilings(s,s.session.account);
    Object.keys(labels).forEach(k=>C.assert(Number.isSafeInteger(values[k]) && values[k]>=0 && values[k]<=cap[k],labels[k]+' deve estar entre zero e '+C.M.fmt(cap[k])+'.'));
    C.assert(values.night<=values.per,'O limite noturno não pode ser superior ao limite por transação configurado.');
  }
  function begin(s,values) {
    C.Session.requireClient(s);validate(s,values);
    const before={...A.own(s).limits};
    C.assert(Object.keys(labels).some(k=>before[k]!==values[k]),'Nenhum limite foi alterado.');
    const otp=C.Security.otp(s,'LIMITES',A.client(s,s.session.client).phone);
    Object.assign(otp,{payload:C.Db.clone(values),before,client:s.session.client,account:s.session.account,requested:s.now});
    return otp;
  }
  function request(s,values,id,code) {
    C.Session.requireClient(s);validate(s,values);
    const otp=s.codes.find(o=>o.id===id && o.scope==='LIMITES');
    C.assert(otp && otp.client===s.session.client && otp.account===s.session.account,'Confirmação pertence a outro cliente ou conta.');
    C.assert(otp.expires>s.now,'Código inválido ou expirado.');
    C.assert(JSON.stringify(otp.payload)===JSON.stringify(values),'A confirmação não corresponde aos valores solicitados.');
    const a=A.own(s);
    C.assert(JSON.stringify(otp.before)===JSON.stringify(a.limits),'Os limites vigentes mudaram. Revise a solicitação novamente.');
    C.Security.confirm(s,id,'LIMITES',code);
    const result=[];
    Object.keys(labels).forEach(k=>{
      if(a.limits[k]===values[k])return;
      s.limitChanges.filter(r=>r.account===a.id && r.kind===k && r.status==='EM_CARENCIA').forEach(r=>r.status='CANCELADA');
      const increase=values[k]>a.limits[k];
      const row={id:C.Ids.uuid(),account:a.id,kind:k,before:a.limits[k],value:values[k],requested:otp.requested,
        effective:increase?new Date(new Date(otp.requested).getTime()+C.policy.limitWaitHours*3600000).toISOString().replace(/\.\d{3}Z$/,'Z'):s.now,status:increase?'EM_CARENCIA':'APLICADA'};
      s.limitChanges.push(row);result.push(row);
      if(!increase)a.limits[k]=values[k];
      C.S.audit(s,'limite',row.id,JSON.stringify(row));
    });
    return result;
  }
  C.S.limits={validate,begin,request};
  const history=s=>U.table(['Limite','Anterior','Solicitado','Solicitação','Vigência','Situação'],s.limitChanges.filter(r=>r.account===s.session.account).slice().reverse().map(r=>[U.e(labels[r.kind]),U.money(r.before),U.money(r.value),U.e(K.label(r.requested)),U.e(K.label(r.effective)),U.badge(r.status)]));
  function confirmation(otp) {
    const changes=Object.keys(labels).filter(k=>otp.before[k]!==otp.payload[k]);
    const effective=new Date(new Date(otp.requested).getTime()+C.policy.limitWaitHours*3600000).toISOString();
    const hasIncrease=changes.some(k=>otp.payload[k]>otp.before[k]);
    U.modal('Confirmar alteração de limite','<span class="i6-confirmation" aria-hidden="true"></span>'+U.table(['Limite','Anterior → solicitado','Tipo'],changes.map(k=>[U.e(labels[k]),U.money(otp.before[k])+' → '+U.money(otp.payload[k]),otp.payload[k]>otp.before[k]?'Aumento':'Redução']))+'<p>'+(hasIncrease?'Aumentos entrarão em vigor em '+U.e(K.label(effective))+', após '+C.policy.limitWaitHours+' horas; até lá permanece o limite anterior. Reduções têm efeito imediato.':'A redução passa a valer imediatamente após a confirmação, sem carência.')+'</p><div class="banner warning">Segundo fator simulado por SMS: <strong>'+U.e(otp.code)+'</strong> · válido por 5 minutos.</div>'+U.form(U.field('code','Código de verificação (segundo fator)','','text','maxlength="6" inputmode="numeric" autocomplete="one-time-code"'),(d,form)=>{
      let result;fieldFeedback(form,[],null);
      try{result=C.Db.transaction(s=>request(s,otp.payload,otp.id,d.code));}catch(error){fieldFeedback(form,['code'],error);throw error;}
      U.done('Solicitação registrada. Reduções aplicadas; aumentos em carência.');
      const increase=result.some(r=>r.status==='EM_CARENCIA');
      U.modal(increase?'Solicitação de aumento registrada':'Limite reduzido','<div class="i6-result-icon" aria-hidden="true">✓</div>'+U.table(['Limite','Alteração','Vigência','Situação'],result.map(r=>[U.e(labels[r.kind]),U.money(r.before)+' → '+U.money(r.value),U.e(K.label(r.effective)),U.badge(r.status)]))+'<p>'+(increase?'Os aumentos aguardam a carência. O limite anterior continua vigente até a data indicada.':'As reduções já estão em vigor.')+'</p>'+U.action('Ver histórico de alterações',()=>{U.close();C.Router.go('limites-historico');}));
    },'Confirmar alteração')+U.action('Cancelar',U.close,'secondary'));
  }
  C.Router.register('limites','Limites da conta',s=>{
    const a=A.own(s),caps=A.ceilings(s,a.id);
    return U.page('Limites da conta','Configure os limites diário, por transação, noturno e de saque.','<div class="grid i6-grid">'+U.card('Limites vigentes',U.form(Object.keys(labels).map(k=>U.field(k,labels[k]+' (R$)',C.M.decimal(a.limits[k]))).join('')+'<p>Reduções passam a valer imediatamente após a confirmação. Aumentos aguardam '+C.policy.limitWaitHours+' horas. Toda alteração exige segundo fator.</p>',(d,form)=>{
      fieldFeedback(form,[],null);const values={};
      Object.keys(labels).forEach(k=>{try{values[k]=C.M.parse(d[k],true);}catch(error){fieldFeedback(form,[k],error);throw error;}});
      try{confirmation(C.Db.transaction(x=>begin(x,values)));}catch(error){const key=Object.keys(labels).find(k=>error.message.startsWith(labels[k])) || (error.message.includes('noturno')?'night':null);fieldFeedback(form,key?[key]:[],error);throw error;}
    },'Salvar alterações'))+U.card('Histórico de alterações',history(s)+'<p>Cada linha registra o valor anterior, o solicitado, a data da solicitação e a entrada em vigor.</p>'+U.link('limites-historico','Ver histórico completo'))+'</div>'+U.card('Tetos da sua conta',U.table(['Limite','Teto definido pelo banco'],Object.keys(labels).map(k=>[U.e(labels[k]),U.money(caps[k])]))+'<p>Consumido hoje: '+U.money(A.consumption(s,a.id))+'. Período noturno: das 20h até antes das 6h.</p>'),'F7 · RN1–RN7');
  },'Conta e segurança');
  C.Router.register('limites-historico','Histórico de limites',s=>U.page('Histórico de alterações de limite','Valores anteriores e datas de vigência das suas solicitações.',U.card('Alterações da conta',history(s))+U.link('limites','Voltar aos limites'),'F7 · RN7'),null);
})(Cesbank);
