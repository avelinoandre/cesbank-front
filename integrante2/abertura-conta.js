/* Integrante 2 · F5 RN1–RN12 · assistente em cinco etapas, recusa e criação automática. */
(function (C) {
  'use strict';

  const U = C.UI,
    K = C.Clock,
    M = C.M;
  const ufs = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
  const cities = [{
    cep: '50000000',
    city: 'Recife',
    code: '2611606',
    uf: 'PE'
  }, {
    cep: '01001000',
    city: 'São Paulo',
    code: '3550308',
    uf: 'SP'
  }, {
    cep: '20040002',
    city: 'Rio de Janeiro',
    code: '3304557',
    uf: 'RJ'
  }];
  const occupations = ['EMPREGADO', 'AUTONOMO', 'EMPRESARIO', 'APOSENTADO', 'ESTUDANTE'];
  const periods = ['DIARIA', 'SEMANAL', 'QUINZENAL', 'MENSAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'OUTROS'];
  function monthly(value, period) {
    return period === 'DIARIA' ? M.mul(value, 30, 1) : period === 'SEMANAL' ? M.mul(value, 52, 12) : period === 'QUINZENAL' ? M.mul(value, 2, 1) : period === 'BIMESTRAL' ? M.mul(value, 1, 2) : period === 'TRIMESTRAL' ? M.mul(value, 1, 3) : period === 'SEMESTRAL' ? M.mul(value, 1, 6) : period === 'ANUAL' ? M.mul(value, 1, 12) : value;
  }
  function validate(s, d, step) {
    if (step === 1) {
      C.assert(C.V.cpf(d.cpf), 'CPF obrigatório com 11 dígitos e dígitos verificadores válidos.');
      C.assert(!s.clients.some(u => u.cpf === d.cpf), 'Não pode haver dois clientes cadastrados com o mesmo CPF.');
      C.assert(C.V.date(d.birth) && d.birth <= K.months(K.day(s.now), -216), 'O cliente deve ter no mínimo 18 anos completos na data do cadastro.');
      C.assert(d.name.trim() && d.name.trim().length <= 70 && d.social.length <= 70, 'Nome civil obrigatório e nomes limitados a 70 caracteres.');
    }
    if (step === 2) {
      C.assert(d.street.trim() && d.district.trim() && d.city.trim() && /^\d{8}$/.test(d.cep) && ufs.includes(d.uf) && /^\d{7}$/.test(d.ibge), 'Informe endereço completo, UF oficial, CEP de 8 dígitos e código IBGE de 7 dígitos.');
      C.assert(cities.some(c => c.cep === d.cep && c.code === d.ibge && c.uf === d.uf && c.city.toLowerCase() === d.city.toLowerCase()), 'O município, CEP e código IBGE não correspondem à tabela fictícia consultada.');
    }
    if (step === 3) {
      C.assert(C.V.key('EMAIL', d.email.toLowerCase()) && C.V.key('PHONE', d.phone) && /^\d{2,3}$/.test(d.ddd) && ['FIXO', 'MOVEL', 'OUTRO'].includes(d.phoneType), 'Informe e-mail e telefone válidos, tipo de telefone e DDD de 2 ou 3 dígitos.');
      C.assert(d.emailPrincipal && d.phonePrincipal, 'Marque um e-mail e um telefone como principais.');
      if (d.email2) C.assert(C.V.key('EMAIL', d.email2.toLowerCase()), 'E-mail adicional inválido.');
      if (d.phone2) C.assert(C.V.key('PHONE', d.phone2), 'Telefone adicional inválido.');
    }
    if (step === 4) {
      C.assert(d.identityFile?.name && d.addressFile?.name, 'Anexe o documento de identidade e o comprovante de endereço obrigatórios.');
      C.assert(C.V.date(d.expiry) && d.expiry >= K.day(s.now), 'O documento deve estar dentro do prazo de validade.');
      C.assert(d.documentCpf === d.cpf, 'O número do documento deve ser compatível com o CPF informado.');
      C.assert(d.documentNumber.trim(), 'Número do documento obrigatório.');
      C.assert(d.documentVerified, 'Confirme a validação documental simulada.');
    }
    if (step === 5) {
      C.assert(occupations.includes(d.occupation) && periods.includes(d.periodicity), 'Ocupação ou periodicidade fora da tabela vigente.');
      M.parse(d.income);
      C.assert(C.V.date(d.reference) && d.reference <= K.day(s.now), 'Data de referência da renda inválida.');
      C.assert(d.terms, 'Registre o aceite dos termos de uso e da política de privacidade vigentes.');
      C.assert(['CONTA_DEPOSITO_A_VISTA', 'CONTA_POUPANCA', 'CONTA_PAGAMENTO_PRE_PAGA'].includes(d.type) && ['INDIVIDUAL', 'CONJUNTA_SIMPLES', 'CONJUNTA_SOLIDARIA'].includes(d.subtype), 'Tipo ou subtipo de conta inválido.');
    }
  }
  function newDraft(s) {
    const r = {
      id: C.Ids.uuid(),
      status: 'RASCUNHO',
      step: 1,
      data: {
        name: '',
        social: '',
        cpf: '',
        birth: '',
        street: '',
        district: '',
        city: 'Recife',
        uf: 'PE',
        cep: '50000000',
        ibge: '2611606',
        email: '',
        phone: '',
        ddd: '81',
        phoneType: 'MOVEL',
        emailPrincipal: 'on',
        phonePrincipal: 'on',
        email2: '',
        phone2: ''
      },
      created: s.now
    };
    s.registrations.push(r);
    return r;
  }
  function submit(s, r) {
    C.assert(r.status === 'RASCUNHO', 'Cadastro recusado ou concluído não pode ser reaberto. Crie nova solicitação.');
    for (let i = 1; i <= 5; i++) validate(s, r.data, i);
    const d = r.data;
    const restriction = s.registrations.some(q => q.id !== r.id && q.data.cpf === d.cpf && q.blocked) || r.blocked;
    const income = monthly(M.parse(d.income), d.periodicity);
    r.consent = {
      version: '2026.02',
      at: s.now,
      origin: 'PROTOTIPO_LOCAL',
      terms: true,
      privacy: true
    };
    if (restriction) {
      r.status = 'RECUSADO';
      r.reason = 'Restrição cadastral na base fictícia de compliance.';
      r.criterion = 'F5 RN10 · restrições cadastrais';
      C.S.audit(s, 'cadastro', r.id, r.reason);
      return r;
    }
    const u = {
      id: C.Ids.uuid(),
      name: d.name.trim(),
      social: d.social.trim(),
      cpf: d.cpf,
      birth: d.birth,
      email: d.email.toLowerCase(),
      phone: d.phone,
      contacts: {
        emailPrincipal: d.email.toLowerCase(),
        phonePrincipal: d.phone,
        email2: d.email2 || null,
        phone2: d.phone2 || null,
        phoneType: d.phoneType,
        ddd: d.ddd
      },
      income,
      declaredIncome: M.parse(d.income),
      periodicity: d.periodicity,
      incomeReference: d.reference,
      occupation: d.occupation,
      qualification: income >= 700000 ? 'ALTA' : income >= 400000 ? 'MEDIA' : 'BASICA',
      restriction: false,
      joined: K.day(s.now),
      credential: C.Security.credential('Cesbank9!'),
      passwordHistory: [],
      address: {
        street: d.street,
        district: d.district,
        city: d.city,
        uf: d.uf,
        cep: d.cep,
        ibge: d.ibge
      },
      documents: {
        identity: d.identityFile,
        address: d.addressFile,
        expiry: d.expiry,
        number: d.documentNumber
      },
      consent: r.consent
    };
    s.clients.push(u);
    const a = {
      id: C.Ids.uuid(),
      client: u.id,
      branch: '0001',
      number: String(7654321 + s.accounts.length).padStart(10, '0'),
      institution: '12345678',
      type: {
        CONTA_DEPOSITO_A_VISTA: 'CACC',
        CONTA_POUPANCA: 'SVGS',
        CONTA_PAGAMENTO_PRE_PAGA: 'TRAN'
      }[d.type],
      registrationType: d.type,
      subtype: d.subtype,
      status: 'ATIVA',
      opened: s.now,
      total: 0,
      blocked: 0,
      limits: {
        daily: 0,
        per: 0,
        night: 0,
        withdraw: 0
      }
    };
    s.accounts.push(a);
    const caps = C.S.accounts.ceilings(s, a.id);
    a.limits = Object.fromEntries(Object.entries(caps).map(([k, v]) => [k, M.mul(v, 1, 2)]));
    r.status = 'APROVADO';
    r.client = u.id;
    r.account = a.id;
    r.reason = 'Critérios cadastrais, documentais e de compliance atendidos.';
    C.S.audit(s, 'cadastro', r.id, 'Aprovado; conta criada com saldo zero e limites da qualificação ' + u.qualification + '.');
    return r;
  }
  C.S.opening = {
    validate,
    submit,
    newDraft,
    monthly,
    cities,
    occupations
  };
  C.Router.register('abrir-conta', 'Abrir conta', (s, p) => {
    const id = p.get('id'),
      r = s.registrations.find(r => r.id === id);
    if (!r) return U.page('Abra sua conta Cesbank', 'Cadastro fictício em cinco etapas.', U.card('Começar cadastro', '<p>Use documentos e dados fictícios. Nenhum arquivo é enviado a serviços externos.</p>' + U.action('Iniciar nova solicitação', () => {
      const q = C.Db.transaction(x => newDraft(x));
      C.Router.go('abrir-conta?id=' + q.id);
    })) + U.card('Solicitações existentes', U.table(['Protocolo', 'Situação', 'Motivo', 'Acesso'], s.registrations.map(q => [U.e(q.id), U.badge(q.status), U.e(q.reason || 'Em preenchimento'), U.link('abrir-conta?id=' + q.id, 'Consultar')]))), 'F5 · RN1–RN12');
    if (r.status !== 'RASCUNHO') return U.page(r.status === 'APROVADO' ? 'Conta criada com sucesso' : 'Cadastro recusado', r.reason, U.card(r.status, U.badge(r.status) + `<p>${U.e(r.criterion || 'Conta criada automaticamente com saldo inicial zero.')}</p>` + (r.account ? U.action('Acessar minha nova conta', () => {
      C.Session.select(r.client);
      C.Router.go('inicio');
      U.render();
    }) + U.table(['Conta e limites iniciais', 'Valor'], (() => { const a = s.accounts.find(a => a.id === r.account); return [['Agência / conta', U.e(a.branch + ' / ' + a.number)], ['Saldo inicial', U.money(0)], ...Object.entries(a.limits).map(([k,v]) => [{daily:'Diário',night:'Noturno',per:'Por transação',withdraw:'Saque'}[k], U.money(v)])]; })()) : U.link('abrir-conta', 'Criar nova solicitação')) + U.json(r)), 'F5 · RN9–RN12');
    const d = r.data,
      step = r.step;
    let body = '';
    if (step === 1) body = U.field('cpf', 'CPF sem pontuação', d.cpf) + U.field('birth', 'Data de nascimento', d.birth, 'date') + U.field('name', 'Nome civil', d.name, 'text', 'maxlength="70"') + U.field('social', 'Nome social opcional', d.social, 'text', 'maxlength="70"');
    if (step === 2) body = U.field('street', 'Logradouro', d.street) + U.field('district', 'Bairro', d.district) + U.field('city', 'Município', d.city) + U.select('uf', 'UF', ufs, d.uf) + U.field('cep', 'CEP sem pontuação', d.cep) + U.field('ibge', 'Código IBGE do município', d.ibge) + `<p class="small">Tabela de consulta fictícia: ${cities.map(c => `${c.cep} · ${c.city}/${c.uf} · ${c.code}`).join('; ')}.</p>`;
    if (step === 2) body += U.field('email', 'E-mail principal', d.email) + U.checkbox('emailPrincipal', 'Marcar e-mail como principal', !!d.emailPrincipal) + U.field('phone', 'Telefone principal internacional', d.phone) + U.checkbox('phonePrincipal', 'Marcar telefone como principal', !!d.phonePrincipal) + U.select('phoneType', 'Classificação', ['FIXO', 'MOVEL', 'OUTRO'], d.phoneType) + U.field('ddd', 'DDD (2 ou 3 dígitos)', d.ddd) + U.field('email2', 'Outro e-mail opcional', d.email2) + U.field('phone2', 'Outro telefone opcional', d.phone2);
    if (step === 4) body = U.field('identityFile', 'Documento de identidade fictício', '', 'file') + U.field('addressFile', 'Comprovante de endereço fictício', '', 'file') + (d.identityFile ? `<p>Arquivo atual: ${U.e(d.identityFile.name)}</p>` : '') + U.field('documentNumber', 'Número do documento', d.documentNumber || '') + U.field('documentCpf', 'CPF vinculado ao documento', d.documentCpf || d.cpf) + U.field('expiry', 'Validade do documento', d.expiry || K.addDays(K.day(s.now), 365), 'date') + U.checkbox('documentVerified', 'A conferência simulada confirmou a compatibilidade entre documento, CPF e titular.', !!d.documentVerified);
    if (step === 3) body = U.select('occupation', 'Ocupação', occupations, d.occupation) + U.field('income', 'Renda declarada', d.income || '5000.00') + U.select('periodicity', 'Periodicidade', periods, d.periodicity || 'MENSAL') + U.field('reference', 'Data de referência', d.reference || K.day(s.now), 'date') + U.select('type', 'Tipo de conta', ['CONTA_DEPOSITO_A_VISTA', 'CONTA_POUPANCA', 'CONTA_PAGAMENTO_PRE_PAGA'], d.type) + U.select('subtype', 'Subtipo', ['INDIVIDUAL', 'CONJUNTA_SIMPLES', 'CONJUNTA_SOLIDARIA'], d.subtype);
    if (step === 5) body = U.table(['Confira seus dados', 'Informação'], [
      ['Nome exibido', U.e(d.social || d.name)], ['Nome civil', U.e(d.name)],
      ['CPF / nascimento', U.e(d.cpf + ' / ' + d.birth)],
      ['Endereço', U.e(d.street + ', ' + d.district + ' · ' + d.city + '/' + d.uf + ' · CEP ' + d.cep + ' · IBGE ' + d.ibge)],
      ['Contatos principais', U.e(d.email + ' · ' + d.phone)],
      ['Ocupação e renda', U.e(d.occupation) + ' · ' + U.money(M.parse(d.income)) + ' · ' + U.e(d.periodicity) + ' · ref. ' + U.e(d.reference)],
      ['Conta', U.e(d.type + ' · ' + d.subtype)],
      ['Documentos', U.e(d.identityFile?.name + ' · ' + d.addressFile?.name)]
    ]) + U.checkbox('terms', 'Li e aceito os termos de uso e a política de privacidade · versão 2026.02.', !!d.terms) + '<p>O aceite registra versão, data, hora e origem da solicitação.</p><details><summary>Ferramentas de demonstração</summary>' + U.checkbox('blocked', 'Simular restrição cadastral para testar recusa.', r.blocked) + '</details>';
    return U.page('Abrir conta · etapa ' + step + ' de 5', ['', 'Dados pessoais', 'Endereço e contatos', 'Qualificação e conta', 'Documentos', 'Termos e envio'][step], `<div class="steps">${['Dados pessoais', 'Endereço e contatos', 'Qualificação e conta', 'Documentos', 'Termos e envio'].map((t, i) => `<span class="${i + 1 === step ? 'current' : ''}">${i + 1}. ${t}</span>`).join('')}</div>` + U.card('Preencha os dados da etapa', U.form(body, (data, el) => {
      let result;
      C.Db.transaction(x => {
        const q = x.registrations.find(v => v.id === r.id);
        C.assert(q.status === 'RASCUNHO' && q.step === step, 'Solicitação não está mais nesta etapa.');
        const combined = {
          ...q.data,
          ...data
        };
        if (step === 2) {
          combined.emailPrincipal = data.emailPrincipal;
          combined.phonePrincipal = data.phonePrincipal;
        }
        if (step === 4) {
          for (const key of ['identityFile', 'addressFile']) {
            const f = el.elements[key].files[0];
            combined[key] = f ? {
              name: f.name,
              size: f.size,
              type: f.type
            } : q.data[key];
          }
          combined.documentVerified = data.documentVerified;
        }
        if (step === 5) combined.terms = data.terms;
        if (step === 2) { validate(x, combined, 2); validate(x, combined, 3); }
        else if (step === 3) validate(x, { ...combined, terms: true }, 5);
        else validate(x, combined, step);
        q.data = combined;
        if (step < 5) q.step++;else {
          q.blocked = !!data.blocked;
          result = submit(x, q);
        }
      });
      U.render();
      if (result) U.flash(result.status === 'APROVADO' ? 'Cadastro aprovado; conta e limites iniciais criados.' : 'Cadastro recusado: ' + result.reason, result.status === 'APROVADO' ? 'success' : 'error');
    }, step === 5 ? 'Enviar cadastro para análise' : 'Continuar') + (step > 1 ? U.action('Voltar à etapa anterior', () => {
      C.Db.transaction(x => {
        const q = x.registrations.find(v => v.id === r.id);
        C.assert(q.status === 'RASCUNHO', 'Cadastro imutável.');
        q.step--;
      });
      U.render();
    }, 'secondary') : '')), 'F5 · RN1–RN12');
  }, 'Cadastro e crédito');
})(Cesbank);
