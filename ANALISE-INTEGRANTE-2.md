# Análise e adequação — Integrante 2

Repositório: https://github.com/avelinoandre/cesbank-front.git
Data: 20/10/2026.
Referência: Atividade_2026_02_-_Integrante_2_com_prints.pdf, 28 páginas; texto extraído e páginas 1–24 renderizadas, com inspeção ampliada dos prints de cadastro, simulação e quitação.

## Resultado

Foram corrigidas divergências no fluxo de abertura de conta (F5) e contratação de empréstimo (F9). A base já implementava as regras de negócio em serviços locais; a principal diferença estava na organização das telas e na revisão antes das operações. As alterações estão na cópia local cesbank-front e não foram enviadas ao GitHub.

| Referência no PDF | Divergência encontrada | Adequação |
| --- | --- | --- |
| Páginas 2–7: cinco etapas de cadastro | Contatos em etapa separada; qualificação e termos juntos no final | Dados pessoais → endereço e contatos → qualificação e conta → documentos → termos e envio |
| Páginas 6–7: confira seus dados | Ausência de resumo antes do consentimento | Resumo com nomes, CPF, nascimento, endereço, contatos, renda, conta e documentos |
| Página 8: resultado do cadastro | Resultado genérico e dados principalmente em JSON | Resultado explícito de aprovação/recusa, motivo, nova solicitação e resumo de conta/limites |
| Páginas 12–13: simulação e parcelas | Resultado restrito a modal, sem acesso ao cronograma prévio | Resultado com URL própria, custos, condições, validade e modal Ver parcelas |
| Página 14: proposta recusada | Misturada com todos os contratos | Detalhe individual com motivo, código e retorno para nova simulação |
| Páginas 16–19: contrato e cronograma | Todos os contratos completos na mesma tela | Lista → detalhe individual → cronograma e pagamentos |
| Páginas 20–23: quitação | Formulário embutido e confirmação genérica; parcela debitada sem revisão | Modal de cálculo e confirmação, total/parcial, redução de parcela/prazo e antecipação de várias parcelas |
| Página 24: meus contratos | Sem lista resumida de navegação | Tabela resumida com acesso a cada contrato |

A prévia da quitação usa uma cópia do estado. Não altera saldos, contratos nem armazenamento. Antes de confirmar, valida se o contrato e o relógio continuam iguais aos da revisão. As confirmações verificam efetivação antes de exibir sucesso. A antecipação de várias parcelas é executada dentro de uma transação local única.

Os cenários F5 foram ajustados à nova sequência. Os cenários F9 de contratos agora abrem diretamente o detalhe correspondente.

## Verificação

Comando, a partir da pasta do repositório: `node tests/integrante2.cjs`.

- 89 de 89 testes originais passaram.
- Regressões adicionais passaram: cinco etapas do cadastro, campos agrupados, revisão, aprovação, recusa, ausência de consentimento, simulação, cronograma prévio, lista/detalhe, aceite, prévias sem débito, antecipação de três parcelas, quitação total, expiração e bloqueio de aceite de proposta recusada.
- No navegador: cadastro até qualificação, simulação → aprovação → aceite → contrato ativo → antecipação de três parcelas; saldo atualizado e mensagem de sucesso conferidos.
- Inspeção visual no navegador com largura reduzida: conteúdo legível, resumo de custos empilhado e navegação adaptada. Captura anexada.
- Verificação de sintaxe dos JavaScripts alterados e de whitespace do diff.

Os testes de regressão usam o código real de serviços e callbacks das telas, com adaptadores mínimos para DOM e armazenamento. Não substituem uma bateria completa de cliques em todos os navegadores.

## Limites e decisões

A adequação é do fluxo funcional, não uma reprodução pixel a pixel. O menu integrado dos seis integrantes, a identidade visual existente e os parâmetros fictícios foram preservados. Exemplos dos prints (taxas, faixas, datas, nomes e valores) diferem da política de demonstração já presente no repositório: R$ 100–50.000, 2–60 meses, juros de 2%/2,5%/3% conforme faixa e relógio inicial de 03/02/2025. A versão dos termos permanece 2026.02.

O débito automático continua obrigatório conforme RN10; o controle de pagamento manual que aparece em um print não foi usado para desativá-lo. Há pagamento manual/antecipação com confirmação no cronograma. A tabela CEP/IBGE, a conferência documental e a análise de crédito são simulações locais já existentes, não integrações externas nem validação bancária real.

Administração e encerramento aparecem nos prints das páginas 9–11 e já existem no repositório. Foram preservados; a adequação e os novos testes concentram-se nas duas funcionalidades formalmente atribuídas ao integrante 2 no documento. Não se afirma validação exaustiva dessas telas auxiliares.

## Arquivos alterados

- integrante2/abertura-conta.js
- integrante2/emprestimo.js
- integrante2/emprestimo.css
- core/cenarios.js
- tests/integrante2.cjs (novo)

Para executar a versão entregue, extraia o ZIP e abra cesbank-front/index.html. Para testes automatizados, use Node.js e o comando acima. Não há dependências adicionais.
