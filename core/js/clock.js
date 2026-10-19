/* Núcleo · prazos de todas as RNs · calendário fictício sem feriados, UTC-03. */
(function (C) {
  'use strict';

  const dayMs = 86400000;
  const local = iso => new Date(new Date(iso).getTime() - 10800000);
  const day = iso => local(iso).toISOString().replace(/\.\d{3}Z$/, 'Z').slice(0, 10);
  const at = (d, hour = 10) => new Date(d + 'T' + String(hour + 3).padStart(2, '0') + ':00:00Z').toISOString().replace(/\.\d{3}Z$/, 'Z');
  const addDays = (d, n) => new Date(new Date(d.slice(0, 10) + 'T12:00:00Z').getTime() + n * dayMs).toISOString().replace(/\.\d{3}Z$/, 'Z').slice(0, 10);
  function months(d, n) {
    const x = new Date(d.slice(0, 10) + 'T12:00:00Z');
    const original = x.getUTCDate();
    x.setUTCDate(1);
    x.setUTCMonth(x.getUTCMonth() + n);
    const last = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
    x.setUTCDate(Math.min(original, last));
    return x.toISOString().replace(/\.\d{3}Z$/, 'Z').slice(0, 10);
  }
  const business = d => ![0, 6].includes(new Date(d.slice(0, 10) + 'T12:00:00Z').getUTCDay());
  function adjust(d, previous = false) {
    while (!business(d)) d = addDays(d, previous ? -1 : 1);
    return d;
  }
  function businessAdd(d, n) {
    while (n > 0) {
      d = addDays(d, 1);
      if (business(d)) n--;
    }
    return d;
  }
  function advance(to) {
    const end = new Date(to).getTime();
    const old = C.Db.get().now;
    C.assert(Number.isFinite(end) && end >= new Date(old).getTime(), 'O relógio só pode avançar. Reinicie os dados para voltar.');
    C.assert(end - new Date(old).getTime() <= dayMs * 800, 'Avance no máximo 800 dias por vez.');
    C.Db.transaction(s => {
      let cursor = new Date(s.now).getTime();
      s.systemProcessing = true;
      while (cursor < end) {
        cursor = Math.min(end, Math.floor(cursor / 3600000) * 3600000 + 3600000);
        const before = s.now;
        s.now = new Date(cursor).toISOString().replace(/\.\d{3}Z$/, 'Z');
        C.processors.forEach(fn => fn(s, before));
      }
      delete s.systemProcessing;
    });
  }
  C.Clock = {
    day,
    at,
    local,
    addDays,
    months,
    business,
    adjust,
    businessAdd,
    advance,
    days: (a, b) => Math.floor((new Date(b.slice(0, 10) + 'T12:00:00Z') - new Date(a.slice(0, 10) + 'T12:00:00Z')) / dayMs),
    hour: iso => local(iso).getUTCHours(),
    now: () => C.Db.get().now,
    label: iso => local(iso).toISOString().replace(/\.\d{3}Z$/, 'Z').slice(0, 16).replace('T', ' ') + ' (Brasília)'
  };
})(Cesbank);
