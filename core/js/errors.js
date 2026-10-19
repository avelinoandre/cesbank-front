/* Núcleo · Anexo A.6 unificado · respostas de erro auditáveis. */
(function (C) {
  'use strict';

  const messages = {
    ChaveJaExiste: 'A chave informada já possui vínculo ativo no sistema.',
    LimiteDeChavesExcedido: 'A conta já atingiu o número máximo de chaves permitido.',
    ChaveDeOutroTitular: 'A chave pertence a pessoa diferente do titular da conta informada.',
    ChaveInvalida: 'A chave não atende ao formato do tipo informado.',
    ChaveNaoEncontrada: 'Não há vínculo ativo para a chave informada.',
    ChaveBloqueadaPorReivindicacao: 'Existe reivindicação aberta sobre a chave.',
    ConsultasExcedidas: 'O cliente excedeu o número de consultas de chave permitido no período.',
    ContaInexistenteOuInativa: 'A conta de destino não existe ou não está ativa.',
    SaldoInsuficiente: 'O saldo disponível é menor que o valor da operação.',
    LimiteDiarioExcedido: 'O valor ultrapassa o limite diário configurado.',
    LimiteNoturnoExcedido: 'O valor ultrapassa o limite permitido entre 20h e 6h.',
    LimitePorTransacaoExcedido: 'O valor ultrapassa o limite por transação configurado.',
    RequisicaoDuplicada: 'O identificador de requisição já foi processado.',
    BoletoInvalido: 'Falha na validação dos dígitos verificadores da linha digitável.',
    BoletoJaLiquidado: 'O boleto informado já consta como pago.',
    BoletoVencidoForaDoPrazo: 'O boleto está vencido há mais tempo que o prazo aceito para pagamento.',
    ForaDoHorarioDeLiquidacao: 'A operação será liquidada no próximo dia útil.',
    PropostaExpirada: 'A simulação de crédito perdeu a validade.',
    ComprometimentoDeRendaExcedido: 'A parcela ultrapassa o percentual máximo da renda informada.',
    CreditoRecusado: 'A análise automática recusou a proposta.',
    LimiteDeCreditoIndisponivel: 'O valor da compra excede o limite disponível do cartão.',
    CartaoBloqueadoOuCancelado: 'O cartão não está apto a realizar transações.',
    PagamentoInferiorAoMinimo: 'O valor pago é menor que o valor mínimo da fatura.',
    PrazoDeContestacaoExpirado: 'O prazo para contestar a transação já se encerrou.',
    ContestacaoJaEmAberto: 'Já existe contestação em aberto para a transação.',
    PeriodoInvalido: 'A data inicial é posterior à data final ou o intervalo excede 12 meses.',
    ValorAbaixoDoMinimo: 'O valor da aplicação é inferior ao mínimo definido para o produto.',
    ProdutoIndisponivel: 'O produto de investimento não está disponível para aplicação.',
    CarenciaNaoCumprida: 'O resgate foi solicitado antes do fim do período de carência do produto.',
    SaldoInsuficienteParaResgate: 'O valor solicitado no resgate é maior que o saldo aplicado.'
  };
  C.fail = function (code, detail, request) {
    const e = new Error(messages[code] || detail || code);
    e.code = code;
    e.detail = detail || e.message;
    e.request = request || C.Ids.uuid();
    throw e;
  };
  C.assert = function (condition, detail, code = 'ValidacaoDaRegra') {
    if (!condition) C.fail(code, detail);
  };
  C.errorData = e => ({
    codigo: e.code || 'ValidacaoDaRegra',
    titulo: e.message,
    detalhe: e.detail || e.message,
    idRequisicao: e.request || C.Ids.uuid(),
    dataHora: C.Db ? C.Db.get().now : new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  });
})(Cesbank);
