/* Integrante 6 · F7 RN1–RN7 · limites, tetos, carência, segundo fator e histórico. */
(function (C) {
  'use strict';

  const U = C.UI,
    A = C.S.accounts;
  const labels = {
    daily: 'Diário',
    per: 'Por transação',
    night: 'Noturno',
    withdraw: 'Saque'
  };
  function validate(s, values) {
    const cap = A.ceilings(s, s.session.account);
    Object.keys(labels).forEach(k => C.assert(Number.isSafeInteger(values[k]) && values[k] >= 0 && values[k] <= cap[k], `${labels[k]} deve estar entre zero e ${C.M.fmt(cap[k])}.`));
    C.assert(values.night <= values.per, 'O limite noturno não pode ser superior ao limite por transação.');
  }
  C.S.limits = {
    validate,
    request(s, values, otpId, code) {
      C.Session.requireClient(s);
      validate(s, values);
      const otp = C.Security.confirm(s, otpId, 'LIMITES', code);
      C.assert(JSON.stringify(otp.payload) === JSON.stringify(values), 'A confirmação não corresponde aos valores solicitados.');
      const a = A.own(s);
      Object.keys(labels).forEach(k => {
        if (a.limits[k] === values[k]) return;
        s.limitChanges.filter(r => r.account === a.id && r.kind === k && r.status === 'EM_CARENCIA').forEach(r => r.status = 'CANCELADA');
        const increase = values[k] > a.limits[k];
        const row = {
          id: C.Ids.uuid(),
          account: a.id,
          kind: k,
          before: a.limits[k],
          value: values[k],
          requested: s.now,
          effective: increase ? new Date(new Date(s.now).getTime() + C.policy.limitWaitHours * 3600000).toISOString().replace(/\.\d{3}Z$/, 'Z') : s.now,
          status: increase ? 'EM_CARENCIA' : 'APLICADA'
        };
        s.limitChanges.push(row);
        if (!increase) a.limits[k] = values[k];
        C.S.audit(s, 'limite', row.id, JSON.stringify(row));
      });
    }
  };
  C.Router.register('limites', 'Limites da conta', s => {
    const a = A.own(s),
      caps = A.ceilings(s, a.id);
    return U.page('Limites da conta', 'Reduções imediatas. Aumentos após 24 horas; confirmação adicional obrigatória.', U.balance(s) + U.card('Vigentes e tetos do banco', U.table(['Limite', 'Vigente', 'Teto da qualificação'], Object.keys(labels).map(k => [labels[k], U.money(a.limits[k]), U.money(caps[k])])) + `<p>Consumido hoje: ${U.money(A.consumption(s, a.id))}. Horário noturno: 20h até 5h59.</p>`) + U.card('Solicitar alteração', U.form('<div class="fields">' + Object.keys(labels).map(k => U.field(k, labels[k], C.M.decimal(a.limits[k]))).join('') + '</div>', d => {
      const values = Object.fromEntries(Object.keys(labels).map(k => [k, C.M.parse(d[k], true)]));
      let otp;
      C.Db.transaction(x => {
        C.Session.requireClient(x);
        validate(x, values);
        otp = C.Security.otp(x, 'LIMITES', A.client(x, x.session.client).phone);
        otp.payload = values;
      });
      U.modal('Confirmação por segundo fator', `<div class="banner warning">Simulação de SMS: <strong>${U.e(otp.code)}</strong><br>Válido por 5 minutos no relógio global.</div>` + U.form(U.field('code', 'Código recebido'), v => {
        C.Db.transaction(x => C.S.limits.request(x, values, otp.id, v.code));
        U.done('Solicitação registrada. Reduções aplicadas; aumentos em carência.');
      }, 'Confirmar alteração'));
    }, 'Revisar e confirmar')) + U.card('Histórico de alterações', U.table(['Tipo', 'Anterior', 'Solicitado', 'Solicitação', 'Vigência', 'Situação'], s.limitChanges.filter(r => r.account === a.id).map(r => [labels[r.kind], U.money(r.before), U.money(r.value), U.e(C.Clock.label(r.requested)), U.e(C.Clock.label(r.effective)), U.badge(r.status)]))), 'F7 · RN1–RN7');
  }, 'Conta e segurança');
})(Cesbank);
