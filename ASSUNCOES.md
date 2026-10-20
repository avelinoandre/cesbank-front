# Assunções e decisões do protótipo CESBANK

Este documento registra interpretações das seis referências e parâmetros fictícios necessários para torná-las executáveis. O protótipo é local, sem autenticação real, backend, conexão bancária, consulta cadastral externa ou envio de mensagens. Os documentos são fontes de requisitos; o pedido desta conversa define o entregável.

## Unificação dos documentos

| Regra ou conflito | Decisão implementada |
| --- | --- |
| Número 13 duplicado | F13a identifica investimentos; F13b identifica caixinhas. |
| Caixinhas aparecem no documento do integrante 6, mas o pedido as aloca ao integrante 1 | Código em integrante1/caixinha.js; rastreabilidade identifica a fonte integrante 6. |
| F1 sem documento específico | Dez regras derivadas abaixo. |
| A.3 contém estatísticas diferentes entre anexos | Resposta reúne consultasNoPeriodo, reivindicacoesAbertas e contestacoes. |
| A.6 contém erros extras em diferentes documentos | Catálogo único em core/js/errors.js, incluindo investimentos e ChaveBloqueadaPorReivindicacao. |
| A.8 exige fator de quatro dígitos com base 07/10/1997, incompatível com 2026 | Relógio inicial em 03/02/2025 às 10h de Brasília. Não se introduz uma nova base de fator ausente dos documentos. O fator 9999 corresponde a 21/02/2025. |
| A.8 mistura posições do código de barras e da linha reorganizada | Código de 44 posições é reorganizado em linha de 47; validam-se três módulos 10 e um módulo 11 independente. Valor vem das dez posições monetárias do código. |
| F2 saldo disponível cita investimentos, e F13b exclui caixinhas | Composição única: total menos bloqueios, posições de investimentos e caixinhas. |

## Núcleo e representação

1. Valores são números inteiros seguros de centavos. Multiplicações, divisões, Price e CET usam BigInt e escala racional; o resultado monetário volta a inteiro com arredondamento de meio centavo para longe de zero. Valores fora da faixa exata são recusados. Percentuais são pontos-base inteiros, ou milionésimos quando explicitado.
2. Taxas são políticas fictícias para avaliação acadêmica. Não representam legislação, oferta comercial ou cotação atual. Valores e datas do banco simulado vêm da base local.
3. O saldo total inclui o patrimônio custodiado em investimentos e caixinhas. Aplicar/depositar reserva patrimônio e reduz o disponível, sem subtrair duas vezes o total. Corretagem/tributos reduzem o total; rendimentos e marcação a mercado alteram total e posição juntos. Lançamentos de alocação são identificados internamente por allocation.
4. Atomicidade é simulada por clone do estado, validação das invariantes e uma única gravação no localStorage. Exceções antes do commit descartam todas as alterações. O cenário de falha após débito registra o débito e a reversão BE08 no mesmo commit, com patrimônio final restaurado e nenhum crédito no destino.
5. Não há concorrência real entre múltiplos computadores. Use uma aba do protótipo para a avaliação. O armazenamento pertence ao navegador e à origem usada. Se estiver indisponível ou sem quota, há aviso explícito e a sessão funciona em memória; nesse caso o backup não sobrevive ao fechamento.
6. O relógio avança monotonamente em passos de no máximo uma hora, executando cada processador na ordem de cadastro. Isso permite observar eventos intermediários mesmo ao avançar muitos dias. Máximo de 800 dias por avanço; para voltar use reinicialização. Datas/hora persistidas são UTC sem fração de segundo; a interface usa Brasília, UTC-03 fixo.
7. Calendário: segunda a sexta, sem feriados cadastrados. Dias de vencimento de empréstimos e faturas mantêm a data contratada; a compensação por dia útil é aplicada a agendamentos e boletos, conforme suas RNs.
8. Identificadores de requisição e chaves EVP são UUID v4. Operações financeiras usam identificadores E/D + instituição 12345678 + AAAAMMDDHHMM UTC + onze caracteres alfanuméricos. A reutilização de uma requisição retorna o resultado original, sem novo débito.
9. Operações concluídas preservam snapshots de nomes, documento mascarado, conta truncada e descrição; editar contatos/favoritos não reescreve comprovantes. Alterações de estado preservam trilha com data/hora e responsável.
10. Perfis selecionáveis substituem login. Analista, beneficiário e cliente têm verificações locais de papel. A Loja Exemplo pode ser usada como beneficiário ou como cliente empresarial para testar CNPJ.

## Limites e qualificação

Renda mensalizada menor que R$ 4.000,00: BASICA; a partir de R$ 4.000,00: MEDIA; a partir de R$ 7.000,00: ALTA. Os novos cadastros recebem 50% dos tetos abaixo. Os clientes preexistentes têm limites já configurados, exibidos na tela.

| Faixa | Diário | Por transação | Noturno | Saque |
| --- | ---: | ---: | ---: | ---: |
| BASICA | R$ 5.000,00 | R$ 2.000,00 | R$ 500,00 | R$ 1.000,00 |
| MEDIA | R$ 20.000,00 | R$ 10.000,00 | R$ 2.000,00 | R$ 3.000,00 |
| ALTA | R$ 50.000,00 | R$ 20.000,00 | R$ 3.000,00 | R$ 5.000,00 |

- F7 RN4: aumento em 24 horas; redução imediata após confirmação. Pedido novo do mesmo tipo cancela aumento anterior ainda pendente. Ao entrar em vigor, a relação noturno menor ou igual a por transação é revalidada; incompatibilidades ficam canceladas no histórico.
- F7 RN6 e F6 RN5: códigos de seis dígitos, de uso único e válidos por cinco minutos. O código é mostrado como simulação de SMS/e-mail e está vinculado ao pedido/contato/cliente. Não é enviado a ninguém.
- Transferências e boletos concorrem pelo limite diário. Por decisão do núcleo integrado solicitado, os pagamentos também respeitam o teto por operação e o teto noturno. Não se consome limite ao criar um agendamento, aplicar recursos ou guardar em caixinha.

## Boletos e recorrências

- Liquidação de boleto em dia útil antes das 17h. Às 17h ou depois, e em dias não úteis, informa-se a próxima data útil antes da confirmação. A execução usa encargos recalculados nessa data.
- Pagamento de boleto vencido aceito por até 90 dias corridos. Multa de 2%, mora simples de 0,033% ao dia e desconto de 1% quando liquidado antes do vencimento; condições ficam associadas a cada boleto.
- A consulta bancária é representada pela lista local de boletos registrados. Um código válido desconhecido não inventa beneficiário: informa que o boleto não está na base fictícia. Os boletos iniciais têm nominal e vencimento codificados, sem campos editáveis para esses dados.
- Até três tentativas da ocorrência, iniciando às 10h e repetindo após duas horas, todas no mesmo dia. Para boletos, só SaldoInsuficiente gera nova tentativa automática; outras falhas são definitivas. Uma falha financeira com estorno mantém a trilha e encerra a ocorrência, sem duplicar o débito.
- Recorrências aceitam as sete frequências do anexo; até 120 ocorrências são materializadas por cadastro para manter a demonstração limitada. Em recorrência por data-limite, também se usa esse teto de materialização. Meses sem o dia original usam o último dia do mês, preservando a âncora original nas ocorrências seguintes.
- F4 RN6/RN7: somente ocorrências PENDENTES podem ser alteradas. FALHADA/CANCELADA são resultados finais; um novo agendamento é necessário para retomada. Cancelamento individual só até a véspera; encerramento da série cancela suas pendentes e preserva as executadas.
- Recurso do beneficiário em até cinco dias corridos da rejeição, com justificativa e ao menos um anexo fictício. Até 2 MB por arquivo e 4 MB por recurso. Conteúdo e metadados dos anexos ficam no estado local, sem upload externo. O recurso não altera vencimento.
- Reconhecer o boleto após consultar evidências libera a confirmação comum. A rejeição é efetivamente encerrada quando o pagamento se confirma; manter rejeição impede novo pagamento e encerra a discussão daquela rejeição.

## Abertura de conta e dados

- F5 RN5: consulta simulada a três combinações CEP/município/IBGE/UF, mostradas no assistente. As demais UFs oficiais são reconhecidas, mas a correspondência deve existir na tabela fictícia. Não se consulta serviço externo.
- F5 RN7: identidade e comprovante de endereço são documentos obrigatórios. A validade, o número, o CPF vinculado e a confirmação de conferência são metadados explícitos de validação simulada; não há OCR, leitura governamental ou verificação de autenticidade dos arquivos. A própria tela nomeia a conferência como simulada.
- Ocupações: EMPREGADO, AUTONOMO, EMPRESARIO, APOSENTADO, ESTUDANTE. Renda DIARIA x30; SEMANAL x52/12; QUINZENAL x2; BIMESTRAL /2; TRIMESTRAL /3; SEMESTRAL /6; ANUAL /12. MENSAL e OUTROS usam o valor informado como mensal equivalente.
- Termos e privacidade: versão fictícia 2026.02, aceite conjunto explícito com data/hora e origem PROTOTIPO_LOCAL. Uma recusa de compliance gera decisão final com motivo; não reabre o pedido recusado. Erros de preenchimento retornam à etapa para correção e não são decisões finais de cadastro.
- Conta conjunta guarda o subtipo solicitado, sem inventar um fluxo de inclusão de cotitulares ausente dos documentos. Conta salário só existe na enumeração operacional e não é oferecida na abertura, conforme F5 RN11.
- Encerramento exige total zero e ausência de empréstimos ativos/em análise do titular e de saldo utilizado no cartão. Cancela pendentes, cancela cartão e inativa Pix por ACCOUNT_CLOSURE. Históricos são preservados.
- F6: senha mínima de oito caracteres, letras e números, sem sequências crescentes/decrescentes de três caracteres, três repetições, CPF ou combinações relevantes de nascimento. São vedadas a atual e as quatro anteriores. A auditoria guarda o anterior como ********.
- A senha é resumida localmente com SHA-256 e sal aleatório por credencial; o hash e sal são mostrados para validação. Isso não torna o protótipo um mecanismo de autenticação de produção. Senha inicial dos perfis: Cesbank9!.
- CPF, nascimento e nome civil não têm edição direta. Uma correção registra nova solicitação e documentos, sem efetivar alteração automática. Troca de contato principal não transfere automaticamente uma chave Pix já existente.

## Empréstimo

- F9 RN1/RN7: de R$ 100,00 a R$ 50.000,00; prazo inteiro de 2 a 60 meses; simulação válida por 30 minutos. Taxas mensais: ALTA 2%, MEDIA 2,5%, BASICA 3%.
- F9 RN2: Price com centavos inteiros; as parcelas têm valor fixo e a última absorve a diferença de arredondamento para amortizar exatamente o principal financiado. Cronograma guarda juros, amortização e saldo.
- F9 RN3/RN4: IOF fictício de 0,38% fixo e 0,0082% diário, com prazo diário limitado a 365 dias. A parcela diária é ponderada pelas amortizações do cronograma-base. Tarifa de R$ 25,00. IOF e tarifa são financiados, enquanto o solicitado é liberado. CET é taxa interna de retorno das parcelas contra o valor liberado, resolvida com escala racional e convertida em anual por capitalização de doze meses.
- F9 RN5: capacidade de crédito é o menor entre R$ 50.000,00 e seis rendas mensais mais metade dos créditos da conta nos últimos 90 dias. Restrições, contratos ou faturas em atraso recusam; valor acima da capacidade pode gerar oferta menor, que precisa de revisão e aceite explícitos. Toda decisão registra critérios e motivo.
- F9 RN6: todas as parcelas dos contratos ativos somadas à proposta devem caber em 30% da renda. O aceite revalida a soma e a titularidade da conta de liberação.
- Primeira parcela após 30 dias, seguintes no mesmo dia mensal ajustado ao fim do mês. Débito automático ocorre na data pelo relógio; sem saldo fica EM_ATRASO, multa de 2% e mora simples de 1% ao mês proporcional a dias/30. Não se fazem tentativas de débito que gerem saldo negativo.
- Quitação total soma principal remanescente, juros proporcionais já incorridos e encargos, excluindo juros futuros. Na parcial, paga-se primeiro juros incorridos/encargos e reamortiza-se o principal, reduzindo prestação ou o menor prazo que mantenha prestação até a anterior. Há também antecipação individual com desconto dos juros não incorridos.

## Cartões e faturas

- F10: mínimo de 30 dias de relacionamento. Entradas/saídas e média de saldo são consultadas em janela de 90 dias; qualificação e restrições completam a análise. O limite é arredondado para faixas de R$ 100,00 e limitado a R$ 5.000,00 (BASICA), R$ 10.000,00 (MEDIA) ou R$ 20.000,00 (ALTA).
- Cálculo do limite: duas rendas + 25% das entradas + 25% do saldo médio positivo − 10% das saídas; mínimo de R$ 100,00 se elegível. A tela mostra os dados usados.
- Senha do cartão: quatro dígitos, todos diferentes, sem sequência crescente/decrescente nem data de nascimento. Cartões dos cenários usam 5962. Aproximação acima de R$ 200,00 exige senha; compra presencial também exige senha no protótipo.
- Cartão virtual tem número próprio, limite compartilhado e descarte individual, exclusivamente NAO_PRESENCIAL. Autorização reserva o total de todas as parcelas, inclusive encargos opcionais; expira em 48 horas sem confirmação. Bloqueio/cancelamento impedem novas autorizações, mas não apagam as já emitidas.
- Validade de 36 meses; renovação 30 dias antes se ativo e sem fatura em atraso. Aumento de limite depende de nova análise; redução imediata não pode ficar abaixo do utilizado.
- F11: fechamento até o fim do dia 25; processamento a partir do dia 26; vencimento no dia 10 seguinte, garantindo pelo menos sete dias entre fechamento e vencimento. Até 12 parcelas. Taxa opcional de parcelamento entre zero e 5% ao mês, informada na compra; sem taxa, parcelas dividem os centavos exatamente.
- Mínimo de 15% do saldo exigível, excluindo cobranças suspensas. Pagamentos em conta são liquidados atomicamente; só então recompõem o limite. Multa de 2%, mora de 1% ao mês proporcional e rotativo de 12% ao mês proporcional aos dias entre vencimento e próximo fechamento.
- Saldo transportado deixa de ser pagável na fatura de origem e passa à seguinte com vínculo. O histórico da origem preserva o atraso, mas não rebloqueia um cartão regularizado se não resta débito naquela fatura. Encargos novos também comprometem limite.
- F11 RN10: a antecipação paga o principal da parcela futura e desconta seus juros não incorridos; sem encargos, o desconto é zero. Não permite antecipar item suspenso por contestação.
- Créditos de estorno aparecem como lançamentos negativos na fatura. Devolução de compra já paga devolve ao saldo de conta a parcela efetivamente paga, sem liberar duas vezes o limite.

## Contestações e devoluções

- F12 RN3: prazo máximo de 80 dias corridos. A referência deve pertencer ao cliente. Ocorrências não encerradas impedem uma segunda contestação do mesmo item/transação.
- F12 RN5: neste modelo sem saldo negativo, exige-se saldo disponível integral no destinatário para constituir o bloqueio cautelar solicitado. Se não houver, informa-se SaldoInsuficiente e não se cria bloqueio parcial silencioso. Na procedência o bloqueio permanece vinculado até a execução da devolução para garantir a transferência; na improcedência é liberado na decisão.
- F12 RN6: até dez dias úteis, com uma prorrogação justificada de dez dias úteis. Estouro de prazo gera aviso e fica visível ao atendimento; não se inventa decisão automática de mérito ausente dos documentos.
- F12 RN9: a decisão procedente solicita devolução imediatamente, portanto dentro das 72h permitidas. MD06/FR01 são executadas após seis horas; BE08 no máximo em 48h. Falta de saldo devolvedor fica explícita como falha operacional pendente, com nova tentativa pelo processador e aviso.
- Transação de devolução nova, vinculada à original, com motivo MD06/BE08/FR01 e valor total ou parcial. A original passa a DEVOLVIDA quando integralmente devolvida. Falhas de execução usam BE08 e não exigem contestação.
- F12 RN11: suspendem-se cobrança, mínimo e rotativo do item, inclusive removendo sua parcela de transportes já feitos. Na improcedência, somente a parcela ainda não paga retorna ao ciclo seguinte, com encargos devidos. Na procedência, registra-se estorno; parcela já paga vira crédito em conta.
- Notificações PUSH locais são persistidas em central única; EMAIL/SMS são canais enumerados e simulados, sem envio externo.

## Investimentos e caixinhas

- F13a: produtos CDB/FUNDO usam as regras de renda fixa; não se inventa tributação de ações ausente do documento. Prefixado divide taxa nominal anual por 365; CDI usa 252 dias úteis e percentual contratado; híbrido compõe IPCA vigente com adicional contratado e divide por 365. Arredondamento diário em centavos. A porcentagem CDI e o adicional ficam imutáveis na aplicação, embora o índice diário consultado possa variar.
- IR: 22,5% até 180 dias; 20% até 360; 17,5% até 720; 15% depois. IOF sobre rendimento: dia zero 100%; dias 1–30: 96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3, 0%. IR calculado sobre rendimento após IOF; principal nunca tributado. No parcial, principal e rendimento são alocados proporcionalmente, mantendo a data original.
- Cotação e índices são locais e editáveis pelo analista. Corretagem fictícia de R$ 4,90 por ordem; ações negociadas em quantidades inteiras positivas, máximo de um milhão por ordem. A posição usa marcação a mercado, podendo apresentar perda. Não há promessa de rentabilidade.
- Os dois cadastros administrativos são distintos no modelo, mas ficam em uma única tela do analista: categorias de investimento (CDB, fundo, ação) e produtos oferecidos com suas condições (prefixado, percentual do CDI, IPCA mais taxa fixa ou cotação). Ambos podem ser criados, consultados, editados e removidos logicamente, respeitando os vínculos com produtos e posições ativas. Caixinhas permanecem fora desse cadastro. A aplicação já contratada pelo cliente é uma posição para consulta e resgate; suas condições financeiras são preservadas quando o catálogo é editado.
- F13b: até cinco caixinhas ativas; nome único por cliente mesmo depois do encerramento. Taxa fictícia de 0,0165% ao dia, apurada pelo saldo e tempo decorrido em segundos. Mantém-se acumulador racional sem crédito antecipado, mesmo após resgate total antes do aniversário. No aniversário é feito um único crédito integral arredondado.
- Caixinhas dos dias 29/30/31 usam sempre aniversário no dia 1º do mês seguinte; demais mantêm o dia de criação. A sinalização de meta pode voltar a ATIVA se o saldo cair abaixo da meta, sem bloquear movimentos.
- Encerrar resgata todo o saldo já creditado e torna a caixinha somente leitura. Como o documento não define liquidação de rendimento ainda não creditado no encerramento, o encerramento interrompe a apuração e não antecipa rendimento fora do aniversário. Resgatar sem encerrar preserva o rendimento acumulado para o aniversário.

## Exportação e limites de verificação

- F14: até 12 meses de intervalo e sem movimentos anteriores aos últimos 12 meses. Filtros de tipo/natureza são idênticos na tela e nos arquivos. Protocolo, horário, filtros, formato e conteúdo ficam no histórico local.
- Backup do arquivo disponível por 30 dias; após esse prazo o conteúdo é descartado pelo relógio, preservando a solicitação e exigindo novo arquivo. CSV UTF-8 com BOM e delimitador ponto e vírgula. PDF 1.4 paginado gerado no navegador sem bibliotecas, com fonte Courier e transliteração de acentos para ASCII; a interface e o CSV mantêm português com acentos.
- A prévia foi conferida em navegador via servidor local de desenvolvimento, que não integra a entrega. O navegador de teste bloqueia URLs file:, portanto o duplo clique não foi executado automaticamente. Foram verificados scripts clássicos, caminhos relativos, ausência de fetch/imports/dependências e arquivos existentes para permitir a abertura local conforme o pedido.
- Nenhuma RN foi retirada do catálogo ou deixada como placeholder. As decisões de escopo e bordas operacionais acima são explícitas para revisão do avaliador; os testes automáticos não substituem os passos de interface da matriz.

## F1 regras derivadas completas

### F1 RN1 Formato e normalização de chaves

- Descrição: Validar CPF, CNPJ, PHONE, EMAIL e EVP pelo A.1; e-mail minúsculo com até 77 caracteres; EVP é UUID v4 gerado pelo sistema.
- Consultas: Nenhuma.
- Complexidade: Baixa.
- Origem: Anexo A.1.

### F1 RN2 Requisição de cadastro e idempotência

- Descrição: Registrar chave, conta e titular, motivo enumerado e idRequisicao UUID v4 conforme A.2; reenvio devolve resultado original sem nova chave.
- Consultas: Requisições já processadas.
- Complexidade: Média.
- Origem: A.2, A.5 e RequisicaoDuplicada.

### F1 RN3 Unicidade e limite de chaves

- Descrição: Uma chave não pode ter dois vínculos ativos; limitar a 5 chaves ativas por conta.
- Consultas: Chaves ativas do sistema e da conta.
- Complexidade: Média.
- Origem: ChaveJaExiste e LimiteDeChavesExcedido do A.6.

### F1 RN4 Titularidade da chave

- Descrição: CPF/CNPJ devem corresponder ao titular; telefone/e-mail devem ser os contatos principais confirmados.
- Consultas: Cadastro e contatos confirmados do titular.
- Complexidade: Média.
- Origem: ChaveDeOutroTitular; F6 RN5.

### F1 RN5 Consulta de chave ativa e restrição de consultas

- Descrição: Consultar somente vínculo ativo e conta ativa; limitar a 10 consultas por cliente por dia simulado.
- Consultas: Chaves, contas e contador diário de consultas.
- Complexidade: Alta.
- Origem: A.3; ChaveNaoEncontrada e ConsultasExcedidas.

### F1 RN6 Reivindicação de posse e portabilidade

- Descrição: OWNERSHIP exige prova de posse simulada do e-mail/telefone; PORTABILITY exige mesmo titular e outra conta; uma reivindicação aberta por chave.
- Consultas: Vínculo atual, titular e reivindicações.
- Complexidade: Alta.
- Origem: Anexo A.5.

### F1 RN7 Motivos e inativação de chaves

- Descrição: Usar USER_REQUESTED, ACCOUNT_CLOSURE, BRANCH_TRANSFER, RECONCILIATION ou FRAUD; exclusão lógica preserva histórico; encerramento de conta inativa suas chaves automaticamente.
- Consultas: Chaves e conta.
- Complexidade: Média.
- Origem: A.5; integração F5.

### F1 RN8 Bloqueio durante reivindicação

- Descrição: Bloquear resolução e exclusão enquanto reivindicação não estiver concluída ou cancelada.
- Consultas: Reivindicações abertas da chave.
- Complexidade: Alta.
- Origem: ChaveBloqueadaPorReivindicacao; F2 RN1; F8 RN3.

### F1 RN9 Resposta de consulta e mascaramento

- Descrição: Responder A.3 com data, chave ativa, instituição/agência/conta/tipo, nome e documento mascarados, consultasNoPeriodo, reivindicacoesAbertas e contestacoes.
- Consultas: Cadastro do titular, vínculo, contadores e contestações.
- Complexidade: Média.
- Origem: A.3 unificado; F2 RN4.

### F1 RN10 Ciclo auditável da reivindicação

- Descrição: Permitir ABERTA → AGUARDANDO_RESOLUCAO → CONFIRMADA → CONCLUIDA, ou CANCELADA antes da conclusão; conclusão transfere vínculo e libera chave; registrar data e responsável.
- Consultas: Situação atual e conta receptora.
- Complexidade: Alta.
- Origem: Enumerações A.5 e integridade do vínculo.
