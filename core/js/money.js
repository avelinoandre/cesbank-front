/* Núcleo compartilhado · F2 RN13 e A.7 · centavos inteiros e cálculo racional. */
window.Cesbank = {
  S: {},
  modules: [],
  processors: [],
  routes: {},
  policy: {}
};
(function (C) {
  'use strict';

  const SCALE = 1000000000000n;
  function safe(v) {
    const n = Number(v);
    if (!Number.isSafeInteger(n)) throw new Error('Valor fora da faixa exata de centavos.');
    return n;
  }
  function div(a, b) {
    a = BigInt(a);
    b = BigInt(b);
    if (b <= 0n) throw new Error('Divisor inválido.');
    return (a < 0n ? -1n : 1n) * ((a < 0n ? -a : a) + b / 2n) / b;
  }
  function parse(v, allowZero = false) {
    let t = String(v).trim().replace(/^R\$\s*/, '');
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
    if (!/^\d{1,13}(\.\d{1,2})?$/.test(t)) throw new Error('Informe um valor monetário válido com até duas casas decimais.');
    const [a, b = ''] = t.split('.');
    const n = safe(BigInt(a) * 100n + BigInt(b.padEnd(2, '0')));
    if (n === 0 && !allowZero) throw new Error('O valor deve ser maior que zero.');
    return n;
  }
  function decimal(n) {
    const a = BigInt(n);
    return (a < 0n ? '-' : '') + (a < 0n ? -a : a) / 100n + '.' + String((a < 0n ? -a : a) % 100n).padStart(2, '0');
  }
  function fmt(n) {
    const [a, b] = decimal(n).split('.');
    return 'R$ ' + a.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + b;
  }
  function mul(n, numerator, denominator = 10000) {
    return safe(div(BigInt(n) * BigInt(numerator), BigInt(denominator)));
  }
  function pow(base, exp) {
    let v = SCALE;
    for (let i = 0; i < exp; i++) v = div(v * base, SCALE);
    return v;
  }
  function price(principal, rateBp, months) {
    if (!Number.isInteger(months) || months < 1 || months > 360) throw new Error('Prazo inválido.');
    const r = BigInt(rateBp) * SCALE / 10000n;
    const p = pow(SCALE + r, months);
    const fixed = r === 0n ? safe(div(principal, months)) : safe(div(BigInt(principal) * r * p, SCALE * (p - SCALE)));
    let balance = principal;
    return Array.from({
      length: months
    }, (_, i) => {
      const interest = mul(balance, rateBp);
      const amort = i === months - 1 ? balance : Math.min(balance, fixed - interest);
      const row = {
        number: i + 1,
        interest,
        amort,
        value: amort + interest,
        balance: balance - amort
      };
      balance -= amort;
      return row;
    });
  }
  function irr(net, rows) {
    let low = 0n,
      high = SCALE;
    for (let i = 0; i < 48; i++) {
      const r = (low + high) / 2n;
      let f = SCALE,
        present = 0n;
      rows.forEach(row => {
        f = div(f * (SCALE + r), SCALE);
        present += div(BigInt(row.value) * SCALE, f);
      });
      if (present > BigInt(net)) low = r;else high = r;
    }
    const rate = (low + high) / 2n;
    return {
      monthBp: safe(div(rate * 10000n, SCALE)),
      yearBp: safe(div((pow(SCALE + rate, 12) - SCALE) * 10000n, SCALE))
    };
  }
  C.M = {
    safe,
    div,
    parse,
    decimal,
    fmt,
    mul,
    price,
    irr,
    SCALE,
    pow,
    percent: bp => String(Math.trunc(bp / 100)) + ',' + String(bp % 100).padStart(2, '0') + '%'
  };
})(Cesbank);
