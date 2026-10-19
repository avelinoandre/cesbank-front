/* Núcleo · F6 RN1–5 · SHA-256 com sal local; não constitui autenticação real. */
(function (C) {
  'use strict';

  function sha(text) {
    const data = new TextEncoder().encode(text);
    const len = Math.ceil((data.length + 9) / 64) * 64;
    const bytes = new Uint8Array(len);
    bytes.set(data);
    bytes[data.length] = 128;
    const view = new DataView(bytes.buffer);
    view.setUint32(len - 4, data.length * 8);
    const k = [1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298];
    const h = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225];
    const ro = (x, n) => x >>> n | x << 32 - n;
    for (let off = 0; off < len; off += 64) {
      const w = new Uint32Array(64);
      for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const a = w[i - 15],
          b = w[i - 2];
        w[i] = w[i - 16] + (ro(a, 7) ^ ro(a, 18) ^ a >>> 3) + w[i - 7] + (ro(b, 17) ^ ro(b, 19) ^ b >>> 10) >>> 0;
      }
      let [a, b, c, d, e, f, g, j] = h;
      for (let i = 0; i < 64; i++) {
        const t1 = j + (ro(e, 6) ^ ro(e, 11) ^ ro(e, 25)) + (e & f ^ ~e & g) + k[i] + w[i] >>> 0;
        const t2 = (ro(a, 2) ^ ro(a, 13) ^ ro(a, 22)) + (a & b ^ a & c ^ b & c) >>> 0;
        j = g;
        g = f;
        f = e;
        e = d + t1 >>> 0;
        d = c;
        c = b;
        b = a;
        a = t1 + t2 >>> 0;
      }
      [a, b, c, d, e, f, g, j].forEach((v, i) => h[i] = h[i] + v >>> 0);
    }
    return h.map(v => v.toString(16).padStart(8, '0')).join('');
  }
  C.Security = {
    hash: (password, salt) => sha(salt + ':' + password),
    credential(password) {
      const salt = C.Ids.uuid();
      return {
        salt,
        hash: sha(salt + ':' + password)
      };
    },
    verify(password, cred) {
      return cred && sha(cred.salt + ':' + password) === cred.hash;
    },
    otp(s, scope, target) {
      const code = String(100000 + parseInt(C.Ids.uuid().slice(0, 8), 16) % 900000);
      const row = {
        id: C.Ids.uuid(),
        scope,
        target,
        code,
        expires: new Date(new Date(s.now).getTime() + 300000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        used: false
      };
      s.codes.push(row);
      return row;
    },
    confirm(s, id, scope, code) {
      const row = s.codes.find(r => r.id === id && r.scope === scope);
      C.assert(row && !row.used && row.code === code && row.expires >= s.now, 'Código inválido ou expirado.');
      row.used = true;
      return row;
    }
  };
})(Cesbank);
