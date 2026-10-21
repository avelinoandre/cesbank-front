# Adequação do integrante 6

## Escopo aplicado

Foram ajustadas somente Configuração de limites da conta (F7) e Atualização de dados cadastrais e senha (F6). Conforme a orientação do usuário, Pix pertence ao integrante 1 e foi preservado, embora apareça na lista do DOCX anexado. Nenhuma alteração de Pix foi mantida.

Referência de interface e regras: `Atividade_2026_02_-_Integrante_6_telas_v2 (1).docx`. A análise utilizou o texto e as imagens incorporadas das duas funcionalidades em escopo. A aplicação continua sendo um protótipo de front-end em HTML, CSS e JavaScript, com dados locais; os códigos de SMS/e-mail permanecem simulados.

## Fluxos implementados

| Funcionalidade | Fluxo |
| --- | --- |
| Limites | Início → Limites vigentes e histórico → validação dos valores → revisão anterior/solicitado → segundo fator → recibo de redução ou aumento em carência → histórico |
| Dados cadastrais | Início → resumo com nome civil, CPF e nascimento imutáveis → alteração de contato ou senha |
| Senha | Formulário → conferência da senha atual, confirmação, composição e histórico → recibo de sucesso → auditoria |
| Contato | Telefone/e-mail → código enviado a cada novo contato → reenvio ou correção de código → confirmação → recibo e auditoria mascarada |
| Correção cadastral | Resumo → solicitação com descrição e novos documentos fictícios → protocolo de análise, preservando os dados civis |

A tela de edição reúne senha e contatos em cartões separados, com auditoria abaixo, conforme o modelo. Há também acesso direto à tela de alteração de senha. Mensagens de validação identificam os campos correspondentes, com `aria-invalid` e descrição acessível.

Ao alterar telefone e e-mail juntos, ambos exigem confirmação. Os contatos anteriores permanecem vigentes até a confirmação dos dois códigos. Reenvio invalida o código anterior. Cancelar a confirmação não aplica alterações.

## Regras de negócio

F7 mantém os quatro limites independentes, valida valores não negativos e tetos por qualificação e exige que o noturno não ultrapasse o limite por transação. Reduções são imediatas após confirmação; aumentos contam a carência da solicitação. O segundo fator é vinculado a cliente, conta e valores revisados. Se os limites vigentes mudarem antes da confirmação, é exigida nova revisão. O histórico registra anterior, solicitado, solicitação, vigência e situação.

F6 mantém senha atual obrigatória, confirmação coincidente, mínimo de 8 caracteres, letras e números, vedação a sequências simples/CPF/data de nascimento e reuso das últimas 5 senhas. As credenciais continuam como hash com sal. Novos contatos só entram em vigor após código válido, com verificação do cliente e do contato anterior para evitar sobreposição de uma alteração mais recente. A auditoria preserva os valores anteriores mascarados.

Os parâmetros fictícios já existentes foram mantidos: códigos válidos por cinco minutos, carência de 24 horas, tetos por qualificação e relógio inicial compartilhado do projeto. Datas, nomes e valores dos prints são exemplos; as regras utilizam os dados da conta selecionada. O estilo visual integrado foi preservado, com a organização de telas do modelo.

## Correspondência com os prints

| Telas do documento | Implementação e verificação |
| --- | --- |
| Limites 1 | Atalho no início para `#limites` |
| Limites 2 | Formulário dos quatro limites, tetos e histórico consultável |
| Limites 3 | Valor acima do teto recusado e campo marcado |
| Limites 4 | Noturno acima do limite por transação recusado; cenário preparado com valores dentro dos tetos para exercitar especificamente essa relação |
| Limites 5 | Modal de revisão com anterior/solicitado, tipo, vigência e segundo fator |
| Limites 6 | Código incorreto/expirado recusado; incorreto exercitado por cliques e expiração por teste automatizado |
| Limites 7 | Recibo de redução e histórico APLICADA, com vigência imediata |
| Limites 8 | Recibo de aumento EM_CARENCIA; avanço de 24h atualiza o vigente |
| Dados 1 | Atalho no início para `#dados` |
| Dados 2 | Resumo cadastral imutável e contatos atuais |
| Dados 3 | `#dados-editar` reúne os dois formulários e auditoria |
| Dados 4 | Senha atual incorreta e confirmação divergente recusadas, com mensagem por campo |
| Dados 5 | Composição inválida recusada |
| Dados 6 | Reutilização recente recusada |
| Dados 7 | Recibo de senha alterada e auditoria mascarada |
| Dados 8 | Código para cada contato novo; estado anterior preservado |
| Dados 9 | Código inválido, reenvio e expiração; expiração verificada por serviço |
| Dados 10 | Recibo com os contatos efetivados e auditoria dos anteriores |

## Validação executada

- 89/89 casos existentes passaram; dois casos de limites foram adaptados para emitir a confirmação por `S.limits.begin`, preservando as asserções anteriores.
- 18/18 regressões adicionais passaram, incluindo códigos inválidos/expirados, vínculo ao cliente, valores zero, carência, alterações concorrentes, dois contatos, reenvio, senha e integração com transferência.
- 14/14 cenários de F6/F7 foram abertos por cliques no navegador.
- No navegador foram exercitados: resumo/edição; senha atual incorreta, divergência, composição, reuso e sucesso; cancelamento de contato; dois contatos com código incorreto, reenvio, duas confirmações e recibo; correção com upload de arquivo fictício; teto, regra noturna, revisão, código inválido, redução, histórico e aumento com aplicação após 24h.
- A bateria de 89 casos também passou pela interface do navegador.
- 142/142 cenários fora de F6/F7 foram comparados com o commit original `8d88259`, em ambientes isolados e com identificadores determinísticos: mesmas rotas, estados e HTML/erros esperados. Essa é uma comparação automatizada de preparação/renderização, não uma afirmação de cliques completos nas 142 jornadas.
- Arquivos de Pix e módulos dos integrantes 1 e 2 permanecem idênticos ao commit de base. Também foi testado que alterar o contato não modifica os vínculos Pix existentes e que a transferência respeita o limite reduzido.
- Sintaxe dos JavaScripts e verificação de whitespace do diff aprovadas. Capturas das telas foram inspecionadas visualmente.

Comandos a partir da pasta do projeto:

```
node tests/integrante6.cjs
node tests/integrante2.cjs
```

A conferência visual foi feita por HTTP local no navegador integrado. Outros navegadores, abertura por `file:` e todas as combinações possíveis de entrada não foram exercitados.

## Arquivos e núcleo compartilhado

- `integrante6/limites.js` e `integrante6/limites.css`: telas, confirmação e regras de limites.
- `integrante6/dados-senha.js` e `integrante6/dados-senha.css`: resumo, formulários, confirmação, correção e auditoria.
- `core/cenarios.js`: rotas corretas para F6 e correção dos valores de exemplo da regra noturna F7 RN5.
- `core/js/app.js`: dois atalhos no início, preservando os demais acessos.
- `core/testes.js`: emissão do segundo fator nos dois testes de limites adaptada ao novo fluxo.
- `tests/integrante6.cjs`: regressões adicionais.

As alterações estão na cópia local do repositório. Nenhum commit ou push foi realizado nesta etapa.
