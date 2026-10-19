/* Núcleo · catálogo das 156 RNs; transcrição revisada das referências e F1 derivada. */
Cesbank.Requirements = [{
  "feature": "F1",
  "number": 1,
  "title": "Formato e normalização de chaves",
  "description": "Validar CPF, CNPJ, PHONE, EMAIL e EVP pelo A.1; e-mail minúsculo com até 77 caracteres; EVP é UUID v4 gerado pelo sistema.",
  "consultations": "Nenhuma.",
  "complexity": "Baixa",
  "member": 6,
  "derived": true,
  "origin": "Anexo A.1"
}, {
  "feature": "F1",
  "number": 2,
  "title": "Requisição de cadastro e idempotência",
  "description": "Registrar chave, conta e titular, motivo enumerado e idRequisicao UUID v4 conforme A.2; reenvio devolve resultado original sem nova chave.",
  "consultations": "Requisições já processadas.",
  "complexity": "Média",
  "member": 6,
  "derived": true,
  "origin": "A.2, A.5 e RequisicaoDuplicada"
}, {
  "feature": "F1",
  "number": 3,
  "title": "Unicidade e limite de chaves",
  "description": "Uma chave não pode ter dois vínculos ativos; limitar a 5 chaves ativas por conta.",
  "consultations": "Chaves ativas do sistema e da conta.",
  "complexity": "Média",
  "member": 6,
  "derived": true,
  "origin": "ChaveJaExiste e LimiteDeChavesExcedido do A.6"
}, {
  "feature": "F1",
  "number": 4,
  "title": "Titularidade da chave",
  "description": "CPF/CNPJ devem corresponder ao titular; telefone/e-mail devem ser os contatos principais confirmados.",
  "consultations": "Cadastro e contatos confirmados do titular.",
  "complexity": "Média",
  "member": 6,
  "derived": true,
  "origin": "ChaveDeOutroTitular; F6 RN5"
}, {
  "feature": "F1",
  "number": 5,
  "title": "Consulta de chave ativa e restrição de consultas",
  "description": "Consultar somente vínculo ativo e conta ativa; limitar a 10 consultas por cliente por dia simulado.",
  "consultations": "Chaves, contas e contador diário de consultas.",
  "complexity": "Alta",
  "member": 6,
  "derived": true,
  "origin": "A.3; ChaveNaoEncontrada e ConsultasExcedidas"
}, {
  "feature": "F1",
  "number": 6,
  "title": "Reivindicação de posse e portabilidade",
  "description": "OWNERSHIP exige prova de posse simulada do e-mail/telefone; PORTABILITY exige mesmo titular e outra conta; uma reivindicação aberta por chave.",
  "consultations": "Vínculo atual, titular e reivindicações.",
  "complexity": "Alta",
  "member": 6,
  "derived": true,
  "origin": "Anexo A.5"
}, {
  "feature": "F1",
  "number": 7,
  "title": "Motivos e inativação de chaves",
  "description": "Usar USER_REQUESTED, ACCOUNT_CLOSURE, BRANCH_TRANSFER, RECONCILIATION ou FRAUD; exclusão lógica preserva histórico; encerramento de conta inativa suas chaves automaticamente.",
  "consultations": "Chaves e conta.",
  "complexity": "Média",
  "member": 6,
  "derived": true,
  "origin": "A.5; integração F5"
}, {
  "feature": "F1",
  "number": 8,
  "title": "Bloqueio durante reivindicação",
  "description": "Bloquear resolução e exclusão enquanto reivindicação não estiver concluída ou cancelada.",
  "consultations": "Reivindicações abertas da chave.",
  "complexity": "Alta",
  "member": 6,
  "derived": true,
  "origin": "ChaveBloqueadaPorReivindicacao; F2 RN1; F8 RN3"
}, {
  "feature": "F1",
  "number": 9,
  "title": "Resposta de consulta e mascaramento",
  "description": "Responder A.3 com data, chave ativa, instituição/agência/conta/tipo, nome e documento mascarados, consultasNoPeriodo, reivindicacoesAbertas e contestacoes.",
  "consultations": "Cadastro do titular, vínculo, contadores e contestações.",
  "complexity": "Média",
  "member": 6,
  "derived": true,
  "origin": "A.3 unificado; F2 RN4"
}, {
  "feature": "F1",
  "number": 10,
  "title": "Ciclo auditável da reivindicação",
  "description": "Permitir ABERTA → AGUARDANDO_RESOLUCAO → CONFIRMADA → CONCLUIDA, ou CANCELADA antes da conclusão; conclusão transfere vínculo e libera chave; registrar data e responsável.",
  "consultations": "Situação atual e conta receptora.",
  "complexity": "Alta",
  "member": 6,
  "derived": true,
  "origin": "Enumerações A.5 e integridade do vínculo"
}, {
  "feature": "F2",
  "number": 1,
  "title": "Resolução do destino por chave ou por dados bancários",
  "description": "O destino da transferência pode ser informado de duas formas: por chave Pix, caso em que o sistema resolve o vínculo para obter conta e titular, ou por agência e número de conta. As demais regras desta funcionalidade se aplicam igualmente nos dois casos, sendo a forma de resolução o único ponto de variação.",
  "consultations": "Consultar o vínculo da chave informada ou a conta correspondente à agência e número informados.",
  "complexity": "Alta",
  "member": 1
}, {
  "feature": "F2",
  "number": 2,
  "title": "Conta de destino deve existir e estar ativa",
  "description": "A transferência só é realizada se a conta de destino existir e estiver com status ativo.",
  "consultations": "Consultar existência e status da conta de destino.",
  "complexity": "Baixa",
  "member": 1
}, {
  "feature": "F2",
  "number": 3,
  "title": "Origem e destino não podem ser a mesma conta",
  "description": "O sistema recusa transferência em que a conta de origem e a conta de destino sejam a mesma.",
  "consultations": "Nenhuma.",
  "complexity": "Baixa",
  "member": 1
}, {
  "feature": "F2",
  "number": 4,
  "title": "Confirmação dos dados do recebedor",
  "description": "Antes da confirmação, o sistema exibe ao pagador o nome do titular e o documento do recebedor de forma parcialmente mascarada, além da instituição e do tipo de conta. A transação só prossegue após confirmação explícita do pagador.",
  "consultations": "Consultar os dados do titular da conta de destino.",
  "complexity": "Média",
  "member": 1
}, {
  "feature": "F2",
  "number": 5,
  "title": "Saldo disponível suficiente na conta de origem",
  "description": "A transferência só é permitida se o saldo disponível da conta de origem for maior ou igual ao valor solicitado. O saldo disponível corresponde ao saldo total menos os valores bloqueados e menos os valores aplicados em investimentos.",
  "consultations": "Consultar a composição do saldo da conta de origem.",
  "complexity": "Média",
  "member": 1
}, {
  "feature": "F2",
  "number": 6,
  "title": "Respeito ao limite diário",
  "description": "O somatório das transferências realizadas pela conta de origem no dia não pode ultrapassar o limite diário configurado para o cliente.",
  "consultations": "Consultar o somatório de transferências realizadas pela conta no dia.",
  "complexity": "Média",
  "member": 1
}, {
  "feature": "F2",
  "number": 7,
  "title": "Limite reduzido em horário noturno",
  "description": "Entre 20h e 6h, o valor máximo por transferência fica restrito ao limite noturno configurado para a conta, independentemente do limite diário disponível.",
  "consultations": "Consultar o limite noturno vigente da conta e o horário da transação.",
  "complexity": "Média",
  "member": 1
}, {
  "feature": "F2",
  "number": 8,
  "title": "Valor mínimo e máximo por transação",
  "description": "O valor da transferência deve ser maior que zero e não pode ultrapassar o limite por transação configurado para a conta.",
  "consultations": "Consultar o limite por transação vigente.",
  "complexity": "Baixa",
  "member": 1
}, {
  "feature": "F2",
  "number": 9,
  "title": "Débito e crédito atômicos",
  "description": "O débito na conta de origem e o crédito na conta de destino ocorrem em uma única operação atômica; se uma das partes falhar, a outra é desfeita e nenhuma das contas fica alterada.",
  "consultations": "Validação de consistência das contas envolvidas antes da efetivação.",
  "complexity": "Alta",
  "member": 1
}, {
  "feature": "F2",
  "number": 10,
  "title": "Idempotência da requisição de transferência",
  "description": "Cada requisição carrega um identificador de requisição no formato UUID. O reenvio da mesma requisição não gera nova movimentação: o sistema devolve o resultado da execução original.",
  "consultations": "Consultar se o identificador de requisição já foi processado.",
  "complexity": "Média",
  "member": 1
}, {
  "feature": "F2",
  "number": 11,
  "title": "Identificador único de ponta a ponta",
  "description": "Toda transferência recebe identificador único e imutável de 32 caracteres, formado por letra identificadora, código da instituição, data e hora de criação e sufixo aleatório, conforme o Anexo A.4. Esse identificador é a chave de rastreamento da operação.",
  "consultations": "Consultar se o identificador gerado já existe.",
  "complexity": "Média",
  "member": 1
}, {
  "feature": "F2",
  "number": 12,
  "title": "Controle de situação da transação",
  "description": "Toda transferência tem situação registrada e auditável, restrita aos valores em processamento, efetivada, rejeitada e devolvida, evoluindo apenas nas transições previstas.",
  "consultations": "Consultar a situação atual da transação antes de qualquer mudança de estado.",
  "complexity": "Média",
  "member": 1
}, {
  "feature": "F2",
  "number": 13,
  "title": "Representação exata de valores monetários",
  "description": "Todo valor monetário é representado em formato decimal exato, com duas casas decimais e moeda identificada por código de três letras, sendo vedado o uso de ponto flutuante em cálculo, armazenamento ou exibição.",
  "consultations": "Nenhuma.",
  "complexity": "Média",
  "member": 1
}, {
  "feature": "F2",
  "number": 14,
  "title": "Geração de comprovante",
  "description": "Toda transferência concluída com sucesso gera comprovante contendo identificador de ponta a ponta, data e hora, valor, forma de resolução do destino e dados das contas envolvidas, com o documento do recebedor parcialmente mascarado.",
  "consultations": "Nenhuma.",
  "complexity": "Baixa",
  "member": 1
}, {
  "feature": "F3",
  "number": 1,
  "title": "Validação da linha digitável",
  "description": "A linha digitável tem 47 dígitos e é validada em duas camadas: os três dígitos verificadores de campo, calculados por módulo 10, e o dígito verificador geral do código de barras, calculado por módulo 11. Falha em qualquer verificador recusa o pagamento. A estrutura está no Anexo A.8.",
  "consultations": "Nenhuma (cálculo local dos dígitos verificadores).",
  "complexity": "Alta",
  "member": 3
}, {
  "feature": "F3",
  "number": 2,
  "title": "Extração do vencimento e do valor a partir do código",
  "description": "O vencimento é obtido do fator de vencimento, contado em dias a partir da data base de 7 de outubro de 1997, e o valor nominal é obtido das dez últimas posições, expressas em centavos. Esses dados não podem ser digitados pelo cliente quando presentes no código.",
  "consultations": "Nenhuma (cálculo local a partir do código).",
  "complexity": "Média",
  "member": 3
}, {
  "feature": "F3",
  "number": 3,
  "title": "Boleto já pago não pode ser pago novamente",
  "description": "O sistema recusa o pagamento de boleto cujo identificador já conste como liquidado, evitando duplicidade.",
  "consultations": "Consultar a situação do boleto pelo identificador extraído do código.",
  "complexity": "Média",
  "member": 3
}, {
  "feature": "F3",
  "number": 4,
  "title": "Cálculo de encargos e desconto na data de liquidação",
  "description": "Multa, juros de mora e desconto por antecipação são calculados sobre o valor nominal considerando a data efetiva de liquidação, e não a data em que o cliente consultou o boleto. O valor final é reapresentado ao cliente antes da confirmação.",
  "consultations": "Consultar as condições de multa, juros e desconto associadas ao boleto.",
  "complexity": "Alta",
  "member": 3
}, {
  "feature": "F3",
  "number": 5,
  "title": "Pagamento após o vencimento",
  "description": "Boleto vencido pode ser pago, com encargos recalculados. Boleto vencido há mais tempo que o prazo definido pelo sistema é recusado, com orientação para emissão de segunda via.",
  "consultations": "Consultar a data de vencimento e compará-la com a data corrente.",
  "complexity": "Média",
  "member": 3
}, {
  "feature": "F3",
  "number": 6,
  "title": "Horário limite para liquidação no mesmo dia",
  "description": "Pagamentos confirmados após o horário limite definido pelo banco são liquidados no próximo dia útil. O cliente é informado da data efetiva de liquidação antes de confirmar.",
  "consultations": "Consultar o horário corrente e o calendário de dias úteis.",
  "complexity": "Média",
  "member": 3
}, {
  "feature": "F3",
  "number": 7,
  "title": "Saldo disponível e limite na data de execução",
  "description": "O pagamento só é efetivado se houver saldo disponível suficiente e se o valor couber no limite diário na data de execução, e não na data em que o pagamento foi registrado.",
  "consultations": "Consultar saldo disponível e limite consumido na data de execução.",
  "complexity": "Média",
  "member": 3
}, {
  "feature": "F3",
  "number": 8,
  "title": "Agendamento para data futura",
  "description": "O cliente pode agendar o pagamento para data futura anterior ou igual ao vencimento. A validação de saldo ocorre somente na data agendada; no momento do agendamento verifica-se apenas a validade do boleto.",
  "consultations": "Consultar a validade do boleto e a data solicitada.",
  "complexity": "Média",
  "member": 3
}, {
  "feature": "F3",
  "number": 9,
  "title": "Política de tentativas e cancelamento do agendamento",
  "description": "Falhando a execução por saldo insuficiente, o sistema realiza nova tentativa no mesmo dia, dentro do número de tentativas previsto, e notifica o cliente em caso de falha definitiva. O agendamento pode ser cancelado pelo cliente até a véspera da data de execução.",
  "consultations": "Consultar o número de tentativas já realizadas e a situação do agendamento.",
  "complexity": "Média",
  "member": 3
}, {
  "feature": "F3",
  "number": 10,
  "title": "Registro e comprovante do pagamento",
  "description": "Todo pagamento efetivado gera lançamento no extrato do tipo boleto e comprovante contendo o código de autenticação, a linha digitável, o valor nominal, os encargos aplicados, o valor pago e a data de liquidação.",
  "consultations": "Nenhuma.",
  "complexity": "Baixa",
  "member": 3
}, {
  "feature": "F3",
  "number": 11,
  "title": "Duas formas de iniciar o pagamento",
  "description": "O cliente pode iniciar o pagamento por duas telas distintas: a lista de boletos em aberto vinculados ao seu CPF e a digitação ou leitura da linha digitável ou do código de barras. As duas levam à mesma tela de confirmação do pagamento, onde valem as mesmas validações e regras de encargos, horário, saldo e agendamento (RN 1 a 9).",
  "consultations": "Consultar os boletos em aberto vinculados ao CPF do cliente.",
  "complexity": "Média",
  "member": 3
}, {
  "feature": "F3",
  "number": 12,
  "title": "Rejeição de boleto por suspeita de fraude",
  "description": "O cliente pode rejeitar, na lista de boletos do seu CPF, um boleto que não reconhece, informando o motivo. O boleto passa à situação de rejeitado, continua listado para o cliente com a situação de rejeitado, não pode ser pago enquanto a rejeição vigorar e o beneficiário é notificado. A rejeição só vale para boleto ainda não pago.",
  "consultations": "Consultar a situação do boleto e o beneficiário associado.",
  "complexity": "Alta",
  "member": 3
}, {
  "feature": "F3",
  "number": 13,
  "title": "Recurso do beneficiário",
  "description": "Notificado da rejeição, o beneficiário pode recorrer, dentro do prazo definido pelo sistema, afirmando que o boleto é legítimo, com justificativa e anexos que comprovem a compra e a necessidade do boleto. O boleto passa à situação de rejeitado recorrido e continua não pagável. Sem recurso no prazo, a rejeição é mantida. A rejeição e o recurso não suspendem o vencimento: boleto que venceu durante a disputa segue a RN 5.",
  "consultations": "Consultar a rejeição aberta, o prazo para recurso e a data de vencimento.",
  "complexity": "Alta",
  "member": 3
}, {
  "feature": "F3",
  "number": 14,
  "title": "Consulta às evidências do recurso",
  "description": "Na lista do cliente, o boleto rejeitado recorrido pode ser aberto em um pop-up que mostra a justificativa do beneficiário e os anexos enviados. Depois de analisar as evidências, o cliente pode pagar o boleto, o que encerra a rejeição, ou manter a rejeição.",
  "consultations": "Consultar o recurso e os anexos vinculados ao boleto.",
  "complexity": "Média",
  "member": 3
}, {
  "feature": "F4",
  "number": 1,
  "title": "Data de execução futura e válida",
  "description": "A data de execução deve ser posterior à data corrente. Agendamento para dia não útil é executado no primeiro dia útil seguinte, salvo quando o cliente optar pelo dia útil anterior.",
  "consultations": "Consultar o calendário de dias úteis.",
  "complexity": "Média",
  "member": 5
}, {
  "feature": "F4",
  "number": 2,
  "title": "Definição da recorrência",
  "description": "O agendamento pode ser avulso ou recorrente. Sendo recorrente, exige frequência definida e condição de término, por data-limite ou por número de ocorrências.",
  "consultations": "Nenhuma.",
  "complexity": "Média",
  "member": 5
}, {
  "feature": "F4",
  "number": 3,
  "title": "Verificação de saldo apenas na data de execução",
  "description": "O saldo disponível é verificado no momento da execução, não no momento do agendamento. O agendamento é aceito mesmo sem saldo no ato do registro.",
  "consultations": "Consultar o saldo disponível da conta na data de execução.",
  "complexity": "Média",
  "member": 5
}, {
  "feature": "F4",
  "number": 4,
  "title": "Consumo de limite na data de execução",
  "description": "O valor agendado consome o limite diário na data em que for executado, concorrendo com as demais operações do cliente naquele dia.",
  "consultations": "Consultar o limite consumido pela conta na data de execução.",
  "complexity": "Média",
  "member": 5
}, {
  "feature": "F4",
  "number": 5,
  "title": "Política de novas tentativas",
  "description": "Falhando a execução, o sistema realiza novas tentativas conforme a política definida. Esgotadas as tentativas, a ocorrência é encerrada como não executada e o cliente é notificado, sem interromper as ocorrências futuras da recorrência.",
  "consultations": "Consultar as tentativas já realizadas para a ocorrência.",
  "complexity": "Média",
  "member": 5
}, {
  "feature": "F4",
  "number": 6,
  "title": "Alteração antes da execução",
  "description": "Valor, data e destino podem ser alterados enquanto a ocorrência não tiver sido executada. Ocorrências já executadas são imutáveis.",
  "consultations": "Consultar a situação da ocorrência.",
  "complexity": "Média",
  "member": 5
}, {
  "feature": "F4",
  "number": 7,
  "title": "Cancelamento do agendamento",
  "description": "O cliente pode cancelar uma ocorrência futura até a véspera da data de execução, ou encerrar a recorrência inteira, sem afetar as ocorrências já executadas.",
  "consultations": "Consultar a situação da ocorrência e da recorrência.",
  "complexity": "Baixa",
  "member": 5
}, {
  "feature": "F4",
  "number": 8,
  "title": "Registro do resultado de cada ocorrência",
  "description": "Cada ocorrência registra sua situação própria — pendente, executada, falhada ou cancelada — e, quando executada, referencia a transação gerada.",
  "consultations": "Consultar o histórico de ocorrências do agendamento.",
  "complexity": "Média",
  "member": 5
}, {
  "feature": "F5",
  "number": 1,
  "title": "CPF obrigatório e com dígito verificador válido",
  "description": "Todo cliente deve informar CPF com 11 dígitos numéricos, cujos dígitos verificadores são calculados e conferidos pelo sistema.",
  "consultations": "Nenhuma (cálculo local do dígito verificador).",
  "complexity": "Média",
  "member": 2
}, {
  "feature": "F5",
  "number": 2,
  "title": "CPF único no sistema",
  "description": "Não pode haver dois clientes cadastrados com o mesmo CPF.",
  "consultations": "Consultar se já existe cliente cadastrado com o CPF informado.",
  "complexity": "Média",
  "member": 2
}, {
  "feature": "F5",
  "number": 3,
  "title": "Idade mínima para abertura de conta",
  "description": "O cliente deve ter, no mínimo, 18 anos completos na data do cadastro, calculados a partir da data de nascimento.",
  "consultations": "Nenhuma (cálculo a partir da data de nascimento).",
  "complexity": "Baixa",
  "member": 2
}, {
  "feature": "F5",
  "number": 4,
  "title": "Nome civil e nome social",
  "description": "O nome civil é obrigatório e limitado a 70 caracteres. O cliente pode informar nome social, também limitado a 70 caracteres, que passa a ser o nome exibido nas telas e nos comprovantes, preservando-se o nome civil nos registros legais.",
  "consultations": "Nenhuma.",
  "complexity": "Baixa",
  "member": 2
}, {
  "feature": "F5",
  "number": 5,
  "title": "Endereço completo e validado",
  "description": "O cadastro exige logradouro, bairro, município, unidade da federação e CEP com 8 dígitos. A unidade da federação é restrita às siglas oficiais e o município deve corresponder ao código do IBGE, com 7 dígitos.",
  "consultations": "Consultar o município correspondente ao CEP e ao código informado.",
  "complexity": "Média",
  "member": 2
}, {
  "feature": "F5",
  "number": 6,
  "title": "Contatos válidos e principais",
  "description": "O cliente deve informar ao menos um telefone e um e-mail, marcando um de cada como principal. O telefone é classificado como fixo, móvel ou outro, com DDD de 2 ou 3 dígitos.",
  "consultations": "Nenhuma (validação local de formato).",
  "complexity": "Baixa",
  "member": 2
}, {
  "feature": "F5",
  "number": 7,
  "title": "Validação de documentos",
  "description": "O sistema valida se os documentos obrigatórios foram anexados, estão dentro do prazo de validade e se o número do documento é compatível com o CPF informado, antes de submeter o cadastro à análise.",
  "consultations": "Consultar a situação e a validade dos documentos anexados.",
  "complexity": "Média",
  "member": 2
}, {
  "feature": "F5",
  "number": 8,
  "title": "Qualificação do cliente",
  "description": "O cadastro registra a ocupação do cliente, segundo tabela de ocupações adotada, e a renda informada com periodicidade, valor e data de referência. Esses dados fundamentam a análise e os limites iniciais.",
  "consultations": "Consultar a tabela de ocupações vigente.",
  "complexity": "Média",
  "member": 2
}, {
  "feature": "F5",
  "number": 9,
  "title": "Registro de consentimento",
  "description": "O cadastro só é submetido com o registro do aceite dos termos de uso e da política de privacidade, armazenando a versão aceita, a data e hora do aceite e a origem da solicitação.",
  "consultations": "Consultar a versão vigente dos termos.",
  "complexity": "Baixa",
  "member": 2
}, {
  "feature": "F5",
  "number": 10,
  "title": "Análise e decisão sobre o cadastro",
  "description": "A decisão de aprovar ou recusar combina os critérios anteriores com a verificação de restrições cadastrais. Toda recusa registra o motivo e o critério que a originou, e o cadastro recusado não pode ser reaberto: exige nova solicitação.",
  "consultations": "Consultar restrições cadastrais associadas ao CPF informado.",
  "complexity": "Alta",
  "member": 2
}, {
  "feature": "F5",
  "number": 11,
  "title": "Criação automática da conta após aprovação",
  "description": "Aprovado o cadastro, o sistema cria automaticamente uma conta vinculada ao cliente, com saldo inicial zero, tipo restrito a conta de depósito à vista, conta poupança ou conta de pagamento pré-paga, e subtipo individual, conjunta simples ou conjunta solidária.",
  "consultations": "Nenhuma.",
  "complexity": "Baixa",
  "member": 2
}, {
  "feature": "F5",
  "number": 12,
  "title": "Definição dos limites iniciais",
  "description": "Na criação da conta, o sistema define automaticamente os limites iniciais de transferência — diário, noturno, por transação e de saque — a partir da qualificação do cliente.",
  "consultations": "Consultar a faixa de limites correspondente à qualificação do cliente.",
  "complexity": "Média",
  "member": 2
}, {
  "feature": "F6",
  "number": 1,
  "title": "Alteração de senha exige a senha atual",
  "description": "A troca de senha só é aceita mediante informação correta da senha vigente, na mesma requisição.",
  "consultations": "Consultar a credencial vigente do cliente para conferência.",
  "complexity": "Baixa",
  "member": 6
}, {
  "feature": "F6",
  "number": 2,
  "title": "Política de composição da nova senha",
  "description": "A nova senha deve ter comprimento mínimo definido, combinar letras e números, e não pode conter sequências simples nem dados pessoais do cliente, como CPF ou data de nascimento.",
  "consultations": "Nenhuma (validação local, com os dados já informados).",
  "complexity": "Baixa",
  "member": 6
}, {
  "feature": "F6",
  "number": 3,
  "title": "Vedação de reuso de senha",
  "description": "A nova senha não pode coincidir com as últimas senhas utilizadas pelo cliente, conforme o histórico mantido pelo sistema.",
  "consultations": "Consultar o histórico de senhas anteriores do cliente.",
  "complexity": "Média",
  "member": 6
}, {
  "feature": "F6",
  "number": 4,
  "title": "Armazenamento irreversível da senha",
  "description": "A senha é armazenada apenas na forma de resumo criptográfico com sal, nunca em texto claro, e não pode ser recuperada, apenas redefinida.",
  "consultations": "Nenhuma.",
  "complexity": "Baixa",
  "member": 6
}, {
  "feature": "F6",
  "number": 5,
  "title": "Confirmação de posse do novo contato",
  "description": "A alteração de telefone ou e-mail só é efetivada após confirmação por código enviado ao novo contato informado. Até a confirmação, o contato anterior permanece válido.",
  "consultations": "Consultar o código de confirmação emitido e seu prazo de validade.",
  "complexity": "Baixa",
  "member": 6
}, {
  "feature": "F6",
  "number": 6,
  "title": "Dados imutáveis",
  "description": "CPF, data de nascimento e nome civil não são editáveis pelo cliente; sua correção exige solicitação com nova apresentação de documentos.",
  "consultations": "Nenhuma.",
  "complexity": "Baixa",
  "member": 6
}, {
  "feature": "F6",
  "number": 7,
  "title": "Registro de auditoria da alteração",
  "description": "Toda alteração de senha ou de contato registra data e hora, canal de origem e valor anterior do dado alterado, com o valor anterior armazenado de forma mascarada.",
  "consultations": "Nenhuma.",
  "complexity": "Baixa",
  "member": 6
}, {
  "feature": "F7",
  "number": 1,
  "title": "Limites configuráveis pelo cliente",
  "description": "São configuráveis pelo cliente os limites diário de transferência, por transação, noturno e de saque, cada um com valor próprio e independente dos demais.",
  "consultations": "Consultar os limites vigentes da conta.",
  "complexity": "Baixa",
  "member": 6
}, {
  "feature": "F7",
  "number": 2,
  "title": "Teto máximo definido pelo banco",
  "description": "Nenhum limite configurado pelo cliente pode ultrapassar o teto máximo definido para a faixa de qualificação da conta, nem ser menor que zero.",
  "consultations": "Consultar o teto máximo aplicável à conta.",
  "complexity": "Baixa",
  "member": 6
}, {
  "feature": "F7",
  "number": 3,
  "title": "Redução com efeito imediato",
  "description": "Toda redução de limite passa a valer imediatamente após a confirmação, sem carência.",
  "consultations": "Nenhuma.",
  "complexity": "Baixa",
  "member": 6
}, {
  "feature": "F7",
  "number": 4,
  "title": "Aumento sujeito a carência",
  "description": "Todo aumento de limite só passa a valer após o prazo de carência definido pelo banco, contado da solicitação. Até lá permanece vigente o limite anterior.",
  "consultations": "Consultar a data da solicitação e o prazo de carência vigente.",
  "complexity": "Média",
  "member": 6
}, {
  "feature": "F7",
  "number": 5,
  "title": "Limite noturno independente do limite diário",
  "description": "O limite noturno é aplicado entre 20h e 6h e não pode ser superior ao limite por transação configurado para o período diurno.",
  "consultations": "Consultar o limite por transação vigente.",
  "complexity": "Baixa",
  "member": 6
}, {
  "feature": "F7",
  "number": 6,
  "title": "Confirmação adicional na alteração",
  "description": "Toda solicitação de alteração de limite exige confirmação adicional do cliente por segundo fator, independentemente do valor solicitado.",
  "consultations": "Consultar o resultado da verificação do segundo fator.",
  "complexity": "Baixa",
  "member": 6
}, {
  "feature": "F7",
  "number": 7,
  "title": "Histórico de alterações",
  "description": "Cada alteração registra o valor anterior, o valor solicitado, a data da solicitação e a data de entrada em vigor, compondo o histórico consultável pelo cliente.",
  "consultations": "Nenhuma.",
  "complexity": "Baixa",
  "member": 6
}, {
  "feature": "F8",
  "number": 1,
  "title": "Dados mínimos do favorito",
  "description": "Todo favorito exige apelido e uma forma de destino, que pode ser chave Pix ou a combinação de instituição, agência e número de conta com o documento do titular.",
  "consultations": "Nenhuma.",
  "complexity": "Baixa",
  "member": 5
}, {
  "feature": "F8",
  "number": 2,
  "title": "Apelido único por cliente",
  "description": "O apelido do favorito não pode se repetir dentro da lista do mesmo cliente.",
  "consultations": "Consultar os apelidos já cadastrados pelo cliente.",
  "complexity": "Baixa",
  "member": 5
}, {
  "feature": "F8",
  "number": 3,
  "title": "Validação do destino no cadastro",
  "description": "No momento do cadastro, o sistema valida o formato do destino e, no caso de chave Pix, resolve o vínculo para confirmar que a chave existe e registrar o nome do titular.",
  "consultations": "Consultar o vínculo da chave informada.",
  "complexity": "Média",
  "member": 5
}, {
  "feature": "F8",
  "number": 4,
  "title": "Favorito não duplicado",
  "description": "O mesmo destino não pode ser cadastrado duas vezes pelo mesmo cliente, ainda que com apelidos diferentes.",
  "consultations": "Consultar os destinos já cadastrados pelo cliente.",
  "complexity": "Baixa",
  "member": 5
}, {
  "feature": "F8",
  "number": 5,
  "title": "Independência em relação às transações",
  "description": "A edição ou remoção de um favorito não altera transações já realizadas, que preservam os dados do destino vigentes no momento da operação.",
  "consultations": "Nenhuma.",
  "complexity": "Baixa",
  "member": 5
}, {
  "feature": "F8",
  "number": 6,
  "title": "Favorito com destino inválido",
  "description": "Quando uma transferência falha por destino inexistente, o favorito correspondente é marcado como inválido e passa a exigir revalidação pelo cliente antes de novo uso.",
  "consultations": "Consultar o resultado da última tentativa de uso do favorito.",
  "complexity": "Média",
  "member": 5
}, {
  "feature": "F8",
  "number": 7,
  "title": "Remoção lógica",
  "description": "A remoção de favorito é lógica: o registro é marcado como removido e deixa de ser listado, preservando-se o histórico.",
  "consultations": "Nenhuma.",
  "complexity": "Baixa",
  "member": 5
}, {
  "feature": "F9",
  "number": 1,
  "title": "Simulação obrigatória antes da contratação",
  "description": "Nenhuma contratação é aceita sem simulação prévia. A simulação apresenta valor solicitado, prazo, taxa de juros, valor da parcela, total a pagar e custo efetivo total, e tem validade limitada, expirando após o prazo definido.",
  "consultations": "Consultar a taxa vigente aplicável à faixa do cliente.",
  "complexity": "Média",
  "member": 2
}, {
  "feature": "F9",
  "number": 2,
  "title": "Cálculo das parcelas por sistema de amortização",
  "description": "As parcelas são calculadas pelo sistema de amortização francês, com valor fixo, e o sistema registra, para cada parcela, a composição entre juros e amortização do principal.",
  "consultations": "Nenhuma (cálculo determinístico sobre os parâmetros da proposta).",
  "complexity": "Alta",
  "member": 2
}, {
  "feature": "F9",
  "number": 3,
  "title": "Divulgação do custo efetivo total",
  "description": "O custo efetivo total é calculado e apresentado ao cliente antes da contratação, expresso em percentual ao mês e ao ano, incorporando juros, tributos, tarifas e demais encargos da operação.",
  "consultations": "Consultar as tarifas e tributos aplicáveis à operação.",
  "complexity": "Alta",
  "member": 2
}, {
  "feature": "F9",
  "number": 4,
  "title": "Incidência de tributo sobre a operação",
  "description": "O sistema calcula o tributo incidente sobre o crédito, composto de parcela fixa sobre o valor liberado e parcela diária proporcional ao prazo, observado o teto legal, e o incorpora ao custo efetivo total.",
  "consultations": "Consultar as alíquotas vigentes.",
  "complexity": "Alta",
  "member": 2
}, {
  "feature": "F9",
  "number": 5,
  "title": "Análise automática de crédito",
  "description": "A proposta é submetida à análise automática que combina a qualificação do cliente, seu histórico de movimentação e eventuais restrições, resultando em aprovação, aprovação com valor reduzido ou recusa. Toda decisão registra o motivo.",
  "consultations": "Consultar histórico de movimentação, restrições e contratos ativos do cliente.",
  "complexity": "Alta",
  "member": 2
}, {
  "feature": "F9",
  "number": 6,
  "title": "Comprometimento máximo de renda",
  "description": "A soma das parcelas dos contratos ativos, incluindo a proposta em análise, não pode ultrapassar o percentual máximo da renda informada definido pela política de crédito.",
  "consultations": "Consultar a renda informada e as parcelas dos contratos ativos do cliente.",
  "complexity": "Média",
  "member": 2
}, {
  "feature": "F9",
  "number": 7,
  "title": "Faixas de valor e prazo",
  "description": "Valor e prazo solicitados devem estar dentro das faixas mínima e máxima definidas para a modalidade, e o prazo deve ser expresso em número inteiro de meses.",
  "consultations": "Consultar as faixas vigentes para a modalidade.",
  "complexity": "Baixa",
  "member": 2
}, {
  "feature": "F9",
  "number": 8,
  "title": "Liberação em conta do próprio cliente",
  "description": "O valor aprovado é creditado exclusivamente em conta de titularidade do próprio cliente, na mesma instituição.",
  "consultations": "Consultar as contas ativas do cliente.",
  "complexity": "Baixa",
  "member": 2
}, {
  "feature": "F9",
  "number": 9,
  "title": "Geração do cronograma de parcelas",
  "description": "Contratado o empréstimo, o sistema gera o cronograma completo com número, valor, vencimento e composição de cada parcela, e o vencimento da primeira parcela respeita a carência definida.",
  "consultations": "Nenhuma.",
  "complexity": "Média",
  "member": 2
}, {
  "feature": "F9",
  "number": 10,
  "title": "Débito automático da parcela e inadimplência",
  "description": "Na data de vencimento, a parcela é debitada automaticamente da conta vinculada. Não havendo saldo disponível, a parcela é marcada como em atraso e passa a acumular multa e juros de mora até a liquidação.",
  "consultations": "Consultar o saldo disponível na data de vencimento e a situação das parcelas anteriores.",
  "complexity": "Alta",
  "member": 2
}, {
  "feature": "F9",
  "number": 11,
  "title": "Quitação antecipada com redução proporcional de juros",
  "description": "O cliente pode liquidar antecipadamente o contrato, de forma total ou parcial, com redução proporcional dos juros ainda não incorridos. Na liquidação parcial, o cliente escolhe entre reduzir o valor das parcelas ou o prazo restante.",
  "consultations": "Consultar o saldo devedor e os juros já incorridos até a data da liquidação.",
  "complexity": "Alta",
  "member": 2
}, {
  "feature": "F9",
  "number": 12,
  "title": "Controle de situação do contrato",
  "description": "O contrato tem situação registrada e auditável, restrita aos valores em análise, aprovado, recusado, ativo, em atraso, liquidado e cancelado, evoluindo apenas nas transições previstas.",
  "consultations": "Consultar a situação atual do contrato e das parcelas.",
  "complexity": "Média",
  "member": 2
}, {
  "feature": "F10",
  "number": 1,
  "title": "Elegibilidade a partir da movimentação da conta",
  "description": "A emissão do cartão depende de análise da movimentação do cliente, considerando entradas, saídas e saldo médio de um período mínimo de relacionamento, além da qualificação registrada no cadastro. Contas sem o tempo mínimo de relacionamento não são elegíveis.",
  "consultations": "Consultar entradas, saídas e saldo médio da conta no período de apuração.",
  "complexity": "Alta",
  "member": 3
}, {
  "feature": "F10",
  "number": 2,
  "title": "Definição do limite de crédito",
  "description": "O limite é calculado a partir do resultado da análise e enquadrado em faixas predefinidas, nunca ultrapassando o teto da faixa em que o cliente foi classificado. Toda emissão registra o critério que originou o limite.",
  "consultations": "Consultar a faixa de limite correspondente ao resultado da análise.",
  "complexity": "Alta",
  "member": 3
}, {
  "feature": "F10",
  "number": 3,
  "title": "Um cartão físico ativo por cliente",
  "description": "Cada cliente pode ter apenas um cartão físico ativo por conta. A emissão de novo cartão físico exige o cancelamento do anterior.",
  "consultations": "Consultar os cartões ativos vinculados à conta.",
  "complexity": "Baixa",
  "member": 3
}, {
  "feature": "F10",
  "number": 4,
  "title": "Ativação obrigatória antes do primeiro uso",
  "description": "O cartão emitido nasce inativo e só permite transações após ativação pelo cliente em canal autenticado, com definição de senha no mesmo fluxo.",
  "consultations": "Consultar a situação do cartão.",
  "complexity": "Baixa",
  "member": 3
}, {
  "feature": "F10",
  "number": 5,
  "title": "Política de senha do cartão",
  "description": "A senha do cartão tem comprimento fixo definido, não pode conter dígitos repetidos nem sequências, e não pode coincidir com a data de nascimento do titular.",
  "consultations": "Nenhuma (validação local).",
  "complexity": "Média",
  "member": 3
}, {
  "feature": "F10",
  "number": 6,
  "title": "Cartão virtual descartável",
  "description": "O cliente pode gerar cartões virtuais com numeração própria, vinculados ao mesmo limite, de uso exclusivo em compras não presenciais. Cada cartão virtual pode ser descartado individualmente sem afetar o cartão físico.",
  "consultations": "Consultar os cartões virtuais ativos do cliente.",
  "complexity": "Média",
  "member": 3
}, {
  "feature": "F10",
  "number": 7,
  "title": "Limites por canal",
  "description": "O cliente pode configurar limites distintos para compra presencial, compra não presencial e aproximação, todos subordinados ao limite total do cartão.",
  "consultations": "Consultar o limite total do cartão e os limites por canal vigentes.",
  "complexity": "Alta",
  "member": 3
}, {
  "feature": "F10",
  "number": 8,
  "title": "Teto de aproximação sem senha",
  "description": "Transações por aproximação acima do valor máximo definido exigem senha, independentemente do limite por canal configurado.",
  "consultations": "Consultar o valor máximo vigente para aproximação sem senha.",
  "complexity": "Baixa",
  "member": 3
}, {
  "feature": "F10",
  "number": 9,
  "title": "Autorização de compra reserva limite",
  "description": "Toda compra autorizada reserva imediatamente o valor no limite disponível, mesmo antes de ser incorporada à fatura. A reserva é liberada se a compra não for confirmada dentro do prazo previsto.",
  "consultations": "Consultar o limite disponível e as reservas ativas do cartão.",
  "complexity": "Alta",
  "member": 3
}, {
  "feature": "F10",
  "number": 10,
  "title": "Bloqueio temporário e cancelamento",
  "description": "O bloqueio temporário impede novas transações e é reversível pelo próprio cliente. O cancelamento é definitivo, não reversível, e exige nova emissão; nos dois casos, as compras já autorizadas seguem para a fatura.",
  "consultations": "Consultar a situação do cartão e as autorizações pendentes.",
  "complexity": "Média",
  "member": 3
}, {
  "feature": "F10",
  "number": 11,
  "title": "Alteração do limite total",
  "description": "A redução do limite total tem efeito imediato, desde que não fique abaixo do valor já utilizado. O aumento depende de nova análise e só passa a valer após a aprovação.",
  "consultations": "Consultar o valor já utilizado do limite.",
  "complexity": "Média",
  "member": 3
}, {
  "feature": "F10",
  "number": 12,
  "title": "Validade e renovação",
  "description": "O cartão tem data de validade e é renovado automaticamente antes do vencimento, salvo se estiver bloqueado, cancelado ou com fatura em atraso.",
  "consultations": "Consultar a situação do cartão e das faturas do cliente.",
  "complexity": "Baixa",
  "member": 3
}, {
  "feature": "F11",
  "number": 1,
  "title": "Ciclo de faturamento",
  "description": "Cada fatura tem data de fechamento e data de vencimento definidas. Compras realizadas até o fechamento compõem a fatura do ciclo corrente; compras posteriores ao fechamento compõem a fatura do ciclo seguinte.",
  "consultations": "Consultar a data de fechamento vigente e a data de cada lançamento.",
  "complexity": "Alta",
  "member": 4
}, {
  "feature": "F11",
  "number": 2,
  "title": "Composição da fatura",
  "description": "A fatura fechada reúne compras à vista do ciclo, parcelas de compras parceladas com vencimento no ciclo, encargos apurados, tarifas e eventuais créditos por estorno, resultando no valor total do ciclo.",
  "consultations": "Consultar todos os lançamentos vinculados ao ciclo.",
  "complexity": "Alta",
  "member": 4
}, {
  "feature": "F11",
  "number": 3,
  "title": "Parcelamento de compra",
  "description": "Compras podem ser parceladas até o número máximo de parcelas definido. Cada parcela é lançada na fatura do respectivo mês, e o valor total das parcelas futuras permanece comprometendo o limite do cartão.",
  "consultations": "Consultar o limite disponível e as parcelas futuras já comprometidas.",
  "complexity": "Alta",
  "member": 4
}, {
  "feature": "F11",
  "number": 4,
  "title": "Valor mínimo de pagamento",
  "description": "Toda fatura apresenta valor mínimo de pagamento, correspondente ao percentual definido sobre o valor total, e esse valor é informado ao cliente junto com o valor total.",
  "consultations": "Consultar o percentual mínimo vigente.",
  "complexity": "Média",
  "member": 4
}, {
  "feature": "F11",
  "number": 5,
  "title": "Pagamento total, mínimo ou parcial",
  "description": "O cliente pode pagar o valor total, o valor mínimo ou qualquer valor intermediário, desde que não inferior ao mínimo. Pagamento inferior ao mínimo é recusado.",
  "consultations": "Consultar o valor total e o valor mínimo da fatura.",
  "complexity": "Média",
  "member": 4
}, {
  "feature": "F11",
  "number": 6,
  "title": "Rotativo sobre o saldo remanescente",
  "description": "Pago valor inferior ao total, o saldo remanescente é transportado para a fatura seguinte acrescido dos encargos do crédito rotativo, apurados proporcionalmente aos dias entre o vencimento e o novo fechamento.",
  "consultations": "Consultar o saldo remanescente, a taxa vigente e o intervalo de dias apurado.",
  "complexity": "Alta",
  "member": 4
}, {
  "feature": "F11",
  "number": 7,
  "title": "Encargos por atraso",
  "description": "Fatura paga após o vencimento sofre multa e juros de mora, calculados sobre o valor em atraso e lançados na fatura seguinte, cumulativamente aos encargos do rotativo.",
  "consultations": "Consultar o valor da multa por atraso.",
  "complexity": "Alta",
  "member": 4
}, {
  "feature": "F11",
  "number": 8,
  "title": "Recomposição do limite após o pagamento",
  "description": "O limite disponível do cartão é recomposto no valor efetivamente pago, e somente após a confirmação da liquidação do pagamento.",
  "consultations": "Consultar o valor pago e o limite utilizado do cartão.",
  "complexity": "Alta",
  "member": 4
}, {
  "feature": "F11",
  "number": 9,
  "title": "Bloqueio por inadimplência",
  "description": "Fatura em atraso além do prazo definido bloqueia automaticamente novas transações no cartão, e o desbloqueio ocorre com a regularização do débito.",
  "consultations": "Consultar a situação das faturas do cartão.",
  "complexity": "Média",
  "member": 4
}, {
  "feature": "F11",
  "number": 10,
  "title": "Antecipação de parcelas",
  "description": "O cliente pode antecipar parcelas futuras de compras parceladas, com desconto proporcional dos encargos ainda não incorridos, liberando o limite correspondente.",
  "consultations": "Consultar as parcelas futuras e os encargos já incorridos.",
  "complexity": "Alta",
  "member": 4
}, {
  "feature": "F11",
  "number": 11,
  "title": "Controle de situação da fatura",
  "description": "A fatura tem situação registrada e auditável, restrita aos valores aberta, fechada, paga, paga parcialmente e em atraso, evoluindo apenas nas transições previstas.",
  "consultations": "Consultar a situação atual da fatura.",
  "complexity": "Média",
  "member": 4
}, {
  "feature": "F11",
  "number": 12,
  "title": "Disponibilização da fatura ao cliente",
  "description": "Fechada a fatura, ela é disponibilizada ao cliente com antecedência mínima em relação ao vencimento, detalhando todos os lançamentos do ciclo.",
  "consultations": "Consultar a data de fechamento e a data de vencimento.",
  "complexity": "Baixa",
  "member": 4
}, {
  "feature": "F12",
  "number": 1,
  "title": "Abertura de ocorrência com protocolo",
  "description": "Toda contestação gera ocorrência identificada por número de protocolo, fornecido ao cliente no ato da abertura, que acompanha a ocorrência até o encerramento.",
  "consultations": "Nenhuma.",
  "complexity": "Baixa",
  "member": 4
}, {
  "feature": "F12",
  "number": 2,
  "title": "Vínculo obrigatório a uma transação",
  "description": "A contestação deve referenciar uma transação ou um lançamento de fatura existente, identificado e pertencente ao cliente que a abre.",
  "consultations": "Consultar a transação ou o lançamento informado e sua titularidade.",
  "complexity": "Média",
  "member": 4
}, {
  "feature": "F12",
  "number": 3,
  "title": "Prazo máximo para contestar",
  "description": "A contestação só é aceita dentro do prazo máximo contado da data da transação contestada. Fora do prazo, a abertura é recusada com o motivo registrado.",
  "consultations": "Consultar a data da transação contestada.",
  "complexity": "Média",
  "member": 4
}, {
  "feature": "F12",
  "number": 4,
  "title": "Contestação única por transação",
  "description": "Uma mesma transação não pode ter duas ocorrências de contestação em aberto simultaneamente.",
  "consultations": "Consultar ocorrências em aberto para a transação.",
  "complexity": "Média",
  "member": 4
}, {
  "feature": "F12",
  "number": 5,
  "title": "Bloqueio cautelar do valor",
  "description": "Havendo indício de fraude, o valor contestado é bloqueado imediatamente na conta que o recebeu, deixando de compor o saldo disponível, e permanece bloqueado até a decisão sobre a ocorrência.",
  "consultations": "Consultar o saldo disponível da conta destinatária e o valor já bloqueado.",
  "complexity": "Alta",
  "member": 4
}, {
  "feature": "F12",
  "number": 6,
  "title": "Prazo de análise e resposta",
  "description": "A ocorrência deve ser analisada e respondida em até 10 dias úteis contados da abertura, admitida uma única prorrogação, por igual período e de forma justificada.",
  "consultations": "Consultar a data de abertura e eventual prorrogação registrada.",
  "complexity": "Alta",
  "member": 4
}, {
  "feature": "F12",
  "number": 7,
  "title": "Ciclo de vida da ocorrência",
  "description": "A ocorrência percorre os estados aberta, em análise, procedente, improcedente e encerrada, evoluindo apenas nas transições previstas, e cada mudança registra data, hora e responsável.",
  "consultations": "Consultar a situação atual da ocorrência.",
  "complexity": "Alta",
  "member": 4
}, {
  "feature": "F12",
  "number": 8,
  "title": "Devolução em caso de procedência",
  "description": "Sendo a contestação procedente, o valor é devolvido ao cliente por meio de nova transação, vinculada à transação original e identificada por motivo codificado, conforme o Anexo A.5. A devolução pode ser total ou parcial.",
  "consultations": "Consultar a transação original, o valor bloqueado e o saldo da conta devolvedora.",
  "complexity": "Alta",
  "member": 4
}, {
  "feature": "F12",
  "number": 9,
  "title": "Prazos de efetivação da devolução",
  "description": "A devolução por falha operacional deve ser efetivada em até 48 horas a partir da identificação da falha. Nos demais casos, a devolução é iniciada em até 72 horas após a conclusão da análise e efetivada em até 6 horas após a solicitação.",
  "consultations": "Consultar a data e hora da decisão e o motivo da devolução.",
  "complexity": "Alta",
  "member": 4
}, {
  "feature": "F12",
  "number": 10,
  "title": "Estorno automático por falha na execução",
  "description": "Independentemente de contestação, quando ocorre falha após o débito da conta de origem em qualquer operação, o valor é automaticamente devolvido à conta de origem, com motivo de falha operacional registrado, sem necessidade de abertura de ocorrência pelo cliente.",
  "consultations": "Consultar transações com débito efetuado e crédito não confirmado.",
  "complexity": "Alta",
  "member": 4
}, {
  "feature": "F12",
  "number": 11,
  "title": "Contestação de lançamento de cartão suspende a cobrança",
  "description": "Aberta contestação sobre lançamento de fatura, o valor contestado é suspenso da cobrança até a decisão, não compõe o valor mínimo e não gera encargos de rotativo. Sendo improcedente, retorna à fatura seguinte com os encargos devidos.",
  "consultations": "Consultar a fatura em que o lançamento foi incluído e sua situação.",
  "complexity": "Alta",
  "member": 4
}, {
  "feature": "F12",
  "number": 12,
  "title": "Notificação e histórico",
  "description": "O cliente é notificado na abertura, na mudança de estado e no encerramento da ocorrência, e pode consultar o histórico completo de suas contestações com os respectivos protocolos.",
  "consultations": "Consultar as ocorrências do cliente.",
  "complexity": "Baixa",
  "member": 4
}, {
  "feature": "F13a",
  "number": 1,
  "title": "Aplicação mínima e produto disponível",
  "description": "A aplicação exige valor mínimo definido por produto e só é aceita em produto disponível na data da operação. O valor aplicado debita imediatamente o saldo disponível da conta.",
  "consultations": "Consultar o valor mínimo e a disponibilidade do produto.",
  "complexity": "Baixa",
  "member": 1
}, {
  "feature": "F13a",
  "number": 2,
  "title": "Tipos de rentabilidade em renda fixa",
  "description": "Cada certificado de depósito bancário contratado tem rentabilidade prefixada, pós-fixada como percentual do CDI, ou híbrida indexada ao IPCA mais taxa fixa, definida no momento da aplicação e mantida durante toda a vigência.",
  "consultations": "Consultar o indexador vigente aplicável ao produto.",
  "complexity": "Média",
  "member": 1
}, {
  "feature": "F13a",
  "number": 3,
  "title": "Apuração diária do rendimento",
  "description": "O rendimento da aplicação em renda fixa é apurado diariamente sobre o saldo aplicado, considerando apenas dias úteis nos produtos pós-fixados indexados ao CDI, e incorporado ao saldo da posição.",
  "consultations": "Consultar o saldo aplicado e o indexador do dia.",
  "complexity": "Alta",
  "member": 1
}, {
  "feature": "F13a",
  "number": 4,
  "title": "Liquidez diária ou com carência",
  "description": "Cada produto define sua liquidez: diária, permitindo resgate a qualquer momento, ou com carência, que impede resgate antes de uma data mínima fixada no momento da aplicação.",
  "consultations": "Consultar a data de carência da aplicação.",
  "complexity": "Média",
  "member": 1
}, {
  "feature": "F13a",
  "number": 5,
  "title": "Imposto de renda regressivo no resgate",
  "description": "No resgate de produto de renda fixa, incide imposto de renda sobre o rendimento apurado, com alíquota regressiva conforme o prazo decorrido desde a aplicação: 22,5% até 180 dias, 20% de 181 a 360 dias, 17,5% de 361 a 720 dias e 15% acima de 720 dias. O imposto é retido no próprio resgate, conforme o Anexo A.9.",
  "consultations": "Consultar a data da aplicação e o rendimento apurado até o resgate.",
  "complexity": "Alta",
  "member": 1
}, {
  "feature": "F13a",
  "number": 6,
  "title": "IOF regressivo nos primeiros 30 dias",
  "description": "Resgate realizado antes de 30 dias corridos da aplicação sofre incidência de IOF sobre o rendimento, seguindo tabela regressiva que se reduz a cada dia decorrido e se anula a partir do trigésimo dia, conforme o Anexo A.9.",
  "consultations": "Consultar o número de dias corridos entre a aplicação e o resgate.",
  "complexity": "Alta",
  "member": 1
}, {
  "feature": "F13a",
  "number": 7,
  "title": "Resgate total ou parcial",
  "description": "O cliente pode resgatar o valor total ou parcial de uma aplicação. No resgate parcial, permanece aplicado o saldo remanescente, preservando a data de aplicação original para fins de contagem de prazo.",
  "consultations": "Consultar o saldo disponível para resgate na aplicação.",
  "complexity": "Média",
  "member": 1
}, {
  "feature": "F13a",
  "number": 8,
  "title": "Negociação de ações e ativos de renda variável",
  "description": "Ações e outros ativos de renda variável são negociados pela cotação de mercado vigente no momento da ordem. A compra debita o saldo disponível pelo valor da cotação multiplicado pela quantidade, mais taxa de corretagem; a venda credita o valor apurado, descontada a corretagem.",
  "consultations": "Consultar a cotação vigente do ativo.",
  "complexity": "Alta",
  "member": 1
}, {
  "feature": "F13a",
  "number": 9,
  "title": "Ausência de garantia de rentabilidade em renda variável",
  "description": "Diferentemente da renda fixa, não há rentabilidade garantida em ações: o resultado da posição decorre da variação entre o preço médio de compra e a cotação de mercado no momento da consulta ou da venda.",
  "consultations": "Consultar o preço médio de compra e a cotação atual do ativo.",
  "complexity": "Média",
  "member": 1
}, {
  "feature": "F13a",
  "number": 10,
  "title": "Consolidação da posição do cliente",
  "description": "O sistema mantém a posição consolidada de cada cliente, com valor aplicado, rendimento apurado e valor atual por produto, atualizada a cada aplicação, resgate ou apuração de rendimento.",
  "consultations": "Consultar todas as aplicações ativas do cliente.",
  "complexity": "Média",
  "member": 1
}, {
  "feature": "F13a",
  "number": 11,
  "title": "Simulação prévia ao resgate",
  "description": "Antes de confirmar o resgate, o sistema apresenta ao cliente o valor bruto, o imposto de renda e o IOF incidentes, e o valor líquido a receber.",
  "consultations": "Nenhuma (cálculo determinístico sobre os dados da aplicação).",
  "complexity": "Média",
  "member": 1
}, {
  "feature": "F13b",
  "number": 1,
  "title": "Criação da caixinha",
  "description": "A criação exige nome e valor de meta maior que zero, admitindo data-alvo opcional. O nome não pode se repetir entre as caixinhas do mesmo cliente.",
  "consultations": "Consultar as caixinhas já existentes do cliente.",
  "complexity": "Baixa",
  "member": 6
}, {
  "feature": "F13b",
  "number": 2,
  "title": "Limite de caixinhas por conta",
  "description": "Cada conta pode ter no máximo o número de caixinhas ativas definido pelo sistema.",
  "consultations": "Consultar a quantidade de caixinhas ativas da conta.",
  "complexity": "Baixa",
  "member": 6
}, {
  "feature": "F13b",
  "number": 3,
  "title": "Depósito debita o saldo disponível",
  "description": "O depósito na caixinha debita o saldo disponível da conta e credita o saldo da caixinha, em operação atômica, exigindo saldo disponível suficiente.",
  "consultations": "Consultar o saldo disponível da conta.",
  "complexity": "Média",
  "member": 6
}, {
  "feature": "F13b",
  "number": 4,
  "title": "Valor da caixinha não compõe o saldo disponível",
  "description": "O valor guardado em caixinhas não compõe o saldo disponível para transferências, pagamentos ou saques, e é exibido separadamente na composição do saldo.",
  "consultations": "Consultar o total alocado em caixinhas da conta.",
  "complexity": "Média",
  "member": 6
}, {
  "feature": "F13b",
  "number": 5,
  "title": "Resgate para a conta de origem",
  "description": "O resgate, total ou parcial, credita o valor de volta no saldo disponível da mesma conta, nunca em conta de terceiro.",
  "consultations": "Consultar o saldo da caixinha.",
  "complexity": "Média",
  "member": 6
}, {
  "feature": "F13b",
  "number": 6,
  "title": "Rendimento total na data de aniversário da caixinha",
  "description": "A caixinha tem uma data de aniversário mensal, igual ao dia do mês em que foi criada; caixinhas criadas nos dias 29, 30 e 31 têm aniversário no dia 1º do mês seguinte. Na data de aniversário, o sistema apura o rendimento total do período e o credita integralmente no saldo da caixinha, em um único lançamento. Não há crédito de rendimento fora da data de aniversário.",
  "consultations": "Consultar o saldo da caixinha ao longo do período e a taxa de rendimento vigente.",
  "complexity": "Média",
  "member": 6
}, {
  "feature": "F13b",
  "number": 7,
  "title": "Depósitos e resgates a qualquer momento",
  "description": "O cliente pode depositar e resgatar, total ou parcialmente, a qualquer momento, inclusive antes da data de aniversário, limitado ao saldo da caixinha no caso do resgate. A movimentação antecipada não impede o recebimento do rendimento total na data de aniversário.",
  "consultations": "Consultar o saldo da caixinha e o saldo disponível da conta.",
  "complexity": "Média",
  "member": 6
}, {
  "feature": "F13b",
  "number": 8,
  "title": "Acompanhamento e conclusão da meta",
  "description": "O sistema calcula e exibe o percentual alcançado da meta. Atingida a meta, a caixinha é sinalizada como concluída, sem impedir novos depósitos ou resgates.",
  "consultations": "Consultar o saldo da caixinha e o valor da meta.",
  "complexity": "Baixa",
  "member": 6
}, {
  "feature": "F13b",
  "number": 9,
  "title": "Encerramento da caixinha",
  "description": "O encerramento resgata automaticamente todo o saldo para a conta e marca a caixinha como encerrada, preservando o histórico de depósitos, resgates e rendimentos.",
  "consultations": "Consultar o saldo da caixinha.",
  "complexity": "Baixa",
  "member": 6
}, {
  "feature": "F13b",
  "number": 10,
  "title": "Extrato da caixinha",
  "description": "O cliente pode consultar o extrato de cada caixinha, com todas as entradas (depósitos), saídas (resgates) e os créditos de rendimento lançados na data de aniversário, em ordem cronológica, exibindo data, tipo, valor e saldo da caixinha após cada movimentação. O extrato admite filtro por período e por tipo de movimentação e é preservado mesmo após o encerramento da caixinha.",
  "consultations": "Consultar os depósitos, resgates e rendimentos da caixinha.",
  "complexity": "Baixa",
  "member": 6
}, {
  "feature": "F14",
  "number": 1,
  "title": "Filtros válidos de período",
  "description": "A data inicial não pode ser posterior à data final. Informada uma das datas, a outra passa a ser obrigatória, e ambas seguem o formato de data definido no Anexo A.7.",
  "consultations": "Nenhuma.",
  "complexity": "Baixa",
  "member": 5
}, {
  "feature": "F14",
  "number": 2,
  "title": "Período máximo de exportação",
  "description": "O intervalo entre data inicial e final não pode ultrapassar 12 meses, e não é possível exportar transações anteriores a 12 meses da data corrente.",
  "consultations": "Nenhuma (cálculo a partir das datas informadas).",
  "complexity": "Baixa",
  "member": 5
}, {
  "feature": "F14",
  "number": 3,
  "title": "Filtros de tipo e natureza",
  "description": "A exportação pode ser restrita a um ou mais tipos de transação e à natureza de crédito ou de débito, conforme as listas do Anexo A.5, mantendo no arquivo exatamente os mesmos filtros aplicados na visualização.",
  "consultations": "Consultar as transações da conta que atendem aos filtros informados.",
  "complexity": "Baixa",
  "member": 5
}, {
  "feature": "F14",
  "number": 4,
  "title": "Registro da solicitação",
  "description": "Toda solicitação de exportação ou de segunda via é registrada com protocolo, data e hora, filtros aplicados e formato solicitado, ficando disponível no histórico do cliente.",
  "consultations": "Nenhuma.",
  "complexity": "Baixa",
  "member": 5
}, {
  "feature": "F14",
  "number": 5,
  "title": "Formato e conteúdo do arquivo",
  "description": "O arquivo é gerado em PDF ou CSV, contendo o período exportado, a identificação da conta e o total de lançamentos, além dos próprios lançamentos.",
  "consultations": "Consultar as transações filtradas para composição do arquivo.",
  "complexity": "Média",
  "member": 5
}, {
  "feature": "F14",
  "number": 6,
  "title": "Mascaramento de dados de terceiros",
  "description": "No arquivo exportado, o documento da contraparte é exibido de forma parcialmente mascarada e o número da conta da contraparte é truncado.",
  "consultations": "Nenhuma.",
  "complexity": "Baixa",
  "member": 5
}, {
  "feature": "F14",
  "number": 7,
  "title": "Segunda via não altera a operação original",
  "description": "A reemissão de comprovante gera novo arquivo com os mesmos dados da operação original, identificado como segunda via, sem qualquer alteração na transação, que permanece imutável.",
  "consultations": "Consultar a transação original pelo seu identificador.",
  "complexity": "Baixa",
  "member": 5
}, {
  "feature": "F14",
  "number": 8,
  "title": "Disponibilidade do arquivo",
  "description": "O arquivo gerado fica disponível para o cliente pelo prazo definido pelo sistema, após o qual é descartado, exigindo nova solicitação.",
  "consultations": "Consultar a data de geração do arquivo.",
  "complexity": "Baixa",
  "member": 5
}];
