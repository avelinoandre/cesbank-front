# Relatório de validação CESBANK

## Verificações executadas

- 89 de 89 casos automáticos aprovados em execução JavaScript isolada.
- Os 89 casos da versão final também foram executados com sucesso dentro do navegador, pela página Roteiro de validação.
- 156 cenários preparados e suas páginas renderizadas em ambiente de verificação, sem falhas inesperadas. F3 RN3/RN5 produzem propositalmente BoletoJaLiquidado e BoletoVencidoForaDoPrazo.
- Navegação visual por perfil, transferência com confirmação/comprovante, alteração de limite com código e vigência imediata, filtro do roteiro e rendimento de aniversário da caixinha.
- PDF exportado pelo código do navegador: estrutura aberta por leitor independente e página renderizada/inspecionada, sem cortes ou sobreposição. O CSV e o PDF preservam o mascaramento da contraparte.
- SHA-256 comparado com implementação independente para três casos, incluindo UTF-8.
- Scripts clássicos e arquivos referenciados verificados; não há imports, fetch local, CDN ou dependências de execução.

## Limites da verificação

O navegador de teste permite HTTP/HTTPS e bloqueia file:. A prévia visual foi executada por servidor local temporário, sem alterações na estrutura de entrega. A abertura por duplo clique não foi executada automaticamente. Os cenários financeiros e metadados de documentos são fictícios; não há validação externa real. Anexos, códigos e todos os passos de interface podem ser repetidos pelo avaliador no roteiro.

## Casos automáticos

| Caso | Regras relacionadas | Resultado |
| --- | --- | --- |
| Centavos exatos e valor mínimo | F2 RN8, F2 RN13 | APROVADO |
| UUID v4 e identificador de 32 caracteres | F2 RN10, F2 RN11 | APROVADO |
| Relógio local, dia útil e aniversário de mês | F4 RN1, F13b RN6 | APROVADO |
| Rollback de uma operação incompleta | F2 RN9 | APROVADO |
| Transferência pelas duas formas de resolução | F2 RN1, F2 RN4 | APROVADO |
| Destino inexistente, inativo e mesma conta | F2 RN2, F2 RN3 | APROVADO |
| Composição de saldo e saldo insuficiente | F2 RN5, F13a RN1, F13b RN4 | APROVADO |
| Limite diário compartilhado e limite por transação | F2 RN6, F2 RN8, F4 RN4 | APROVADO |
| Faixa noturna e fronteiras 20h/6h | F2 RN7, F7 RN5 | APROVADO |
| Débito/crédito atômico e comprovante imutável | F2 RN9, F2 RN14 | APROVADO |
| Reenvio da requisição sem nova movimentação | F2 RN10, F1 RN2 | APROVADO |
| Transições financeiras restritas | F2 RN12 | APROVADO |
| Falha após débito gera estorno automático BE08 | F2 RN9, F12 RN10 | APROVADO |
| Regex Pix, e-mail normalizado e EVP gerada | F1 RN1 | APROVADO |
| Pix duplicada, limite máximo e titularidade | F1 RN3, F1 RN4 | APROVADO |
| Consulta Pix, mascaramento e estatísticas | F1 RN5, F1 RN9 | APROVADO |
| Reivindicação bloqueia resolução e exclusão | F1 RN6, F1 RN8, F1 RN10 | APROVADO |
| Inativação lógica e motivo de operação | F1 RN7 | APROVADO |
| Boleto válido em 47/44 dígitos e falha em verificadores | F3 RN1, F3 RN2 | APROVADO |
| Encargos, desconto e prazo de vencimento | F3 RN4, F3 RN5, F3 RN6 | APROVADO |
| Boleto pago não duplica e contém comprovante completo | F3 RN3, F3 RN10, F3 RN11 | APROVADO |
| Boleto sem saldo aceita agendamento e não pagamento | F3 RN7, F3 RN8 | APROVADO |
| Rejeição e recurso mantêm boleto não pagável | F3 RN12, F3 RN13, F3 RN14 | APROVADO |
| Recorrência mensal e ajuste de fim de semana | F4 RN1, F4 RN2 | APROVADO |
| Agendamento sem reserva e execução com limite do dia | F4 RN3, F4 RN4, F4 RN8 | APROVADO |
| Três tentativas falham sem interromper recorrência | F4 RN5, F3 RN9 | APROVADO |
| Cancelamento até véspera e execução imutável | F4 RN6, F4 RN7 | APROVADO |
| CPF válido, único, maioridade e nomes | F5 RN1, F5 RN2, F5 RN3, F5 RN4 | APROVADO |
| Endereço consulta CEP e IBGE e contatos principais | F5 RN5, F5 RN6 | APROVADO |
| Documentos obrigatórios, validade e compatibilidade | F5 RN7 | APROVADO |
| Qualificação, consentimento, conta e limites iniciais | F5 RN8, F5 RN9, F5 RN11, F5 RN12 | APROVADO |
| Recusa cadastral com motivo e sem reabertura | F5 RN10 | APROVADO |
| Encerramento exige saldo zero e inativa Pix | F5 RN11, F1 RN7 | APROVADO |
| Senha atual, composição e divergência de confirmação | F6 RN1, F6 RN2 | APROVADO |
| Hash SHA-256 com sal e vedação de reuso | F6 RN3, F6 RN4, F6 RN7 | APROVADO |
| Contato só muda com código correto e não expirado | F6 RN5, F6 RN6 | APROVADO |
| Tetos e consistência entre limites | F7 RN1, F7 RN2, F7 RN5 | APROVADO |
| Segundo fator, redução imediata e histórico | F7 RN3, F7 RN6, F7 RN7 | APROVADO |
| Aumento só entra em vigor após 24h | F7 RN4 | APROVADO |
| Favorito exige apelido/destino e valida vínculo | F8 RN1, F8 RN3 | APROVADO |
| Favorito sem apelido/destino duplicado e transação independente | F8 RN2, F8 RN4, F8 RN5 | APROVADO |
| Favorito inválido impede reuso e remoção é lógica | F8 RN6, F8 RN7 | APROVADO |
| Simulação de crédito obrigatória e com prazo | F9 RN1, F9 RN7 | APROVADO |
| Price amortiza integralmente com parcela fixa e CET/IOF | F9 RN2, F9 RN3, F9 RN4 | APROVADO |
| Análise recusa restrição e comprometimento de renda | F9 RN5, F9 RN6 | APROVADO |
| Liberação só em conta própria e cronograma com carência | F9 RN8, F9 RN9, F9 RN12 | APROVADO |
| Débito automático, atraso e multa/mora | F9 RN10 | APROVADO |
| Quitação antecipada desconta juros futuros | F9 RN11 | APROVADO |
| Liquidação parcial reduz parcelas ou prazo | F9 RN11 | APROVADO |
| Elegibilidade e limite calculado pela movimentação | F10 RN1, F10 RN2 | APROVADO |
| Cartão único, inativo, ativação e política de senha | F10 RN3, F10 RN4, F10 RN5 | APROVADO |
| Virtual e limites por canal subordinados ao total | F10 RN6, F10 RN7 | APROVADO |
| Aproximação acima do teto exige senha | F10 RN8 | APROVADO |
| Reserva imediata expira em 48h | F10 RN9 | APROVADO |
| Compra autorizada antes do cancelamento segue para fatura | F10 RN10, F11 RN2 | APROVADO |
| Redução de limite respeita utilização e aumento exige análise | F10 RN11 | APROVADO |
| Renovação automática antes da validade | F10 RN12 | APROVADO |
| Ciclos antes/depois do fechamento e parcelas futuras | F11 RN1, F11 RN2, F11 RN3 | APROVADO |
| Fechamento publica fatura com antecedência | F11 RN11, F11 RN12 | APROVADO |
| Mínimo, pagamento parcial e recomposição após liquidação | F11 RN4, F11 RN5, F11 RN8 | APROVADO |
| Falha de pagamento preserva fatura e limite | F11 RN8, F12 RN10 | APROVADO |
| Rotativo e bloqueio após atraso | F11 RN6, F11 RN9 | APROVADO |
| Multa e mora na fatura seguinte | F11 RN7 | APROVADO |
| Antecipação de compra desconta encargos não incorridos | F11 RN10 | APROVADO |
| Protocolo, vínculo, prazo e unicidade de contestação | F12 RN1, F12 RN2, F12 RN3, F12 RN4 | APROVADO |
| Bloqueio cautelar reduz disponível no destinatário | F12 RN5 | APROVADO |
| Prazo de dez dias úteis e única prorrogação justificada | F12 RN6 | APROVADO |
| Ciclo de contestação auditado e notificações | F12 RN7, F12 RN12 | APROVADO |
| Devolução parcial vinculada e liberação do bloqueio | F12 RN8 | APROVADO |
| Devolução executada em seis horas sem antecipar prazo | F12 RN9 | APROVADO |
| Cobrança de cartão suspensa sai do total e do mínimo | F12 RN11 | APROVADO |
| Aplicação mínima, disponibilidade e separação de saldo | F13a RN1 | APROVADO |
| Condições da aplicação preservadas e renda apurada diariamente | F13a RN2, F13a RN3 | APROVADO |
| Carência impede resgate antes da data contratada | F13a RN4 | APROVADO |
| IR regressivo e IOF somente sobre rendimento | F13a RN5, F13a RN6, F13a RN11 | APROVADO |
| Resgate parcial preserva a data e saldo remanescente | F13a RN7 | APROVADO |
| Ação usa cotação, corretagem e resultado sem garantia | F13a RN8, F13a RN9, F13a RN10 | APROVADO |
| Caixinha exige nome/meta, limite e nome único | F13b RN1, F13b RN2 | APROVADO |
| Depósito/resgate da caixinha atômico e limitado ao saldo | F13b RN3, F13b RN4, F13b RN5, F13b RN7 | APROVADO |
| Rendimento da caixinha só no aniversário | F13b RN6 | APROVADO |
| Meta atingida não impede movimentos; encerramento preserva extrato | F13b RN8, F13b RN9, F13b RN10 | APROVADO |
| Filtro de extrato por período válido e janela de 12 meses | F14 RN1, F14 RN2 | APROVADO |
| Exportação mantém filtros e registra protocolo/conteúdo | F14 RN3, F14 RN4, F14 RN5, F14 RN6 | APROVADO |
| Segunda via preserva transação e backup expira | F14 RN7, F14 RN8 | APROVADO |
| Ocorrências simultâneas sobrevivem a rollback de outra tentativa | F4 RN5, F4 RN8 | APROVADO |
| Regularização após rotativo não rebloqueia cartão no próximo tick | F11 RN6, F11 RN9 | APROVADO |
| Contestação após transporte retira cobrança e rotativo correspondente | F12 RN11, F11 RN6 | APROVADO |
| Devolução de compra já paga volta ao saldo da conta | F12 RN8, F12 RN11 | APROVADO |
| Rejeição de transferência auditada sem lançamento financeiro | F2 RN12 | APROVADO |
