/**
 * Prova de fumaça do fluxo inteiro, contra a API rodando de verdade.
 *
 * Não substitui teste automatizado — existe para provar, uma vez, que a costura entre
 * login, gravação da resposta crua, classificação, orientação e aviso à enfermagem
 * funciona ponta a ponta contra MySQL real.
 *
 * EXIGE BANCO RECÉM-SEMEADO. Rode `pnpm seed` antes, sempre.
 * A prova muda estado de propósito — troca a senha de um paciente, publica conjunto,
 * registra consentimento. Rodar duas vezes sem semear de novo falha, e isso é correto:
 * um teste que passa sobre o próprio lixo não está provando nada.
 */
const BASE = process.env.BASE ?? 'http://localhost:3333';
const SENHA = 'aurea-demo-2026';

let falhas = 0;

function conferir(descricao, condicao, detalhe = '') {
  const marca = condicao ? '  ok  ' : '  FALHA';
  console.log(`${marca}  ${descricao}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!condicao) falhas += 1;
}

async function chamar(rota, opcoes = {}) {
  const resposta = await fetch(`${BASE}${rota}`, {
    ...opcoes,
    headers: {
      'content-type': 'application/json',
      ...(opcoes.token ? { authorization: `Bearer ${opcoes.token}` } : {}),
      ...opcoes.headers,
    },
    body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
  });

  const texto = await resposta.text();
  let corpo = null;
  try {
    corpo = texto ? JSON.parse(texto) : null;
  } catch {
    corpo = texto;
  }

  return { status: resposta.status, corpo };
}

console.log('\n== saúde ==');
const saude = await chamar('/saude');
conferir('GET /saude responde 200', saude.status === 200, JSON.stringify(saude.corpo));

console.log('\n== autenticação ==');
const loginErrado = await chamar('/autenticacao/entrar', {
  method: 'POST',
  corpo: { cpf: '12345678909', senha: 'senha-errada-mesmo' },
});
conferir('senha errada é recusada com 401', loginErrado.status === 401);
conferir(
  'a mensagem não revela se o CPF existe',
  loginErrado.corpo?.erro === 'CPF, e-mail ou senha incorretos.',
  loginErrado.corpo?.erro,
);

// CPF válido pelo dígito verificador e não cadastrado. Precisa ser válido: um CPF
// malformado é recusado antes de consultar o banco, e aí o teste não provaria nada
// sobre enumeração de usuário.
const inexistente = await chamar('/autenticacao/entrar', {
  method: 'POST',
  corpo: { cpf: '52998224725', senha: SENHA },
});
conferir('CPF inexistente devolve a mesma mensagem', inexistente.corpo?.erro === loginErrado.corpo?.erro);

const cpfInvalido = await chamar('/autenticacao/entrar', {
  method: 'POST',
  corpo: { cpf: '00000000000', senha: SENHA },
});
conferir('CPF com dígito verificador errado é recusado', cpfInvalido.status === 400, `status ${cpfInvalido.status}`);

const paciente = await chamar('/autenticacao/entrar', {
  method: 'POST',
  corpo: { cpf: '12345678909', senha: SENHA },
});
conferir('paciente entra com CPF e senha', paciente.status === 200 && Boolean(paciente.corpo?.token));
const tokenPaciente = paciente.corpo?.token;

const enfermagem = await chamar('/autenticacao/entrar', {
  method: 'POST',
  corpo: { email: 'enfermagem@aurea.local', senha: SENHA },
});
conferir('enfermagem entra com e-mail', enfermagem.status === 200);
const tokenEnfermagem = enfermagem.corpo?.token;

const admin = await chamar('/autenticacao/entrar', {
  method: 'POST',
  corpo: { email: 'admin@aurea.local', senha: SENHA },
});
const tokenAdmin = admin.corpo?.token;

console.log('\n== permissão: regra 6 do ADR-001 ==');
const painelPeloAdmin = await chamar('/painel/pacientes-do-dia', { token: tokenAdmin });
conferir(
  'admin (edita algoritmo) NÃO acessa o painel de plantão',
  painelPeloAdmin.status === 403,
  `status ${painelPeloAdmin.status}`,
);

const painelPeloPaciente = await chamar('/painel/pacientes-do-dia', { token: tokenPaciente });
conferir('paciente não acessa o painel', painelPeloPaciente.status === 403);

const painelSemToken = await chamar('/painel/pacientes-do-dia');
conferir('painel sem token devolve 401', painelSemToken.status === 401);

console.log('\n== árvore ==');
const arvore = await chamar('/triagem/arvore', { token: tokenPaciente });
conferir('a árvore vem do servidor com 5 sintomas', arvore.corpo?.sintomas?.length === 5);

console.log('\n== check-in verde ==');
const chaveVerde = crypto.randomUUID();
const sessaoVerde = await chamar('/triagem/sessoes', {
  method: 'POST',
  token: tokenPaciente,
  corpo: { chaveDeIdempotencia: chaveVerde },
});
conferir('sessão criada', sessaoVerde.status === 201);

const repetida = await chamar('/triagem/sessoes', {
  method: 'POST',
  token: tokenPaciente,
  corpo: { chaveDeIdempotencia: chaveVerde },
});
conferir(
  'reenvio com a mesma chave devolve a mesma sessão',
  repetida.corpo?.sessaoId === sessaoVerde.corpo?.sessaoId && repetida.corpo?.reaproveitada === true,
);

const respostaVerde = await chamar(`/triagem/sessoes/${sessaoVerde.corpo.sessaoId}/respostas`, {
  method: 'POST',
  token: tokenPaciente,
  corpo: {
    sintomas: [
      { sintoma: 'FEBRE', respostas: [{ campo: 'apresentouFebre', valorBooleano: false }] },
      { sintoma: 'DIARREIA', respostas: [{ campo: 'apresentouDiarreia', valorBooleano: false }] },
      { sintoma: 'NAUSEA_VOMITO', respostas: [{ campo: 'sentiuNausea', valorBooleano: false }] },
      { sintoma: 'DOR', respostas: [{ campo: 'apresentouDor', valorBooleano: false }] },
      { sintoma: 'FALTA_DE_AR', respostas: [{ campo: 'apresentouFaltaDeAr', valorBooleano: false }] },
    ],
  },
});
conferir('sete "não" classificam como VERDE', respostaVerde.corpo?.resultado === 'VERDE', JSON.stringify(respostaVerde.corpo?.resultado));
conferir('verde não gera orientação', respostaVerde.corpo?.orientacoes?.length === 0);
conferir('verde não aciona a enfermagem', respostaVerde.corpo?.enfermagemAvisada === false);
conferir(
  'o resultado vem marcado como NÃO validado clinicamente',
  respostaVerde.corpo?.validadoClinicamente === false,
);

console.log('\n== validação contra a árvore ==');
const sessaoInvalida = await chamar('/triagem/sessoes', {
  method: 'POST',
  token: tokenPaciente,
  corpo: { chaveDeIdempotencia: crypto.randomUUID() },
});
const foraDaFaixa = await chamar(`/triagem/sessoes/${sessaoInvalida.corpo.sessaoId}/respostas`, {
  method: 'POST',
  token: tokenPaciente,
  corpo: {
    sintomas: [
      {
        sintoma: 'FEBRE',
        respostas: [
          { campo: 'apresentouFebre', valorBooleano: true },
          { campo: 'temperaturaMaxima', valorNumerico: 55 },
          { campo: 'usouAntitermico', valorBooleano: false },
        ],
      },
    ],
  },
});
conferir('temperatura de 55 °C é recusada', foraDaFaixa.status === 400, JSON.stringify(foraDaFaixa.corpo?.detalhes));

const detalheSemPorta = await chamar(`/triagem/sessoes/${sessaoInvalida.corpo.sessaoId}/respostas`, {
  method: 'POST',
  token: tokenPaciente,
  corpo: {
    sintomas: [
      {
        sintoma: 'FEBRE',
        respostas: [
          { campo: 'apresentouFebre', valorBooleano: false },
          { campo: 'temperaturaMaxima', valorNumerico: 38.9 },
        ],
      },
    ],
  },
});
conferir('detalhe respondido com a porta fechada é recusado', detalheSemPorta.status === 400);

console.log('\n== check-in vermelho ==');
const sessaoVermelha = await chamar('/triagem/sessoes', {
  method: 'POST',
  token: tokenPaciente,
  corpo: { chaveDeIdempotencia: crypto.randomUUID() },
});
const respostaVermelha = await chamar(`/triagem/sessoes/${sessaoVermelha.corpo.sessaoId}/respostas`, {
  method: 'POST',
  token: tokenPaciente,
  corpo: {
    sintomas: [
      {
        sintoma: 'FEBRE',
        respostas: [
          { campo: 'apresentouFebre', valorBooleano: true },
          { campo: 'temperaturaMaxima', valorNumerico: 38.9 },
          { campo: 'usouAntitermico', valorBooleano: false },
        ],
      },
      {
        sintoma: 'NAUSEA_VOMITO',
        respostas: [
          { campo: 'sentiuNausea', valorBooleano: true },
          { campo: 'vomitou', valorBooleano: true },
          { campo: 'episodiosDeVomito', valorNumerico: 3 },
          { campo: 'consegueBeberLiquidos', valorBooleano: true },
          { campo: 'consegueComer', valorBooleano: true },
        ],
      },
    ],
  },
});
conferir('febre 38,9 classifica como VERMELHO', respostaVermelha.corpo?.resultado === 'VERMELHO');
conferir('a enfermagem é avisada', respostaVermelha.corpo?.enfermagemAvisada === true);
conferir(
  'a explicação diz qual regra disparou e com que valor',
  respostaVermelha.corpo?.explicacao?.porSintoma?.[0]?.regrasDisparadas?.[0]?.valorObservado === 38.9,
  JSON.stringify(respostaVermelha.corpo?.explicacao?.porSintoma?.[0]?.regrasDisparadas?.[0]?.justificativa)?.slice(0, 80),
);

console.log('\n== regra 8: orientação só nomeia o que está prescrito ==');
const orientacaoNausea = respostaVermelha.corpo?.orientacoes?.find((o) => o.sintoma === 'NAUSEA_VOMITO');
conferir(
  'Paciente Um TEM Ondansetrona prescrita e recebe o texto que nomeia o remédio',
  orientacaoNausea?.corpo?.includes('Ondansetrona') === true,
  orientacaoNausea?.corpo?.slice(0, 60),
);

const pacienteDois = await chamar('/autenticacao/entrar', {
  method: 'POST',
  corpo: { cpf: '11144477735', senha: SENHA },
});
const tokenDois = pacienteDois.corpo?.token;
const sessaoDois = await chamar('/triagem/sessoes', {
  method: 'POST',
  token: tokenDois,
  corpo: { chaveDeIdempotencia: crypto.randomUUID() },
});
const respostaDois = await chamar(`/triagem/sessoes/${sessaoDois.corpo.sessaoId}/respostas`, {
  method: 'POST',
  token: tokenDois,
  corpo: {
    sintomas: [
      {
        sintoma: 'NAUSEA_VOMITO',
        respostas: [
          { campo: 'sentiuNausea', valorBooleano: true },
          { campo: 'vomitou', valorBooleano: true },
          { campo: 'episodiosDeVomito', valorNumerico: 3 },
          { campo: 'consegueBeberLiquidos', valorBooleano: true },
          { campo: 'consegueComer', valorBooleano: true },
        ],
      },
    ],
  },
});
const orientacaoDois = respostaDois.corpo?.orientacoes?.find((o) => o.sintoma === 'NAUSEA_VOMITO');
conferir(
  'Paciente Dois NÃO tem prescrição e recebe a versão sem nomear remédio',
  orientacaoDois !== undefined && orientacaoDois.corpo.includes('Ondansetrona') === false,
  orientacaoDois?.corpo?.slice(0, 60),
);

console.log('\n== isolamento entre pacientes ==');
const sessaoAlheia = await chamar(`/triagem/sessoes/${sessaoVermelha.corpo.sessaoId}`, { token: tokenDois });
conferir('paciente não lê sessão de outro paciente', sessaoAlheia.status === 403);

console.log('\n== painel da enfermagem ==');
const painel = await chamar('/painel/pacientes-do-dia', { token: tokenEnfermagem });
conferir('enfermagem de plantão acessa o painel', painel.status === 200);
conferir('os três pacientes aparecem', painel.corpo?.cards?.length === 3, `${painel.corpo?.cards?.length} cards`);
conferir('o vermelho vem primeiro', painel.corpo?.cards?.[0]?.situacao === 'VERMELHO', painel.corpo?.cards?.[0]?.nome);
conferir(
  'quem não respondeu aparece como SEM_RESPOSTA_HOJE em vez de sumir',
  painel.corpo?.cards?.some((c) => c.situacao === 'SEM_RESPOSTA_HOJE') === true,
  `sem resposta: ${painel.corpo?.resumo?.semResposta}`,
);

console.log('\n== intervenção e log de acesso ==');
const historico = await chamar(`/painel/pacientes/${painel.corpo.cards[0].pacienteId}/historico`, {
  token: tokenEnfermagem,
});
conferir('enfermagem abre o histórico', historico.status === 200);
conferir('a resposta crua está guardada', historico.corpo?.sessoesDeTriagem?.[0]?.respostas?.length > 0);

const intervencao = await chamar(`/painel/sessoes/${sessaoVermelha.corpo.sessaoId}/intervencoes`, {
  method: 'POST',
  token: tokenEnfermagem,
  corpo: {
    conduta: 'Contato telefônico. Orientada a procurar o serviço.',
    situacao: 'EM_ACOMPANHAMENTO',
    contatoRealizadoEm: new Date().toISOString(),
  },
});
conferir('intervenção é registrada amarrada à sessão que gerou o alerta', intervencao.status === 201);

const intervencaoPeloMedico = await chamar(`/painel/sessoes/${sessaoVermelha.corpo.sessaoId}/intervencoes`, {
  method: 'POST',
  token: tokenAdmin,
  corpo: { conduta: 'tentativa indevida', situacao: 'RESOLVIDO', contatoRealizadoEm: new Date().toISOString() },
});
conferir('quem não tem permissão de intervenção é barrado', intervencaoPeloMedico.status === 403);

console.log('\n== admin: o algoritmo como dado ==');
const listaDeConjuntos = await chamar('/admin/limiares', { token: tokenAdmin });
conferir('admin lista os conjuntos de limiares', listaDeConjuntos.status === 200);
conferir(
  'o conjunto ativo é o rascunho-0 e está marcado como NÃO validado',
  listaDeConjuntos.corpo?.[0]?.versao === 'rascunho-0' &&
    listaDeConjuntos.corpo?.[0]?.validadoClinicamente === false,
);

const conjuntoAtivoId = listaDeConjuntos.corpo[0].id;
const detalhe = await chamar(`/admin/limiares/${conjuntoAtivoId}`, { token: tokenAdmin });
conferir(
  'a regra vem descrita em português, não só operador e valor',
  typeof detalhe.corpo?.regras?.[0]?.descricao === 'string' &&
    detalhe.corpo.regras[0].descricao.includes('→'),
  detalhe.corpo?.regras?.[0]?.descricao,
);
conferir('o conjunto ativo não tem problema de integridade', detalhe.corpo?.problemasDeIntegridade?.length === 0);

const conjuntoQuebrado = await chamar('/admin/limiares', {
  method: 'POST',
  token: tokenAdmin,
  corpo: {
    versao: 'quebrado-1',
    descricao: 'conjunto com regra apontando para campo inexistente',
    origem: 'teste',
    regras: [
      {
        ordem: 1,
        sintoma: 'FEBRE',
        campo: 'temperaturaAxilar',
        operador: 'MAIOR_OU_IGUAL',
        valor: 38,
        classificacao: 'VERMELHO',
        justificativa: 'campo que não existe na árvore',
      },
    ],
  },
});
conferir(
  'conjunto com regra apontando para campo inexistente é RECUSADO',
  conjuntoQuebrado.status === 422,
  JSON.stringify(conjuntoQuebrado.corpo?.detalhes),
);

const conjuntoNovo = await chamar('/admin/limiares', {
  method: 'POST',
  token: tokenAdmin,
  corpo: {
    versao: 'rascunho-1',
    descricao: 'febre desce de 38,5 para 38,0 — teste do diff',
    origem: 'teste automatizado',
    combinacao: 'DOIS_AMARELOS_VIRAM_VERMELHO',
    regras: [
      {
        ordem: 1,
        sintoma: 'FEBRE',
        campo: 'temperaturaMaxima',
        operador: 'MAIOR_OU_IGUAL',
        valor: 38.0,
        classificacao: 'VERMELHO',
        justificativa: 'corte mais conservador para teste',
      },
    ],
  },
});
conferir('conjunto novo é aceito', conjuntoNovo.status === 201);
conferir('e nasce INATIVO', conjuntoNovo.corpo?.ativo === false);

const diff = await chamar(`/admin/limiares/${conjuntoAtivoId}/diferenca/${conjuntoNovo.corpo?.id}`, {
  token: tokenAdmin,
});
conferir(
  'o diff mostra o que entrou, saiu e mudou',
  diff.status === 200 && diff.corpo?.semDiferenca === false,
  `entraram ${diff.corpo?.entraram?.length} · saíram ${diff.corpo?.sairam?.length} · mudaram ${diff.corpo?.mudaram?.length} · política ${diff.corpo?.politica?.length}`,
);
conferir(
  'nenhuma regra some do diff: entraram + saíram + mudaram fecha a conta',
  (diff.corpo?.sairam?.length ?? 0) + (diff.corpo?.mudaram?.length ?? 0) === 14 &&
    (diff.corpo?.regrasRepetidas?.length ?? 0) === 0,
  `saíram ${diff.corpo?.sairam?.length} + mudaram ${diff.corpo?.mudaram?.length} = ${(diff.corpo?.sairam?.length ?? 0) + (diff.corpo?.mudaram?.length ?? 0)} de 14`,
);

const publicarPelaEnfermagem = await chamar(`/admin/limiares/${conjuntoNovo.corpo?.id}/publicar`, {
  method: 'POST',
  token: tokenEnfermagem,
  corpo: {},
});
conferir(
  'enfermagem de plantão NÃO publica algoritmo',
  publicarPelaEnfermagem.status === 403,
  `status ${publicarPelaEnfermagem.status}`,
);

const validarPeloAdmin = await chamar(`/admin/limiares/${conjuntoNovo.corpo?.id}/validar`, {
  method: 'POST',
  token: tokenAdmin,
  corpo: {},
});
conferir(
  'admin sem registro profissional NÃO assina validação clínica',
  validarPeloAdmin.status === 403,
  validarPeloAdmin.corpo?.erro,
);

console.log('\n== consentimento (LGPD / Comitê de Ética) ==');
const consentimentoAntes = await chamar('/conta/consentimento', { token: tokenPaciente });
conferir('paciente consulta se já consentiu a versão vigente', consentimentoAntes.status === 200);

const versaoErrada = await chamar('/conta/consentimento', {
  method: 'POST',
  token: tokenPaciente,
  corpo: { versaoDoTermo: 'versao-que-nao-existe' },
});
conferir('aceitar versão diferente da vigente é recusado', versaoErrada.status === 409);

const aceite = await chamar('/conta/consentimento', {
  method: 'POST',
  token: tokenPaciente,
  corpo: { versaoDoTermo: consentimentoAntes.corpo?.versaoVigente },
});
conferir('aceite da versão vigente é registrado', [201, 200].includes(aceite.status));

console.log('\n== troca de senha ==');
const senhaErradaAtual = await chamar('/conta/senha', {
  method: 'POST',
  token: tokenDois,
  corpo: { senhaAtual: 'nao-e-a-minha-senha', senhaNova: 'senha-nova-bem-longa' },
});
conferir('trocar senha sem saber a atual é recusado', senhaErradaAtual.status === 401);

const senhaIgual = await chamar('/conta/senha', {
  method: 'POST',
  token: tokenDois,
  corpo: { senhaAtual: SENHA, senhaNova: SENHA },
});
conferir('senha nova igual à atual é recusada', senhaIgual.status === 400);

const trocou = await chamar('/conta/senha', {
  method: 'POST',
  token: tokenDois,
  corpo: { senhaAtual: SENHA, senhaNova: 'senha-nova-do-paciente-dois' },
});
conferir('troca de senha funciona', trocou.status === 200);

const tokenVelho = await chamar('/conta/consentimento', { token: tokenDois });
conferir('a troca derruba as sessões antigas', tokenVelho.status === 401, `status ${tokenVelho.status}`);

const comSenhaNova = await chamar('/autenticacao/entrar', {
  method: 'POST',
  corpo: { cpf: '11144477735', senha: 'senha-nova-do-paciente-dois' },
});
conferir('entra com a senha nova', comSenhaNova.status === 200);

console.log('\n== limite de tentativas de login ==');
// CPF válido e não cadastrado, usado SÓ aqui. Se este teste gastasse tentativas de
// uma conta que as outras conferências usam, rodar a prova duas vezes seguidas
// derrubaria o login logo no começo — foi o que aconteceu antes desta linha existir.
let bloqueou = false;
for (let tentativa = 0; tentativa < 25; tentativa += 1) {
  const r = await chamar('/autenticacao/entrar', {
    method: 'POST',
    corpo: { cpf: '39053344705', senha: `errada-${tentativa}` },
  });
  if (r.status === 429) {
    bloqueou = true;
    break;
  }
}
conferir('força bruta no login é barrada com 429', bloqueou);

console.log('\n' + '='.repeat(60));
console.log(falhas === 0 ? `TODAS AS CONFERÊNCIAS PASSARAM` : `${falhas} CONFERÊNCIA(S) FALHARAM`);
console.log('='.repeat(60) + '\n');
process.exit(falhas === 0 ? 0 : 1);
