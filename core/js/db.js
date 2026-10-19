/* Núcleo · atomicidade F2 RN9 e F13b RN3 · único acesso a localStorage. */
(function (C) {
  'use strict';

  const key = 'cesbank.prototype.v1';
  let memory,
    isolated = false;
  const clone = x => JSON.parse(JSON.stringify(x));
  function get() {
    if (!memory) {
      try {
        memory = JSON.parse(localStorage.getItem(key));
      } catch (_) {
        memory = null;
      }
      if (!memory || memory.schema !== 1) memory = C.seed();
    }
    return clone(memory);
  }
  function save(s) {
    const text = JSON.stringify(s);
    if (!isolated) {
      try {
        localStorage.setItem(key, text);
        C.storageWarning = false;
      } catch (_) {
        C.storageWarning = true;
      }
    }
    memory = clone(s);
  }
  function transaction(fn) {
    const s = get();
    const result = fn(s);
    C.assert(!(result && typeof result.then === 'function'), 'Operações assíncronas não são permitidas dentro de transações.');
    s.accounts.forEach(a => {
      C.assert(Number.isSafeInteger(a.total) && a.total >= 0, 'Saldo total inconsistente.');
      C.assert(C.S.accounts.balance(s, a.id).available >= 0, 'Composição de saldo inconsistente.');
    });
    save(s);
    return clone(result === undefined ? null : result);
  }
  C.Db = {
    get,
    transaction,
    reset() {
      save(C.seed());
    },
    clone,
    isolated(fn) {
      const before = get();
      const warning = C.storageWarning;
      isolated = true;
      try {
        memory = C.seed();
        return fn();
      } finally {
        memory = before;
        isolated = false;
        C.storageWarning = warning;
      }
    }
  };
})(Cesbank);
