# CESBANK protótipo navegável

Uma aplicação local em HTML, CSS e JavaScript puro, com os módulos dos seis integrantes integrados por serviços compartilhados. Todos os dados são fictícios. Não há backend, build, dependências externas ou envio real de mensagens.

## Abrir

1. Extraia o ZIP inteiro mantendo a pasta cesbank.
2. Abra cesbank/index.html no navegador com duplo clique. Não abra o arquivo dentro do visualizador de ZIP.
3. Escolha um perfil de demonstração. Maria, João e Carlos são clientes; Loja Exemplo oferece beneficiário e conta empresarial; Analista Cesbank oferece atendimento/administração.
4. Use Como experimentar para cenários prontos ou Roteiro de validação para uma RN específica.
5. Para reiniciar, abra Ferramentas de demonstração e use Reiniciar dados do protótipo. O pedido de confirmação descreve a restauração dos dados fictícios.

O navegador precisa de JavaScript, BigInt, TextEncoder e crypto.getRandomValues. Scripts são clássicos com namespace global Cesbank; não há ES modules nem fetch de arquivos. O estado fica no localStorage do navegador/origem. Se o navegador bloquear o armazenamento de arquivo local ou a quota esgotar, a tela avisa que a sessão está em memória. A prévia por HTTP e a abertura local podem manter bases separadas.

A navegação visual foi verificada por HTTP local. O navegador de teste não permite protocolo file:, então o duplo clique não foi executado automaticamente; a estrutura local foi verificada estaticamente. Não é necessário iniciar o servidor usado na verificação para abrir a entrega.

## Ordem de construção e organização

1. core/js/money.js, ids.js, errors.js, clock.js, security.js e validators.js: valores, formatos, datas e confirmações simuladas.
2. core/js/seed.js, db.js, services.js e session.js: estado inicial, atomicidade, contas, transações e papéis.
3. core/js/router.js, ui.js e core/css/base.css: aplicação hash, componentes e aparência.
4. integrante6/: chaves, limites, dados/senha; integrante1/: transferências, serviços de investimentos, telas dos dois CRUDs e caixinhas.
5. integrante2/: abertura, empréstimo, encerramento, administração; integrante5/: recorrências, favoritos, exportação.
6. integrante3/: boletos e cartão; integrante4/: fatura e contestação, integrados aos serviços anteriores.
7. core/requisitos.js, cenarios.js, testes.js, validacao.js e core/js/app.js: catálogo, preparação de dados, testes isolados e inicialização.
8. README.md, ASSUNCOES.md e RELATORIO-VALIDACAO.md: instruções, decisões e evidências.

Cada módulo possui seu JavaScript e CSS. Os scripts no index.html já estão na ordem de carga correta. Chamadas entre funcionalidades usam Cesbank.S; dinheiro, relógio, validações, estado e componentes ficam no núcleo. localStorage só é acessado por Db.

## Dados para experimentar

- Senha inicial dos clientes: Cesbank9!.
- Senha dos cartões preparados por cenário: 5962.
- Chave de João: joao@cesbank.com; agência 0001, conta 0007654322, instituição 12345678.
- Maria: conta 0007654321; Carlos: 0007654323; Loja Exemplo: 0007654324.
- Relógio inicial: 03/02/2025 às 10h de Brasília, escolhido para seguir literalmente a base de fator de boleto dos documentos. O motivo está em ASSUNCOES.md.
- Os códigos de e-mail/SMS aparecem na própria confirmação. São de uso único e expiram em cinco minutos no relógio simulado.
- O botão Preparar cenário restaura a base fictícia antes de montar o caso. Nenhum cenário depende de criar manualmente compras, contratos ou saldos prévios. Quando há prazo, use +1 hora/dia, +30 dias ou Avançar ao próximo evento do cenário.

## Validação das regras

Para CADA linha da matriz abaixo:

1. Abra Roteiro de validação no menu.
2. Filtre pela funcionalidade e localize o código RN da linha.
3. Clique Preparar cenário · restaura dados. A página recebe os dados e valores necessários.
4. Siga a orientação da linha; confira a mensagem/código, o saldo, a situação, o comprovante ou o histórico indicado.
5. Volte ao roteiro e prepare a próxima regra. Preparar outra regra elimina os movimentos do caso anterior, evitando dependência entre testes.

O botão Executar verificações automáticas roda em estado isolado, sem gravar ou alterar os dados da avaliação. A bateria contém 89 verificações de cálculo, validação e integração. Os fluxos de interface e anexos permanecem explícitos no roteiro, mesmo quando há teste de serviço associado.

## Roteiros de telas dos documentos

### Investimentos: uma entrada para cliente e analista

| Perfil | Tela | O que aparece |
| --- | --- | --- |
| Cliente | #investimentos | Caixinhas, outros produtos disponíveis, nova aplicação e posições contratadas. Caixinhas abrem em #caixinhas e seguem regras próprias. |
| Analista | #investimentos → Adicionar produto ou Gerenciar produtos → #gerenciar-investimentos | O botão Adicionar produto abre o cadastro diretamente. A página de gestão reúne categorias (CDB, fundo, ação), produtos oferecidos com suas condições, cotações e indexadores. Caixinhas ficam fora desses cadastros. |

Os dois cadastros administrativos são categoria e produto oferecido, reunidos na mesma tela para simplificar o uso. O cliente acompanha suas posições em #aplicacao?id=... e pode simular resgate total ou parcial antes de confirmar. As condições contratadas são preservadas se um produto do catálogo for editado. Renda fixa recebe apuração diária conforme a regra do produto; ações acompanham a cotação atualizada pelo analista.

### Caixinhas: vinte telas e estados

| Tela do documento | Implementação / como reproduzir |
| --- | --- |
| 1 Início / acesso | #inicio → Ver investimentos → Ver ou criar caixinhas. |
| 2 Primeiro acesso vazio | Reiniciar dados, #caixinhas. |
| 3 Lista e nova | #caixinhas, criar uma caixinha e voltar à lista. |
| 4 Nome repetido/meta inválida | Preparar F13b RN1, submeter os dados preparados. |
| 5 Limite atingido | Preparar F13b RN2, tentar criar a sexta. |
| 6 Criação com sucesso | Nome único e meta positiva; banner e detalhe. |
| 7 Resumo/aniversário/saldo | Preparar F13b RN4. |
| 8 Depósito | Preparar F13b RN3 e abrir Depositar. |
| 9 Saldo insuficiente | No depósito, informar mais que o saldo disponível. |
| 10 Depósito com sucesso | Depositar R$ 10,00 e conferir extrato e composição. |
| 11 Resgate | Preparar F13b RN5 e abrir Resgatar. |
| 12 Resgate acima do saldo | Informar valor maior que o saldo da caixinha. |
| 13 Resgate com sucesso | Resgatar parcialmente e conferir os dois saldos. |
| 14 Meta concluída | Preparar F13b RN8. |
| 15 Rendimento de aniversário | Preparar F13b RN6 e avançar ao evento. |
| 16 Extrato | Detalhe da caixinha, movimentos em ordem e saldo após cada um. |
| 17 Extrato vazio filtrado | Filtrar por período/tipo sem movimento. |
| 18 Confirmação de encerramento | Preparar F13b RN9 e clicar Encerrar caixinha. |
| 19 Encerramento com sucesso | Confirmar e conferir resgate integral e banner. |
| 20 Encerrada somente consulta | Preparar F13b RN10. Sem botões de movimentação. |

### Chaves Pix: vinte telas e estados

| Tela do documento | Como reproduzir |
| --- | --- |
| 1 Início / acesso | #inicio → Chaves Pix. |
| 2 Primeiro acesso vazio | Conta sem chaves, em #chaves. |
| 3 Lista e nova chave | #chaves. |
| 4 Chave aleatória | Tipo Chave aleatória; o valor é gerado pelo sistema (F1 RN1). |
| 5 Formato inválido | Preparar F1 RN1; telefone sem +55. |
| 6 Chave já vinculada | Preparar F1 RN3; e-mail já cadastrado. |
| 7 CPF/CNPJ de outro titular | Preparar F1 RN4. |
| 8 Limite de chaves atingido | Preparar F1 RN3 (5 chaves). |
| 9 Confirmação com motivo | Cadastrar telefone ou e-mail válido. |
| 10 Posse do contato por código | O código aparece na própria simulação. |
| 11 Código inválido ou expirado | Código errado, ou avançar mais de 5 minutos. |
| 12 Chave cadastrada | Confirmar o código. |
| 13 Aleatória cadastrada | Concluir o cadastro da tela 4. |
| 14 Solicitação repetida | Preparar F1 RN2. |
| 15 Exclusão: confirmação | Excluir em uma chave (F1 RN7). |
| 16 Chave excluída | Confirmar a exclusão. |
| 17 Exclusão não permitida | Excluir chave de conta da qual não é titular. |
| 18 Histórico de excluídas | Ver histórico de chaves excluídas. |
| 19 Consulta de terceiro | #consulta-pix (F1 RN9). |
| 20 Chave não encontrada | Preparar F1 RN5. |

### Limites: oito telas e estados

#inicio/#limites; vigentes e histórico; erro de teto (RN2); erro noturno (RN5); modal de segundo fator (RN6); código inválido/expirado; redução aplicada (RN3); aumento em carência e vigência após 24h (RN4).

### Dados e senha: dez telas e estados

#inicio/#dados; dados imutáveis/contatos atuais; formulários de alteração; senha atual incorreta e confirmação divergente; senha fora da política; reuso recente; sucesso com hash/sal; modal de confirmação do contato; código inválido/expirado; contato atualizado e auditoria.

Para o caso adicional de portabilidade F1 RN6, use Como experimentar → Simulações adicionais → Portabilidade de chave · mesmo titular. O botão prepara duas contas do mesmo titular, sem montagem manual. Para CNPJ, escolha Loja Exemplo → Usar conta empresarial; exclua a chave CNPJ preexistente e cadastre-a novamente.

## Integrações para conferir

- Aplicar ou guardar na caixinha reduz o disponível usado pela transferência, boleto e débito automático.
- Transferências e boletos executados por agendamento usam os limites vigentes no dia da execução.
- Autorização reserva limite, confirmação cria parcelas nas faturas e expiração devolve a reserva.
- Fatura atrasada bloqueia cartão e impede renovação. Após pagar o débito exigível, o bloqueio por inadimplência é removido.
- Contestação de cartão suspende total/mínimo/rotativo. Estorno parcial ou total e improcedência deixam trilhas e notificações.
- Atraso no empréstimo afeta análise de crédito e emissão/aumento do cartão.
- Favorito com destino que não existe mais fica inválido após tentativa; edição/revalidação não altera recibos antigos.
- Encerramento exige saldo zero e ausência de empréstimos ativos; inativa as chaves por ACCOUNT_CLOSURE.
- Históricos de caixinhas encerradas e solicitações de extratos continuam consultáveis; arquivos expiram em 30 dias.

## Cobertura e decisões

Não há RN omitida, placeholder ou funcionalidade substituída por tela sem comportamento. A F1 é derivada, conforme pedido. As 156 regras têm implementação, entrada no catálogo e cenário de validação; 89 casos automáticos agrupam verificações de diversas RNs. Algumas bordas operacionais dependem das interpretações documentadas, incluindo destinatário sem saldo para bloqueio integral, encerramento de caixinha antes do rendimento, critérios de crédito e parâmetros não definidos nas fontes.

Consulte ASSUNCOES.md para julgar essas decisões. A matriz é um roteiro verificável, não uma alegação de que todos os cliques e todas as combinações possíveis foram automatizados. O relatório separa testes de serviços, preparação de cenários e conferência visual.

## Matriz de cobertura por RN

| RN | Título | Arquivo e tela | Passos e resultado a conferir |
| --- | --- | --- | --- |
| F1 RN1 | Formato e normalização de chaves | integrante6/chaves-pix.js · #chaves | Preparar a RN no roteiro. Cadastre a chave aleatória. Depois teste outros tipos; e-mail é normalizado e os formatos seguem o Anexo A.1. |
| F1 RN2 | Requisição de cadastro e idempotência | integrante6/chaves-pix.js · #chaves | Preparar a RN no roteiro. Cadastre com o UUID preenchido. Deve devolver RequisicaoDuplicada e o cadastro original, sem criar outra chave. |
| F1 RN3 | Unicidade e limite de chaves | integrante6/chaves-pix.js · #chaves | Preparar a RN no roteiro. A conta está no limite de 5 chaves. Cadastre outra: LimiteDeChavesExcedido. Uma chave já vinculada deve produzir ChaveJaExiste. |
| F1 RN4 | Titularidade da chave | integrante6/chaves-pix.js · #chaves | Preparar a RN no roteiro. O telefone tem formato válido, mas não pertence ao titular: ChaveDeOutroTitular. |
| F1 RN5 | Consulta de chave ativa e restrição de consultas | integrante6/chaves-pix.js · #consulta-pix | Preparar a RN no roteiro. Consulte a chave inexistente para ChaveNaoEncontrada. O limite é de 10 consultas por dia. |
| F1 RN6 | Reivindicação de posse e portabilidade | integrante6/chaves-pix.js · #reivindicacoes | Preparar a RN no roteiro. Abra a reivindicação com a prova fictícia de posse marcada. Para PORTABILITY, use outra conta do mesmo titular. |
| F1 RN7 | Motivos e inativação de chaves | integrante6/chaves-pix.js · #chaves | Preparar a RN no roteiro. Exclua uma chave escolhendo um dos motivos enumerados. A chave fica INATIVA e o histórico é preservado. Encerramento usa ACCOUNT_CLOSURE. |
| F1 RN8 | Bloqueio durante reivindicação | integrante6/chaves-pix.js · #consulta-pix | Preparar a RN no roteiro. Consulte a chave com reivindicação aberta: ChaveBloqueadaPorReivindicacao. |
| F1 RN9 | Resposta de consulta e mascaramento | integrante6/chaves-pix.js · #consulta-pix | Preparar a RN no roteiro. Consulte e abra os dados da resposta: nome/documento mascarados e estatísticas unificadas. |
| F1 RN10 | Ciclo auditável da reivindicação | integrante6/chaves-pix.js · #reivindicacoes | Preparar a RN no roteiro. Avance cada etapa e confira a auditoria. Somente a conclusão transfere o vínculo e libera a chave. |
| F2 RN1 | Resolução do destino por chave ou por dados bancários | integrante1/transferencia.js · #transferencia | Preparar a RN no roteiro. Revise por Pix; depois use agência 0001 e conta 0007654322. As duas formas levam à mesma confirmação. |
| F2 RN2 | Conta de destino deve existir e estar ativa | integrante1/transferencia.js · #transferencia | Preparar a RN no roteiro. Destino inativo: a revisão deve recusar ContaInexistenteOuInativa. |
| F2 RN3 | Origem e destino não podem ser a mesma conta | integrante1/transferencia.js · #transferencia | Preparar a RN no roteiro. Origem e destino iguais: a revisão deve recusar a operação. |
| F2 RN4 | Confirmação dos dados do recebedor | integrante1/transferencia.js · #transferencia | Preparar a RN no roteiro. Revise e confira nome/documento mascarados, instituição e tipo. Só o botão de confirmação efetiva a transferência. |
| F2 RN5 | Saldo disponível suficiente na conta de origem | integrante1/transferencia.js · #transferencia | Preparar a RN no roteiro. Saldo total zerado: deve apresentar SaldoInsuficiente e a composição do saldo. |
| F2 RN6 | Respeito ao limite diário | integrante1/transferencia.js · #transferencia | Preparar a RN no roteiro. Duas transferências já consumiram R$ 8.000,00 hoje. Uma nova de R$ 3.000,00 excede o diário. |
| F2 RN7 | Limite reduzido em horário noturno | integrante1/transferencia.js · #transferencia | Preparar a RN no roteiro. Relógio às 21h. Transferir R$ 1.500,00 excede o noturno de R$ 1.000,00. |
| F2 RN8 | Valor mínimo e máximo por transação | integrante1/transferencia.js · #transferencia | Preparar a RN no roteiro. Valor acima do limite por transação: LimitePorTransacaoExcedido. Teste zero para a validação de valor mínimo. |
| F2 RN9 | Débito e crédito atômicos | integrante1/transferencia.js · #transferencia | Preparar a RN no roteiro. Falha preparada após o débito. Ao confirmar, confira saldo restaurado, destino sem crédito e trilha BE08. |
| F2 RN10 | Idempotência da requisição de transferência | integrante1/transferencia.js · #transferencia | Preparar a RN no roteiro. UUID já processado. A confirmação devolve a primeira operação, sem novo débito. |
| F2 RN11 | Identificador único de ponta a ponta | integrante1/transferencia.js · #transferencia | Preparar a RN no roteiro. Confirme e confira os 32 caracteres do identificador no comprovante e na auditoria. |
| F2 RN12 | Controle de situação da transação | integrante1/transferencia.js · #transferencia | Preparar a RN no roteiro. Confirme e consulte a evolução EM_PROCESSAMENTO → EFETIVADA. O cenário de falha cobre DEVOLVIDA. |
| F2 RN13 | Representação exata de valores monetários | integrante1/transferencia.js · #transferencia | Preparar a RN no roteiro. Transfira R$ 0,10. Confira exatamente os centavos no saldo e no extrato. |
| F2 RN14 | Geração de comprovante | integrante1/transferencia.js · #transferencia | Preparar a RN no roteiro. Confirme e confira identificador, data, valor, forma do destino e documento mascarado no comprovante. |
| F3 RN1 | Validação da linha digitável | integrante3/boleto.js · #boleto-codigo | Preparar a RN no roteiro. Na entrada por código, altere um dígito e consulte: BoletoInvalido. Use o código inicial para o caminho válido. |
| F3 RN2 | Extração do vencimento e do valor a partir do código | integrante3/boleto.js · #boleto-codigo | Preparar a RN no roteiro. Consulte o código válido: vencimento e valor são extraídos e exibidos sem edição. |
| F3 RN3 | Boleto já pago não pode ser pago novamente | integrante3/boleto.js · #boleto-confirmar | Preparar a RN no roteiro. Tente consultar/pagar o boleto liquidado: BoletoJaLiquidado. |
| F3 RN4 | Cálculo de encargos e desconto na data de liquidação | integrante3/boleto.js · #boleto-confirmar | Preparar a RN no roteiro. Confira multa, juros e desconto no resumo. Avance o relógio e revise novamente para ver o recálculo. |
| F3 RN5 | Pagamento após o vencimento | integrante3/boleto.js · #boleto-confirmar | Preparar a RN no roteiro. Abra o boleto vencido fora do prazo: BoletoVencidoForaDoPrazo e orientação de segunda via. |
| F3 RN6 | Horário limite para liquidação no mesmo dia | integrante3/boleto.js · #boleto-confirmar | Preparar a RN no roteiro. Às 18h, revise o boleto; a liquidação informada será no próximo dia útil. |
| F3 RN7 | Saldo disponível e limite na data de execução | integrante3/boleto.js · #boleto-confirmar | Preparar a RN no roteiro. Saldo zerado. O pagamento imediato falha, mas o agendamento é aceito sem saldo. |
| F3 RN8 | Agendamento para data futura | integrante3/boleto.js · #boleto-confirmar | Preparar a RN no roteiro. Agende o boleto para uma data futura até o vencimento; confira que não houve débito nem consumo de limite. |
| F3 RN9 | Política de tentativas e cancelamento do agendamento | integrante3/boleto.js · #agendamentos | Preparar a RN no roteiro. Há um boleto agendado para amanhã e saldo zero. Avance 1 dia e depois horas para observar três tentativas e notificação. |
| F3 RN10 | Registro e comprovante do pagamento | integrante3/boleto.js · #boleto-confirmar | Preparar a RN no roteiro. Pague o boleto e confira o comprovante com autenticação, linha, nominal, encargos e liquidação. |
| F3 RN11 | Duas formas de iniciar o pagamento | integrante3/boleto.js · #boleto-codigo | Preparar a RN no roteiro. Entre pela lista ou por código. Ambas as entradas usam a confirmação única. |
| F3 RN12 | Rejeição de boleto por suspeita de fraude | integrante3/boleto.js · #boletos | Preparar a RN no roteiro. Use Não reconheço e informe o motivo. Confira o estado REJEITADO e o aviso ao beneficiário. |
| F3 RN13 | Recurso do beneficiário | integrante3/boleto.js · #beneficiario | Preparar a RN no roteiro. Perfil beneficiário selecionado, boleto rejeitado. Anexe arquivos fictícios e justifique o recurso dentro de 5 dias. |
| F3 RN14 | Consulta às evidências do recurso | integrante3/boleto.js · #boletos | Preparar a RN no roteiro. Abra Ver evidências. Confira os anexos e escolha reconhecer/pagar ou manter a rejeição. |
| F4 RN1 | Data de execução futura e válida | integrante5/agendamento.js · #agendamentos | Preparar a RN no roteiro. Agende para sábado 08/02/2025 e escolha próximo dia útil ou anterior; confira 10/02 ou 07/02. |
| F4 RN2 | Definição da recorrência | integrante5/agendamento.js · #agendamentos | Preparar a RN no roteiro. Crie recorrência mensal com três ocorrências. Sem frequência ou término, o cadastro é recusado. |
| F4 RN3 | Verificação de saldo apenas na data de execução | integrante5/agendamento.js · #agendamentos | Preparar a RN no roteiro. Saldo zero: registre o agendamento normalmente; não há reserva nem validação de saldo agora. |
| F4 RN4 | Consumo de limite na data de execução | integrante5/agendamento.js · #agendamentos | Preparar a RN no roteiro. O agendamento foi criado sem consumo. Avance 1 dia: só a execução consumirá limite diário. |
| F4 RN5 | Política de novas tentativas | integrante5/agendamento.js · #agendamentos | Preparar a RN no roteiro. Recorrência sem saldo. Avance os horários: cada ocorrência falha após 3 tentativas, e as futuras continuam pendentes. |
| F4 RN6 | Alteração antes da execução | integrante5/agendamento.js · #agendamentos | Preparar a RN no roteiro. Edite a ocorrência pendente; após a execução, as ações de edição desaparecem. |
| F4 RN7 | Cancelamento do agendamento | integrante5/agendamento.js · #agendamentos | Preparar a RN no roteiro. Cancele uma ocorrência até a véspera ou encerre toda a recorrência. As executadas são preservadas. |
| F4 RN8 | Registro do resultado de cada ocorrência | integrante5/agendamento.js · #agendamentos | Preparar a RN no roteiro. Avance 1 dia e confira situação, tentativas e vínculo ao comprovante de cada ocorrência. |
| F5 RN1 | CPF obrigatório e com dígito verificador válido | integrante2/abertura-conta.js · #abrir-conta | Preparar a RN no roteiro. CPF válido preenchido. Troque um dígito para testar o verificador; depois use o cadastro preparado. |
| F5 RN2 | CPF único no sistema | integrante2/abertura-conta.js · #abrir-conta | Preparar a RN no roteiro. CPF da Maria preenchido: deve recusar duplicidade. |
| F5 RN3 | Idade mínima para abertura de conta | integrante2/abertura-conta.js · #abrir-conta | Preparar a RN no roteiro. Nascimento de menor de 18 anos preenchido: deve recusar. |
| F5 RN4 | Nome civil e nome social | integrante2/abertura-conta.js · #abrir-conta | Preparar a RN no roteiro. Nome civil e social preenchidos; conclua o cadastro e confira o nome social nas telas e comprovantes. |
| F5 RN5 | Endereço completo e validado | integrante2/abertura-conta.js · #abrir-conta | Preparar a RN no roteiro. Endereço fictício completo e correspondência CEP/IBGE preparados. Troque o código para testar incompatibilidade. |
| F5 RN6 | Contatos válidos e principais | integrante2/abertura-conta.js · #abrir-conta | Preparar a RN no roteiro. Contatos preenchidos como principais. Desmarque um principal para testar a obrigatoriedade. |
| F5 RN7 | Validação de documentos | integrante2/abertura-conta.js · #abrir-conta | Preparar a RN no roteiro. Metadados documentais fictícios preparados. Validade vencida produz recusa; anexe arquivos fictícios para testar novos documentos. |
| F5 RN8 | Qualificação do cliente | integrante2/abertura-conta.js · #abrir-conta | Preparar a RN no roteiro. Ocupação e renda com periodicidade preenchidas. A renda é mensalizada para determinar a qualificação. |
| F5 RN9 | Registro de consentimento | integrante2/abertura-conta.js · #abrir-conta | Preparar a RN no roteiro. Aceite marcado. A submissão registra versão 2026.02, data/hora e origem; sem aceite, recusa. |
| F5 RN10 | Análise e decisão sobre o cadastro | integrante2/abertura-conta.js · #abrir-conta | Preparar a RN no roteiro. Restrição cadastral fictícia marcada: o cadastro será RECUSADO com motivo e exigirá nova solicitação. |
| F5 RN11 | Criação automática da conta após aprovação | integrante2/abertura-conta.js · #abrir-conta | Preparar a RN no roteiro. Conclua o cadastro para criar automaticamente a conta com saldo zero, tipo e subtipo selecionados. |
| F5 RN12 | Definição dos limites iniciais | integrante2/abertura-conta.js · #abrir-conta | Preparar a RN no roteiro. Conclua e consulte os limites iniciais correspondentes à qualificação da renda. |
| F6 RN1 | Alteração de senha exige a senha atual | integrante6/dados-senha.js · #dados | Preparar a RN no roteiro. Senha atual incorreta preenchida. Tente alterar: a troca é recusada. |
| F6 RN2 | Política de composição da nova senha | integrante6/dados-senha.js · #dados | Preparar a RN no roteiro. Nova senha com sequência simples preenchida. A política deve recusar. |
| F6 RN3 | Vedação de reuso de senha | integrante6/dados-senha.js · #dados | Preparar a RN no roteiro. Nova senha igual à atual preenchida. O histórico deve impedir o reuso. |
| F6 RN4 | Armazenamento irreversível da senha | integrante6/dados-senha.js · #dados | Preparar a RN no roteiro. Altere a senha e confira apenas hash SHA-256 e sal na demonstração, sem texto claro no cadastro. |
| F6 RN5 | Confirmação de posse do novo contato | integrante6/dados-senha.js · #dados | Preparar a RN no roteiro. Solicite novo e-mail/telefone. O código aparece na simulação; só após confirmá-lo o contato muda. |
| F6 RN6 | Dados imutáveis | integrante6/dados-senha.js · #dados | Preparar a RN no roteiro. CPF, nascimento e nome civil estão desabilitados. Use Solicitar correção para enviar nova documentação fictícia. |
| F6 RN7 | Registro de auditoria da alteração | integrante6/dados-senha.js · #dados | Preparar a RN no roteiro. Altere senha ou confirme novo contato e confira canal, data/hora e valor anterior mascarado na auditoria. |
| F7 RN1 | Limites configuráveis pelo cliente | integrante6/limites.js · #limites | Preparar a RN no roteiro. Quatro limites independentes estão disponíveis. Cada alteração exige confirmação adicional. |
| F7 RN2 | Teto máximo definido pelo banco | integrante6/limites.js · #limites | Preparar a RN no roteiro. Diário acima do teto da faixa preenchido. A revisão deve recusar. |
| F7 RN3 | Redução com efeito imediato | integrante6/limites.js · #limites | Preparar a RN no roteiro. Diário reduzido preenchido. Confirme pelo código: a redução vale imediatamente. |
| F7 RN4 | Aumento sujeito a carência | integrante6/limites.js · #limites | Preparar a RN no roteiro. Diário aumentado preenchido. Confirme e avance 24h para observar a vigência. |
| F7 RN5 | Limite noturno independente do limite diário | integrante6/limites.js · #limites | Preparar a RN no roteiro. Noturno acima do limite por transação preenchido. A alteração deve ser recusada. |
| F7 RN6 | Confirmação adicional na alteração | integrante6/limites.js · #limites | Preparar a RN no roteiro. Peça alteração e use código incorreto ou avance mais de 5 minutos antes de confirmar para testar expiração. |
| F7 RN7 | Histórico de alterações | integrante6/limites.js · #limites | Preparar a RN no roteiro. Efetive uma redução ou aumento e confira os valores e datas registrados no histórico. |
| F8 RN1 | Dados mínimos do favorito | integrante5/favoritos.js · #favoritos | Preparar a RN no roteiro. Apelido e destino preenchidos. Limpe o apelido para testar dados mínimos. |
| F8 RN2 | Apelido único por cliente | integrante5/favoritos.js · #favoritos | Preparar a RN no roteiro. Apelido João já cadastrado. Tente cadastrar outro com o mesmo apelido. |
| F8 RN3 | Validação do destino no cadastro | integrante5/favoritos.js · #favoritos | Preparar a RN no roteiro. Chave inexistente preenchida. O cadastro deve falhar ao resolver o vínculo. |
| F8 RN4 | Favorito não duplicado | integrante5/favoritos.js · #favoritos | Preparar a RN no roteiro. Mesmo destino de João com outro apelido: o cadastro deve recusar duplicidade. |
| F8 RN5 | Independência em relação às transações | integrante5/favoritos.js · #favoritos | Preparar a RN no roteiro. Transferência ao favorito já realizada. Edite/remova o favorito e confira que o comprovante preserva o destino original. |
| F8 RN6 | Favorito com destino inválido | integrante5/favoritos.js · #transferencia | Preparar a RN no roteiro. Favorito preparado com destino que foi inativado. Ao tentar transferir, ele fica inválido e exige revalidação. |
| F8 RN7 | Remoção lógica | integrante5/favoritos.js · #favoritos | Preparar a RN no roteiro. Remova o favorito. Ele sai da lista, mas permanece na auditoria como remoção lógica. |
| F9 RN1 | Simulação obrigatória antes da contratação | integrante2/emprestimo.js · #emprestimo | Preparar a RN no roteiro. Simulação preparada e expirada. Consulte-a na lista e solicite análise: PropostaExpirada. |
| F9 RN2 | Cálculo das parcelas por sistema de amortização | integrante2/emprestimo.js · #emprestimo | Preparar a RN no roteiro. Simule e contrate; confira parcela fixa, juros e amortização em cada linha, com ajuste final de centavos. |
| F9 RN3 | Divulgação do custo efetivo total | integrante2/emprestimo.js · #emprestimo | Preparar a RN no roteiro. Confira o CET mensal e anual, calculado sobre o valor liberado e incorporando IOF, tarifa e juros. |
| F9 RN4 | Incidência de tributo sobre a operação | integrante2/emprestimo.js · #emprestimo | Preparar a RN no roteiro. A simulação discrimina IOF fixo e diário limitado a 365 dias e os inclui no CET. |
| F9 RN5 | Análise automática de crédito | integrante2/emprestimo.js · #emprestimo | Preparar a RN no roteiro. Valor acima da capacidade preparado para aprovação reduzida. Restrições ou atrasos resultam em recusa com motivo. |
| F9 RN6 | Comprometimento máximo de renda | integrante2/emprestimo.js · #emprestimo | Preparar a RN no roteiro. Proposta de parcela alta preparada. A soma das parcelas ativas não pode passar de 30% da renda. |
| F9 RN7 | Faixas de valor e prazo | integrante2/emprestimo.js · #emprestimo | Preparar a RN no roteiro. Valor abaixo do mínimo e prazo fracionário preenchidos. A simulação deve recusar. |
| F9 RN8 | Liberação em conta do próprio cliente | integrante2/emprestimo.js · #contratos | Preparar a RN no roteiro. Oferta aprovada preparada. O aceite só permite conta ativa do próprio titular na mesma instituição. |
| F9 RN9 | Geração do cronograma de parcelas | integrante2/emprestimo.js · #contratos | Preparar a RN no roteiro. Contrato ativo com cronograma preparado. Confira primeira parcela após 30 dias e as composições. |
| F9 RN10 | Débito automático da parcela e inadimplência | integrante2/emprestimo.js · #contratos | Preparar a RN no roteiro. Contrato ativo sem saldo. Avance até o vencimento: débito falha e contrato fica EM_ATRASO; confira multa e mora. Use o botão Avançar ao próximo evento do cenário nas ferramentas. |
| F9 RN11 | Quitação antecipada com redução proporcional de juros | integrante2/emprestimo.js · #contratos | Preparar a RN no roteiro. Contrato ativo preparado. Compare quitação total, parcial com redução de parcela/prazo e antecipação individual. |
| F9 RN12 | Controle de situação do contrato | integrante2/emprestimo.js · #contratos | Preparar a RN no roteiro. Consulte o histórico do contrato; avance o relógio ou liquide para testar as transições permitidas. |
| F10 RN1 | Elegibilidade a partir da movimentação da conta | integrante3/cartao.js · #cartoes | Preparar a RN no roteiro. Perfil com histórico de movimentação preparado. Analise e emita; uma conta nova sem 30 dias deve ser recusada. |
| F10 RN2 | Definição do limite de crédito | integrante3/cartao.js · #cartoes | Preparar a RN no roteiro. Analise e emita. Consulte o critério e o teto da faixa usado na aprovação. |
| F10 RN3 | Um cartão físico ativo por cliente | integrante3/cartao.js · #cartoes | Preparar a RN no roteiro. Já existe cartão físico ativo. Nova emissão deve ser recusada até cancelar o anterior. |
| F10 RN4 | Ativação obrigatória antes do primeiro uso | integrante3/cartao.js · #cartoes | Preparar a RN no roteiro. Cartão emitido inativo. Defina a senha 5962 para ativar. |
| F10 RN5 | Política de senha do cartão | integrante3/cartao.js · #cartoes | Preparar a RN no roteiro. Na ativação, tente 1111, 1234 ou data de nascimento: deve recusar. Use 5962 para o caminho válido. |
| F10 RN6 | Cartão virtual descartável | integrante3/cartao.js · #cartoes | Preparar a RN no roteiro. Gere um virtual e use apenas NAO_PRESENCIAL. Descarte-o e confira que o físico continua ativo. |
| F10 RN7 | Limites por canal | integrante3/cartao.js · #cartoes | Preparar a RN no roteiro. Altere limites por canal; acima do limite total deve ser recusado. |
| F10 RN8 | Teto de aproximação sem senha | integrante3/cartao.js · #cartoes | Preparar a RN no roteiro. Compra por aproximação de R$ 250,00 preparada. Exige senha 5962; sem senha deve ser recusada. |
| F10 RN9 | Autorização de compra reserva limite | integrante3/cartao.js · #cartoes | Preparar a RN no roteiro. Autorize a compra: o limite é reservado antes da fatura. Sem confirmação, avance 48h para liberar a reserva. |
| F10 RN10 | Bloqueio temporário e cancelamento | integrante3/cartao.js · #cartoes | Preparar a RN no roteiro. Autorize, bloqueie/cancele e depois confirme a autorização: a compra anterior ainda entra na fatura. |
| F10 RN11 | Alteração do limite total | integrante3/cartao.js · #cartoes | Preparar a RN no roteiro. Prepare uma compra para consumir limite. Redução abaixo do utilizado deve ser recusada; aumento exige nova análise. |
| F10 RN12 | Validade e renovação | integrante3/cartao.js · #cartoes | Preparar a RN no roteiro. Validade próxima preparada. Avance 1 hora: haverá renovação automática apenas se não houver bloqueio ou atraso. |
| F11 RN1 | Ciclo de faturamento | integrante4/fatura.js · #faturas | Preparar a RN no roteiro. Compra com parcelas preparada. Confira os ciclos; uma compra após o dia 25 será lançada no seguinte. |
| F11 RN2 | Composição da fatura | integrante4/fatura.js · #faturas | Preparar a RN no roteiro. A fatura contém compra parcelada com principal e encargos; feche o ciclo para conferir a soma. |
| F11 RN3 | Parcelamento de compra | integrante4/fatura.js · #faturas | Preparar a RN no roteiro. Compra em três parcelas preparada. Todas comprometem o limite, e cada mês recebe uma parcela. |
| F11 RN4 | Valor mínimo de pagamento | integrante4/fatura.js · #faturas | Preparar a RN no roteiro. Fatura fechada preparada. Confira mínimo de 15% excluindo eventuais cobranças suspensas. |
| F11 RN5 | Pagamento total, mínimo ou parcial | integrante4/fatura.js · #faturas | Preparar a RN no roteiro. Fatura fechada. Teste total, mínimo, parcial e valor abaixo do mínimo. |
| F11 RN6 | Rotativo sobre o saldo remanescente | integrante4/fatura.js · #faturas | Preparar a RN no roteiro. Fatura com pagamento mínimo preparada. Avance ao próximo fechamento para conferir transporte e rotativo proporcional. |
| F11 RN7 | Encargos por atraso | integrante4/fatura.js · #faturas | Preparar a RN no roteiro. Fatura vencida preparada. Pague e confira multa e mora na fatura seguinte. |
| F11 RN8 | Recomposição do limite após o pagamento | integrante4/fatura.js · #faturas | Preparar a RN no roteiro. Fatura fechada. Pague e confira recomposição do limite apenas após liquidação; o cenário de falha deixa tudo preservado. |
| F11 RN9 | Bloqueio por inadimplência | integrante4/fatura.js · #faturas | Preparar a RN no roteiro. Fatura em atraso há mais de 5 dias preparada. Avance 1 hora para bloquear o cartão; quite o débito para regularizar. |
| F11 RN10 | Antecipação de parcelas | integrante4/fatura.js · #faturas | Preparar a RN no roteiro. Parcelas futuras com encargos preparadas. Antecipe e confira o desconto e a liberação do limite. |
| F11 RN11 | Controle de situação da fatura | integrante4/fatura.js · #faturas | Preparar a RN no roteiro. Fatura fechada preparada. Pague mínimo/total e consulte as transições auditadas. |
| F11 RN12 | Disponibilização da fatura ao cliente | integrante4/fatura.js · #faturas | Preparar a RN no roteiro. Fatura fechada preparada. Confira publicação e antecedência mínima em relação ao vencimento. |
| F12 RN1 | Abertura de ocorrência com protocolo | integrante4/contestacao.js · #contestacoes | Preparar a RN no roteiro. Transação de teste preparada. Abra a contestação e confira o protocolo no formato ano-sequencial. |
| F12 RN2 | Vínculo obrigatório a uma transação | integrante4/contestacao.js · #contestacoes | Preparar a RN no roteiro. A lista contém apenas transações efetivadas da conta selecionada. O serviço recusa referências de outro titular. |
| F12 RN3 | Prazo máximo para contestar | integrante4/contestacao.js · #contestacoes | Preparar a RN no roteiro. Transação com mais de 80 dias preparada. A abertura deve recusar PrazoDeContestacaoExpirado. |
| F12 RN4 | Contestação única por transação | integrante4/contestacao.js · #contestacoes | Preparar a RN no roteiro. Ocorrência já aberta para a transação. Nova abertura deve recusar ContestacaoJaEmAberto. |
| F12 RN5 | Bloqueio cautelar do valor | integrante4/contestacao.js · #contestacoes | Preparar a RN no roteiro. Ocorrência com fraude preparada. Selecione João nos perfis e confira o valor bloqueado na composição do saldo. |
| F12 RN6 | Prazo de análise e resposta | integrante4/contestacao.js · #atendimento | Preparar a RN no roteiro. Ocorrência em análise. Selecione analista, registre uma prorrogação justificada e confira 10 dias úteis adicionais. |
| F12 RN7 | Ciclo de vida da ocorrência | integrante4/contestacao.js · #atendimento | Preparar a RN no roteiro. No atendimento, avance ABERTA → EM_ANALISE → decisão → ENCERRADA e confira data/responsável. |
| F12 RN8 | Devolução em caso de procedência | integrante4/contestacao.js · #atendimento | Preparar a RN no roteiro. No atendimento, decida procedente com valor total ou parcial e motivo MD06, BE08 ou FR01. |
| F12 RN9 | Prazos de efetivação da devolução | integrante4/contestacao.js · #atendimento | Preparar a RN no roteiro. Devolução procedente já solicitada. Avance 6 horas para efetivar; BE08 tem prazo de até 48 horas. |
| F12 RN10 | Estorno automático por falha na execução | integrante4/contestacao.js · #transferencia | Preparar a RN no roteiro. Falha após débito preparada. Confirme a transferência e confira o estorno BE08 sem abrir contestação. |
| F12 RN11 | Contestação de lançamento de cartão suspende a cobrança | integrante4/contestacao.js · #faturas | Preparar a RN no roteiro. Lançamento de cartão contestado. Confira que o valor saiu do total, mínimo e rotativo até a decisão. |
| F12 RN12 | Notificação e histórico | integrante4/contestacao.js · #notificacoes | Preparar a RN no roteiro. Ocorrência preparada. Consulte a central de notificações e o histórico em cada mudança. |
| F13a RN1 | Aplicação mínima e produto disponível | integrante1/investimentos.js · #investimentos | Preparar a RN no roteiro. Valor inferior ao mínimo preenchido. Deve recusar ValorAbaixoDoMinimo. Produto indisponível produz ProdutoIndisponivel. |
| F13a RN2 | Tipos de rentabilidade em renda fixa | integrante1/investimentos.js · #investimentos | Preparar a RN no roteiro. Há produtos prefixado, percentual CDI e híbrido IPCA. Aplique e confira as condições preservadas na aplicação. |
| F13a RN3 | Apuração diária do rendimento | integrante1/investimentos.js · #investimentos | Preparar a RN no roteiro. Aplicação CDI preparada. Avance dias e confira rendimento somente em dias úteis. |
| F13a RN4 | Liquidez diária ou com carência | integrante1/investimentos.js · #investimentos | Preparar a RN no roteiro. Aplicação com carência de 30 dias preparada. Simular resgate antes do prazo deve recusar CarenciaNaoCumprida. |
| F13a RN5 | Imposto de renda regressivo no resgate | integrante1/investimentos.js · #investimentos | Preparar a RN no roteiro. Aplicação com rendimento preparada. Simule resgate e confira IR conforme o prazo original. |
| F13a RN6 | IOF regressivo nos primeiros 30 dias | integrante1/investimentos.js · #investimentos | Preparar a RN no roteiro. Aplicação com rendimento e menos de 30 dias preparada. Simule o resgate para conferir IOF regressivo. |
| F13a RN7 | Resgate total ou parcial | integrante1/investimentos.js · #investimentos | Preparar a RN no roteiro. Simule e confirme resgate parcial. Saldo remanescente e data original devem ser preservados. |
| F13a RN8 | Negociação de ações e ativos de renda variável | integrante1/investimentos.js · #investimentos | Preparar a RN no roteiro. Compra de 10 ações preparada. A cotação vigente e a corretagem entram no custo; venda desconta corretagem. |
| F13a RN9 | Ausência de garantia de rentabilidade em renda variável | integrante1/investimentos.js · #investimentos | Preparar a RN no roteiro. Ações preparadas com cotação reduzida. Confira perda sem garantia de rentabilidade. |
| F13a RN10 | Consolidação da posição do cliente | integrante1/investimentos.js · #investimentos | Preparar a RN no roteiro. Há renda fixa e ações. Confira a posição e sua atualização após cada movimento. |
| F13a RN11 | Simulação prévia ao resgate | integrante1/investimentos.js · #investimentos | Preparar a RN no roteiro. Simule o resgate. Bruto, IOF, IR, corretagem e líquido aparecem antes da confirmação. |
| F13b RN1 | Criação da caixinha | integrante1/caixinha.js · #caixinhas | Preparar a RN no roteiro. Crie a caixinha com nome e meta positiva. Nome repetido ou meta zero deve ser recusado. |
| F13b RN2 | Limite de caixinhas por conta | integrante1/caixinha.js · #caixinhas | Preparar a RN no roteiro. Cinco caixinhas ativas preparadas. A sexta deve ser recusada. |
| F13b RN3 | Depósito debita o saldo disponível | integrante1/caixinha.js · #caixinha | Preparar a RN no roteiro. Caixinha preparada. Deposite e confira alocação atômica e saldo disponível; valor acima do disponível deve ser recusado. |
| F13b RN4 | Valor da caixinha não compõe o saldo disponível | integrante1/caixinha.js · #caixinha | Preparar a RN no roteiro. Caixinha com R$ 100,00 preparada. Confira a composição do saldo e tente usar o valor reservado em transferência. |
| F13b RN5 | Resgate para a conta de origem | integrante1/caixinha.js · #caixinha | Preparar a RN no roteiro. Resgate total ou parcial. O crédito volta somente à mesma conta de origem. |
| F13b RN6 | Rendimento total na data de aniversário da caixinha | integrante1/caixinha.js · #caixinha | Preparar a RN no roteiro. Caixinha com saldo preparada. Avance ao aniversário: rendimento integral em um lançamento; fora dele, nenhum crédito. |
| F13b RN7 | Depósitos e resgates a qualquer momento | integrante1/caixinha.js · #caixinha | Preparar a RN no roteiro. Deposite e resgate antes do aniversário; avance e confira o rendimento do período apesar das movimentações. |
| F13b RN8 | Acompanhamento e conclusão da meta | integrante1/caixinha.js · #caixinha | Preparar a RN no roteiro. Caixinha acima da meta preparada. A sinalização CONCLUIDA continua permitindo novos depósitos e resgates. |
| F13b RN9 | Encerramento da caixinha | integrante1/caixinha.js · #caixinha | Preparar a RN no roteiro. Encerre a caixinha. Todo o saldo é resgatado e o histórico fica disponível. |
| F13b RN10 | Extrato da caixinha | integrante1/caixinha.js · #caixinha | Preparar a RN no roteiro. Caixinha encerrada com movimentos preparada. Use os filtros de período e tipo; confira ordem e saldos após os movimentos. |
| F14 RN1 | Filtros válidos de período | integrante5/extrato-export.js · #extrato | Preparar a RN no roteiro. Filtre com ambas as datas. Data inicial posterior à final ou apenas uma data produz PeriodoInvalido. |
| F14 RN2 | Período máximo de exportação | integrante5/extrato-export.js · #extrato | Preparar a RN no roteiro. Teste período com mais de 12 meses ou início anterior a 12 meses atrás: PeriodoInvalido. |
| F14 RN3 | Filtros de tipo e natureza | integrante5/extrato-export.js · #extrato | Preparar a RN no roteiro. Selecione tipos com Ctrl e uma natureza. Visualização e arquivos devem conter os mesmos lançamentos. |
| F14 RN4 | Registro da solicitação | integrante5/extrato-export.js · #extrato | Preparar a RN no roteiro. Exporte CSV/PDF ou peça segunda via. Confira protocolo, horário, filtros e formato no histórico. |
| F14 RN5 | Formato e conteúdo do arquivo | integrante5/extrato-export.js · #extrato | Preparar a RN no roteiro. Gere PDF e CSV. Confira período, identificação da conta, total e dados dos lançamentos. |
| F14 RN6 | Mascaramento de dados de terceiros | integrante5/extrato-export.js · #extrato | Preparar a RN no roteiro. Exporte o Pix preparado e confira documento mascarado e conta da contraparte truncada. |
| F14 RN7 | Segunda via não altera a operação original | integrante5/extrato-export.js · #extrato | Preparar a RN no roteiro. Peça segunda via. Compare identificador e dados originais: apenas o novo arquivo e a solicitação são adicionados. |
| F14 RN8 | Disponibilidade do arquivo | integrante5/extrato-export.js · #extrato | Preparar a RN no roteiro. Arquivo de backup preparado. Baixe novamente; após 30 dias ele expira e exige nova solicitação. |
