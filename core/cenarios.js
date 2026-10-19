/* Núcleo · preparação reproduzível de cenários para todas as 156 RNs, sem espera real. */
(function (C) {
  'use strict';

  const A = C.S.accounts,
    K = C.Clock,
    M = C.M;
  const pages = {
    F1: 'chaves',
    F2: 'transferencia',
    F3: 'boletos',
    F4: 'agendamentos',
    F5: 'abrir-conta',
    F6: 'dados',
    F7: 'limites',
    F8: 'favoritos',
    F9: 'emprestimo',
    F10: 'cartoes',
    F11: 'faturas',
    F12: 'contestacoes',
    F13a: 'investimentos',
    F13b: 'caixinhas',
    F14: 'extrato'
  };
  const files = {
    F1: 'integrante6/chaves-pix.js',
    F2: 'integrante1/transferencia.js',
    F3: 'integrante3/boleto.js',
    F4: 'integrante5/agendamento.js',
    F5: 'integrante2/abertura-conta.js',
    F6: 'integrante6/dados-senha.js',
    F7: 'integrante6/limites.js',
    F8: 'integrante5/favoritos.js',
    F9: 'integrante2/emprestimo.js',
    F10: 'integrante3/cartao.js',
    F11: 'integrante4/fatura.js',
    F12: 'integrante4/contestacao.js',
    F13a: 'integrante1/investimentos.js',
    F13b: 'integrante1/caixinha.js',
    F14: 'integrante5/extrato-export.js'
  };
  function transfer(s, value = 10000, extra = {}) {
    return C.S.transfer.execute(s, {
      method: 'PIX',
      key: 'joao@cesbank.com',
      value,
      requestId: C.Ids.uuid(),
      ...extra
    });
  }
  function card(s) {
    const c = C.S.cards.issue(s);
    c.pin = C.Security.credential('5962');
    C.S.transition(s, c, 'card', 'ATIVO', 'Cenário preparado; senha fictícia 5962.');
    return c;
  }
  function purchase(s, c, value = '600.00', installments = 3, rateBp = 100) {
    const auth = C.S.cards.authorize(s, {
      card: c.id,
      value,
      installments,
      rateBp,
      channel: 'NAO_PRESENCIAL',
      description: 'Compra de demonstração'
    });
    C.S.cards.confirm(s, auth.id);
    return auth;
  }
  function loan(s) {
    const q = C.S.loans.simulate(s, 100000, 12);
    s.proposals.push(q);
    const c = C.S.loans.analysis(s, q.id);
    C.S.loans.accept(s, c.id, s.session.account);
    return c;
  }
  function registration(s, step = 1) {
    const r = C.S.opening.newDraft(s);
    r.step = step;
    r.data = {
      ...r.data,
      cpf: '39053344705',
      birth: '1992-03-15',
      name: 'Ana Lima',
      social: 'Ana',
      street: 'Rua Exemplo, 100',
      district: 'Centro',
      city: 'Recife',
      uf: 'PE',
      cep: '50000000',
      ibge: '2611606',
      email: 'ana@exemplo.com',
      phone: '+5581999980000',
      ddd: '81',
      phoneType: 'MOVEL',
      phonePrincipal: 'on',
      emailPrincipal: 'on',
      documentNumber: 'RG12345',
      documentCpf: '39053344705',
      identityFile: {
        name: 'identidade-ficticia.txt',
        size: 100
      },
      addressFile: {
        name: 'endereco-ficticio.txt',
        size: 100
      },
      expiry: '2030-01-01',
      documentVerified: 'on',
      occupation: 'EMPREGADO',
      income: '5000.00',
      periodicity: 'MENSAL',
      reference: K.day(s.now),
      terms: 'on',
      type: 'CONTA_DEPOSITO_A_VISTA',
      subtype: 'INDIVIDUAL'
    };
    return r;
  }
  function prepare(feature, n) {
    C.Db.reset();
    let route = pages[feature],
      fields = {},
      instruction = '';
    C.Db.transaction(s => {
      const a = A.own(s),
        u = A.client(s, s.session.client);
      s.demo.code = feature + ' RN' + n;
      if (feature === 'F1') {
        if (n === 1) {
          fields = {
            type: 'EVP'
          };
          instruction = 'Cadastre a chave aleatória. Depois teste outros tipos; e-mail é normalizado e os formatos seguem o Anexo A.1.';
        }
        if (n === 2) {
          const key = s.keys.find(k => k.account === a.id && k.type === 'EMAIL');
          key.status = 'INATIVA';
          const req = C.Ids.uuid();
          C.S.pix.add(s, {
            type: 'EMAIL',
            value: u.email,
            reason: 'USER_REQUESTED',
            requestId: req
          });
          fields = {
            type: 'EMAIL',
            value: u.email,
            requestId: req
          };
          instruction = 'Cadastre com o UUID preenchido. Deve devolver RequisicaoDuplicada e o cadastro original, sem criar outra chave.';
        }
        if (n === 3) {
          for (let i = 0; i < 3; i++) C.S.pix.add(s, {
            type: 'EVP',
            reason: 'USER_REQUESTED',
            requestId: C.Ids.uuid()
          });
          fields = {
            type: 'EVP'
          };
          instruction = 'A conta está no limite de 5 chaves. Cadastre outra: LimiteDeChavesExcedido. Uma chave já vinculada deve produzir ChaveJaExiste.';
        }
        if (n === 4) {
          fields = {
            type: 'PHONE',
            value: '+5511888880000'
          };
          instruction = 'O telefone tem formato válido, mas não pertence ao titular: ChaveDeOutroTitular.';
        }
        if (n === 5 || n === 9) {
          route = 'consulta-pix';
          fields = {
            value: n === 5 ? 'naoexiste@exemplo.com' : 'joao@cesbank.com'
          };
          instruction = n === 5 ? 'Consulte a chave inexistente para ChaveNaoEncontrada. O limite é de 10 consultas por dia.' : 'Consulte e abra os dados da resposta: nome/documento mascarados e estatísticas unificadas.';
        }
        if (n === 6) {
          route = 'reivindicacoes';
          u.phone = '+5581888877777';
          s.keys.push({
            id: C.Ids.uuid(),
            value: u.phone,
            type: 'PHONE',
            account: 'a1',
            status: 'ATIVA',
            history: []
          });
          fields = {
            value: u.phone,
            type: 'OWNERSHIP',
            proof: true
          };
          instruction = 'Abra a reivindicação com a prova fictícia de posse marcada. Para PORTABILITY, use outra conta do mesmo titular.';
        }
        if (n === 7) {
          instruction = 'Exclua uma chave escolhendo um dos motivos enumerados. A chave fica INATIVA e o histórico é preservado. Encerramento usa ACCOUNT_CLOSURE.';
        }
        if (n === 8 || n === 10) {
          const key = s.keys.find(k => k.value === 'joao@cesbank.com');
          s.claims.push({
            id: C.Ids.uuid(),
            key: key.id,
            account: a.id,
            type: 'OWNERSHIP',
            status: 'ABERTA',
            at: s.now,
            history: []
          });
          if (n === 8) {
            route = 'consulta-pix';
            fields = {
              value: key.value
            };
            instruction = 'Consulte a chave com reivindicação aberta: ChaveBloqueadaPorReivindicacao.';
          } else {
            s.session.role = 'ANALISTA';
            route = 'reivindicacoes';
            instruction = 'Avance cada etapa e confira a auditoria. Somente a conclusão transfere o vínculo e libera a chave.';
          }
        }
      }
      if (feature === 'F2') {
        fields = {
          method: 'PIX',
          key: 'joao@cesbank.com',
          value: '100.00'
        };
        const notes = {
          1: 'Revise por Pix; depois use agência 0001 e conta 0007654322. As duas formas levam à mesma confirmação.',
          2: 'Destino inativo: a revisão deve recusar ContaInexistenteOuInativa.',
          3: 'Origem e destino iguais: a revisão deve recusar a operação.',
          4: 'Revise e confira nome/documento mascarados, instituição e tipo. Só o botão de confirmação efetiva a transferência.',
          5: 'Saldo total zerado: deve apresentar SaldoInsuficiente e a composição do saldo.',
          6: 'Duas transferências já consumiram R$ 8.000,00 hoje. Uma nova de R$ 3.000,00 excede o diário.',
          7: 'Relógio às 21h. Transferir R$ 1.500,00 excede o noturno de R$ 1.000,00.',
          8: 'Valor acima do limite por transação: LimitePorTransacaoExcedido. Teste zero para a validação de valor mínimo.',
          9: 'Falha preparada após o débito. Ao confirmar, confira saldo restaurado, destino sem crédito e trilha BE08.',
          10: 'UUID já processado. A confirmação devolve a primeira operação, sem novo débito.',
          11: 'Confirme e confira os 32 caracteres do identificador no comprovante e na auditoria.',
          12: 'Confirme e consulte a evolução EM_PROCESSAMENTO → EFETIVADA. O cenário de falha cobre DEVOLVIDA.',
          13: 'Transfira R$ 0,10. Confira exatamente os centavos no saldo e no extrato.',
          14: 'Confirme e confira identificador, data, valor, forma do destino e documento mascarado no comprovante.'
        };
        instruction = notes[n];
        if (n === 2) {
          s.accounts[1].status = 'INATIVA';
          fields.method = 'DADOS_BANCARIOS';
        }
        if (n === 3) fields.key = u.email;
        if (n === 5) a.total = 0;
        if (n === 6) {
          transfer(s, 400000);
          transfer(s, 400000);
          fields.value = '3000.00';
        }
        if (n === 7) {
          s.now = '2025-02-04T00:00:00Z';
          fields.value = '1500.00';
        }
        if (n === 8) fields.value = '6000.00';
        if (n === 9) s.demo.failAfterDebit = true;
        if (n === 10) {
          const req = C.Ids.uuid();
          transfer(s, 10000, {
            requestId: req
          });
          fields.requestId = req;
        }
        if (n === 13) fields.value = '0.10';
      }
      if (feature === 'F3') {
        const notes = {
          1: 'Na entrada por código, altere um dígito e consulte: BoletoInvalido. Use o código inicial para o caminho válido.',
          2: 'Consulte o código válido: vencimento e valor são extraídos e exibidos sem edição.',
          3: 'Tente consultar/pagar o boleto liquidado: BoletoJaLiquidado.',
          4: 'Confira multa, juros e desconto no resumo. Avance o relógio e revise novamente para ver o recálculo.',
          5: 'Abra o boleto vencido fora do prazo: BoletoVencidoForaDoPrazo e orientação de segunda via.',
          6: 'Às 18h, revise o boleto; a liquidação informada será no próximo dia útil.',
          7: 'Saldo zerado. O pagamento imediato falha, mas o agendamento é aceito sem saldo.',
          8: 'Agende o boleto para uma data futura até o vencimento; confira que não houve débito nem consumo de limite.',
          9: 'Há um boleto agendado para amanhã e saldo zero. Avance 1 dia e depois horas para observar três tentativas e notificação.',
          10: 'Pague o boleto e confira o comprovante com autenticação, linha, nominal, encargos e liquidação.',
          11: 'Entre pela lista ou por código. Ambas as entradas usam a confirmação única.',
          12: 'Use Não reconheço e informe o motivo. Confira o estado REJEITADO e o aviso ao beneficiário.',
          13: 'Perfil beneficiário selecionado, boleto rejeitado. Anexe arquivos fictícios e justifique o recurso dentro de 5 dias.',
          14: 'Abra Ver evidências. Confira os anexos e escolha reconhecer/pagar ou manter a rejeição.'
        };
        instruction = notes[n];
        if ([1, 2, 11].includes(n)) route = 'boleto-codigo';
        if (n === 1) fields = {
          code: s.boletos[0].line.slice(0, -1) + (s.boletos[0].line.at(-1) === '0' ? '1' : '0')
        };
        if (n === 3) {
          C.S.boleto.execute(s, 'b0', C.Ids.uuid());
          route = 'boleto-confirmar?id=b0';
        }
        if (n === 5) route = 'boleto-confirmar?id=b2';
        if (n === 6) {
          s.now = '2025-02-03T21:00:00Z';
          route = 'boleto-confirmar?id=b0';
        }
        if (n === 7) {
          a.total = 0;
          route = 'boleto-confirmar?id=b0';
        }
        if (n === 4 || n === 8 || n === 10) route = 'boleto-confirmar?id=b0';
        if (n === 9) {
          C.S.schedules.create(s, {
            date: '2025-02-04',
            kind: 'BOLETO',
            payload: {
              id: 'b0'
            },
            value: 18590
          });
          a.total = 0;
          route = 'agendamentos';
        }
        if (n === 13 || n === 14) {
          const b = s.boletos[0];
          C.S.transition(s, b, 'boleto', 'REJEITADO', 'Cobrança não reconhecida.');
          b.rejectedAt = s.now;
          b.rejectionReason = 'Cobrança não reconhecida.';
          if (n === 13) {
            s.session = {
              client: 'beneficiario',
              account: 'a3',
              role: 'BENEFICIARIO'
            };
            route = 'beneficiario';
          } else {
            b.appeal = {
              at: s.now,
              justification: 'Pedido fictício 123 e comprovante de entrega.',
              files: [{
                name: 'evidencia.txt',
                size: 25,
                type: 'text/plain',
                data: 'data:text/plain;base64,RXZpZGVuY2lhIGZpY3RpY2lhLg=='
              }]
            };
            C.S.transition(s, b, 'boleto', 'REJEITADO_RECORRIDO');
          }
        }
      }
      if (feature === 'F4') {
        fields = {
          date: '2025-02-04',
          key: 'joao@cesbank.com',
          value: '100.00',
          recurring: 'SIM',
          frequency: 'MENSAL',
          count: '3'
        };
        const notes = {
          1: 'Agende para sábado 08/02/2025 e escolha próximo dia útil ou anterior; confira 10/02 ou 07/02.',
          2: 'Crie recorrência mensal com três ocorrências. Sem frequência ou término, o cadastro é recusado.',
          3: 'Saldo zero: registre o agendamento normalmente; não há reserva nem validação de saldo agora.',
          4: 'O agendamento foi criado sem consumo. Avance 1 dia: só a execução consumirá limite diário.',
          5: 'Recorrência sem saldo. Avance os horários: cada ocorrência falha após 3 tentativas, e as futuras continuam pendentes.',
          6: 'Edite a ocorrência pendente; após a execução, as ações de edição desaparecem.',
          7: 'Cancele uma ocorrência até a véspera ou encerre toda a recorrência. As executadas são preservadas.',
          8: 'Avance 1 dia e confira situação, tentativas e vínculo ao comprovante de cada ocorrência.'
        };
        instruction = notes[n];
        if (n === 1) fields.date = '2025-02-08';
        if (n === 3 || n === 5) a.total = 0;
        if (n >= 4) {
          C.S.schedules.create(s, {
            date: '2025-02-04',
            value: 10000,
            kind: 'TRANSFERENCIA',
            payload: {
              method: 'PIX',
              key: 'joao@cesbank.com'
            },
            recurring: 'SIM',
            frequency: 'MENSAL',
            count: '3'
          });
        }
      }
      if (feature === 'F5') {
        const step = n <= 4 ? 1 : n === 5 ? 2 : n === 6 ? 3 : n === 7 ? 4 : 5;
        const r = registration(s, step);
        route = 'abrir-conta?id=' + r.id;
        const notes = {
          1: 'CPF válido preenchido. Troque um dígito para testar o verificador; depois use o cadastro preparado.',
          2: 'CPF da Maria preenchido: deve recusar duplicidade.',
          3: 'Nascimento de menor de 18 anos preenchido: deve recusar.',
          4: 'Nome civil e social preenchidos; conclua o cadastro e confira o nome social nas telas e comprovantes.',
          5: 'Endereço fictício completo e correspondência CEP/IBGE preparados. Troque o código para testar incompatibilidade.',
          6: 'Contatos preenchidos como principais. Desmarque um principal para testar a obrigatoriedade.',
          7: 'Metadados documentais fictícios preparados. Validade vencida produz recusa; anexe arquivos fictícios para testar novos documentos.',
          8: 'Ocupação e renda com periodicidade preenchidas. A renda é mensalizada para determinar a qualificação.',
          9: 'Aceite marcado. A submissão registra versão 2026.02, data/hora e origem; sem aceite, recusa.',
          10: 'Restrição cadastral fictícia marcada: o cadastro será RECUSADO com motivo e exigirá nova solicitação.',
          11: 'Conclua o cadastro para criar automaticamente a conta com saldo zero, tipo e subtipo selecionados.',
          12: 'Conclua e consulte os limites iniciais correspondentes à qualificação da renda.'
        };
        instruction = notes[n];
        if (n === 2) fields = {
          cpf: u.cpf
        };
        if (n === 3) fields = {
          birth: '2010-01-01'
        };
        if (n === 7) fields = {
          expiry: '2020-01-01'
        };
        if (n === 10) fields = {
          blocked: true
        };
      }
      if (feature === 'F6') {
        fields = {
          current: 'Cesbank9!',
          password: 'Forte9!Z7',
          confirm: 'Forte9!Z7'
        };
        const notes = {
          1: 'Senha atual incorreta preenchida. Tente alterar: a troca é recusada.',
          2: 'Nova senha com sequência simples preenchida. A política deve recusar.',
          3: 'Nova senha igual à atual preenchida. O histórico deve impedir o reuso.',
          4: 'Altere a senha e confira apenas hash SHA-256 e sal na demonstração, sem texto claro no cadastro.',
          5: 'Solicite novo e-mail/telefone. O código aparece na simulação; só após confirmá-lo o contato muda.',
          6: 'CPF, nascimento e nome civil estão desabilitados. Use Solicitar correção para enviar nova documentação fictícia.',
          7: 'Altere senha ou confirme novo contato e confira canal, data/hora e valor anterior mascarado na auditoria.'
        };
        instruction = notes[n];
        if (n === 1) fields.current = 'Incorreta9!';
        if (n === 2) fields.password = fields.confirm = 'Abc12345';
        if (n === 3) fields.password = fields.confirm = 'Cesbank9!';
      }
      if (feature === 'F7') {
        const notes = {
          1: 'Quatro limites independentes estão disponíveis. Cada alteração exige confirmação adicional.',
          2: 'Diário acima do teto da faixa preenchido. A revisão deve recusar.',
          3: 'Diário reduzido preenchido. Confirme pelo código: a redução vale imediatamente.',
          4: 'Diário aumentado preenchido. Confirme e avance 24h para observar a vigência.',
          5: 'Noturno acima do limite por transação preenchido. A alteração deve ser recusada.',
          6: 'Peça alteração e use código incorreto ou avance mais de 5 minutos antes de confirmar para testar expiração.',
          7: 'Efetive uma redução ou aumento e confira os valores e datas registrados no histórico.'
        };
        instruction = notes[n];
        fields = n === 2 ? {
          daily: '50001.00'
        } : n === 3 ? {
          daily: '9000.00'
        } : n === 5 ? {
          night: '6000.00'
        } : {
          daily: '11000.00'
        };
      }
      if (feature === 'F8') {
        const d = {
          alias: 'João',
          method: 'PIX',
          key: 'joao@cesbank.com'
        };
        if (n !== 1 && n !== 3) C.S.favorites.save(s, d);
        const notes = {
          1: 'Apelido e destino preenchidos. Limpe o apelido para testar dados mínimos.',
          2: 'Apelido João já cadastrado. Tente cadastrar outro com o mesmo apelido.',
          3: 'Chave inexistente preenchida. O cadastro deve falhar ao resolver o vínculo.',
          4: 'Mesmo destino de João com outro apelido: o cadastro deve recusar duplicidade.',
          5: 'Transferência ao favorito já realizada. Edite/remova o favorito e confira que o comprovante preserva o destino original.',
          6: 'Favorito preparado com destino que foi inativado. Ao tentar transferir, ele fica inválido e exige revalidação.',
          7: 'Remova o favorito. Ele sai da lista, mas permanece na auditoria como remoção lógica.'
        };
        instruction = notes[n];
        fields = {
          alias: n === 4 ? 'Outro João' : 'João',
          key: n === 3 ? 'inexistente@cesbank.com' : 'joao@cesbank.com'
        };
        if (n === 5) transfer(s);
        if (n === 6) {
          s.accounts[1].status = 'INATIVA';
          route = 'transferencia?favorito=' + s.favorites[0].id;
        }
      }
      if (feature === 'F9') {
        const notes = {
          1: 'Faça uma simulação e confira sua validade de 30 minutos. Após expirar, a análise deve recusar PropostaExpirada.',
          2: 'Simule e contrate; confira parcela fixa, juros e amortização em cada linha, com ajuste final de centavos.',
          3: 'Confira o CET mensal e anual, calculado sobre o valor liberado e incorporando IOF, tarifa e juros.',
          4: 'A simulação discrimina IOF fixo e diário limitado a 365 dias e os inclui no CET.',
          5: 'Valor acima da capacidade preparado para aprovação reduzida. Restrições ou atrasos resultam em recusa com motivo.',
          6: 'Proposta de parcela alta preparada. A soma das parcelas ativas não pode passar de 30% da renda.',
          7: 'Valor abaixo do mínimo e prazo fracionário preenchidos. A simulação deve recusar.',
          8: 'Oferta aprovada preparada. O aceite só permite conta ativa do próprio titular na mesma instituição.',
          9: 'Contrato ativo com cronograma preparado. Confira primeira parcela após 30 dias e as composições.',
          10: 'Contrato ativo sem saldo. Avance até o vencimento: débito falha e contrato fica EM_ATRASO; confira multa e mora.',
          11: 'Contrato ativo preparado. Compare quitação total, parcial com redução de parcela/prazo e antecipação individual.',
          12: 'Consulte o histórico do contrato; avance o relógio ou liquide para testar as transições permitidas.'
        };
        instruction = notes[n];
        fields = {
          value: n === 5 ? '50000.00' : n === 6 ? '20000.00' : n === 7 ? '99.00' : '3000.00',
          months: n === 7 ? '2.5' : n === 6 ? '2' : '12'
        };
        if (n === 5) {
          u.income = 500000;
          u.qualification = 'MEDIA';
          s.ledger = s.ledger.filter(r => r.account !== 'a0' || r.nature !== 'CREDITO');
          fields.months = '60';
        }
        if (n === 1) {
          const q = C.S.loans.simulate(s, 100000, 12);
          q.expires = s.now;
          s.proposals.push(q);
          instruction = 'Simulação preparada e expirada. Consulte-a na lista e solicite análise: PropostaExpirada.';
        }
        if (n === 8) {
          const q = C.S.loans.simulate(s, 100000, 12);
          s.proposals.push(q);
          C.S.loans.analysis(s, q.id);
          route = 'contratos';
        }
        if (n >= 9) {
          const c = loan(s);
          route = 'contratos';
          if (n === 10) {
            a.total = 0;
            s.demo.advanceTo = K.at(c.rows[0].due, 10);
            instruction += ' Use o botão Avançar ao próximo evento do cenário nas ferramentas.';
          }
        }
      }
      if (feature === 'F10' || feature === 'F11') {
        let c;
        if (feature === 'F11' || n >= 3) c = card(s);
        if (feature === 'F10') {
          const notes = {
            1: 'Perfil com histórico de movimentação preparado. Analise e emita; uma conta nova sem 30 dias deve ser recusada.',
            2: 'Analise e emita. Consulte o critério e o teto da faixa usado na aprovação.',
            3: 'Já existe cartão físico ativo. Nova emissão deve ser recusada até cancelar o anterior.',
            4: 'Cartão emitido inativo. Defina a senha 5962 para ativar.',
            5: 'Na ativação, tente 1111, 1234 ou data de nascimento: deve recusar. Use 5962 para o caminho válido.',
            6: 'Gere um virtual e use apenas NAO_PRESENCIAL. Descarte-o e confira que o físico continua ativo.',
            7: 'Altere limites por canal; acima do limite total deve ser recusado.',
            8: 'Compra por aproximação de R$ 250,00 preparada. Exige senha 5962; sem senha deve ser recusada.',
            9: 'Autorize a compra: o limite é reservado antes da fatura. Sem confirmação, avance 48h para liberar a reserva.',
            10: 'Autorize, bloqueie/cancele e depois confirme a autorização: a compra anterior ainda entra na fatura.',
            11: 'Prepare uma compra para consumir limite. Redução abaixo do utilizado deve ser recusada; aumento exige nova análise.',
            12: 'Validade próxima preparada. Avance 1 hora: haverá renovação automática apenas se não houver bloqueio ou atraso.'
          };
          instruction = notes[n];
          if (n === 4 || n === 5) {
            c.status = 'INATIVO';
            fields = {
              pin: n === 5 ? '1234' : '5962'
            };
          }
          if (n === 8) fields = {
            channel: 'APROXIMACAO',
            value: '250.00',
            pin: ''
          };
          if (n === 10 || n === 11) C.S.cards.authorize(s, {
            card: c.id,
            value: '600.00',
            installments: 3,
            channel: 'NAO_PRESENCIAL',
            description: 'Compra autorizada pendente'
          });
          if (n === 12) c.expiry = '2025-02-20';
        } else {
          const auth = purchase(s, c);
          const f = s.invoices.find(f => f.card === c.id && f.cycle === '2025-02');
          if (n === 2) {
            f.items.push({
              id: C.Ids.uuid(),
              amount: 500,
              principal: 0,
              interest: 500,
              type: 'TARIFA',
              description: 'Tarifa avulsa fictícia do ciclo',
              at: s.now
            });
            f.items.push({
              id: C.Ids.uuid(),
              amount: -200,
              principal: -200,
              interest: 0,
              type: 'ESTORNO',
              description: 'Crédito de estorno de demonstração',
              at: s.now
            });
            c.used += 300;
          }
          const notes = {
            1: 'Compra com parcelas preparada. Confira os ciclos; uma compra após o dia 25 será lançada no seguinte.',
            2: 'A fatura contém compra parcelada com principal e encargos; feche o ciclo para conferir a soma.',
            3: 'Compra em três parcelas preparada. Todas comprometem o limite, e cada mês recebe uma parcela.',
            4: 'Fatura fechada preparada. Confira mínimo de 15% excluindo eventuais cobranças suspensas.',
            5: 'Fatura fechada. Teste total, mínimo, parcial e valor abaixo do mínimo.',
            6: 'Fatura com pagamento mínimo preparada. Avance ao próximo fechamento para conferir transporte e rotativo proporcional.',
            7: 'Fatura vencida preparada. Pague e confira multa e mora na fatura seguinte.',
            8: 'Fatura fechada. Pague e confira recomposição do limite apenas após liquidação; o cenário de falha deixa tudo preservado.',
            9: 'Fatura em atraso há mais de 5 dias preparada. Avance 1 hora para bloquear o cartão; quite o débito para regularizar.',
            10: 'Parcelas futuras com encargos preparadas. Antecipe e confira o desconto e a liberação do limite.',
            11: 'Fatura fechada preparada. Pague mínimo/total e consulte as transições auditadas.',
            12: 'Fatura fechada preparada. Confira publicação e antecedência mínima em relação ao vencimento.'
          };
          instruction = notes[n];
          if ([4, 5, 6, 8, 11, 12].includes(n)) {
            s.now = '2025-02-26T13:00:00Z';
            C.S.transition(s, f, 'invoice', 'FECHADA', 'Cenário de fatura fechada.');
            f.published = s.now;
          }
          if (n === 6) {
            C.S.invoices.pay(s, f.id, C.S.invoices.minimum(f));
            s.demo.advanceTo = '2025-03-26T13:00:00Z';
          }
          if (n === 7 || n === 9) {
            s.now = n === 9 ? '2025-03-17T13:00:00Z' : '2025-03-12T13:00:00Z';
            C.S.transition(s, f, 'invoice', 'FECHADA');
            C.S.transition(s, f, 'invoice', 'EM_ATRASO');
          }
        }
      }
      if (feature === 'F12') {
        const tx = transfer(s);
        if (n === 3) {
          tx.at = '2024-10-01T13:00:00Z';
        }
        const notes = {
          1: 'Transação de teste preparada. Abra a contestação e confira o protocolo no formato ano-sequencial.',
          2: 'A lista contém apenas transações efetivadas da conta selecionada. O serviço recusa referências de outro titular.',
          3: 'Transação com mais de 80 dias preparada. A abertura deve recusar PrazoDeContestacaoExpirado.',
          4: 'Ocorrência já aberta para a transação. Nova abertura deve recusar ContestacaoJaEmAberto.',
          5: 'Ocorrência com fraude preparada. Selecione João nos perfis e confira o valor bloqueado na composição do saldo.',
          6: 'Ocorrência em análise. Selecione analista, registre uma prorrogação justificada e confira 10 dias úteis adicionais.',
          7: 'No atendimento, avance ABERTA → EM_ANALISE → decisão → ENCERRADA e confira data/responsável.',
          8: 'No atendimento, decida procedente com valor total ou parcial e motivo MD06, BE08 ou FR01.',
          9: 'Devolução procedente já solicitada. Avance 6 horas para efetivar; BE08 tem prazo de até 48 horas.',
          10: 'Falha após débito preparada. Confirme a transferência e confira o estorno BE08 sem abrir contestação.',
          11: 'Lançamento de cartão contestado. Confira que o valor saiu do total, mínimo e rotativo até a decisão.',
          12: 'Ocorrência preparada. Consulte a central de notificações e o histórico em cada mudança.'
        };
        instruction = notes[n];
        fields = {
          transaction: tx.id,
          description: 'Não reconheço a operação fictícia.'
        };
        if ([4, 5, 6, 7, 8, 9, 12].includes(n)) {
          const q = C.S.disputes.open(s, {
            transaction: tx.id,
            kind: 'CONTA',
            description: 'Contestação fictícia para validação.',
            fraud: n === 5
          });
          if ([6, 8, 9].includes(n)) {
            s.session.role = 'ANALISTA';
            C.S.disputes.state(s, q.id, 'EM_ANALISE');
          }
          if (n === 9) C.S.disputes.state(s, q.id, 'PROCEDENTE', {
            reason: 'MD06',
            value: '100.00'
          });
          if ([6, 7, 8, 9].includes(n)) {
            s.session.role = 'ANALISTA';
            route = 'atendimento';
          }
        }
        if (n === 10) {
          route = 'transferencia';
          s.demo.failAfterDebit = true;
        }
        if (n === 11) {
          const c = card(s);
          purchase(s, c);
          const f = s.invoices[0];
          C.S.disputes.open(s, {
            kind: 'CARTAO',
            invoice: f.id,
            item: f.items[0].id,
            description: 'Compra fictícia não reconhecida.'
          });
          route = 'faturas';
        }
        if (n === 12) route = 'notificacoes';
      }
      if (feature === 'F13a') {
        const notes = {
          1: 'Valor inferior ao mínimo preenchido. Deve recusar ValorAbaixoDoMinimo. Produto indisponível produz ProdutoIndisponivel.',
          2: 'Há produtos prefixado, percentual CDI e híbrido IPCA. Aplique e confira as condições preservadas na aplicação.',
          3: 'Aplicação CDI preparada. Avance dias e confira rendimento somente em dias úteis.',
          4: 'Aplicação com carência de 30 dias preparada. Simular resgate antes do prazo deve recusar CarenciaNaoCumprida.',
          5: 'Aplicação com rendimento preparada. Simule resgate e confira IR conforme o prazo original.',
          6: 'Aplicação com rendimento e menos de 30 dias preparada. Simule o resgate para conferir IOF regressivo.',
          7: 'Simule e confirme resgate parcial. Saldo remanescente e data original devem ser preservados.',
          8: 'Compra de 10 ações preparada. A cotação vigente e a corretagem entram no custo; venda desconta corretagem.',
          9: 'Ações preparadas com cotação reduzida. Confira perda sem garantia de rentabilidade.',
          10: 'Há renda fixa e ações. Confira a posição e sua atualização após cada movimento.',
          11: 'Simule o resgate. Bruto, IOF, IR, corretagem e líquido aparecem antes da confirmação.'
        };
        instruction = notes[n];
        fields = {
          product: 'p1',
          value: n === 1 ? '1.00' : '500.00'
        };
        if (n >= 3) {
          const app = C.S.investments.apply(s, {
            product: n === 3 || n === 4 ? 'p2' : n === 8 || n === 9 ? 'p4' : 'p1',
            value: '500.00',
            quantity: '10'
          });
          if (n === 5 || n === 6 || n === 7 || n === 11) {
            app.balance += 2000;
            a.total += 2000;
          }
          if (n === 5) {
            app.originalDate = '2024-07-01';
            app.lastAccrual = K.day(s.now);
          }
          if (n === 9) C.S.investments.quote(s, 'p4', 2000);
          if (n === 10) C.S.investments.apply(s, {
            product: 'p4',
            quantity: '10'
          });
        }
      }
      if (feature === 'F13b') {
        const notes = {
          1: 'Crie a caixinha com nome e meta positiva. Nome repetido ou meta zero deve ser recusado.',
          2: 'Cinco caixinhas ativas preparadas. A sexta deve ser recusada.',
          3: 'Caixinha preparada. Deposite e confira alocação atômica e saldo disponível; valor acima do disponível deve ser recusado.',
          4: 'Caixinha com R$ 100,00 preparada. Confira a composição do saldo e tente usar o valor reservado em transferência.',
          5: 'Resgate total ou parcial. O crédito volta somente à mesma conta de origem.',
          6: 'Caixinha com saldo preparada. Avance ao aniversário: rendimento integral em um lançamento; fora dele, nenhum crédito.',
          7: 'Deposite e resgate antes do aniversário; avance e confira o rendimento do período apesar das movimentações.',
          8: 'Caixinha acima da meta preparada. A sinalização CONCLUIDA continua permitindo novos depósitos e resgates.',
          9: 'Encerre a caixinha. Todo o saldo é resgatado e o histórico fica disponível.',
          10: 'Caixinha encerrada com movimentos preparada. Use os filtros de período e tipo; confira ordem e saldos após os movimentos.'
        };
        instruction = notes[n];
        const b = C.S.boxes.create(s, {
          name: 'Viagem',
          goal: '1000.00'
        });
        if (n === 1) fields = {
          name: 'Viagem',
          goal: '0.00'
        };
        if (n === 2) {
          for (let i = 0; i < 4; i++) C.S.boxes.create(s, {
            name: 'Meta ' + i,
            goal: '100.00'
          });
          fields = {
            name: 'Sexta caixinha',
            goal: '100.00'
          };
        }
        if (n >= 3) {
          C.S.boxes.move(s, b.id, n === 8 ? 110000 : 10000, 'DEPOSITO');
          route = 'caixinha?id=' + b.id;
        }
        if (n === 6 || n === 7) s.demo.advanceTo = K.at(b.nextBirthday, 10);
        if (n === 10) {
          C.S.boxes.move(s, b.id, 2500, 'RESGATE');
          C.S.boxes.close(s, b.id);
        }
      }
      if (feature === 'F14') {
        transfer(s);
        const notes = {
          1: 'Filtre com ambas as datas. Data inicial posterior à final ou apenas uma data produz PeriodoInvalido.',
          2: 'Teste período com mais de 12 meses ou início anterior a 12 meses atrás: PeriodoInvalido.',
          3: 'Selecione tipos com Ctrl e uma natureza. Visualização e arquivos devem conter os mesmos lançamentos.',
          4: 'Exporte CSV/PDF ou peça segunda via. Confira protocolo, horário, filtros e formato no histórico.',
          5: 'Gere PDF e CSV. Confira período, identificação da conta, total e dados dos lançamentos.',
          6: 'Exporte o Pix preparado e confira documento mascarado e conta da contraparte truncada.',
          7: 'Peça segunda via. Compare identificador e dados originais: apenas o novo arquivo e a solicitação são adicionados.',
          8: 'Arquivo de backup preparado. Baixe novamente; após 30 dias ele expira e exige nova solicitação.'
        };
        instruction = notes[n];
        if (n === 8) {
          C.S.exports.generate(s, C.S.exports.filter(s, {}), 'CSV');
          s.demo.advanceTo = K.at(K.addDays(K.day(s.now), 31), 10);
        }
      }
      s.demo.path = route.split('?')[0];
      s.demo.fields = fields;
      s.demo.instruction = instruction;
    });
    C.Router.go(route);
    C.UI.render();
    return C.Db.get().demo;
  }
  C.Demos = {
    pages,
    files,
    prepare,
    transfer,
    card,
    purchase,
    loan,
    registration
  };
})(Cesbank);
