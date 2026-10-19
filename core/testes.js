/* Núcleo · verificações de integração em base isolada; o roteiro mantém os casos de interface. */
(function (C) {
  'use strict';

  const M = C.M,
    K = C.Clock,
    S = C.S;
  function run() {
    const results = [];
    const ok = (v, msg = 'Resultado divergente do esperado.') => {
      if (!v) throw new Error(msg);
    };
    const eq = (a, b) => ok(JSON.stringify(a) === JSON.stringify(b), JSON.stringify(a) + ' != ' + JSON.stringify(b));
    function throws(fn, code) {
      let err;
      try {
        fn();
      } catch (e) {
        err = e;
      }
      ok(err, 'A operação deveria ser recusada.');
      if (code) ok(err.code === code || err.message.includes(code) || err.detail?.includes(code), 'Esperado ' + code + '; recebido ' + err.code + ' / ' + err.message);
      return err;
    }
    function test(name, rules, fn) {
      try {
        C.Db.isolated(() => fn(C.Db.get()));
        results.push({
          name,
          rules,
          pass: true
        });
      } catch (e) {
        results.push({
          name,
          rules,
          pass: false,
          detail: e.message
        });
      }
    }
    const transfer = (s, value = 10000, requestId = C.Ids.uuid()) => S.transfer.execute(s, {
      method: 'PIX',
      key: 'joao@cesbank.com',
      value,
      requestId
    });
    const apply = (s, product = 'p1', value = '500.00') => S.investments.apply(s, {
      product,
      value,
      quantity: '10'
    });
    const box = s => S.boxes.create(s, {
      name: 'Meta teste',
      goal: '100.00'
    });
    const limitValues = s => ({
      ...s.accounts[0].limits,
      daily: 900000
    });
    const draft = s => C.Demos.registration(s, 5);
    test('Centavos exatos e valor mínimo', ['F2 RN8', 'F2 RN13'], () => {
      eq(M.parse('0,10'), 10);
      eq(M.fmt(10), 'R$ 0,10');
      eq(M.decimal(1), '0.01');
      eq(M.mul(101, 5000), 51);
      throws(() => M.parse('1.001'));
      throws(() => M.parse('0'));
    });
    test('UUID v4 e identificador de 32 caracteres', ['F2 RN10', 'F2 RN11'], s => {
      ok(C.Ids.valid(C.Ids.uuid()));
      const a = C.Ids.e2e(s);
      ok(/^[ED]\d{20}[A-Za-z0-9]{11}$/.test(a));
      eq(a.length, 32);
    });
    test('Relógio local, dia útil e aniversário de mês', ['F4 RN1', 'F13b RN6'], () => {
      eq(K.adjust('2025-02-08'), '2025-02-10');
      eq(K.adjust('2025-02-08', true), '2025-02-07');
      eq(K.months('2025-01-31', 1), '2025-02-28');
      eq(K.businessAdd('2025-02-03', 10), '2025-02-17');
    });
    test('Rollback de uma operação incompleta', ['F2 RN9'], () => {
      const before = C.Db.get();
      throws(() => C.Db.transaction(s => {
        s.accounts[0].total -= 10000;
        throw new Error('Falha de consistência');
      }));
      eq(C.Db.get().accounts, before.accounts);
    });
    test('Transferência pelas duas formas de resolução', ['F2 RN1', 'F2 RN4'], s => {
      eq(S.destination(s, {
        method: 'PIX',
        key: 'joao@cesbank.com'
      }).id, 'a1');
      eq(S.destination(s, {
        method: 'DADOS_BANCARIOS',
        branch: '0001',
        number: '0007654322'
      }).id, 'a1');
      const t = transfer(s);
      ok(t.receipt.receiver.document.startsWith('***'));
      ok(t.receipt.receiver.name.includes('.'));
    });
    test('Destino inexistente, inativo e mesma conta', ['F2 RN2', 'F2 RN3'], s => {
      throws(() => S.destination(s, {
        method: 'DADOS_BANCARIOS',
        branch: '0001',
        number: '99999'
      }), 'ContaInexistenteOuInativa');
      s.accounts[1].status = 'INATIVA';
      throws(() => transfer(s), 'ContaInexistenteOuInativa');
      throws(() => S.move(s, {
        from: 'a0',
        to: 'a0',
        value: 10,
        requestId: C.Ids.uuid()
      }), 'Origem e destino');
    });
    test('Composição de saldo e saldo insuficiente', ['F2 RN5', 'F13a RN1', 'F13b RN4'], s => {
      const b = box(s);
      S.boxes.move(s, b.id, 10000, 'DEPOSITO');
      apply(s);
      eq(S.accounts.balance(s, 'a0'), {
        total: 2500000,
        blocked: 0,
        invested: 50000,
        boxes: 10000,
        available: 2440000
      });
      s.accounts[0].total = 60000;
      throws(() => transfer(s, 1), 'SaldoInsuficiente');
    });
    test('Limite diário compartilhado e limite por transação', ['F2 RN6', 'F2 RN8', 'F4 RN4'], s => {
      transfer(s, 400000);
      transfer(s, 400000);
      throws(() => transfer(s, 300000), 'LimiteDiarioExcedido');
      throws(() => transfer(s, 600000), 'LimitePorTransacaoExcedido');
    });
    test('Faixa noturna e fronteiras 20h/6h', ['F2 RN7', 'F7 RN5'], s => {
      s.now = '2025-02-04T00:00:00Z';
      throws(() => transfer(s, 150000), 'LimiteNoturnoExcedido');
      s.now = '2025-02-04T09:00:00Z';
      ok(transfer(s, 150000).status === 'EFETIVADA');
    });
    test('Débito/crédito atômico e comprovante imutável', ['F2 RN9', 'F2 RN14'], s => {
      const a = s.accounts[0].total,
        b = s.accounts[1].total;
      const tx = transfer(s);
      eq(s.accounts[0].total, a - 10000);
      eq(s.accounts[1].total, b + 10000);
      eq(tx.receipt.id, tx.id);
      eq(tx.receipt.resolution, 'PIX');
      ok(tx.history.length === 2);
    });
    test('Reenvio da requisição sem nova movimentação', ['F2 RN10', 'F1 RN2'], s => {
      const id = C.Ids.uuid(),
        first = transfer(s, 10000, id),
        before = s.accounts[0].total;
      const repeat = transfer(s, 10000, id);
      eq(first.id, repeat.id);
      ok(repeat.duplicate);
      eq(before, s.accounts[0].total);
    });
    test('Transições financeiras restritas', ['F2 RN12'], s => {
      const tx = transfer(s);
      throws(() => S.transition(s, tx, 'transaction', 'EM_PROCESSAMENTO'));
      S.transition(s, tx, 'transaction', 'DEVOLVIDA', 'MD06');
      throws(() => S.transition(s, tx, 'transaction', 'EFETIVADA'));
    });
    test('Falha após débito gera estorno automático BE08', ['F2 RN9', 'F12 RN10'], s => {
      s.demo.failAfterDebit = true;
      const a = s.accounts[0].total,
        b = s.accounts[1].total;
      const tx = transfer(s);
      eq(tx.status, 'DEVOLVIDA');
      eq(s.accounts[0].total, a);
      eq(s.accounts[1].total, b);
      ok(s.transactions.some(t => t.original === tx.id && t.reason === 'BE08'));
    });
    test('Regex Pix, e-mail normalizado e EVP gerada', ['F1 RN1'], s => {
      ok(C.V.key('CNPJ', 'A1234567890123'));
      ok(!C.V.key('EMAIL', 'a'.repeat(70) + '@mail.com'));
      const k = S.pix.add(s, {
        type: 'EVP',
        reason: 'USER_REQUESTED',
        requestId: C.Ids.uuid()
      });
      ok(C.Ids.valid(k.value));
      s.keys.find(k => k.value === 'maria@cesbank.com').status = 'INATIVA';
      eq(S.pix.add(s, {
        type: 'EMAIL',
        value: 'MARIA@CESBANK.COM',
        reason: 'USER_REQUESTED',
        requestId: C.Ids.uuid()
      }).value, 'maria@cesbank.com');
    });
    test('Pix duplicada, limite máximo e titularidade', ['F1 RN3', 'F1 RN4'], s => {
      throws(() => S.pix.add(s, {
        type: 'EMAIL',
        value: 'joao@cesbank.com',
        reason: 'USER_REQUESTED',
        requestId: C.Ids.uuid()
      }), 'ChaveJaExiste');
      throws(() => S.pix.add(s, {
        type: 'PHONE',
        value: '+5511888877777',
        reason: 'USER_REQUESTED',
        requestId: C.Ids.uuid()
      }), 'ChaveDeOutroTitular');
      for (let i = 0; i < 3; i++) S.pix.add(s, {
        type: 'EVP',
        reason: 'USER_REQUESTED',
        requestId: C.Ids.uuid()
      });
      throws(() => S.pix.add(s, {
        type: 'EVP',
        reason: 'USER_REQUESTED',
        requestId: C.Ids.uuid()
      }), 'LimiteDeChavesExcedido');
    });
    test('Consulta Pix, mascaramento e estatísticas', ['F1 RN5', 'F1 RN9'], s => {
      const r = S.pix.resolve(s, 'joao@cesbank.com');
      eq(r.chave.situacao, 'ATIVA');
      eq(r.estatisticas.consultasNoPeriodo, 1);
      ok(r.chave.titular.documento.includes('*'));
      throws(() => S.pix.resolve(s, 'ausente@exemplo.com'), 'ChaveNaoEncontrada');
      for (let i = 0; i < 8; i++) S.pix.resolve(s, 'joao@cesbank.com');
      throws(() => S.pix.resolve(s, 'joao@cesbank.com'), 'ConsultasExcedidas');
    });
    test('Reivindicação bloqueia resolução e exclusão', ['F1 RN6', 'F1 RN8', 'F1 RN10'], s => {
      const k = s.keys.find(k => k.value === 'joao@cesbank.com'),
        r = {
          id: C.Ids.uuid(),
          key: k.id,
          account: 'a0',
          type: 'OWNERSHIP',
          status: 'ABERTA',
          history: []
        };
      s.claims.push(r);
      throws(() => S.pix.resolve(s, k.value), 'ChaveBloqueadaPorReivindicacao');
      throws(() => S.pix.remove(s, k.id, 'USER_REQUESTED'), 'ChaveBloqueadaPorReivindicacao');
      throws(() => S.transition(s, r, 'claim', 'CONCLUIDA'));
      S.transition(s, r, 'claim', 'AGUARDANDO_RESOLUCAO');
      S.transition(s, r, 'claim', 'CONFIRMADA');
      S.transition(s, r, 'claim', 'CONCLUIDA');
      ok(S.pix.resolve(s, k.value));
    });
    test('Inativação lógica e motivo de operação', ['F1 RN7'], s => {
      const k = s.keys[0];
      S.pix.remove(s, k.id, 'FRAUD');
      eq(k.status, 'INATIVA');
      eq(k.history[0].detail, 'FRAUD');
      throws(() => S.pix.resolve(s, k.value), 'ChaveNaoEncontrada');
    });
    test('Boleto válido em 47/44 dígitos e falha em verificadores', ['F3 RN1', 'F3 RN2'], s => {
      const r = C.V.boleto(s.boletos[0].line);
      eq(r.value, 18590);
      eq(r.due, '2025-02-21');
      eq(C.V.boleto(r.barcode).line, r.line);
      for (let i = 0; i < 47; i++) {
        const changed = r.line.slice(0, i) + (r.line[i] === '0' ? '1' : '0') + r.line.slice(i + 1);
        throws(() => C.V.boleto(changed), 'BoletoInvalido');
      }
    });
    test('Encargos, desconto e prazo de vencimento', ['F3 RN4', 'F3 RN5', 'F3 RN6'], s => {
      const q = S.boleto.quote(s, 'b0');
      ok(q.discount > 0 && q.fine === 0);
      const late = S.boleto.quote(s, 'b0', '2025-02-24');
      ok(late.interest > 0 && late.fine > 0 && late.discount === 0);
      throws(() => S.boleto.quote(s, 'b2'), 'BoletoVencidoForaDoPrazo');
      s.now = '2025-02-03T21:00:00Z';
      eq(S.boleto.quote(s, 'b0').date, '2025-02-04');
    });
    test('Boleto pago não duplica e contém comprovante completo', ['F3 RN3', 'F3 RN10', 'F3 RN11'], s => {
      const tx = S.boleto.execute(s, 'b0', C.Ids.uuid());
      eq(s.boletos[0].status, 'PAGO');
      eq(tx.type, 'BOLETO');
      ok(tx.receipt.line && tx.receipt.nominal && tx.receipt.settlementDate);
      throws(() => S.boleto.execute(s, 'b0', C.Ids.uuid()), 'BoletoJaLiquidado');
    });
    test('Boleto sem saldo aceita agendamento e não pagamento', ['F3 RN7', 'F3 RN8'], s => {
      s.accounts[0].total = 0;
      throws(() => S.boleto.execute(s, 'b0', C.Ids.uuid()), 'SaldoInsuficiente');
      S.schedules.create(s, {
        date: '2025-02-04',
        kind: 'BOLETO',
        value: 18590,
        payload: {
          id: 'b0'
        }
      });
      eq(s.schedules.length, 1);
      eq(S.accounts.consumption(s, 'a0'), 0);
      throws(() => S.boleto.validateSchedule(s, 'b0', '2025-03-01'));
    });
    test('Rejeição e recurso mantêm boleto não pagável', ['F3 RN12', 'F3 RN13', 'F3 RN14'], s => {
      const b = s.boletos[0];
      S.transition(s, b, 'boleto', 'REJEITADO', 'Não reconhecido.');
      throws(() => S.boleto.quote(s, b.id));
      S.transition(s, b, 'boleto', 'REJEITADO_RECORRIDO');
      throws(() => S.boleto.execute(s, b.id, C.Ids.uuid()));
      S.transition(s, b, 'boleto', 'ABERTO', 'Cliente reconheceu evidências.');
      ok(S.boleto.quote(s, b.id));
    });
    test('Recorrência mensal e ajuste de fim de semana', ['F4 RN1', 'F4 RN2'], s => {
      S.schedules.create(s, {
        date: '2025-02-08',
        kind: 'TRANSFERENCIA',
        payload: {
          method: 'PIX',
          key: 'joao@cesbank.com'
        },
        value: 10000,
        recurring: 'SIM',
        frequency: 'MENSAL',
        count: '3'
      });
      eq(s.schedules.length, 3);
      eq(s.schedules[0].date, '2025-02-10');
      throws(() => S.schedules.create(s, {
        date: '2025-02-08',
        payload: {
          method: 'PIX',
          key: 'joao@cesbank.com'
        },
        value: 10000,
        recurring: 'SIM',
        frequency: 'MENSAL'
      }));
    });
    test('Agendamento sem reserva e execução com limite do dia', ['F4 RN3', 'F4 RN4', 'F4 RN8'], () => {
      C.Db.transaction(s => {
        S.schedules.create(s, {
          date: '2025-02-04',
          payload: {
            method: 'PIX',
            key: 'joao@cesbank.com'
          },
          value: 10000
        });
        eq(S.accounts.consumption(s, 'a0'), 0);
      });
      K.advance('2025-02-04T13:00:00Z');
      const s = C.Db.get();
      eq(s.schedules[0].status, 'EXECUTADA');
      eq(S.accounts.consumption(s, 'a0'), 10000);
      ok(s.schedules[0].transaction);
    });
    test('Três tentativas falham sem interromper recorrência', ['F4 RN5', 'F3 RN9'], () => {
      C.Db.transaction(s => {
        s.accounts[0].total = 0;
        S.schedules.create(s, {
          date: '2025-02-04',
          payload: {
            method: 'PIX',
            key: 'joao@cesbank.com'
          },
          value: 10000,
          recurring: 'SIM',
          frequency: 'MENSAL',
          count: '2'
        });
      });
      K.advance('2025-02-04T18:00:00Z');
      const s = C.Db.get();
      eq(s.schedules[0].status, 'FALHADA');
      eq(s.schedules[0].attempts.length, 3);
      eq(s.schedules[1].status, 'PENDENTE');
      ok(s.notifications.length);
    });
    test('Cancelamento até véspera e execução imutável', ['F4 RN6', 'F4 RN7'], s => {
      S.schedules.create(s, {
        date: '2025-02-04',
        payload: {
          method: 'PIX',
          key: 'joao@cesbank.com'
        },
        value: 10000
      });
      const r = s.schedules[0];
      S.schedules.cancel(s, r.id);
      eq(r.status, 'CANCELADA');
      throws(() => S.transition(s, r, 'schedule', 'PENDENTE'));
    });
    test('CPF válido, único, maioridade e nomes', ['F5 RN1', 'F5 RN2', 'F5 RN3', 'F5 RN4'], s => {
      const r = draft(s);
      S.opening.validate(s, r.data, 1);
      r.data.cpf = '52998224725';
      throws(() => S.opening.validate(s, r.data, 1), 'mesmo CPF');
      r.data.cpf = '39053344705';
      r.data.birth = '2010-01-01';
      throws(() => S.opening.validate(s, r.data, 1), '18 anos');
      r.data.birth = '1992-03-15';
      r.data.name = 'x'.repeat(71);
      throws(() => S.opening.validate(s, r.data, 1));
      ok(!C.V.cpf('11111111111'));
    });
    test('Endereço consulta CEP e IBGE e contatos principais', ['F5 RN5', 'F5 RN6'], s => {
      const d = draft(s).data;
      S.opening.validate(s, d, 2);
      d.ibge = '3550308';
      throws(() => S.opening.validate(s, d, 2));
      S.opening.validate(s, d, 3);
      d.emailPrincipal = false;
      throws(() => S.opening.validate(s, d, 3));
    });
    test('Documentos obrigatórios, validade e compatibilidade', ['F5 RN7'], s => {
      const d = draft(s).data;
      S.opening.validate(s, d, 4);
      d.expiry = '2020-01-01';
      throws(() => S.opening.validate(s, d, 4));
      d.expiry = '2030-01-01';
      d.documentCpf = '11144477735';
      throws(() => S.opening.validate(s, d, 4));
    });
    test('Qualificação, consentimento, conta e limites iniciais', ['F5 RN8', 'F5 RN9', 'F5 RN11', 'F5 RN12'], s => {
      const r = draft(s);
      S.opening.submit(s, r);
      eq(r.status, 'APROVADO');
      const a = s.accounts.find(a => a.id === r.account),
        u = s.clients.find(u => u.id === r.client);
      eq(a.total, 0);
      ok(a.limits.daily > 0);
      eq(u.social, 'Ana');
      eq(u.consent.version, '2026.02');
      eq(u.qualification, 'MEDIA');
      eq(S.opening.monthly(1200000, 'ANUAL'), 100000);
    });
    test('Recusa cadastral com motivo e sem reabertura', ['F5 RN10'], s => {
      const r = draft(s);
      r.blocked = true;
      S.opening.submit(s, r);
      eq(r.status, 'RECUSADO');
      ok(r.reason && r.criterion);
      throws(() => S.opening.submit(s, r));
      eq(s.accounts.length, 4);
    });
    test('Encerramento exige saldo zero e inativa Pix', ['F5 RN11', 'F1 RN7'], s => {
      throws(() => S.closure(s));
      s.accounts[0].total = 0;
      S.closure(s);
      eq(s.accounts[0].status, 'ENCERRADA');
      ok(s.keys.filter(k => k.account === 'a0').every(k => k.status === 'INATIVA' && k.reason === 'ACCOUNT_CLOSURE'));
    });
    test('Senha atual, composição e divergência de confirmação', ['F6 RN1', 'F6 RN2'], s => {
      throws(() => S.profile.password(s, {
        current: 'errada',
        password: 'Forte9!Z7',
        confirm: 'Forte9!Z7'
      }));
      throws(() => S.profile.password(s, {
        current: 'Cesbank9!',
        password: 'Abc12345',
        confirm: 'Abc12345'
      }));
      throws(() => S.profile.password(s, {
        current: 'Cesbank9!',
        password: 'Forte9!Z7',
        confirm: 'Outra8!J'
      }));
    });
    test('Hash SHA-256 com sal e vedação de reuso', ['F6 RN3', 'F6 RN4', 'F6 RN7'], s => {
      const u = s.clients[0],
        old = u.credential;
      const cred = S.profile.password(s, {
        current: 'Cesbank9!',
        password: 'Forte9!Z7',
        confirm: 'Forte9!Z7'
      });
      ok(cred.salt !== old.salt && cred.hash.length === 64);
      ok(!JSON.stringify(u).includes('Forte9!Z7'));
      throws(() => S.profile.password(s, {
        current: 'Forte9!Z7',
        password: 'Cesbank9!',
        confirm: 'Cesbank9!'
      }));
      ok(s.audit.at(-1).detail.includes('********'));
    });
    test('Contato só muda com código correto e não expirado', ['F6 RN5', 'F6 RN6'], s => {
      const before = s.clients[0].email,
        otp = C.Security.otp(s, 'CONTATO', 'novo@exemplo.com');
      Object.assign(otp, {
        kind: 'email',
        client: 'maria'
      });
      eq(s.clients[0].email, before);
      throws(() => S.profile.contact(s, otp.id, '000000'));
      S.profile.contact(s, otp.id, otp.code);
      eq(s.clients[0].email, 'novo@exemplo.com');
      eq(s.clients[0].cpf, '52998224725');
      throws(() => S.profile.contact(s, otp.id, otp.code));
    });
    test('Tetos e consistência entre limites', ['F7 RN1', 'F7 RN2', 'F7 RN5'], s => {
      const v = limitValues(s);
      S.limits.validate(s, v);
      throws(() => S.limits.validate(s, {
        ...v,
        daily: 5000001
      }));
      throws(() => S.limits.validate(s, {
        ...v,
        night: 600000
      }));
      throws(() => S.limits.validate(s, {
        ...v,
        withdraw: -1
      }));
    });
    test('Segundo fator, redução imediata e histórico', ['F7 RN3', 'F7 RN6', 'F7 RN7'], s => {
      const v = limitValues(s),
        otp = C.Security.otp(s, 'LIMITES', '+5581999998888');
      otp.payload = v;
      throws(() => S.limits.request(s, v, otp.id, '000000'));
      S.limits.request(s, v, otp.id, otp.code);
      eq(s.accounts[0].limits.daily, 900000);
      eq(s.limitChanges[0].before, 1000000);
      eq(s.limitChanges[0].effective, s.now);
    });
    test('Aumento só entra em vigor após 24h', ['F7 RN4'], () => {
      C.Db.transaction(s => {
        const v = {
            ...s.accounts[0].limits,
            daily: 1100000
          },
          otp = C.Security.otp(s, 'LIMITES', '+5581999998888');
        otp.payload = v;
        S.limits.request(s, v, otp.id, otp.code);
      });
      K.advance('2025-02-04T12:00:00Z');
      eq(C.Db.get().accounts[0].limits.daily, 1000000);
      K.advance('2025-02-04T13:00:00Z');
      eq(C.Db.get().accounts[0].limits.daily, 1100000);
    });
    test('Favorito exige apelido/destino e valida vínculo', ['F8 RN1', 'F8 RN3'], s => {
      throws(() => S.favorites.save(s, {
        alias: '',
        method: 'PIX',
        key: 'joao@cesbank.com'
      }));
      throws(() => S.favorites.save(s, {
        alias: 'Destino',
        method: 'PIX',
        key: 'ausente@exemplo.com'
      }), 'ChaveNaoEncontrada');
      const f = S.favorites.save(s, {
        alias: 'João',
        method: 'PIX',
        key: 'joao@cesbank.com'
      });
      ok(f.name.includes('.'));
    });
    test('Favorito sem apelido/destino duplicado e transação independente', ['F8 RN2', 'F8 RN4', 'F8 RN5'], s => {
      const f = S.favorites.save(s, {
        alias: 'João',
        method: 'PIX',
        key: 'joao@cesbank.com'
      });
      throws(() => S.favorites.save(s, {
        alias: 'João',
        method: 'PIX',
        key: 'carlos@cesbank.com'
      }));
      throws(() => S.favorites.save(s, {
        alias: 'Outro',
        method: 'PIX',
        key: 'joao@cesbank.com'
      }));
      const tx = transfer(s),
        snapshot = JSON.stringify(tx.receipt);
      f.alias = 'Editado';
      f.removed = true;
      eq(JSON.stringify(tx.receipt), snapshot);
    });
    test('Favorito inválido impede reuso e remoção é lógica', ['F8 RN6', 'F8 RN7'], s => {
      const f = S.favorites.save(s, {
        alias: 'João',
        method: 'PIX',
        key: 'joao@cesbank.com'
      });
      f.invalid = true;
      throws(() => S.destination(s, {
        favorite: f.id
      }));
      f.removed = true;
      ok(s.favorites.includes(f));
    });
    test('Simulação de crédito obrigatória e com prazo', ['F9 RN1', 'F9 RN7'], s => {
      throws(() => S.loans.analysis(s, 'inexistente'));
      throws(() => S.loans.simulate(s, 9999, 12));
      throws(() => S.loans.simulate(s, 10000, 2.5));
      const q = S.loans.simulate(s, 100000, 12);
      s.proposals.push(q);
      q.expires = s.now;
      throws(() => S.loans.analysis(s, q.id), 'PropostaExpirada');
    });
    test('Price amortiza integralmente com parcela fixa e CET/IOF', ['F9 RN2', 'F9 RN3', 'F9 RN4'], s => {
      const q = S.loans.simulate(s, 100000, 12);
      eq(q.rows.reduce((v, r) => v + r.amort, 0), q.financed);
      eq(q.rows.at(-1).balance, 0);
      eq(new Set(q.rows.slice(0, -1).map(r => r.value)).size, 1);
      ok(q.tax > 0 && q.fee > 0 && q.cet.monthBp > q.rateBp && q.cet.yearBp > q.cet.monthBp * 12);
    });
    test('Análise recusa restrição e comprometimento de renda', ['F9 RN5', 'F9 RN6'], s => {
      const q = S.loans.simulate(s, 100000, 12);
      s.proposals.push(q);
      s.clients[0].restriction = true;
      const declined = S.loans.analysis(s, q.id);
      eq(declined.status, 'RECUSADO');
      ok(declined.reason);
      s.clients[0].restriction = false;
      const high = S.loans.simulate(s, 2000000, 2);
      s.proposals.push(high);
      eq(S.loans.analysis(s, high.id).code, 'ComprometimentoDeRendaExcedido');
    });
    test('Liberação só em conta própria e cronograma com carência', ['F9 RN8', 'F9 RN9', 'F9 RN12'], s => {
      const q = S.loans.simulate(s, 100000, 12);
      s.proposals.push(q);
      const c = S.loans.analysis(s, q.id);
      throws(() => S.loans.accept(s, c.id, 'a1'));
      const before = s.accounts[0].total;
      S.loans.accept(s, c.id, 'a0');
      eq(s.accounts[0].total, before + 100000);
      eq(c.rows.length, 12);
      ok(K.days(K.day(s.now), c.rows[0].due) >= 30);
      eq(c.status, 'ATIVO');
      throws(() => S.transition(s, c, 'contract', 'APROVADO'));
    });
    test('Débito automático, atraso e multa/mora', ['F9 RN10'], () => {
      let due;
      C.Db.transaction(s => {
        const c = C.Demos.loan(s);
        s.accounts[0].total = 0;
        due = c.rows[0].due;
      });
      K.advance(K.at(K.addDays(due, 2), 10));
      const s = C.Db.get(),
        c = s.contracts[0];
      eq(c.status, 'EM_ATRASO');
      ok(S.loans.late(s, c.rows[0]) > 0);
      ok(s.notifications.length);
    });
    test('Quitação antecipada desconta juros futuros', ['F9 RN11'], s => {
      const c = C.Demos.loan(s),
        q = S.loans.debt(s, c);
      ok(q.total < q.contractual);
      S.loans.settle(s, c.id, {
        mode: 'TOTAL'
      });
      eq(c.status, 'LIQUIDADO');
      ok(c.rows.every(r => r.status === 'PAGA'));
    });
    test('Liquidação parcial reduz parcelas ou prazo', ['F9 RN11'], s => {
      const c = C.Demos.loan(s),
        old = c.rows[0].value;
      S.loans.settle(s, c.id, {
        mode: 'PARCIAL',
        value: '200.00',
        strategy: 'PARCELA'
      });
      ok(c.rows[0].value < old);
      eq(c.restructurings.length, 1);
    });
    test('Elegibilidade e limite calculado pela movimentação', ['F10 RN1', 'F10 RN2'], s => {
      const result = S.cards.analyze(s);
      ok(result.incoming > 0 && result.outgoing > 0 && result.average > 0 && result.limit <= result.ceiling);
      s.accounts[0].opened = s.now;
      throws(() => S.cards.issue(s), 'CreditoRecusado');
    });
    test('Cartão único, inativo, ativação e política de senha', ['F10 RN3', 'F10 RN4', 'F10 RN5'], s => {
      const c = S.cards.issue(s);
      eq(c.status, 'INATIVO');
      throws(() => S.cards.issue(s));
      throws(() => S.cards.pin('1111', s.clients[0]));
      throws(() => S.cards.pin('1234', s.clients[0]));
      throws(() => S.cards.pin('0518', s.clients[0]));
      S.cards.pin('5962', s.clients[0]);
      throws(() => S.cards.authorize(s, {
        card: c.id,
        value: '100.00',
        installments: 1,
        channel: 'NAO_PRESENCIAL',
        description: 'Teste'
      }), 'CartaoBloqueadoOuCancelado');
    });
    test('Virtual e limites por canal subordinados ao total', ['F10 RN6', 'F10 RN7'], s => {
      const c = C.Demos.card(s);
      c.virtuals.push({
        id: 'v1',
        status: 'ATIVO'
      });
      throws(() => S.cards.authorize(s, {
        card: c.id,
        virtual: 'v1',
        value: '100.00',
        installments: 1,
        channel: 'PRESENCIAL',
        description: 'Teste'
      }));
      c.channels.NAO_PRESENCIAL = 5000;
      throws(() => S.cards.authorize(s, {
        card: c.id,
        value: '100.00',
        installments: 1,
        channel: 'NAO_PRESENCIAL',
        description: 'Teste'
      }), 'LimiteDeCreditoIndisponivel');
    });
    test('Aproximação acima do teto exige senha', ['F10 RN8'], s => {
      const c = C.Demos.card(s),
        d = {
          card: c.id,
          value: '250.00',
          installments: 1,
          channel: 'APROXIMACAO',
          description: 'Teste'
        };
      throws(() => S.cards.authorize(s, d));
      ok(S.cards.authorize(s, {
        ...d,
        pin: '5962'
      }));
    });
    test('Reserva imediata expira em 48h', ['F10 RN9'], () => {
      C.Db.transaction(s => {
        const c = C.Demos.card(s);
        S.cards.authorize(s, {
          card: c.id,
          value: '100.00',
          installments: 1,
          channel: 'NAO_PRESENCIAL',
          description: 'Teste'
        });
        eq(c.used, 10000);
      });
      K.advance('2025-02-05T13:00:00Z');
      const s = C.Db.get();
      eq(s.authorizations[0].status, 'EXPIRADA');
      eq(s.cards[0].used, 0);
    });
    test('Compra autorizada antes do cancelamento segue para fatura', ['F10 RN10', 'F11 RN2'], s => {
      const c = C.Demos.card(s),
        auth = S.cards.authorize(s, {
          card: c.id,
          value: '100.00',
          installments: 1,
          channel: 'NAO_PRESENCIAL',
          description: 'Teste'
        });
      S.transition(s, c, 'card', 'CANCELADO');
      S.cards.confirm(s, auth.id);
      eq(s.invoices[0].items[0].amount, 10000);
      throws(() => S.transition(s, c, 'card', 'ATIVO'));
    });
    test('Redução de limite respeita utilização e aumento exige análise', ['F10 RN11'], s => {
      const c = C.Demos.card(s);
      C.Demos.purchase(s, c);
      throws(() => S.cards.changeLimit(s, c.id, 1));
      throws(() => S.cards.changeLimit(s, c.id, 999999999), 'CreditoRecusado');
    });
    test('Renovação automática antes da validade', ['F10 RN12'], () => {
      C.Db.transaction(s => {
        const c = C.Demos.card(s);
        c.expiry = '2025-02-20';
      });
      K.advance('2025-02-03T14:00:00Z');
      eq(C.Db.get().cards[0].expiry, '2028-02-20');
    });
    test('Ciclos antes/depois do fechamento e parcelas futuras', ['F11 RN1', 'F11 RN2', 'F11 RN3'], s => {
      const c = C.Demos.card(s),
        auth = C.Demos.purchase(s, c);
      eq(s.invoices.length, 3);
      eq(s.invoices[0].cycle, '2025-02');
      eq(s.invoices[2].cycle, '2025-04');
      eq(c.used, auth.value);
      eq(S.invoices.cycle(s, c.id, '2025-02-26').cycle, '2025-03');
      eq(s.invoices.reduce((v, f) => v + S.invoices.total(f), 0), auth.value);
    });
    test('Fechamento publica fatura com antecedência', ['F11 RN11', 'F11 RN12'], () => {
      C.Db.transaction(s => C.Demos.purchase(s, C.Demos.card(s)));
      K.advance('2025-02-26T13:00:00Z');
      const s = C.Db.get(),
        f = s.invoices[0];
      eq(f.status, 'FECHADA');
      ok(f.published && K.days(f.close, f.due) >= 7);
      ok(s.notifications.length);
    });
    test('Mínimo, pagamento parcial e recomposição após liquidação', ['F11 RN4', 'F11 RN5', 'F11 RN8'], s => {
      const c = C.Demos.card(s);
      C.Demos.purchase(s, c);
      const f = s.invoices[0];
      S.transition(s, f, 'invoice', 'FECHADA');
      const min = S.invoices.minimum(f);
      eq(min, M.mul(S.invoices.total(f), 1500));
      throws(() => S.invoices.pay(s, f.id, min - 1), 'PagamentoInferiorAoMinimo');
      const used = c.used;
      S.invoices.pay(s, f.id, min);
      eq(c.used, used - min);
      eq(f.status, 'PAGA_PARCIALMENTE');
    });
    test('Falha de pagamento preserva fatura e limite', ['F11 RN8', 'F12 RN10'], s => {
      const c = C.Demos.card(s);
      C.Demos.purchase(s, c);
      const f = s.invoices[0];
      S.transition(s, f, 'invoice', 'FECHADA');
      s.demo.failAfterDebit = true;
      const used = c.used,
        tx = S.invoices.pay(s, f.id, S.invoices.total(f));
      eq(tx.status, 'DEVOLVIDA');
      eq(c.used, used);
      eq(f.paid, 0);
    });
    test('Rotativo e bloqueio após atraso', ['F11 RN6', 'F11 RN9'], () => {
      C.Db.transaction(s => C.Demos.purchase(s, C.Demos.card(s)));
      K.advance('2025-03-26T13:00:00Z');
      const s = C.Db.get(),
        f = s.invoices[0];
      ok(f.rolledAmount > 0 && f.rotationInterest > 0);
      eq(s.cards[0].status, 'BLOQUEADO');
      ok(s.cards[0].blockedByDebt);
    });
    test('Multa e mora na fatura seguinte', ['F11 RN7'], s => {
      const c = C.Demos.card(s);
      C.Demos.purchase(s, c);
      const f = s.invoices[0];
      S.transition(s, f, 'invoice', 'FECHADA');
      s.now = '2025-03-12T13:00:00Z';
      S.invoices.pay(s, f.id, S.invoices.total(f));
      ok(s.invoices[1].items.some(i => i.type === 'ENCARGOS_ATRASO' && i.amount > 0));
    });
    test('Antecipação de compra desconta encargos não incorridos', ['F11 RN10'], s => {
      const c = C.Demos.card(s);
      C.Demos.purchase(s, c);
      const item = s.invoices[1].items[0],
        before = c.used;
      S.invoices.anticipation(s, item.id);
      ok(item.discount > 0);
      eq(c.used, before - item.amount);
      ok(item.advanced);
    });
    test('Protocolo, vínculo, prazo e unicidade de contestação', ['F12 RN1', 'F12 RN2', 'F12 RN3', 'F12 RN4'], s => {
      const tx = transfer(s);
      throws(() => S.disputes.open(s, {
        transaction: 'inexistente',
        description: 'Teste'
      }));
      const q = S.disputes.open(s, {
        transaction: tx.id,
        description: 'Não reconheço'
      });
      ok(/^\d{4}-\d{10}$/.test(q.id));
      throws(() => S.disputes.open(s, {
        transaction: tx.id,
        description: 'Duplicada'
      }), 'ContestacaoJaEmAberto');
      const other = transfer(s);
      other.at = '2024-01-01T13:00:00Z';
      throws(() => S.disputes.open(s, {
        transaction: other.id,
        description: 'Expirada'
      }), 'PrazoDeContestacaoExpirado');
    });
    test('Bloqueio cautelar reduz disponível no destinatário', ['F12 RN5'], s => {
      const tx = transfer(s),
        before = S.accounts.balance(s, 'a1').available;
      const q = S.disputes.open(s, {
        transaction: tx.id,
        description: 'Fraude',
        fraud: true
      });
      eq(q.blocked, 10000);
      eq(S.accounts.balance(s, 'a1').available, before - 10000);
    });
    test('Prazo de dez dias úteis e única prorrogação justificada', ['F12 RN6'], s => {
      const tx = transfer(s),
        q = S.disputes.open(s, {
          transaction: tx.id,
          description: 'Teste'
        });
      eq(q.deadline, '2025-02-17');
      s.session.role = 'ANALISTA';
      throws(() => S.disputes.extend(s, q.id, ''));
      S.disputes.extend(s, q.id, 'Análise adicional');
      eq(q.deadline, '2025-03-03');
      throws(() => S.disputes.extend(s, q.id, 'Outra'));
    });
    test('Ciclo de contestação auditado e notificações', ['F12 RN7', 'F12 RN12'], s => {
      const q = S.disputes.open(s, {
        transaction: transfer(s).id,
        description: 'Teste'
      });
      s.session.role = 'ANALISTA';
      throws(() => S.disputes.state(s, q.id, 'PROCEDENTE', {
        reason: 'MD06',
        value: '100.00'
      }));
      S.disputes.state(s, q.id, 'EM_ANALISE');
      S.disputes.state(s, q.id, 'IMPROCEDENTE', {
        justification: 'Operação comprovada'
      });
      S.disputes.state(s, q.id, 'ENCERRADA');
      eq(q.status, 'ENCERRADA');
      ok(q.history.every(h => h.at && h.actor));
      ok(s.notifications.length >= 4);
    });
    test('Devolução parcial vinculada e liberação do bloqueio', ['F12 RN8'], s => {
      const tx = transfer(s),
        q = S.disputes.open(s, {
          transaction: tx.id,
          description: 'Fraude',
          fraud: true
        });
      s.session.role = 'ANALISTA';
      S.disputes.state(s, q.id, 'EM_ANALISE');
      S.disputes.state(s, q.id, 'PROCEDENTE', {
        reason: 'FR01',
        value: '50.00'
      });
      S.disputes.refund(s, q);
      eq(q.blocked, 0);
      const refund = s.transactions.find(t => t.id === q.returnTransaction);
      eq(refund.value, 5000);
      eq(refund.reason, 'FR01');
      eq(refund.original, tx.id);
    });
    test('Devolução executada em seis horas sem antecipar prazo', ['F12 RN9'], () => {
      C.Db.transaction(s => {
        const q = S.disputes.open(s, {
          transaction: transfer(s).id,
          description: 'Teste'
        });
        s.session.role = 'ANALISTA';
        S.disputes.state(s, q.id, 'EM_ANALISE');
        S.disputes.state(s, q.id, 'PROCEDENTE', {
          reason: 'MD06',
          value: '100.00'
        });
      });
      K.advance('2025-02-03T18:00:00Z');
      ok(!C.Db.get().disputes[0].returnTransaction);
      K.advance('2025-02-03T19:00:00Z');
      ok(C.Db.get().disputes[0].returnTransaction);
    });
    test('Cobrança de cartão suspensa sai do total e do mínimo', ['F12 RN11'], s => {
      const c = C.Demos.card(s);
      C.Demos.purchase(s, c);
      const f = s.invoices[0],
        item = f.items[0];
      S.disputes.open(s, {
        kind: 'CARTAO',
        invoice: f.id,
        item: item.id,
        description: 'Não reconheço'
      });
      eq(S.invoices.total(f), 0);
      eq(S.invoices.minimum(f), 0);
    });
    test('Aplicação mínima, disponibilidade e separação de saldo', ['F13a RN1'], s => {
      throws(() => apply(s, 'p1', '1.00'), 'ValorAbaixoDoMinimo');
      s.products[0].available = false;
      throws(() => apply(s), 'ProdutoIndisponivel');
      s.products[0].available = true;
      apply(s);
      eq(S.accounts.balance(s, 'a0').available, 2450000);
    });
    test('Condições da aplicação preservadas e renda apurada diariamente', ['F13a RN2', 'F13a RN3'], () => {
      C.Db.transaction(s => {
        apply(s, 'p2');
        s.products[1].cdiPercentBp = 5000;
      });
      K.advance('2025-02-07T13:00:00Z');
      const before = C.Db.get().applications[0];
      eq(before.cdiPercentBp, 11000);
      ok(before.balance > before.principal);
      K.advance('2025-02-09T13:00:00Z');
      eq(C.Db.get().applications[0].balance, before.balance);
    });
    test('Carência impede resgate antes da data contratada', ['F13a RN4'], s => {
      const p = apply(s, 'p2');
      throws(() => S.investments.preview(s, p, '100.00'), 'CarenciaNaoCumprida');
    });
    test('IR regressivo e IOF somente sobre rendimento', ['F13a RN5', 'F13a RN6', 'F13a RN11'], s => {
      const p = apply(s);
      p.balance += 10000;
      s.accounts[0].total += 10000;
      s.now = '2025-02-04T13:00:00Z';
      const q = S.investments.preview(s, p, '600.00');
      eq(q.iof, 9600);
      eq(q.ir, 90);
      eq(q.net, q.gross - q.iof - q.ir);
      s.now = '2027-03-01T13:00:00Z';
      const long = S.investments.preview(s, p, '600.00');
      eq(long.iof, 0);
      eq(long.irBp, 1500);
    });
    test('Resgate parcial preserva a data e saldo remanescente', ['F13a RN7'], s => {
      const p = apply(s),
        date = p.originalDate,
        q = S.investments.preview(s, p, '100.00');
      S.investments.redeem(s, p.id, q);
      eq(p.balance, 40000);
      eq(p.originalDate, date);
      eq(p.status, 'RESGATADA_PARCIALMENTE');
    });
    test('Ação usa cotação, corretagem e resultado sem garantia', ['F13a RN8', 'F13a RN9', 'F13a RN10'], s => {
      const p = apply(s, 'p4'),
        before = s.accounts[0].total;
      eq(p.quantity, 10);
      eq(p.balance, 25000);
      S.investments.quote(s, 'p4', 2000);
      eq(p.balance, 20000);
      eq(s.accounts[0].total, before - 5000);
      const q = S.investments.preview(s, p, undefined, 5);
      eq(q.gross, 10000);
      eq(q.net, 9510);
    });
    test('Caixinha exige nome/meta, limite e nome único', ['F13b RN1', 'F13b RN2'], s => {
      throws(() => S.boxes.create(s, {
        name: '',
        goal: '10.00'
      }));
      box(s);
      throws(() => box(s));
      for (let i = 0; i < 4; i++) S.boxes.create(s, {
        name: 'Meta ' + i,
        goal: '10.00'
      });
      throws(() => S.boxes.create(s, {
        name: 'Sexta',
        goal: '10.00'
      }));
    });
    test('Depósito/resgate da caixinha atômico e limitado ao saldo', ['F13b RN3', 'F13b RN4', 'F13b RN5', 'F13b RN7'], s => {
      const b = box(s),
        before = S.accounts.balance(s, 'a0').available;
      S.boxes.move(s, b.id, 10000, 'DEPOSITO');
      eq(S.accounts.balance(s, 'a0').available, before - 10000);
      throws(() => S.boxes.move(s, b.id, 10001, 'RESGATE'), 'SaldoInsuficienteParaResgate');
      S.boxes.move(s, b.id, 4000, 'RESGATE');
      eq(b.balance, 6000);
      eq(S.accounts.balance(s, 'a0').available, before - 6000);
    });
    test('Rendimento da caixinha só no aniversário', ['F13b RN6'], () => {
      C.Db.transaction(s => {
        const b = box(s);
        S.boxes.move(s, b.id, 100000, 'DEPOSITO');
      });
      K.advance('2025-03-02T13:00:00Z');
      eq(C.Db.get().boxes[0].balance, 100000);
      K.advance('2025-03-03T13:00:00Z');
      const b = C.Db.get().boxes[0];
      ok(b.balance > 100000);
      eq(b.entries.filter(r => r.type === 'RENDIMENTO').length, 1);
    });
    test('Meta atingida não impede movimentos; encerramento preserva extrato', ['F13b RN8', 'F13b RN9', 'F13b RN10'], s => {
      const b = box(s);
      S.boxes.move(s, b.id, 15000, 'DEPOSITO');
      eq(b.status, 'CONCLUIDA');
      S.boxes.move(s, b.id, 1000, 'DEPOSITO');
      S.boxes.close(s, b.id);
      eq(b.status, 'ENCERRADA');
      eq(b.balance, 0);
      eq(b.entries.at(-1).balance, 0);
      ok(b.entries.length === 3);
      throws(() => S.boxes.move(s, b.id, 1, 'DEPOSITO'));
    });
    test('Filtro de extrato por período válido e janela de 12 meses', ['F14 RN1', 'F14 RN2'], s => {
      throws(() => S.exports.filter(s, {
        start: '2025-01-01'
      }), 'PeriodoInvalido');
      throws(() => S.exports.filter(s, {
        start: '2025-02-03',
        end: '2025-01-01'
      }), 'PeriodoInvalido');
      throws(() => S.exports.filter(s, {
        start: '2023-01-01',
        end: '2025-02-03'
      }), 'PeriodoInvalido');
      ok(S.exports.filter(s, {}));
    });
    test('Exportação mantém filtros e registra protocolo/conteúdo', ['F14 RN3', 'F14 RN4', 'F14 RN5', 'F14 RN6'], s => {
      transfer(s);
      const f = S.exports.filter(s, {
        start: '2025-02-01',
        end: '2025-02-03',
        types: ['PIX'],
        nature: 'DEBITO'
      });
      eq(S.exports.rows(s, f).length, 1);
      const r = S.exports.generate(s, f, 'CSV');
      ok(r.content.includes('BRL') && r.content.includes('***444777**'));
      ok(!r.content.includes('11144477735'));
      ok(/^\d{4}-\d{10}$/.test(r.id));
      const pdf = S.exports.generate(s, f, 'PDF');
      ok(pdf.content.startsWith('%PDF-1.4') && pdf.content.includes('xref'));
    });
    test('Segunda via preserva transação e backup expira', ['F14 RN7', 'F14 RN8'], () => {
      let id;
      C.Db.transaction(s => {
        const tx = transfer(s),
          before = JSON.stringify(tx);
        const r = S.exports.generate(s, S.exports.filter(s, {}), 'CSV', tx.id);
        id = r.id;
        ok(r.content.includes('SEGUNDA VIA'));
        eq(JSON.stringify(tx), before);
      });
      K.advance('2025-03-06T13:00:00Z');
      eq(C.Db.get().exports.find(r => r.id === id).content, null);
    });
    test('Ocorrências simultâneas sobrevivem a rollback de outra tentativa', ['F4 RN5', 'F4 RN8'], () => {
      C.Db.transaction(s => {
        s.accounts[0].total = 15000;
        S.schedules.create(s, {
          date: '2025-02-04',
          payload: {
            method: 'PIX',
            key: 'joao@cesbank.com'
          },
          value: 20000
        });
        S.schedules.create(s, {
          date: '2025-02-04',
          payload: {
            method: 'PIX',
            key: 'joao@cesbank.com'
          },
          value: 10000
        });
      });
      K.advance('2025-02-04T13:00:00Z');
      const s = C.Db.get();
      eq(s.schedules[0].status, 'PENDENTE');
      eq(s.schedules[0].attempts.length, 1);
      eq(s.schedules[1].status, 'EXECUTADA');
      eq(s.accounts[0].total, 5000);
    });
    test('Regularização após rotativo não rebloqueia cartão no próximo tick', ['F11 RN6', 'F11 RN9'], () => {
      C.Db.transaction(s => C.Demos.purchase(s, C.Demos.card(s)));
      K.advance('2025-03-26T13:00:00Z');
      C.Db.transaction(s => {
        const f = s.invoices.find(f => f.cycle === '2025-03');
        S.invoices.pay(s, f.id, S.invoices.remaining(f));
        eq(s.cards[0].status, 'ATIVO');
      });
      K.advance('2025-03-26T14:00:00Z');
      eq(C.Db.get().cards[0].status, 'ATIVO');
    });
    test('Contestação após transporte retira cobrança e rotativo correspondente', ['F12 RN11', 'F11 RN6'], () => {
      let invoice, item;
      C.Db.transaction(s => {
        const c = C.Demos.card(s);
        C.Demos.purchase(s, c);
        invoice = s.invoices[0].id;
        item = s.invoices[0].items[0].id;
      });
      K.advance('2025-03-26T13:00:00Z');
      C.Db.transaction(s => {
        const next = s.invoices.find(f => f.cycle === '2025-03'),
          before = S.invoices.total(next);
        S.disputes.open(s, {
          kind: 'CARTAO',
          invoice,
          item,
          description: 'Não reconheço'
        });
        ok(S.invoices.total(next) < before);
        ok(next.items.find(i => i.type === 'ROTATIVO').amount === 0);
      });
    });
    test('Devolução de compra já paga volta ao saldo da conta', ['F12 RN8', 'F12 RN11'], s => {
      const c = C.Demos.card(s);
      C.Demos.purchase(s, c);
      const f = s.invoices[0],
        item = f.items[0];
      S.transition(s, f, 'invoice', 'FECHADA');
      S.invoices.pay(s, f.id, S.invoices.total(f));
      const before = s.accounts[0].total,
        q = S.disputes.open(s, {
          kind: 'CARTAO',
          invoice: f.id,
          item: item.id,
          description: 'Não reconheço'
        });
      s.session.role = 'ANALISTA';
      S.disputes.state(s, q.id, 'EM_ANALISE');
      S.disputes.state(s, q.id, 'PROCEDENTE', {
        reason: 'MD06',
        value: M.decimal(q.value)
      });
      S.disputes.refund(s, q);
      eq(s.accounts[0].total, before + q.value);
    });
    test('Rejeição de transferência auditada sem lançamento financeiro', ['F2 RN12'], s => {
      const before = s.ledger.length;
      const ex = throws(() => transfer({
        ...s,
        accounts: s.accounts.map(a => ({
          ...a,
          total: 0
        }))
      }), 'SaldoInsuficiente');
      const tx = S.recordRejection(s, {
        requestId: C.Ids.uuid(),
        value: 10000,
        method: 'PIX'
      }, ex);
      eq(tx.status, 'REJEITADA');
      eq(s.ledger.length, before);
    });
    return {
      total: results.length,
      passed: results.filter(r => r.pass).length,
      results
    };
  }
  C.Tests = {
    run
  };
})(Cesbank);
