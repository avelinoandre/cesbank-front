/* Núcleo · A.4 e A.7 · UUID v4, identificadores únicos e protocolo. */
(function (C) {
  'use strict';

  C.Ids = {
    uuid() {
      const b = new Uint8Array(16);
      crypto.getRandomValues(b);
      b[6] = b[6] & 15 | 64;
      b[8] = b[8] & 63 | 128;
      const s = Array.from(b, v => v.toString(16).padStart(2, '0')).join('');
      return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
    },
    e2e(s, letter = 'E') {
      let id;
      do {
        id = letter + '12345678' + s.now.replace(/\D/g, '').slice(0, 12) + C.Ids.uuid().replace(/-/g, '').slice(0, 11);
      } while (s.transactions.some(t => t.id === id));
      return id;
    },
    protocol(s) {
      s.sequence++;
      return s.now.slice(0, 4) + '-' + String(s.sequence).padStart(10, '0');
    },
    valid(v) {
      return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
    }
  };
})(Cesbank);
