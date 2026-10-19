/* Núcleo · A.1, A.7, A.8 e validações compartilhadas. */
(function (C) {
  'use strict';

  const regex = {
    CPF: /^\d{11}$/,
    CNPJ: /^[A-Za-z0-9]{14}$/,
    PHONE: /^\+[1-9][0-9]{1,14}$/,
    EMAIL: /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/,
    EVP: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  };
  const mask = v => String(v).length === 11 ? '***' + String(v).slice(3, 9) + '**' : String(v).slice(0, 3) + '*******' + String(v).slice(-4);
  const name = v => String(v).split(' ').map((x, i) => i ? x[0] + '.' : x).join(' ');
  function cpf(v) {
    if (!/^\d{11}$/.test(v) || /^(\d)\1+$/.test(v)) return false;
    for (let n = 9; n < 11; n++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += Number(v[i]) * (n + 1 - i);
      if (sum * 10 % 11 % 10 !== Number(v[n])) return false;
    }
    return true;
  }
  function date(v) {
    return /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v)) && new Date(v + 'T12:00:00Z').toISOString().replace(/\.\d{3}Z$/, 'Z').slice(0, 10) === v;
  }
  function mod10(v) {
    let sum = 0,
      w = 2;
    for (let i = v.length - 1; i >= 0; i--) {
      const p = Number(v[i]) * w;
      sum += Math.trunc(p / 10) + p % 10;
      w = w === 2 ? 1 : 2;
    }
    return String((10 - sum % 10) % 10);
  }
  function mod11(v) {
    let sum = 0,
      w = 2;
    for (let i = v.length - 1; i >= 0; i--) {
      sum += Number(v[i]) * w;
      w = w === 9 ? 2 : w + 1;
    }
    const d = 11 - sum % 11;
    return String(d === 0 || d === 10 || d === 11 ? 1 : d);
  }
  function lineFromBarcode(b) {
    const x = b.slice(0, 4) + b.slice(19, 24),
      y = b.slice(24, 34),
      z = b.slice(34, 44);
    return x + mod10(x) + y + mod10(y) + z + mod10(z) + b[4] + b.slice(5, 19);
  }
  function boleto(input) {
    const v = String(input).replace(/[ .-]/g, '');
    let b;
    if (/^\d{47}$/.test(v)) {
      if (mod10(v.slice(0, 9)) !== v[9] || mod10(v.slice(10, 20)) !== v[20] || mod10(v.slice(21, 31)) !== v[31]) C.fail('BoletoInvalido');
      b = v.slice(0, 4) + v[32] + v.slice(33, 47) + v.slice(4, 9) + v.slice(10, 20) + v.slice(21, 31);
    } else if (/^\d{44}$/.test(v)) b = v;else C.fail('BoletoInvalido');
    if (b[3] !== '9' || mod11(b.slice(0, 4) + b.slice(5)) !== b[4]) C.fail('BoletoInvalido');
    return {
      barcode: b,
      line: lineFromBarcode(b),
      factor: Number(b.slice(5, 9)),
      value: Number(b.slice(9, 19)),
      due: C.Clock.addDays('1997-10-07', Number(b.slice(5, 9)))
    };
  }
  function makeBoleto(factor, value, free = '1234567890123456789012345') {
    let b = '2379' + '0' + String(factor).padStart(4, '0') + String(value).padStart(10, '0') + free;
    b = b.slice(0, 4) + mod11(b.slice(0, 4) + b.slice(5)) + b.slice(5);
    return lineFromBarcode(b);
  }
  C.V = {
    regex,
    mask,
    name,
    cpf,
    date,
    boleto,
    makeBoleto,
    account: v => /^\d{1,20}$/.test(v),
    branch: v => /^\d{1,4}$/.test(v),
    key(type, v) {
      return !!regex[type] && regex[type].test(v) && (type !== 'EMAIL' || v.length <= 77);
    }
  };
})(Cesbank);
