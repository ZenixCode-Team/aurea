/**
 * Publica o cenário de demonstração em um ambiente REMOTO, pela API HTTP.
 *
 *   API=https://api.aurea.zenixcode.cloud \
 *   ORIGEM=https://aurea.zenixcode.cloud \
 *   SENHA_ADMIN=... \
 *   pnpm tsx prisma/demonstracao-via-api.ts
 *
 * POR QUE EXISTE, SE JÁ HÁ `dados-de-demonstracao.ts`. Aquele fala com o banco por
 * Prisma e só funciona onde há acesso ao banco. O MySQL de produção não é exposto para
 * fora, o que está certo. Este aqui usa exatamente as mesmas rotas que a interface usa,
 * o que tem duas consequências boas: não precisa de acesso ao banco, e qualquer coisa
 * que ele consiga criar é coisa que a equipe também consegue criar pela tela.
 *
 * O CHECK-IN É DE VERDADE. Em vez de escrever classificação na mão, cada paciente
 * fictício entra e responde o questionário; quem classifica é o motor, com o conjunto
 * de limiares que estiver publicado. É mais lento e é a única forma de a demonstração
 * mostrar o sistema funcionando em vez de mostrar linhas inseridas à força.
 *
 * IDEMPOTENTE por CPF e por chave de sessão: rodar duas vezes não duplica paciente nem
 * check-in. Não apaga nada em nenhuma hipótese.
 */

const API = process.env.API ?? 'http://localhost:3333';
const ORIGEM = process.env.ORIGEM ?? 'http://localhost:3210';
const SENHA = process.env.SENHA_DEMO ?? 'aurea-demo-2026';
const EMAIL_ADMIN = process.env.EMAIL_ADMIN ?? 'admin@aurea.local';
const EMAIL_ENFERMAGEM = process.env.EMAIL_ENFERMAGEM ?? 'enfermagem@aurea.local';

interface Resposta<T> {
  status: number;
  corpo: T;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Pausa entre chamadas.
 *
 * A API tem limite de taxa, e com razão: é uma defesa contra força bruta no login. O
 * publicador faz centenas de chamadas em sequência e bate no limite — os check-ins
 * falharam silenciosamente na primeira execução por isso. Aqui a lentidão é a resposta
 * correta: baixar o limite do servidor para acomodar um script de demonstração seria
 * enfraquecer a defesa por conveniência.
 */
const PAUSA_ENTRE_CHAMADAS = 220;

async function chamar<T = unknown>(
  caminho: string,
  opcoes: { metodo?: string; corpo?: unknown; token?: string; tentativa?: number } = {},
): Promise<Resposta<T>> {
  await esperar(PAUSA_ENTRE_CHAMADAS);

  const resposta = await fetch(`${API}${caminho}`, {
    method: opcoes.metodo ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGEM,
      ...(opcoes.token ? { Authorization: `Bearer ${opcoes.token}` } : {}),
    },
    body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
  });

  const texto = await resposta.text();
  let corpo: unknown = null;
  try {
    corpo = texto ? JSON.parse(texto) : null;
  } catch {
    corpo = texto;
  }

  /* 429 com espera: o servidor diz quanto tempo, e a única resposta correta é esperar.
     Uma tentativa só — se o limite persistir, o problema não é ritmo. */
  const tentativa = opcoes.tentativa ?? 0;
  if (resposta.status === 429 && tentativa < 1) {
    const segundos = Number(resposta.headers.get('retry-after') ?? 21);
    console.log(`  … limite de taxa, esperando ${segundos}s`);
    await esperar((Number.isFinite(segundos) ? segundos : 21) * 1000);
    return chamar<T>(caminho, { ...opcoes, tentativa: tentativa + 1 });
  }

  return { status: resposta.status, corpo: corpo as T };
}

async function entrar(
  credencial: { email?: string; cpf?: string },
  senha = SENHA,
): Promise<string> {
  const r = await chamar<{ token?: string }>('/autenticacao/entrar', {
    metodo: 'POST',
    corpo: { ...credencial, senha },
  });
  if (!r.corpo?.token) {
    throw new Error(
      `Login falhou para ${credencial.email ?? credencial.cpf}: ${r.status} ${JSON.stringify(r.corpo)}`,
    );
  }
  return r.corpo.token;
}

/* Perfis fictícios.
 *
 * Os CPFs foram GERADOS: dígito verificador correto, para o cadastro aceitar, e
 * sequência de raiz repetida (111444777, 222555888...) para que nenhum deles possa
 * ser o CPF de uma pessoa real. Usar número plausível seria inaceitável mesmo em
 * demonstração, e usar número inválido faria o sistema recusar — o que, aliás, foi o
 * que aconteceu na primeira tentativa e provou que a validação funciona. */
const PERFIS = [
  {
    cpf: '11144477735',
    nome: 'Marisa Andrade (fictícia)',
    sexo: 'FEMININO',
    nascimento: '1971-04-12',
    diagnostico: 'Câncer de mama (fictício)',
    protocolo: 'AC-T (demonstração)',
    // Febre alta e vômito sem reter líquido: o motor classifica como vermelho.
    respostas: [
      { sintoma: 'FEBRE', respostas: [ { campo: 'apresentouFebre', valorBooleano: true }, { campo: 'temperaturaMaxima', valorNumerico: 38.7 }, { campo: 'usouAntitermico', valorBooleano: false } ] },
      { sintoma: 'NAUSEA_VOMITO', respostas: [ { campo: 'sentiuNausea', valorBooleano: true }, { campo: 'vomitou', valorBooleano: true }, { campo: 'episodiosDeVomito', valorNumerico: 6 }, { campo: 'consegueBeberLiquidos', valorBooleano: false }, { campo: 'consegueComer', valorBooleano: false } ] },
    ],
    social: { moraSozinho: true, dificuldadeDeTransporte: true, temCuidador: false },
    barreiras: [{ tipo: 'TRANSPORTE', descricao: 'Depende de carona da vizinha (fictício)' }],
    pendencia: { tipo: 'EXAME', descricao: 'Hemograma da véspera (fictício)' },
    internacao: { motivo: 'Neutropenia febril (fictícia)', haDias: 12, altaHaDias: 4 },
  },
  {
    cpf: '22255588846',
    nome: 'Rubens Tavares (fictício)',
    sexo: 'MASCULINO',
    nascimento: '1948-09-30',
    diagnostico: 'Câncer colorretal (fictício)',
    protocolo: 'FOLFOX (demonstração)',
    respostas: null, // nunca responde: entra no alerta de silêncio
    social: { moraSozinho: true, dificuldadeDeTransporte: true, temCuidador: false },
    barreiras: [{ tipo: 'TRANSPORTE' }, { tipo: 'DISTANCIA', descricao: 'Mora a 80 km (fictício)' }],
    internacao: { motivo: 'Desidratação (fictícia)', haDias: 2, altaHaDias: null },
  },
  {
    cpf: '33366699957',
    nome: 'Otávio Lins (fictício)',
    sexo: 'MASCULINO',
    nascimento: '1966-07-03',
    diagnostico: 'Câncer colorretal (fictício)',
    protocolo: 'FOLFOX (demonstração)',
    respostas: [{ sintoma: 'DIARREIA', respostas: [ { campo: 'apresentouDiarreia', valorBooleano: true }, { campo: 'episodiosEm24h', valorNumerico: 4 }, { campo: 'presencaDeSangue', valorBooleano: false } ] }],
    social: { moraSozinho: false, dificuldadeDeTransporte: false, temCuidador: true },
    barreiras: [],
    pendencia: { tipo: 'AUTORIZACAO' },
  },
  {
    cpf: '44477700083',
    nome: 'Ivone Prado (fictícia)',
    sexo: 'FEMININO',
    nascimento: '1959-11-17',
    diagnostico: 'Câncer de mama (fictício)',
    protocolo: 'AC-T (demonstração)',
    respostas: [
      { sintoma: 'NAUSEA_VOMITO', respostas: [ { campo: 'sentiuNausea', valorBooleano: true }, { campo: 'vomitou', valorBooleano: true }, { campo: 'episodiosDeVomito', valorNumerico: 3 }, { campo: 'consegueBeberLiquidos', valorBooleano: true }, { campo: 'consegueComer', valorBooleano: true } ] },
    ],
    social: { moraSozinho: false, dificuldadeDeTransporte: true, temCuidador: true },
    barreiras: [{ tipo: 'AUTORIZACAO', descricao: 'Convênio em análise (fictício)' }],
  },
  {
    cpf: '55588811194',
    nome: 'Cleide Barros (fictícia)',
    sexo: 'FEMININO',
    nascimento: '1983-01-22',
    diagnostico: 'Câncer de pulmão (fictício)',
    protocolo: 'Pembrolizumabe (demonstração)',
    respostas: null,
    social: null, // ninguém avaliou: mostra a base insuficiente na estratificação
    barreiras: [{ tipo: 'ANSIEDADE' }],
  },
  {
    cpf: '66699922203',
    nome: 'Hélio Braga (fictício)',
    sexo: 'MASCULINO',
    nascimento: '1955-06-25',
    diagnostico: 'Câncer de próstata (fictício)',
    protocolo: 'Pembrolizumabe (demonstração)',
    respostas: [{ sintoma: 'DOR', respostas: [ { campo: 'apresentouDor', valorBooleano: true }, { campo: 'localizacao', valorTexto: 'ABDOME' }, { campo: 'intensidade', valorNumerico: 2 } ] }],
    social: { moraSozinho: false, dificuldadeDeTransporte: false, temCuidador: true },
    barreiras: [],
  },
  {
    cpf: '77700033340',
    nome: 'Sônia Vasques (fictícia)',
    sexo: 'FEMININO',
    nascimento: '1978-12-01',
    diagnostico: 'Câncer de ovário (fictício)',
    protocolo: 'AC-T (demonstração)',
    respostas: [{ sintoma: 'FEBRE', respostas: [ { campo: 'apresentouFebre', valorBooleano: false } ] }],
    social: { moraSozinho: false, dificuldadeDeTransporte: false, temCuidador: true },
    barreiras: [],
  },
  {
    cpf: '88811144450',
    nome: 'Wanderley Sales (fictício)',
    sexo: 'MASCULINO',
    nascimento: '1962-03-14',
    diagnostico: 'Câncer gástrico (fictício)',
    protocolo: 'FOLFOX (demonstração)',
    respostas: [{ sintoma: 'DIARREIA', respostas: [ { campo: 'apresentouDiarreia', valorBooleano: true }, { campo: 'episodiosEm24h', valorNumerico: 3 }, { campo: 'presencaDeSangue', valorBooleano: false } ] }],
    social: { moraSozinho: true, dificuldadeDeTransporte: false, temCuidador: false },
    barreiras: [{ tipo: 'FINANCEIRA' }, { tipo: 'REDE_DE_APOIO' }],
  },
  {
    cpf: '99922255561',
    nome: 'Neusa Correia (fictícia)',
    sexo: 'FEMININO',
    nascimento: '1946-08-19',
    diagnostico: 'Câncer de mama (fictício)',
    protocolo: 'AC-T (demonstração)',
    respostas: [{ sintoma: 'DOR', respostas: [ { campo: 'apresentouDor', valorBooleano: false } ] }],
    social: { moraSozinho: true, dificuldadeDeTransporte: true, temCuidador: false },
    barreiras: [{ tipo: 'TRANSPORTE' }],
  },
  {
    cpf: '12345678062',
    nome: 'Gilmar Peçanha (fictício)',
    sexo: 'MASCULINO',
    nascimento: '1974-05-09',
    diagnostico: 'Câncer colorretal (fictício)',
    protocolo: 'FOLFOX (demonstração)',
    respostas: [{ sintoma: 'DIARREIA', respostas: [ { campo: 'apresentouDiarreia', valorBooleano: true }, { campo: 'episodiosEm24h', valorNumerico: 4 }, { campo: 'presencaDeSangue', valorBooleano: false } ] }],
    social: { moraSozinho: false, dificuldadeDeTransporte: false, temCuidador: true },
    barreiras: [],
  },
  {
    cpf: '23456789173',
    nome: 'Lúcia Amorim (fictícia)',
    sexo: 'FEMININO',
    nascimento: '1987-10-27',
    diagnostico: 'Câncer de colo do útero (fictício)',
    protocolo: 'Pembrolizumabe (demonstração)',
    respostas: [{ sintoma: 'FEBRE', respostas: [ { campo: 'apresentouFebre', valorBooleano: false } ] }],
    social: { moraSozinho: false, dificuldadeDeTransporte: false, temCuidador: true },
    barreiras: [],
  },
  {
    cpf: '34567890256',
    nome: 'Denise Fontes (fictícia)',
    sexo: 'FEMININO',
    nascimento: '1990-02-08',
    diagnostico: 'Linfoma (fictício)',
    protocolo: 'Pembrolizumabe (demonstração)',
    respostas: null,
    social: { moraSozinho: false, dificuldadeDeTransporte: false, temCuidador: true },
    barreiras: [{ tipo: 'TRABALHO', descricao: 'Sem folga para vir (fictício)' }],
  },
] as const;

const PROTOCOLOS = [
  { nome: 'FOLFOX (demonstração)', preparo: 25, pre: 15, infusao: 150, obs: 20, neutropenia: true, bomba: true },
  { nome: 'AC-T (demonstração)', preparo: 20, pre: 30, infusao: 90, obs: 30, neutropenia: true, bomba: false },
  { nome: 'Pembrolizumabe (demonstração)', preparo: 20, pre: 0, infusao: 30, obs: 60, neutropenia: false, bomba: false },
] as const;

/**
 * Chave de idempotência do check-in, no formato que a rota exige (UUID v4).
 *
 * Derivada do CPF e do dia, e não sorteada: sorteio criaria um check-in novo a cada
 * execução, que é exatamente o que a chave existe para impedir. Os bits de versão e
 * variante são fixados à mão porque o valor precisa ser um UUID VÁLIDO, não só ter o
 * formato — o schema da rota valida o padrão inteiro.
 */
function chaveDoDia(cpf: string): string {
  const semente = `${cpf}${new Date().toISOString().slice(0, 10)}`;
  let hash = 0;
  const digitos: string[] = [];
  for (let i = 0; i < 32; i += 1) {
    hash = (hash * 31 + semente.charCodeAt(i % semente.length) + i) % 0xffff;
    digitos.push((hash % 16).toString(16));
  }
  const h = digitos.join('');
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    `4${h.slice(13, 16)}`,
    `a${h.slice(17, 20)}`,
    h.slice(20, 32),
  ].join('-');
}

function diasAtras(dias: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - dias);
  return d.toISOString();
}

async function publicar() {
  console.log(`Publicando em ${API}`);

  const admin = await entrar({ email: EMAIL_ADMIN });
  const enfermagem = await entrar({ email: EMAIL_ENFERMAGEM });
  console.log('  autenticado como administração e enfermagem');

  // ------------------------------------------------------------- protocolos
  const listagem = await chamar<{ itens?: { id: string; nome: string }[] } | { id: string; nome: string }[]>(
    '/admin/protocolos',
    { token: admin },
  );
  const existentes = Array.isArray(listagem.corpo)
    ? listagem.corpo
    : (listagem.corpo?.itens ?? []);

  const idDoProtocolo = new Map<string, string>();
  for (const p of existentes) idDoProtocolo.set(p.nome, p.id);

  for (const definicao of PROTOCOLOS) {
    if (idDoProtocolo.has(definicao.nome)) continue;
    const r = await chamar<{ id: string }>('/admin/protocolos', {
      metodo: 'POST',
      token: admin,
      corpo: {
        nome: definicao.nome,
        descricao: 'Protocolo de demonstração. Não representa esquema real.',
      },
    });
    if (r.corpo?.id) idDoProtocolo.set(definicao.nome, r.corpo.id);
    else console.log(`  ! protocolo ${definicao.nome}: ${r.status}`);
  }
  console.log(`  protocolos: ${idDoProtocolo.size}`);

  // -------------------------------------------------------------- pacientes
  /* A listagem PAGINA. Ler só a primeira página faria o publicador não reconhecer
     quem já existe a partir do vigésimo paciente e tentar recriar todo mundo — que é
     exatamente o erro que a idempotência existe para evitar. O parâmetro é `tamanho`,
     e `limite` faz a rota responder erro de cursor. */
  const porNome = new Map<string, string>();
  let cursor: string | null = null;

  do {
    const pagina: Resposta<{
      itens?: { id: string; nome: string }[];
      proximoCursor?: string | null;
    }> = await chamar('/admin/pacientes?tamanho=100' + (cursor ? `&cursor=${cursor}` : ''), {
      token: admin,
    });

    for (const p of pagina.corpo?.itens ?? []) porNome.set(p.nome, p.id);
    cursor = pagina.corpo?.proximoCursor ?? null;
  } while (cursor);

  let criados = 0;
  const idPorCpf = new Map<string, string>();

  for (const perfil of PERFIS) {
    const jaExiste = porNome.get(perfil.nome);
    if (jaExiste) {
      idPorCpf.set(perfil.cpf, jaExiste);
      continue;
    }

    const r = await chamar<{ id: string }>('/admin/pacientes', {
      metodo: 'POST',
      token: admin,
      corpo: {
        nome: perfil.nome,
        cpf: perfil.cpf,
        dataNascimento: `${perfil.nascimento}T00:00:00.000Z`,
        sexo: perfil.sexo,
        diagnostico: perfil.diagnostico,
        habitoIntestinalBasal: 1,
        senhaProvisoria: SENHA,
      },
    });

    if (r.corpo?.id) {
      idPorCpf.set(perfil.cpf, r.corpo.id);
      criados += 1;
    } else {
      console.log(`  ! paciente ${perfil.nome}: ${r.status} ${JSON.stringify(r.corpo)}`);
    }
  }
  console.log(`  pacientes: ${criados} criados, ${idPorCpf.size} no total`);

  // ------------------------------------------------------------- tratamentos
  for (const perfil of PERFIS) {
    const pacienteId = idPorCpf.get(perfil.cpf);
    const protocoloId = idDoProtocolo.get(perfil.protocolo);
    if (!pacienteId || !protocoloId) continue;

    const r = await chamar<{ id: string }>('/admin/tratamentos', {
      metodo: 'POST',
      token: admin,
      corpo: { pacienteId, protocoloId, iniciadoEm: diasAtras(60) },
    });

    /* 409 quer dizer que já existe tratamento ativo. É o caminho normal da segunda
       execução, não é erro. */
    if (r.corpo?.id) {
      await chamar('/admin/tratamentos/' + r.corpo.id + '/ciclos', {
        metodo: 'POST',
        token: admin,
        corpo: { numero: 2, sessaoRealizadaEm: diasAtras(6) },
      });
    }
  }
  console.log('  tratamentos e ciclos');

  // ----------------------------------------------- check-ins DE VERDADE
  let checkins = 0;
  for (const perfil of PERFIS) {
    if (!perfil.respostas) continue;

    let token: string;
    try {
      token = await entrar({ cpf: perfil.cpf });
    } catch {
      console.log(`  ! não consegui entrar como ${perfil.nome}`);
      continue;
    }

    const sessao = await chamar<{ sessaoId?: string; id?: string }>('/triagem/sessoes', {
      metodo: 'POST',
      token,
      corpo: { chaveDeIdempotencia: chaveDoDia(perfil.cpf) },
    });

    const sessaoId = sessao.corpo?.sessaoId ?? sessao.corpo?.id;
    if (!sessaoId) continue;

    const envio = await chamar('/triagem/sessoes/' + sessaoId + '/respostas', {
      metodo: 'POST',
      token,
      corpo: { sintomas: perfil.respostas },
    });

    if (envio.status < 300) checkins += 1;
    else console.log(`  ! check-in de ${perfil.nome}: ${envio.status} ${JSON.stringify(envio.corpo).slice(0, 160)}`);
  }
  console.log(`  check-ins respondidos pelo motor: ${checkins}`);

  // ------------------------------------------- contexto, barreiras, pendências
  let barreiras = 0;
  for (const perfil of PERFIS) {
    const pacienteId = idPorCpf.get(perfil.cpf);
    if (!pacienteId) continue;

    if (perfil.social) {
      await chamar(`/painel/pacientes/${pacienteId}/contexto-social`, {
        metodo: 'PATCH',
        token: enfermagem,
        corpo: perfil.social,
      });
    }

    for (const barreira of perfil.barreiras ?? []) {
      const r = await chamar(`/painel/pacientes/${pacienteId}/barreiras`, {
        metodo: 'POST',
        token: enfermagem,
        corpo: barreira,
      });
      if (r.status < 300) barreiras += 1;
    }

    if ('pendencia' in perfil && perfil.pendencia) {
      const amanha = new Date();
      amanha.setDate(amanha.getDate() + 1);
      await chamar(`/painel/pacientes/${pacienteId}/pendencias`, {
        metodo: 'POST',
        token: enfermagem,
        corpo: {
          ...perfil.pendencia,
          referenteA: amanha.toISOString().slice(0, 10),
        },
      });
    }

    if ('internacao' in perfil && perfil.internacao) {
      await chamar(`/painel/pacientes/${pacienteId}/internacoes`, {
        metodo: 'POST',
        token: enfermagem,
        corpo: {
          motivo: perfil.internacao.motivo,
          local: 'Hospital de demonstração',
          iniciadaEm: diasAtras(perfil.internacao.haDias),
          ...(perfil.internacao.altaHaDias != null
            ? { altaEm: diasAtras(perfil.internacao.altaHaDias) }
            : {}),
        },
      });
    }
  }
  console.log(`  contexto social, ${barreiras} barreiras, pendências e internações`);

  // ------------------------------------------------------------- cadeiras
  const cadeiras: { id: string; numero: number }[] = [];
  for (let numero = 1; numero <= 10; numero += 1) {
    const r = await chamar<{ id: string; numero: number }>('/painel/cadeiras', {
      metodo: 'POST',
      token: enfermagem,
      corpo: { numero },
    });
    if (r.corpo?.id) cadeiras.push({ id: r.corpo.id, numero });
  }
  console.log(`  cadeiras: ${cadeiras.length}`);

  const ESTADOS = [
    'EM_INFUSAO', 'EM_INFUSAO', 'EM_INFUSAO', 'EM_INFUSAO', 'EM_INFUSAO',
    'EM_OBSERVACAO', 'EM_PREPARO', 'EM_PREPARO', 'AGUARDANDO_MEDICACAO',
  ] as const;

  let sessoes = 0;
  for (const [indice, perfil] of PERFIS.slice(0, ESTADOS.length).entries()) {
    const pacienteId = idPorCpf.get(perfil.cpf);
    const cadeira = cadeiras[indice];
    if (!pacienteId || !cadeira) continue;

    const inicio = new Date();
    inicio.setHours(8 + Math.floor(indice / 3), (indice % 3) * 20, 0, 0);

    const r = await chamar<{ id: string }>('/painel/cadeiras/sessoes', {
      metodo: 'POST',
      token: enfermagem,
      corpo: {
        pacienteId,
        cadeiraId: cadeira.id,
        previsaoDeInicio: inicio.toISOString(),
      },
    });

    if (r.corpo?.id) {
      sessoes += 1;
      /* O estado é aplicado depois: é o PATCH que grava `inicioReal` no servidor, e é
         dele que sai o atraso operacional. */
      await chamar(`/painel/cadeiras/sessoes/${r.corpo.id}`, {
        metodo: 'PATCH',
        token: enfermagem,
        corpo: { estado: ESTADOS[indice] },
      });
    }
  }
  console.log(`  sessões de infusão: ${sessoes}`);
}

publicar()
  .then(() => console.log('Pronto.'))
  .catch((erro: unknown) => {
    console.error('Falhou:', erro);
    process.exitCode = 1;
  });
