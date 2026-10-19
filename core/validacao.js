/* Núcleo · roteiro por integrante e funcionalidade, com as 156 RNs rastreáveis. */
(function (C) {
  'use strict';

  const U = C.UI;
  const names = {
    F1: 'Cadastro e consulta de chave Pix',
    F2: 'Iniciação de transferência',
    F3: 'Pagamento e agendamento de boleto',
    F4: 'Agendamento e recorrência',
    F5: 'Abertura de conta',
    F6: 'Dados cadastrais e senha',
    F7: 'Limites da conta',
    F8: 'Favoritos',
    F9: 'Empréstimo',
    F10: 'Cartão de crédito',
    F11: 'Compras e faturas',
    F12: 'Disputas e devoluções',
    F13a: 'Investimentos',
    F13b: 'Caixinha de economia',
    F14: 'Extrato e comprovantes'
  };
  C.Router.register('validacao', 'Roteiro de validação', (s, p) => {
    const feature = p.get('funcionalidade') || '',
      member = p.get('integrante') || '';
    const requirements = C.Requirements.filter(r => (!feature || r.feature === feature) && (!member || r.member === Number(member)));
    return U.page('Roteiro de validação', '156 regras rastreadas aos documentos. Cada cenário restaura a base fictícia inicial antes de preparar seus dados.', U.card('Como validar', '<p>Escolha uma regra, prepare o cenário e siga a orientação exibida na própria tela. Volte aqui para a próxima regra. Os testes automáticos rodam em dados isolados, sem modificar sua demonstração.</p>' + U.form('<div class="fields">' + U.select('feature', 'Funcionalidade', [['', 'Todas'], ...Object.entries(names).map(([f, name]) => [f, f + ' · ' + name])], feature) + U.select('member', 'Integrante', [['', 'Todos'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']], member) + '</div>', d => C.Router.go('validacao?funcionalidade=' + d.feature + '&integrante=' + d.member), 'Filtrar', 'secondary') + U.action('Executar verificações automáticas', () => {
      const report = C.Tests.run();
      U.modal('Resultado das verificações', `<p>${report.passed} de ${report.total} verificações aprovadas. Os casos manuais continuam no roteiro abaixo.</p>` + U.table(['Caso', 'Regras', 'Resultado', 'Detalhe'], report.results.map(r => [U.e(r.name), U.e(r.rules.join(', ')), U.badge(r.pass ? 'APROVADO' : 'FALHOU'), U.e(r.detail || '')])));
    }, 'primary')) + requirements.map(r => U.card(`${r.feature} RN${r.number} · ${r.title}`, `<p>${U.e(r.description)}</p><p class="small">Integrante ${r.member}${r.feature === 'F13b' ? ' · fonte integrante 6; módulo consolidado integrante 1' : ''} · complexidade ${U.e(r.complexity)}${r.derived ? ' · regra derivada' : ''}</p><p class="small"><strong>Consultas:</strong> ${U.e(r.consultations)}</p><p class="small">Arquivo: ${U.e(C.Demos.files[r.feature])} · serviços compartilhados em core/.</p><div class="actions">${U.link(C.Demos.pages[r.feature], 'Abrir tela')}${U.action('Preparar cenário · restaura dados', () => C.Demos.prepare(r.feature, r.number), 'secondary')}</div>`)).join(''), 'F1–F14 · 156 regras');
  }, 'Demonstração');
  C.Validation = {
    names
  };
})(Cesbank);
