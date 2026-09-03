/**
 * Dados de demonstração — o cenário que faz as telas contarem uma história.
 *
 *   pnpm tsx prisma/dados-de-demonstracao.ts
 *
 * POR QUE NÃO É O `seed.ts`. O seed começa com quinze `deleteMany`, o que é correto
 * para montar um ambiente do zero e destrutivo para enriquecer um que já existe. Este
 * arquivo é idempotente e não apaga nada: pode rodar antes de uma apresentação, de
 * novo depois, e de novo no dia seguinte.
 *
 * ------------------------------------------------------------------------------
 * TODO PACIENTE AQUI É FICTÍCIO, E O NOME DIZ ISSO
 *
 * Não por formalidade: este banco existe para demonstração e a marca no nome é o que
 * impede um print de virar dado clínico no slide de alguém. A regra vale para o motivo
 * da internação, o texto da barreira e a conduta da intervenção — tudo carrega a
 * palavra "fictício" ou "demonstração".
 *
 * ------------------------------------------------------------------------------
 * O CENÁRIO
 *
 * Doze pacientes montados para que cada tela tenha o que mostrar:
 *
 * - **Fila de prioridades** — um vermelho com febre, um calado há oito dias, um que
 *   nunca respondeu, dois amarelos, um questionário incompleto, verdes no fim.
 * - **Alerta de silêncio** — as cinco faixas ocupadas, nenhuma vazia.
 * - **Toxicidade** — três protocolos com perfis DIFERENTES de sintoma, que é o que
 *   torna a tabela do bloco 5 interessante em vez de óbvia.
 * - **Estratificação** — pelo menos um alto risco por acúmulo de fatores de
 *   categorias diferentes, e um baixo risco para servir de contraste.
 * - **Navegação** — barreiras concentradas em transporte, pendências para amanhã,
 *   internação em curso, tratamento suspenso.
 * - **Intervenções** — os três desfechos abertos representados.
 *
 * A chave de idempotência é o CPF do paciente. É o que o próprio sistema já usa como
 * identidade de login, e o único campo aqui que um humano reconhece.
 */

import { PrismaClient, type Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

const SENHA_DE_DEMONSTRACAO = 'aurea-demo-2026';

/**
 * Meia-noite UTC do dia civil LOCAL de N dias atrás — o formato de uma coluna
 * `@db.Date`.
 *
 * Usa o calendário local e não `getUTC*` por um motivo que custou uma rodada: depois
 * das 21h em São Paulo, o dia UTC já virou. Montar "hoje" com `getUTCDate()` produzia
 * um check-in datado de amanhã, e `mesmoDia` no fuso do serviço respondia que o
 * paciente NÃO respondeu hoje. O vermelho com febre caía em baixa prioridade sem erro
 * nenhum aparecer.
 */
function diasAtras(dias: number): Date {
  const agora = new Date();
  return new Date(
    Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate() - dias),
  );
}

/**
 * Instante real de N dias atrás.
 *
 * Para `dias = 0` devolve um momento algumas horas ATRÁS de agora, nunca uma hora fixa
 * do dia: hora fixa vira futuro sempre que o script roda de madrugada, e check-in no
 * futuro é dado que nenhuma tela sabe ler.
 */
function instanteDiasAtras(dias: number, horasAntes = 2): Date {
  const agora = new Date();
  return new Date(
    agora.getTime() - dias * 24 * 60 * 60 * 1000 - horasAntes * 60 * 60 * 1000,
  );
}

interface Perfil {
  cpf: string;
  nome: string;
  sexo: 'FEMININO' | 'MASCULINO';
  nascimento: string;
  diagnostico: string;
  protocolo: string;
  /** Quantos dias atrás foi o último check-in. `null` = nunca respondeu. */
  diasDesdeUltimoCheckin: number | null;
  classificacao: 'VERMELHO' | 'AMARELO' | 'VERDE' | null;
  sintomasGraves: readonly { sintoma: string; justificativa: string }[];
  ecog: 'ZERO' | 'UM' | 'DOIS' | 'TRES' | 'NAO_AVALIADO';
  moraSozinho: boolean;
  transporte: boolean;
  cuidador: boolean;
  avaliouSocial: boolean;
  comorbidades: readonly string[];
  barreiras: readonly { tipo: string; descricao?: string }[];
  pendencia?: { tipo: string; descricao?: string; emDias: number };
  internacao?: { motivo: string; iniciadaHaDias: number; altaHaDias: number | null };
  suspenderTratamento?: boolean;
  intervencao?: { situacao: string; conduta: string };
}

/**
 * Os protocolos, com perfis de toxicidade distintos.
 *
 * A diferença entre eles é o ponto da tabela do bloco 5: se todos produzissem os
 * mesmos sintomas, a tela responderia uma pergunta que ninguém faria.
 */
const PROTOCOLOS = [
  {
    nome: 'FOLFOX (demonstração)',
    altoRiscoDeNeutropenia: true,
    imunoterapia: false,
    bombaInfusora: true,
    tratamentoOral: false,
  },
  {
    nome: 'AC-T (demonstração)',
    altoRiscoDeNeutropenia: true,
    imunoterapia: false,
    bombaInfusora: false,
    tratamentoOral: false,
  },
  {
    nome: 'Pembrolizumabe (demonstração)',
    altoRiscoDeNeutropenia: false,
    imunoterapia: true,
    bombaInfusora: false,
    tratamentoOral: false,
  },
] as const;

/**
 * O sintoma que cada protocolo produz com mais frequência.
 *
 * É o que faz a tabela do bloco 5 dizer alguma coisa. Sem isso, as sessões antigas
 * seriam todas verdes, a taxa geral ficaria em 2% e a coluna "sintoma mais frequente"
 * teria o mesmo valor para todo protocolo — uma tabela que responde uma pergunta que
 * ninguém faria.
 *
 * Os pares são plausíveis e continuam FICTÍCIOS: servem para demonstrar a leitura, não
 * para afirmar perfil de toxicidade de esquema real.
 */
const SINTOMA_CARACTERISTICO: Record<string, { sintoma: string; justificativa: string }> = {
  'FOLFOX (demonstração)': {
    sintoma: 'DIARREIA',
    justificativa: 'De 3 a 5 evacuações soltas em 24 horas (fictício).',
  },
  'AC-T (demonstração)': {
    sintoma: 'NAUSEA_VOMITO',
    justificativa: 'De 2 a 5 episódios de vômito em 24 horas (fictício).',
  },
  'Pembrolizumabe (demonstração)': {
    sintoma: 'DOR',
    justificativa: 'Dor de 4 a 7 na escala (fictício).',
  },
};

const PERFIS: readonly Perfil[] = [
  {
    cpf: '52998224725',
    nome: 'Marisa Andrade (fictícia)',
    sexo: 'FEMININO',
    nascimento: '1971-04-12',
    diagnostico: 'Câncer de mama (fictício)',
    protocolo: 'AC-T (demonstração)',
    diasDesdeUltimoCheckin: 0,
    classificacao: 'VERMELHO',
    sintomasGraves: [
      { sintoma: 'FEBRE', justificativa: 'Febre de 38,7 graus há 12 horas (fictício).' },
      { sintoma: 'NAUSEA_VOMITO', justificativa: 'Não consegue reter líquido (fictício).' },
    ],
    ecog: 'DOIS',
    moraSozinho: true,
    transporte: true,
    cuidador: false,
    avaliouSocial: true,
    comorbidades: ['Hipertensão (fictícia)', 'Diabetes tipo 2 (fictícia)'],
    barreiras: [{ tipo: 'TRANSPORTE', descricao: 'Depende de carona da vizinha (fictício)' }],
    pendencia: { tipo: 'EXAME', descricao: 'Hemograma da véspera (fictício)', emDias: 1 },
    internacao: { motivo: 'Neutropenia febril (fictícia)', iniciadaHaDias: 12, altaHaDias: 4 },
    intervencao: {
      situacao: 'ENCAMINHADO_AO_PA',
      conduta:
        'Contato telefônico. Orientada a procurar o pronto atendimento hoje (fictício).',
    },
  },
  {
    cpf: '87748248800',
    nome: 'Rubens Tavares (fictício)',
    sexo: 'MASCULINO',
    nascimento: '1948-09-30',
    diagnostico: 'Câncer colorretal (fictício)',
    protocolo: 'FOLFOX (demonstração)',
    diasDesdeUltimoCheckin: 8,
    classificacao: null,
    sintomasGraves: [],
    ecog: 'TRES',
    moraSozinho: true,
    transporte: true,
    cuidador: false,
    avaliouSocial: true,
    comorbidades: ['Cardiopatia (fictícia)'],
    barreiras: [
      { tipo: 'TRANSPORTE' },
      { tipo: 'DISTANCIA', descricao: 'Mora a 80 km do serviço (fictício)' },
    ],
    internacao: { motivo: 'Desidratação (fictícia)', iniciadaHaDias: 2, altaHaDias: null },
  },
  {
    cpf: '15350946056',
    nome: 'Cleide Barros (fictícia)',
    sexo: 'FEMININO',
    nascimento: '1983-01-22',
    diagnostico: 'Câncer de pulmão (fictício)',
    protocolo: 'Pembrolizumabe (demonstração)',
    diasDesdeUltimoCheckin: null,
    classificacao: null,
    sintomasGraves: [],
    ecog: 'NAO_AVALIADO',
    moraSozinho: false,
    transporte: false,
    cuidador: false,
    avaliouSocial: false,
    comorbidades: [],
    barreiras: [{ tipo: 'ANSIEDADE' }],
  },
  {
    cpf: '71428793860',
    nome: 'Otávio Lins (fictício)',
    sexo: 'MASCULINO',
    nascimento: '1966-07-03',
    diagnostico: 'Câncer colorretal (fictício)',
    protocolo: 'FOLFOX (demonstração)',
    diasDesdeUltimoCheckin: 0,
    classificacao: 'AMARELO',
    sintomasGraves: [
      { sintoma: 'DIARREIA', justificativa: 'De 3 a 5 evacuações soltas em 24 horas (fictício).' },
    ],
    ecog: 'UM',
    moraSozinho: false,
    transporte: false,
    cuidador: true,
    avaliouSocial: true,
    comorbidades: [],
    barreiras: [],
    pendencia: { tipo: 'AUTORIZACAO', emDias: 1 },
    intervencao: {
      situacao: 'AGUARDANDO_RETORNO',
      conduta: 'Orientada hidratação e registro dos episódios (fictício).',
    },
  },
  {
    cpf: '30880324880',
    nome: 'Ivone Prado (fictícia)',
    sexo: 'FEMININO',
    nascimento: '1959-11-17',
    diagnostico: 'Câncer de mama (fictício)',
    protocolo: 'AC-T (demonstração)',
    diasDesdeUltimoCheckin: 0,
    classificacao: 'AMARELO',
    sintomasGraves: [
      { sintoma: 'NAUSEA_VOMITO', justificativa: 'De 2 a 5 episódios em 24 horas (fictício).' },
    ],
    ecog: 'UM',
    moraSozinho: false,
    transporte: true,
    cuidador: true,
    avaliouSocial: true,
    comorbidades: ['Hipotireoidismo (fictício)'],
    barreiras: [{ tipo: 'AUTORIZACAO', descricao: 'Convênio em análise (fictício)' }],
    intervencao: {
      situacao: 'REAVALIAR',
      conduta: 'Antiemético conforme prescrição. Reavaliar no check-in (fictício).',
    },
  },
  {
    cpf: '46011180060',
    nome: 'Denise Fontes (fictícia)',
    sexo: 'FEMININO',
    nascimento: '1990-02-08',
    diagnostico: 'Linfoma (fictício)',
    protocolo: 'Pembrolizumabe (demonstração)',
    diasDesdeUltimoCheckin: 3,
    classificacao: null,
    sintomasGraves: [],
    ecog: 'ZERO',
    moraSozinho: false,
    transporte: false,
    cuidador: true,
    avaliouSocial: true,
    comorbidades: [],
    barreiras: [{ tipo: 'TRABALHO', descricao: 'Não consegue folga para vir (fictício)' }],
  },
  {
    cpf: '95524361503',
    nome: 'Hélio Braga (fictício)',
    sexo: 'MASCULINO',
    nascimento: '1955-06-25',
    diagnostico: 'Câncer de próstata (fictício)',
    protocolo: 'Pembrolizumabe (demonstração)',
    diasDesdeUltimoCheckin: 1,
    classificacao: 'VERDE',
    sintomasGraves: [],
    ecog: 'UM',
    moraSozinho: false,
    transporte: false,
    cuidador: true,
    avaliouSocial: true,
    comorbidades: [],
    barreiras: [],
    suspenderTratamento: true,
  },
  {
    cpf: '19238452047',
    nome: 'Sônia Vasques (fictícia)',
    sexo: 'FEMININO',
    nascimento: '1978-12-01',
    diagnostico: 'Câncer de ovário (fictício)',
    protocolo: 'AC-T (demonstração)',
    diasDesdeUltimoCheckin: 0,
    classificacao: 'VERDE',
    sintomasGraves: [],
    ecog: 'ZERO',
    moraSozinho: false,
    transporte: false,
    cuidador: true,
    avaliouSocial: true,
    comorbidades: [],
    barreiras: [],
  },
  {
    cpf: '63913862005',
    nome: 'Wanderley Sales (fictício)',
    sexo: 'MASCULINO',
    nascimento: '1962-03-14',
    diagnostico: 'Câncer gástrico (fictício)',
    protocolo: 'FOLFOX (demonstração)',
    diasDesdeUltimoCheckin: 2,
    classificacao: null,
    sintomasGraves: [],
    ecog: 'DOIS',
    moraSozinho: true,
    transporte: false,
    cuidador: false,
    avaliouSocial: true,
    comorbidades: ['Insuficiência renal (fictícia)'],
    barreiras: [{ tipo: 'FINANCEIRA' }, { tipo: 'REDE_DE_APOIO' }],
  },
  {
    cpf: '24184566040',
    nome: 'Neusa Correia (fictícia)',
    sexo: 'FEMININO',
    nascimento: '1946-08-19',
    diagnostico: 'Câncer de mama (fictício)',
    protocolo: 'AC-T (demonstração)',
    diasDesdeUltimoCheckin: 0,
    classificacao: 'VERDE',
    sintomasGraves: [],
    ecog: 'UM',
    moraSozinho: true,
    transporte: true,
    cuidador: false,
    avaliouSocial: true,
    comorbidades: ['Hipertensão (fictícia)'],
    barreiras: [{ tipo: 'TRANSPORTE' }],
  },
  {
    cpf: '84931920063',
    nome: 'Gilmar Peçanha (fictício)',
    sexo: 'MASCULINO',
    nascimento: '1974-05-09',
    diagnostico: 'Câncer colorretal (fictício)',
    protocolo: 'FOLFOX (demonstração)',
    diasDesdeUltimoCheckin: 0,
    classificacao: 'AMARELO',
    sintomasGraves: [
      { sintoma: 'DOR', justificativa: 'Dor de 4 a 7 na escala (fictício).' },
      { sintoma: 'DIARREIA', justificativa: 'De 3 a 5 evacuações soltas (fictício).' },
    ],
    ecog: 'UM',
    moraSozinho: false,
    transporte: false,
    cuidador: true,
    avaliouSocial: true,
    comorbidades: [],
    barreiras: [],
  },
  {
    cpf: '40483558007',
    nome: 'Lúcia Amorim (fictícia)',
    sexo: 'FEMININO',
    nascimento: '1987-10-27',
    diagnostico: 'Câncer de colo do útero (fictício)',
    protocolo: 'Pembrolizumabe (demonstração)',
    diasDesdeUltimoCheckin: 0,
    classificacao: 'VERDE',
    sintomasGraves: [],
    ecog: 'ZERO',
    moraSozinho: false,
    transporte: false,
    cuidador: true,
    avaliouSocial: true,
    comorbidades: [],
    barreiras: [],
  },
];

/**
 * A explicação gravada com a classificação, no formato que o motor produz.
 *
 * Montada aqui e não copiada de um exemplo real porque as telas leem `porSintoma` para
 * mostrar o motivo da prioridade e para contar a toxicidade por protocolo. Explicação
 * com formato errado não quebra nada — só faz as duas telas ficarem em branco, que é
 * pior.
 */
function montarExplicacao(
  perfil: Perfil,
  diaDoCiclo: number,
): Prisma.InputJsonValue {
  const todos = ['FEBRE', 'DIARREIA', 'NAUSEA_VOMITO', 'DOR', 'FALTA_DE_AR'];
  const graves = new Map(perfil.sintomasGraves.map((s) => [s.sintoma, s]));

  return {
    diaDoCiclo,
    porSintoma: todos.map((sintoma) => {
      const grave = graves.get(sintoma);
      if (!grave) {
        return { sintoma, classificacao: 'VERDE', regrasDisparadas: [] };
      }
      const classificacao = perfil.classificacao ?? 'AMARELO';
      return {
        sintoma,
        classificacao,
        regrasDisparadas: [
          {
            regraId: `demo-${sintoma.toLowerCase()}`,
            sintoma,
            campo: 'campo',
            classificacao,
            justificativa: grave.justificativa,
            valorObservado: true,
          },
        ],
      };
    }),
  };
}

async function publicar() {
  const senhaHash = await hash(SENHA_DE_DEMONSTRACAO, 10);

  // ------------------------------------------------------------------ protocolos
  const protocolos = new Map<string, string>();
  for (const definicao of PROTOCOLOS) {
    const protocolo = await prisma.protocolo.upsert({
      where: { nome: definicao.nome },
      update: {
        altoRiscoDeNeutropenia: definicao.altoRiscoDeNeutropenia,
        imunoterapia: definicao.imunoterapia,
        bombaInfusora: definicao.bombaInfusora,
        tratamentoOral: definicao.tratamentoOral,
      },
      create: {
        nome: definicao.nome,
        descricao: 'Protocolo de demonstração. Não representa esquema real.',
        altoRiscoDeNeutropenia: definicao.altoRiscoDeNeutropenia,
        imunoterapia: definicao.imunoterapia,
        bombaInfusora: definicao.bombaInfusora,
        tratamentoOral: definicao.tratamentoOral,
      },
    });
    protocolos.set(definicao.nome, protocolo.id);
  }

  /* O conjunto de limiares precisa existir para a classificação ter a que se
     referir. Reaproveita o que o seed criou; se não houver, cria um de demonstração. */
  let conjunto = await prisma.conjuntoDeLimiares.findFirst({
    orderBy: { criadoEm: 'desc' },
  });
  if (!conjunto) {
    conjunto = await prisma.conjuntoDeLimiares.create({
      data: { versao: 'rascunho-0', validadoClinicamente: false },
    });
  }

  let criados = 0;
  let atualizados = 0;

  for (const perfil of PERFIS) {
    const protocoloId = protocolos.get(perfil.protocolo);
    if (!protocoloId) continue;

    // ------------------------------------------------------------------ usuário
    const usuarioExistente = await prisma.usuario.findFirst({
      where: { cpf: perfil.cpf },
      select: { id: true },
    });

    const usuario =
      usuarioExistente ??
      (await prisma.usuario.create({
        data: { cpf: perfil.cpf, senhaHash, perfil: 'PACIENTE', ativo: true },
      }));

    if (usuarioExistente) atualizados += 1;
    else criados += 1;

    // ----------------------------------------------------------------- paciente
    const dadosDoPaciente = {
      nome: perfil.nome,
      dataNascimento: new Date(`${perfil.nascimento}T00:00:00.000Z`),
      sexo: perfil.sexo,
      diagnostico: perfil.diagnostico,
      habitoIntestinalBasal: 1,
      ecog: perfil.ecog,
      moraSozinho: perfil.moraSozinho,
      dificuldadeDeTransporte: perfil.transporte,
      temCuidador: perfil.cuidador,
      contextoSocialAvaliadoEm: perfil.avaliouSocial ? instanteDiasAtras(20) : null,
      internadoAte:
        perfil.internacao && perfil.internacao.altaHaDias != null
          ? diasAtras(perfil.internacao.altaHaDias)
          : null,
    };

    const paciente = await prisma.paciente.upsert({
      where: { usuarioId: usuario.id },
      update: dadosDoPaciente,
      create: { ...dadosDoPaciente, usuarioId: usuario.id },
    });

    // ------------------------------------------------------------- comorbidades
    /* Apaga e recria só as deste paciente: a lista é a fonte, e sem isso rodar duas
       vezes duplicaria cada comorbidade. Não toca em nada de outro paciente. */
    await prisma.comorbidadeDoPaciente.deleteMany({ where: { pacienteId: paciente.id } });
    for (const descricao of perfil.comorbidades) {
      await prisma.comorbidadeDoPaciente.create({
        data: {
          pacienteId: paciente.id,
          descricao,
          origem: 'EQUIPE',
          confirmadaEm: instanteDiasAtras(30),
        },
      });
    }

    // --------------------------------------------------------------- tratamento
    const tratamentoExistente = await prisma.tratamento.findFirst({
      where: { pacienteId: paciente.id, encerradoEm: null },
      select: { id: true },
    });

    const tratamento =
      tratamentoExistente ??
      (await prisma.tratamento.create({
        data: {
          pacienteId: paciente.id,
          protocoloId,
          iniciadoEm: diasAtras(60),
        },
      }));

    await prisma.tratamento.update({
      where: { id: tratamento.id },
      data: {
        protocoloId,
        suspensoEm: perfil.suspenderTratamento ? diasAtras(3) : null,
        motivoDaSuspensao: perfil.suspenderTratamento
          ? 'Toxicidade em acompanhamento (fictício)'
          : null,
      },
    });

    const cicloExistente = await prisma.ciclo.findFirst({
      where: { tratamentoId: tratamento.id },
      orderBy: { sessaoRealizadaEm: 'desc' },
      select: { id: true },
    });
    if (!cicloExistente) {
      await prisma.ciclo.create({
        data: {
          tratamentoId: tratamento.id,
          numero: 2,
          sessaoRealizadaEm: diasAtras(6),
        },
      });
    }

    // ----------------------------------------------------- sessões de triagem
    /* Um mês de check-ins, para a tela de toxicidade ter denominador. As sessões
       antigas são todas verdes; a diferença de perfil entre protocolos vem das
       sessões recentes, que é onde a classificação do perfil entra. */
    if (perfil.diasDesdeUltimoCheckin != null) {
      const diasComCheckin = [perfil.diasDesdeUltimoCheckin, 4, 7, 11, 15, 18, 22, 26];

      for (const [indice, dias] of diasComCheckin.entries()) {
        const ehAMaisRecente = indice === 0;
        const caracteristico = SINTOMA_CARACTERISTICO[perfil.protocolo];

        /* Sessões antigas alternam entre o sintoma característico do protocolo e
           verde. Duas de quatro, o que dá taxas na casa dos 30 a 50% — faixa em que a
           tela mostra diferença entre protocolos em vez de ruído. */
        const antigaComSintoma = !ehAMaisRecente && indice % 2 === 1 && caracteristico;

        const perfilDaSessao: Perfil = ehAMaisRecente
          ? perfil
          : antigaComSintoma
            ? {
                ...perfil,
                classificacao: 'AMARELO',
                sintomasGraves: [caracteristico],
              }
            : { ...perfil, classificacao: 'VERDE', sintomasGraves: [] };

        /* A chave de idempotência da própria sessão resolve a repetição: ela existe
           para impedir que reenvio por rede instável crie dois check-ins do mesmo dia,
           e serve exatamente igual para impedir que este script crie dois. */
        const chave = `demo-${perfil.cpf}-${dias}`;

        const sessao = await prisma.sessaoDeTriagem.upsert({
          where: { chaveDeIdempotencia: chave },
          update: {},
          create: {
            pacienteId: paciente.id,
            chaveDeIdempotencia: chave,
            estado: 'CONCLUIDA',
            iniciadaEm: instanteDiasAtras(dias, 3),
            concluidaEm: instanteDiasAtras(dias, 2),
          },
        });

        await prisma.classificacao_.upsert({
          where: {
            sessaoId_conjuntoDeLimiaresId: {
              sessaoId: sessao.id,
              conjuntoDeLimiaresId: conjunto.id,
            },
          },
          update: {
            resultado: perfilDaSessao.classificacao ?? 'VERDE',
            explicacao: montarExplicacao(perfilDaSessao, 6),
          },
          create: {
            sessaoId: sessao.id,
            conjuntoDeLimiaresId: conjunto.id,
            situacao: 'CLASSIFICADA',
            resultado: perfilDaSessao.classificacao ?? 'VERDE',
            explicacao: montarExplicacao(perfilDaSessao, 6),
            origem: 'ORIGINAL',
            calculadaEm: instanteDiasAtras(dias, 2),
          },
        });

        // ------------------------------------------------------- intervenção
        if (ehAMaisRecente && perfil.intervencao) {
          const profissional = await prisma.profissional.findFirst({
            select: { id: true },
          });
          const jaTem = await prisma.intervencao.count({
            where: { sessaoDeTriagemId: sessao.id },
          });
          if (profissional && jaTem === 0) {
            await prisma.intervencao.create({
              data: {
                sessaoDeTriagemId: sessao.id,
                profissionalId: profissional.id,
                conduta: perfil.intervencao.conduta,
                situacao: perfil.intervencao.situacao as never,
                contatoRealizadoEm: instanteDiasAtras(dias, 1),
                registradaEm: instanteDiasAtras(dias, 2),
              },
            });
          }
        }
      }
    }

    // ----------------------------------------------------------------- barreiras
    await prisma.barreiraDoPaciente.deleteMany({ where: { pacienteId: paciente.id } });
    for (const barreira of perfil.barreiras) {
      await prisma.barreiraDoPaciente.create({
        data: {
          pacienteId: paciente.id,
          tipo: barreira.tipo as never,
          descricao: barreira.descricao ?? null,
          criadaEm: instanteDiasAtras(15),
        },
      });
    }

    // ---------------------------------------------------------------- pendências
    await prisma.pendenciaPreTratamento.deleteMany({
      where: { pacienteId: paciente.id },
    });
    if (perfil.pendencia) {
      await prisma.pendenciaPreTratamento.create({
        data: {
          pacienteId: paciente.id,
          tipo: perfil.pendencia.tipo as never,
          descricao: perfil.pendencia.descricao ?? null,
          referenteA: diasAtras(-perfil.pendencia.emDias),
        },
      });
    }

    // --------------------------------------------------------------- internações
    await prisma.internacao.deleteMany({ where: { pacienteId: paciente.id } });
    if (perfil.internacao) {
      await prisma.internacao.create({
        data: {
          pacienteId: paciente.id,
          motivo: perfil.internacao.motivo,
          local: 'Hospital de demonstração',
          iniciadaEm: diasAtras(perfil.internacao.iniciadaHaDias),
          altaEm:
            perfil.internacao.altaHaDias != null
              ? diasAtras(perfil.internacao.altaHaDias)
              : null,
        },
      });
    }
  }

  return { criados, atualizados };
}

publicar()
  .then(({ criados, atualizados }) => {
    console.log(
      `Dados de demonstração publicados: ${criados} pacientes criados, ${atualizados} atualizados.`,
    );
    console.log(`Senha de todos: ${SENHA_DE_DEMONSTRACAO}`);
  })
  .catch((erro: unknown) => {
    console.error('Falhou ao publicar os dados de demonstração:', erro);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
