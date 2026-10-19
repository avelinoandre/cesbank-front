/* Núcleo · inicialização local, painel, perfis e ferramentas de demonstração. */
(function (C) {
  'use strict';

  const U = C.UI,
    A = C.S.accounts,
    K = C.Clock;
  C.Router.register('inicio', 'Início', s => {
    const u = A.client(s, s.session.client),
      pending = s.schedules.filter(r => r.account === s.session.account && r.status === 'PENDENTE').length;
    return U.page('Olá, ' + (u.social || u.name).split(' ')[0] + '.', 'Sua conta e seus objetivos, em um só lugar.', U.balance(s) + `<div class="grid three">` + U.card('Movimente sua conta', '<p>Transfira, pague boletos e acompanhe os próximos pagamentos.</p><div class="actions">' + U.link('transferencia', 'Transferir') + U.link('boletos', 'Pagar boleto') + '</div>') + U.card('Guarde para seus planos', '<p>Caixinhas e investimentos ficam separados do saldo disponível.</p><div class="actions">' + U.link('caixinhas', 'Ver caixinhas') + U.link('investimentos', 'Investir') + '</div>') + U.card('Seu crédito', '<p>Simule um empréstimo ou acompanhe seus cartões e faturas.</p><div class="actions">' + U.link('emprestimo', 'Simular empréstimo') + U.link('faturas', 'Ver faturas') + '</div>') + '</div>' + U.card('Atividade recente', U.table(['Data', 'Descrição', 'Natureza', 'Valor'], s.ledger.filter(r => r.account === s.session.account).slice(-5).reverse().map(r => [U.e(K.label(r.at)), U.e(r.description), U.e(r.nature), U.money(r.value)])) + U.link('extrato', 'Ver extrato completo')) + `<div class="grid">` + U.card('Próximos pagamentos', `<p class="metric">${pending}</p><p>Ocorrências pendentes. Os valores serão verificados na data de execução.</p>` + U.link('agendamentos', 'Consultar agendamentos')) + U.card('Valide os fluxos do protótipo', '<p>Selecione cenários prontos e confira as regras dos seis integrantes.</p>' + U.link('cenarios', 'Como experimentar') + U.link('validacao', 'Roteiro de validação')) + '</div>', 'Protótipo · dados fictícios');
  }, 'Principal');
  C.Router.register('perfis', 'Selecionar perfil', s => U.page('Bem-vindo ao Cesbank', 'Escolha um perfil fictício para explorar o protótipo. Não há login nem transações reais.', `<div class="grid three">` + s.clients.filter(u => s.accounts.some(a => a.client === u.id && a.status === 'ATIVA')).map(u => U.card(u.social || u.name, `<p>${u.id === 'beneficiario' ? 'Beneficiário · recursos de boletos' : 'Cliente · conta de demonstração'}</p><p class="small">${U.e(C.V.mask(u.cpf))}</p>` + U.action('Selecionar perfil', () => {
    C.Session.select(u.id, u.id === 'beneficiario' ? 'BENEFICIARIO' : 'CLIENTE');
    C.Router.go(u.id === 'beneficiario' ? 'beneficiario' : 'inicio');
    U.render();
  }) + (u.cpf.length === 14 ? U.action('Usar conta empresarial', () => {
    C.Session.select(u.id, 'CLIENTE');
    C.Router.go('inicio');
    U.render();
  }, 'secondary') : ''))).join('') + U.card('Analista Cesbank', '<p>Atendimento, decisões de contestação e administração simulada.</p>' + U.action('Entrar como analista', () => {
    const a = C.Db.get().accounts.find(a => a.status === 'ATIVA' && a.client !== 'beneficiario');
    C.assert(a, 'Reinicie os dados para restaurar um perfil de analista.');
    C.Session.select(a.client, 'ANALISTA');
    C.Router.go('atendimento');
    U.render();
  }, 'secondary')) + U.card('Novo cliente', '<p>Abra uma conta fictícia pelo assistente em cinco etapas.</p>' + U.link('abrir-conta', 'Abrir conta')) + '</div>', 'Perfis de demonstração'), 'Principal');
  C.Router.register('notificacoes', 'Notificações', s => U.page('Central de notificações', 'Avisos e mensagens simulados, compartilhados por todos os módulos.', U.card('Minhas notificações', U.table(['Data', 'Canal', 'Mensagem', 'Leitura'], s.notifications.filter(n => n.client === s.session.client).slice().reverse().map(n => [U.e(K.label(n.at)), U.e(n.channel), U.e(n.text), n.read ? 'Lida' : U.action('Marcar como lida', () => {
    C.Db.transaction(x => {
      const row = x.notifications.find(v => v.id === n.id && v.client === x.session.client);
      C.assert(row, 'Notificação não encontrada.');
      row.read = true;
    });
    U.done('Notificação marcada como lida.');
  }, 'secondary')]))), 'F12 RN12 · avisos compartilhados'), 'Principal');
  const scenarioList = [['F2', 5, 'Saldo insuficiente'], ['F2', 7, 'Transferência em horário noturno'], ['F2', 9, 'Falha e estorno automático'], ['F3', 5, 'Boleto vencido fora do prazo'], ['F3', 14, 'Boleto com recurso e evidências'], ['F4', 5, 'Recorrência sem saldo'], ['F5', 10, 'Recusa de abertura de conta'], ['F7', 4, 'Aumento de limite em carência'], ['F9', 10, 'Parcela de empréstimo em atraso'], ['F10', 9, 'Reserva de compra e expiração'], ['F11', 5, 'Fatura fechada'], ['F11', 9, 'Bloqueio por inadimplência'], ['F12', 9, 'Devolução aguardando liquidação'], ['F12', 11, 'Cobrança de cartão suspensa'], ['F13a', 4, 'Investimento com carência'], ['F13b', 6, 'Aniversário da caixinha'], ['F13b', 10, 'Caixinha encerrada com extrato'], ['F14', 8, 'Backup de extrato e expiração']];
  C.Router.register('cenarios', 'Como experimentar', s => U.page('Como experimentar', 'Cada cenário restaura os dados fictícios e prepara o fluxo selecionado.', U.card('Primeiros passos', '<p>1. Escolha um perfil em Selecionar perfil. 2. Navegue pelos módulos. 3. Use o relógio para executar eventos futuros. 4. Consulte o Roteiro de validação para testar cada RN.</p><p>Senhas iniciais dos clientes: Cesbank9! · cartões preparados pelos cenários: 5962. Os códigos de confirmação aparecem na caixa de simulação.</p><p>Relógio inicial: 03/02/2025. Essa data permite respeitar literalmente o fator de boleto de quatro dígitos e base de 1997 dos documentos.</p>') + `<div class="grid three">` + scenarioList.map(([f, n, name]) => U.card(name, `<p class="small">${f} · RN${n}</p>` + U.action('Carregar cenário', () => C.Demos.prepare(f, n), 'secondary'))).join('') + '</div>' + U.card('Simulações adicionais', U.action('Portabilidade de chave · mesmo titular', () => {
    C.Demos.prepare('F1', 6);
    C.Db.transaction(x => {
      const a = A.own(x);
      x.accounts.push({
        ...C.Db.clone(a),
        id: 'a-portabilidade',
        number: '0009999999',
        total: 0,
        blocked: 0
      });
      const key = x.keys.find(k => k.value === 'maria@cesbank.com');
      key.account = 'a-portabilidade';
      x.demo.path = 'reivindicacoes';
      x.demo.fields = {
        value: key.value,
        type: 'PORTABILITY',
        proof: true
      };
      x.demo.instruction = 'Outra conta do mesmo titular preparada. Abra a portabilidade e depois use o perfil analista para concluir o vínculo.';
    });
    C.Router.go('reivindicacoes');
    U.render();
  }, 'secondary') + U.action('Preparar encerramento de conta', () => {
    C.Db.reset();
    C.Db.transaction(x => {
      const a = A.own(x);
      a.total = 0;
      x.demo.path = 'encerrar-conta';
      x.demo.instruction = 'Conta com saldo zero e sem empréstimos preparada. Encerre e confira as chaves inativadas.';
    });
    C.Router.go('encerrar-conta');
    U.render();
  }, 'secondary') + U.action('Exceder consultas de chave', () => {
    C.Db.reset();
    C.Db.transaction(x => {
      x.queryCounts[x.session.client + ':' + K.day(x.now)] = 10;
      x.demo.path = 'consulta-pix';
      x.demo.fields = {
        value: 'joao@cesbank.com'
      };
      x.demo.instruction = 'Limite de dez consultas consumido. A próxima deve recusar ConsultasExcedidas.';
    });
    C.Router.go('consulta-pix');
    U.render();
  }, 'secondary')), 'Cenários prontos'), 'Demonstração');
  C.Router.register('sair', 'Sair', () => {
    return U.page('Trocar perfil', 'Nenhuma autenticação real é utilizada neste protótipo.', U.link('perfis', 'Escolher outro perfil'));
  }, 'Principal');
  const order = ['inicio', 'perfis', 'notificacoes', 'sair', 'transferencia', 'operacoes', 'boletos', 'agendamentos', 'favoritos', 'extrato', 'contestacoes', 'caixinhas', 'investimentos', 'emprestimo', 'contratos', 'cartoes', 'faturas', 'abrir-conta', 'encerrar-conta', 'admin-contas', 'chaves', 'limites', 'dados', 'atendimento', 'cenarios', 'validacao'];
  C.routes = Object.fromEntries([...Object.entries(C.routes)].sort(([a], [b]) => (order.includes(a) ? order.indexOf(a) : 999) - (order.includes(b) ? order.indexOf(b) : 999)));
  const tools = C.UI.render;
  C.UI.render = function () {
    tools();
    const s = C.Db.get();
    if (s.demo.advanceTo) {
      const target = s.demo.advanceTo;
      const el = document.querySelector('#tools details');
      el.insertAdjacentHTML('beforeend', '<p class="small">Próximo evento do cenário: ' + U.e(K.label(target)) + '</p>');
      const b = document.createElement('button');
      b.className = 'secondary';
      b.textContent = 'Avançar ao próximo evento do cenário';
      b.onclick = () => {
        try {
          K.advance(target);
          C.UI.render();
          U.flash('Relógio avançado e eventos processados.');
        } catch (ex) {
          U.error(ex);
        }
      };
      el.appendChild(b);
    }
  };
  if (!location.hash) location.hash = 'perfis';
  C.UI.render();
})(Cesbank);
