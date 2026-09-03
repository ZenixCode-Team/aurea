/**
 * Dados sintéticos do sistema.
 *
 * ⚠️  TODO PACIENTE AQUI É INVENTADO. Nome, diagnóstico e sintoma de pessoa real
 * só entram depois da aprovação do Comitê de Ética — vale para tela, para print e
 * para apresentação. Mesma regra do seed da API.
 *
 * Estes dados existem para que as telas nasçam completas antes do backend estar
 * ligado. São mais ricos que o seed de propósito: uma tela só prova que funciona
 * quando encara vermelho, amarelo, silêncio, lista vazia e texto longo.
 */

import type {
  AcompanhamentoDeIntervencoes,
  PainelDeCadeiras,
  PainelDeNavegacao,
  IndicadoresDeToxicidade,
  CartaoDoPainel,
  ConjuntoResumido,
  DiaDoHistorico,
  HistoricoDoPaciente,
  ItemDaAgenda,
  Medicamento,
  Notificacao,
  Orientacao,
  PacientesDoDia,
  PerfilDoPaciente,
  Protocolo,
  RegistroDeAcesso,
  RegraResumida,
  SolicitacaoDeContato,
  SolicitacaoNaFila,
  UsuarioDaSessao,
  Verbete,
} from './tipos';

/** Ancora as datas para que a tela não mude de sentido conforme o dia. */
const HOJE = '2026-07-30';

/**
 * A hora é declarada no fuso do serviço, não em UTC.
 *
 * Escrever `T09:00Z` produziria 6 da manhã na tela — e o horário de uma sessão de
 * quimioterapia ou de um aviso da equipe precisa ser plausível para quem lê. O mesmo
 * cuidado que a API tem com `FUSO_HORARIO` vale para o dado de demonstração.
 */
function em(dia: string, hora = '09:00'): string {
  return `${dia}T${hora}:00.000-03:00`;
}

/* ==========================================================================
   Sessão
   ========================================================================== */

export const USUARIOS_SINTETICOS: Record<string, UsuarioDaSessao> = {
  paciente: {
    nome: 'Marta Ferreira (fictícia)',
    perfil: 'PACIENTE',
    permissoes: [],
  },
  enfermagem: {
    nome: 'Enfermeira de demonstração',
    perfil: 'PROFISSIONAL',
    permissoes: [
      'ATENDER_PLANTAO',
      'VER_HISTORICO_DE_PACIENTE',
      'REGISTRAR_INTERVENCAO',
    ],
  },
  administrador: {
    nome: 'Orientador de demonstração',
    perfil: 'ADMINISTRADOR',
    permissoes: [
      'EDITAR_ALGORITMO',
      'PUBLICAR_ALGORITMO',
      'EDITAR_ORIENTACAO',
      'GERENCIAR_CADASTROS',
      'GERENCIAR_USUARIOS',
    ],
  },
};

/* ==========================================================================
   Paciente
   ========================================================================== */

export const PERFIL_SINTETICO: PerfilDoPaciente = {
  paciente: {
    id: 'p-1',
    nome: 'Marta Ferreira (fictícia)',
    dataNascimento: '1968-03-11T00:00:00.000Z',
    sexo: 'FEMININO',
    diagnostico: 'Diagnóstico sintético de demonstração',
    convenio: null,
    tipoSanguineo: 'O+',
    urlDaFoto: null,
    habitoIntestinalBasal: 1,
  },
  medicoAssistente: {
    nome: 'Médico de demonstração',
    funcao: 'MEDICO',
    registroDoConselho: 'CRM-XX 000000',
  },
  tratamento: {
    protocolo: { id: 'prot-1', nome: 'Protocolo de demonstração' },
    iniciadoEm: em('2026-05-31'),
  },
  ciclo: {
    numero: 3,
    sessaoRealizadaEm: em('2026-07-27'),
    previsaoDaProximaSessao: em('2026-08-17'),
    diaDoCiclo: 3,
  },
  contatos: {
    doPaciente: [
      { id: 'c-1', nome: 'Marta Ferreira (fictícia)', telefone: '79900000000', relacao: null },
    ],
    deEmergencia: [
      { id: 'c-2', nome: 'Filha (fictícia)', telefone: '79911111111', relacao: 'familiar' },
    ],
  },
  alergias: [
    { id: 'a-1', substancia: 'Dipirona', reacao: 'Urticária', origem: 'EQUIPE' },
  ],
};

export const AGENDA_SINTETICA: readonly ItemDaAgenda[] = [
  {
    id: 'ag-1',
    tipo: 'QUIMIOTERAPIA',
    aconteceEm: em('2026-08-17', '09:00'),
    local: 'Centro de infusão, sala 2',
    observacoes: 'Chegar com 30 minutos de antecedência.',
    profissional: { nome: 'Enfermeira de demonstração', funcao: 'ENFERMEIRO' },
  },
  {
    id: 'ag-2',
    tipo: 'CONSULTA',
    aconteceEm: em('2026-08-10', '14:30'),
    local: 'Ambulatório, consultório 4',
    observacoes: null,
    profissional: { nome: 'Médico de demonstração', funcao: 'MEDICO' },
  },
  {
    id: 'ag-3',
    tipo: 'EXAME',
    aconteceEm: em('2026-08-05', '10:00'),
    local: 'Laboratório central',
    observacoes: 'Hemograma. Jejum de 4 horas.',
    profissional: null,
  },
];

export const BIBLIOTECA_SINTETICA: readonly Verbete[] = [
  {
    id: 'v-1',
    titulo: 'Como organizar os remédios em casa',
    resumo: 'Separe por horário, não por caixa, e não comece nada por conta própria.',
    categoria: 'MEDICAMENTOS',
    conteudo:
      'Durante o tratamento a lista de remédios costuma crescer, e alguns têm horário fixo enquanto outros são só se precisar. Confundir os dois é o engano mais comum.\n\nSepare por horário, não por caixa. Um porta-comprimidos de sete dias resolve mais do que qualquer aplicativo, porque mostra num olhar o que já foi tomado.\n\nNão comece nada por conta própria, nem chá, nem vitamina, nem remédio que ajudou alguém conhecido. Interação com quimioterapia não é raridade.',
    atualizadoEm: em('2026-06-02'),
  },
  {
    id: 'v-2',
    titulo: 'O que comer nos dias de enjoo',
    resumo: 'Refeições pequenas, frias e sem cheiro forte costumam descer melhor.',
    categoria: 'ALIMENTACAO',
    conteudo:
      'Nos dias em que o enjoo aparece, comer pouco e mais vezes funciona melhor do que tentar uma refeição grande.\n\nComidas frias ou mornas têm menos cheiro, e cheiro é o que mais provoca enjoo. Bolacha de água e sal, gelatina, fruta gelada e água de coco costumam ser bem aceitos.\n\nBeba líquido ao longo do dia, em goles pequenos, mesmo sem sede.',
    atualizadoEm: em('2026-06-02'),
  },
  {
    id: 'v-3',
    titulo: 'Cuidados com a boca durante o tratamento',
    resumo: 'Escova macia, bochecho sem álcool e atenção a feridas.',
    categoria: 'MUCOSITE',
    conteudo:
      'A quimioterapia pode deixar a boca sensível, com feridas ou ardência.\n\nUse escova de cerdas macias e evite enxaguante com álcool, que arde e resseca. Bochecho com água morna e uma pitada de sal ajuda a manter a boca limpa.\n\nSe aparecer ferida que atrapalhe comer ou beber, avise a equipe.',
    atualizadoEm: em('2026-06-02'),
  },
  {
    id: 'v-4',
    titulo: 'Movimento e descanso',
    resumo: 'O cansaço do tratamento não passa só com sono, e ficar parado costuma piorá-lo.',
    categoria: 'EXERCICIOS',
    conteudo:
      'O cansaço do tratamento é diferente do cansaço comum: não passa só com sono. E, ao contrário do que parece, ficar parado o dia inteiro costuma aumentá-lo.\n\nCaminhada leve, na maioria dos dias, é o que tem mais evidência a favor. A régua é conseguir conversar enquanto se movimenta.\n\nDistribua as tarefas ao longo da semana em vez de concentrar tudo num dia bom.',
    atualizadoEm: em('2026-06-02'),
  },
];

export const NOTIFICACOES_SINTETICAS: readonly Notificacao[] = [
  {
    id: 'n-1',
    titulo: 'Seu check-in de hoje está aberto',
    corpo: 'Leva cerca de dois minutos. Você pode parar no meio e voltar depois.',
    criadaEm: em(HOJE, '08:00'),
    lidaEm: null,
  },
  {
    id: 'n-2',
    titulo: 'A enfermagem respondeu seu contato',
    corpo: 'A equipe registrou seu pedido de ontem e vai ligar hoje pela manhã.',
    criadaEm: em('2026-07-29', '14:20'),
    lidaEm: em('2026-07-29', '15:02'),
  },
  {
    id: 'n-3',
    titulo: 'Sua próxima sessão está marcada',
    corpo: 'Dia 17 de agosto, às 9h, no centro de infusão.',
    criadaEm: em('2026-07-28', '10:00'),
    lidaEm: em('2026-07-28', '10:31'),
  },
];

export const HISTORICO_DO_PACIENTE_SINTETICO: readonly DiaDoHistorico[] = [
  { sessaoId: 's-1', dia: '2026-07-29', estado: 'CONCLUIDA', diaDoCiclo: 2, sintomasRelatados: ['NAUSEA_VOMITO'] },
  { sessaoId: 's-2', dia: '2026-07-28', estado: 'CONCLUIDA', diaDoCiclo: 1, sintomasRelatados: [] },
  { sessaoId: 's-3', dia: '2026-07-27', estado: 'ABANDONADA', diaDoCiclo: 0, sintomasRelatados: [] },
  { sessaoId: 's-4', dia: '2026-07-26', estado: 'CONCLUIDA', diaDoCiclo: 20, sintomasRelatados: ['DOR'] },
  { sessaoId: 's-5', dia: '2026-07-25', estado: 'CONCLUIDA', diaDoCiclo: 19, sintomasRelatados: [] },
];

export const SOLICITACOES_DO_PACIENTE_SINTETICAS: readonly SolicitacaoDeContato[] = [
  {
    id: 'sc-1',
    motivo: 'Dúvida sobre o remédio de enjoo',
    criadaEm: em('2026-07-29', '13:40'),
    situacao: 'ATENDIDA',
    atendidaEm: em('2026-07-29', '16:10'),
  },
];

/* ==========================================================================
   Painel da equipe
   ========================================================================== */

const CARTOES: readonly CartaoDoPainel[] = [
  {
    pacienteId: 'p-4',
    nome: 'Antônio Reis (fictício)',
    protocolo: 'Protocolo de demonstração',
    situacao: 'VERMELHO',
    respondeuHoje: true,
    diasSemResponder: null,
    nuncaRespondeu: false,
    ultimaSessaoId: 's-10',
    diaDoCiclo: 7,
  },
  {
    pacienteId: 'p-2',
    nome: 'Helena Duarte (fictícia)',
    protocolo: 'Protocolo de demonstração',
    situacao: 'AMARELO',
    respondeuHoje: true,
    diasSemResponder: null,
    nuncaRespondeu: false,
    ultimaSessaoId: 's-11',
    diaDoCiclo: 12,
  },
  {
    pacienteId: 'p-6',
    nome: 'Rita Camargo (fictícia)',
    protocolo: 'Protocolo de demonstração',
    situacao: 'AMARELO',
    respondeuHoje: true,
    diasSemResponder: null,
    nuncaRespondeu: false,
    ultimaSessaoId: 's-12',
    diaDoCiclo: 4,
  },
  {
    pacienteId: 'p-5',
    nome: 'Sebastião Alves (fictício)',
    protocolo: 'Protocolo de demonstração',
    situacao: 'NAO_CLASSIFICADA',
    respondeuHoje: true,
    diasSemResponder: null,
    nuncaRespondeu: false,
    ultimaSessaoId: 's-13',
    diaDoCiclo: 9,
  },
  {
    pacienteId: 'p-7',
    nome: 'Joana Peixoto (fictícia)',
    protocolo: 'Protocolo de demonstração',
    situacao: 'SEM_RESPOSTA_HOJE',
    respondeuHoje: false,
    diasSemResponder: 3,
    nuncaRespondeu: false,
    ultimaSessaoId: 's-14',
    diaDoCiclo: 15,
  },
  {
    pacienteId: 'p-8',
    nome: 'Célia Nunes (fictícia)',
    protocolo: 'Protocolo de demonstração',
    situacao: 'SEM_RESPOSTA_HOJE',
    respondeuHoje: false,
    diasSemResponder: null,
    nuncaRespondeu: true,
    ultimaSessaoId: null,
    diaDoCiclo: 1,
  },
  {
    pacienteId: 'p-1',
    nome: 'Marta Ferreira (fictícia)',
    protocolo: 'Protocolo de demonstração',
    situacao: 'VERDE',
    respondeuHoje: true,
    diasSemResponder: null,
    nuncaRespondeu: false,
    ultimaSessaoId: 's-1',
    diaDoCiclo: 3,
  },
  {
    pacienteId: 'p-3',
    nome: 'Wagner Portela (fictício)',
    protocolo: 'Protocolo de demonstração',
    situacao: 'VERDE',
    respondeuHoje: true,
    diasSemResponder: null,
    nuncaRespondeu: false,
    ultimaSessaoId: 's-15',
    diaDoCiclo: 18,
  },
];

export const PACIENTES_DO_DIA_SINTETICOS: PacientesDoDia = {
  cards: CARTOES,
  resumo: {
    total: CARTOES.length,
    vermelhos: CARTOES.filter((c) => c.situacao === 'VERMELHO').length,
    amarelos: CARTOES.filter((c) => c.situacao === 'AMARELO').length,
    verdes: CARTOES.filter((c) => c.situacao === 'VERDE').length,
    semResposta: CARTOES.filter((c) => c.situacao === 'SEM_RESPOSTA_HOJE').length,
  },
};

export const HISTORICOS_SINTETICOS: Record<string, HistoricoDoPaciente> = {
  'p-4': {
    paciente: {
      id: 'p-4',
      nome: 'Antônio Reis (fictício)',
      diagnostico: 'Diagnóstico sintético de demonstração',
      protocolo: 'Protocolo de demonstração',
      diaDoCiclo: 7,
      numeroDoCiclo: 2,
      /* História de vida do espelho. Preenchida por inteiro num paciente só, de
         propósito: é o que deixa ver a breve história completa E a barra de cadastro
         incompleto nos outros dois, sem precisar de banco. Nenhum valor aqui é
         plausível a ponto de passar por dado real — é a mesma regra da posologia. */
      sexo: 'MASCULINO',
      dataNascimento: '1963-05-22T00:00:00.000Z',
      habitoIntestinalBasal: 1,
      tabagismo: 'EX_FUMANTE',
      parouDeFumarEm: '2019-08-01T00:00:00.000Z',
      atividadeFisica: 'LEVE',
      descricaoDaAtividade: 'caminha três vezes por semana',
      consumoDeAlcool: 'NAO_BEBE',
      alergias: [
        { descricao: 'dipirona (fictícia)', confirmadaEm: '2026-07-02T00:00:00.000Z' },
        { descricao: 'penicilina (fictícia)', origem: 'PACIENTE', confirmadaEm: null },
      ],
      comorbidades: [
        { descricao: 'hipertensão (fictícia)', confirmadaEm: '2026-07-02T00:00:00.000Z' },
      ],
    },
    sessoes: [
      {
        sessaoId: 's-10',
        dia: HOJE,
        estado: 'CONCLUIDA',
        diaDoCiclo: 7,
        classificacao: 'VERMELHO',
        naoClassificadaPorque: null,
        versaoDoConjunto: 'rascunho-0',
        validadoClinicamente: false,
        respostas: [
          { sintoma: 'FEBRE', campo: 'apresentouFebre', pergunta: 'Você teve febre?', valor: true, unidade: null },
          { sintoma: 'FEBRE', campo: 'temperaturaMaxima', pergunta: 'Qual foi a temperatura mais alta que você mediu?', valor: 38.6, unidade: '°C' },
          { sintoma: 'FEBRE', campo: 'usouAntitermico', pergunta: 'Você tomou algum remédio para baixar a febre?', valor: false, unidade: null },
          { sintoma: 'DIARREIA', campo: 'teveDiarreia', pergunta: 'Você teve diarreia?', valor: true, unidade: null },
          { sintoma: 'DIARREIA', campo: 'evacuacoesNoDia', pergunta: 'Quantas vezes evacuou hoje?', valor: 5, unidade: null },
        ],
        regrasDisparadas: [
          {
            regraId: 'r-1',
            sintoma: 'FEBRE',
            campo: 'temperaturaMaxima',
            valorObservado: 38.6,
            classificacao: 'VERMELHO',
            justificativa: 'Temperatura igual ou acima de 38,0 °C em paciente neutropênico é emergência oncológica.',
          },
          {
            regraId: 'r-7',
            sintoma: 'DIARREIA',
            campo: 'evacuacoesNoDia',
            valorObservado: 5,
            classificacao: 'AMARELO',
            justificativa: 'Aumento de 4 a 6 evacuações sobre o hábito basal corresponde a diarreia grau 2.',
          },
        ],
        intervencoes: [],
      },
      {
        sessaoId: 's-16',
        dia: '2026-07-29',
        estado: 'CONCLUIDA',
        diaDoCiclo: 6,
        classificacao: 'AMARELO',
        naoClassificadaPorque: null,
        versaoDoConjunto: 'rascunho-0',
        validadoClinicamente: false,
        respostas: [
          { sintoma: 'FEBRE', campo: 'apresentouFebre', pergunta: 'Você teve febre?', valor: true, unidade: null },
          { sintoma: 'FEBRE', campo: 'temperaturaMaxima', pergunta: 'Qual foi a temperatura mais alta que você mediu?', valor: 37.9, unidade: '°C' },
        ],
        regrasDisparadas: [
          {
            regraId: 'r-2',
            sintoma: 'FEBRE',
            campo: 'temperaturaMaxima',
            valorObservado: 37.9,
            classificacao: 'AMARELO',
            justificativa: 'Temperatura entre 37,8 °C e 37,9 °C exige nova medição e contato com a equipe.',
          },
        ],
        intervencoes: [
          {
            id: 'i-1',
            registradaEm: em('2026-07-29', '16:40'),
            profissional: 'Enfermeira de demonstração',
            conduta: 'Contato telefônico. Orientada nova medição em 2 horas e retorno imediato se subir.',
            situacaoDoSintoma: 'EM_ACOMPANHAMENTO',
          },
        ],
      },
    ],
  },
  'p-5': {
    paciente: {
      id: 'p-5',
      nome: 'Sebastião Alves (fictício)',
      diagnostico: 'Diagnóstico sintético de demonstração',
      protocolo: 'Protocolo de demonstração',
      diaDoCiclo: 9,
    },
    sessoes: [
      {
        sessaoId: 's-13',
        dia: HOJE,
        estado: 'ABANDONADA',
        diaDoCiclo: 9,
        classificacao: null,
        naoClassificadaPorque:
          'Questionário começado e não terminado. Silêncio não é verde; as duas causas mais prováveis são opostas.',
        versaoDoConjunto: 'rascunho-0',
        validadoClinicamente: false,
        respostas: [
          { sintoma: 'FEBRE', campo: 'apresentouFebre', pergunta: 'Você teve febre?', valor: false, unidade: null },
        ],
        regrasDisparadas: [],
        intervencoes: [],
      },
    ],
  },
};

export const FILA_DE_CONTATOS_SINTETICA: readonly SolicitacaoNaFila[] = [
  {
    id: 'sc-10',
    motivo: 'Está com dor que não passa com o remédio',
    criadaEm: em(HOJE, '08:12'),
    situacao: 'ABERTA',
    atendidaEm: null,
    paciente: { id: 'p-2', nome: 'Helena Duarte (fictícia)', telefone: '79922222222' },
  },
  {
    id: 'sc-11',
    motivo: null,
    criadaEm: em(HOJE, '07:55'),
    situacao: 'ABERTA',
    atendidaEm: null,
    paciente: { id: 'p-6', nome: 'Rita Camargo (fictícia)', telefone: '79933333333' },
  },
  {
    id: 'sc-12',
    motivo: 'Dúvida sobre horário da próxima sessão',
    criadaEm: em('2026-07-29', '15:30'),
    situacao: 'ATENDIDA',
    atendidaEm: em('2026-07-29', '16:02'),
    paciente: { id: 'p-3', nome: 'Wagner Portela (fictício)', telefone: '79944444444' },
  },
];

/* ==========================================================================
   Administração
   ========================================================================== */

export const CONJUNTOS_SINTETICOS: readonly ConjuntoResumido[] = [
  {
    id: 'cj-2',
    versao: 'rascunho-1',
    descricao: 'Ajuste do corte de diarreia após revisão da enfermagem',
    origem: 'CTCAE v5.0 + protocolo do serviço',
    estado: 'RASCUNHO',
    validadoClinicamente: false,
    criadoEm: em('2026-07-28'),
    publicadoEm: null,
    quantidadeDeRegras: 15,
  },
  {
    id: 'cj-1',
    versao: 'rascunho-0',
    descricao: 'Conjunto inicial de demonstração',
    origem: 'CTCAE v5.0',
    estado: 'PUBLICADO',
    validadoClinicamente: false,
    criadoEm: em('2026-06-15'),
    publicadoEm: em('2026-06-15'),
    quantidadeDeRegras: 14,
  },
];

export const REGRAS_SINTETICAS: readonly RegraResumida[] = [
  { id: 'r-1', sintoma: 'FEBRE', campo: 'temperaturaMaxima', operador: 'MAIOR_OU_IGUAL', valor: 38, classificacao: 'VERMELHO', justificativa: 'Temperatura igual ou acima de 38,0 °C em paciente neutropênico é emergência oncológica.' },
  { id: 'r-2', sintoma: 'FEBRE', campo: 'temperaturaMaxima', operador: 'MAIOR_OU_IGUAL', valor: 37.8, classificacao: 'AMARELO', justificativa: 'Temperatura entre 37,8 °C e 37,9 °C exige nova medição e contato com a equipe.' },
  { id: 'r-7', sintoma: 'DIARREIA', campo: 'evacuacoesNoDia', operador: 'MAIOR_OU_IGUAL', valor: 4, classificacao: 'AMARELO', justificativa: 'Aumento de 4 a 6 evacuações sobre o hábito basal corresponde a diarreia grau 2.' },
  { id: 'r-8', sintoma: 'DIARREIA', campo: 'evacuacoesNoDia', operador: 'MAIOR_OU_IGUAL', valor: 7, classificacao: 'VERMELHO', justificativa: 'Sete ou mais evacuações acima do basal é grau 3 e indica risco de desidratação.' },
  { id: 'r-11', sintoma: 'NAUSEA_VOMITO', campo: 'episodiosDeVomito', operador: 'MAIOR_OU_IGUAL', valor: 6, classificacao: 'VERMELHO', justificativa: 'Seis ou mais episódios em 24 horas impede hidratação por via oral.' },
  { id: 'r-14', sintoma: 'DOR', campo: 'intensidadeDaDor', operador: 'MAIOR_OU_IGUAL', valor: 7, classificacao: 'VERMELHO', justificativa: 'Dor 7 ou mais na escala numérica é dor grave e exige avaliação no dia.' },
  { id: 'r-16', sintoma: 'FALTA_DE_AR', campo: 'esforcoComFaltaDeAr', operador: 'ESTA_EM', valor: null, classificacao: 'VERMELHO', justificativa: 'Falta de ar em repouso é sinal de gravidade independente de outros sintomas.' },
];

export const PROTOCOLOS_SINTETICOS: readonly Protocolo[] = [
  { id: 'prot-1', nome: 'Protocolo de demonstração', descricao: 'Conjunto sintético para validação da interface.', ativo: true },
  { id: 'prot-2', nome: 'AC-T (demonstração)', descricao: null, ativo: false },
];

export const MEDICAMENTOS_SINTETICOS: readonly Medicamento[] = [
  { id: 'med-1', nome: 'Ondansetrona', principioAtivo: 'Ondansetrona' },
  { id: 'med-2', nome: 'Dipirona', principioAtivo: 'Metamizol sódico' },
  { id: 'med-3', nome: 'Loperamida', principioAtivo: 'Loperamida' },
];

export const ORIENTACOES_SINTETICAS: readonly Orientacao[] = [
  { id: 'o-1', sintoma: 'FEBRE', classificacao: 'VERMELHO', titulo: 'Procure o serviço hoje', texto: 'Sua temperatura está acima do limite que a equipe combinou acompanhar de perto. Entre em contato com o serviço agora e não tome remédio para baixar a febre antes de falar com a equipe.' },
  { id: 'o-2', sintoma: 'FEBRE', classificacao: 'AMARELO', titulo: 'Meça de novo em duas horas', texto: 'Sua temperatura está um pouco acima do normal. Meça novamente em duas horas, anote o valor e entre em contato se subir.' },
  { id: 'o-3', sintoma: 'NAUSEA_VOMITO', classificacao: 'AMARELO', titulo: 'Cuidados com o enjoo', texto: 'Prefira refeições pequenas, frias e sem cheiro forte. Beba líquido em goles pequenos ao longo do dia. Se não conseguir segurar líquido nenhum, avise a equipe.' },
  { id: 'o-4', sintoma: null, classificacao: 'VERDE', titulo: 'Dia tranquilo', texto: 'Nada no que você relatou hoje pede atenção diferente. Siga com os cuidados de sempre e responda de novo amanhã.' },
];

export const REGISTRO_DE_ACESSOS_SINTETICO: readonly RegistroDeAcesso[] = [
  { id: 'la-1', aconteceuEm: em(HOJE, '08:02'), usuario: 'Enfermeira de demonstração', acao: 'LOGIN', recurso: null, enderecoDeOrigem: '10.0.0.14' },
  { id: 'la-2', aconteceuEm: em(HOJE, '08:04'), usuario: 'Enfermeira de demonstração', acao: 'LEITURA_DE_HISTORICO', recurso: 'Antônio Reis (fictício)', enderecoDeOrigem: '10.0.0.14' },
  { id: 'la-3', aconteceuEm: em('2026-07-28', '17:20'), usuario: 'Orientador de demonstração', acao: 'EDICAO_DE_ALGORITMO', recurso: 'rascunho-1', enderecoDeOrigem: '10.0.0.31' },
  { id: 'la-4', aconteceuEm: em('2026-06-15', '11:05'), usuario: 'Orientador de demonstração', acao: 'PUBLICACAO_DE_ALGORITMO', recurso: 'rascunho-0', enderecoDeOrigem: '10.0.0.31' },
];

/**
 * Bloco 7 dos prints, no espelho. Os três desfechos aparecem porque a tabela precisa
 * mostrar que "aguardando retorno", "encaminhado ao PA" e "reavaliar" são estados
 * diferentes, e não sinônimos elegantes de "em aberto".
 */
export const INTERVENCOES_SINTETICAS: AcompanhamentoDeIntervencoes = {
  itens: [
    {
      id: 'i-1',
      pacienteId: 'p-4',
      paciente: 'Antônio Reis (fictício)',
      sessaoId: 's-10',
      motivo: 'FEBRE',
      justificativa: 'Temperatura acima do limiar do protocolo.',
      classificacao: 'VERMELHO',
      situacao: 'ENCAMINHADO_AO_PA',
      conduta:
        'Contato telefônico. Orientado a procurar o pronto atendimento do serviço hoje.',
      profissional: 'Enfermeira de demonstração',
      contatoRealizadoEm: HOJE,
      registradaEm: HOJE,
    },
    {
      id: 'i-2',
      pacienteId: 'p-1',
      paciente: 'Helena Duarte (fictícia)',
      sessaoId: 's-4',
      motivo: 'DIARREIA',
      justificativa: 'De 3 a 5 evacuações soltas em 24 horas.',
      classificacao: 'AMARELO',
      situacao: 'AGUARDANDO_RETORNO',
      conduta: 'Orientada hidratação e registro dos episódios. Retorno combinado à tarde.',
      profissional: 'Enfermeira de demonstração',
      contatoRealizadoEm: HOJE,
      registradaEm: HOJE,
    },
    {
      id: 'i-3',
      pacienteId: 'p-2',
      paciente: 'Rita Camargo (fictícia)',
      sessaoId: 's-6',
      motivo: 'DOR',
      justificativa: 'Dor de 4 a 7 na escala.',
      classificacao: 'AMARELO',
      situacao: 'REAVALIAR',
      conduta: 'Analgesia conforme prescrição. Reavaliar amanhã no check-in.',
      profissional: 'Enfermeira de demonstração',
      contatoRealizadoEm: HOJE,
      registradaEm: HOJE,
    },
  ],
  resumo: { abertas: 3, total: 3 },
};

/**
 * Bloco 5 no espelho. Os números batem entre si de propósito: 12 sessões, e cada taxa
 * é a divisão real das ocorrências por elas. Espelho com percentual inventado é o
 * caminho mais curto para alguém apresentar um gráfico que não fecha.
 */
export const INDICADORES_DE_TOXICIDADE_SINTETICOS: IndicadoresDeToxicidade = {
  diasConsiderados: 30,
  totalDeSessoes: 12,
  amostraSuficiente: true,
  taxas: [
    { sintoma: 'NAUSEA_VOMITO', ocorrencias: 6, totalDeSessoes: 12, percentual: 50 },
    { sintoma: 'DOR', ocorrencias: 4, totalDeSessoes: 12, percentual: 33 },
    { sintoma: 'DIARREIA', ocorrencias: 3, totalDeSessoes: 12, percentual: 25 },
    { sintoma: 'FEBRE', ocorrencias: 1, totalDeSessoes: 12, percentual: 8 },
  ],
  porProtocolo: [
    {
      protocolo: 'Protocolo de demonstração',
      totalDeSessoes: 12,
      sintomaMaisFrequente: 'NAUSEA_VOMITO',
      ocorrenciasDoMaisFrequente: 6,
      amostraSuficiente: true,
    },
  ],
};

/** Blocos 6, 9, 10 e 11 no espelho. Números coerentes entre si: o mural repete o que
    as listas mostram, e não valores soltos que não fecham numa apresentação. */
export const NAVEGACAO_SINTETICA: PainelDeNavegacao = {
  indicadores: {
    pacientesAcompanhados: 8,
    intervencoesRealizadas: 14,
    tempoMedioDeRespostaEmMinutos: 47,
    encaminhamentos: 2,
    internacoesNotificadas: 1,
    tratamentosSuspensos: 1,
    pacientesSemRedeDeApoio: 2,
    pacientesComDificuldadeDeAcesso: 3,
  },
  barreiras: [
    { tipo: 'TRANSPORTE', quantidade: 3 },
    { tipo: 'ANSIEDADE', quantidade: 2 },
    { tipo: 'AUTORIZACAO', quantidade: 2 },
    { tipo: 'FINANCEIRA', quantidade: 1 },
  ],
  alertasPreTratamento: [
    {
      id: 'a-1',
      pacienteId: 'p-1',
      paciente: 'Helena Duarte (fictícia)',
      tipo: 'EXAME',
      descricao: 'Hemograma da véspera não coletado',
      referenteA: HOJE,
    },
    {
      id: 'a-2',
      pacienteId: 'p-2',
      paciente: 'Rita Camargo (fictícia)',
      tipo: 'AUTORIZACAO',
      descricao: null,
      referenteA: HOJE,
    },
  ],
  mural: {
    pacientesInternados: 1,
    tratamentosSuspensos: 1,
    pendenciasParaAmanha: 2,
    barreirasAbertas: 8,
  },
};

/**
 * Giro de cadeiras no espelho — dez poltronas, exatamente o exemplo dos prints.
 *
 * Os horários são relativos ao dia em que a tela abre, e não fixos: espelho com data
 * cravada mostra "ocupação de 3 de setembro" em qualquer demonstração futura.
 */
function horaDeHoje(hora: number, minuto = 0): string {
  const d = new Date();
  d.setHours(hora, minuto, 0, 0);
  return d.toISOString();
}

export const GIRO_DE_CADEIRAS_SINTETICO: PainelDeCadeiras = (() => {
  const cadeiras = Array.from({ length: 10 }, (_, i) => ({
    id: `cad-${i + 1}`,
    numero: i + 1,
    ativa: true,
  }));

  /* Seis ocupadas, duas em preparo, uma aguardando medicação, uma livre: os números
     do print, para a demonstração bater com o que foi desenhado. */
  const estados = [
    'EM_INFUSAO',
    'EM_INFUSAO',
    'EM_INFUSAO',
    'EM_INFUSAO',
    'EM_INFUSAO',
    'EM_OBSERVACAO',
    'EM_PREPARO',
    'EM_PREPARO',
    'AGUARDANDO_MEDICACAO',
  ] as const;

  const nomes = [
    'Marisa Andrade (fictícia)',
    'Rubens Tavares (fictício)',
    'Otávio Lins (fictício)',
    'Ivone Prado (fictícia)',
    'Gilmar Peçanha (fictício)',
    'Sônia Vasques (fictícia)',
    'Neusa Correia (fictícia)',
    'Hélio Braga (fictício)',
    'Denise Fontes (fictícia)',
  ];

  const sessoesDoDia = estados.map((estado, i) => ({
    id: `si-${i + 1}`,
    paciente: nomes[i] ?? 'Paciente (fictício)',
    cadeiraId: `cad-${i + 1}`,
    protocolo: i % 2 === 0 ? 'FOLFOX (demonstração)' : 'AC-T (demonstração)',
    estado,
    previsaoDeInicio: horaDeHoje(8 + (i % 3) * 2, (i % 2) * 20),
    previsaoDeFim: horaDeHoje(10 + (i % 3) * 2, 20 + (i % 2) * 10),
    inicioReal: horaDeHoje(8 + (i % 3) * 2, (i % 2) * 20 + 7),
    fimReal: null,
    medicacaoLiberadaEm: null,
  }));

  const porCadeira = cadeiras.map((cadeira, i) => {
    const sessao = sessoesDoDia[i] ?? null;
    const estado = !sessao
      ? ('DISPONIVEL' as const)
      : sessao.estado === 'EM_INFUSAO'
        ? ('OCUPADA' as const)
        : sessao.estado === 'EM_PREPARO'
          ? ('EM_PREPARO' as const)
          : sessao.estado === 'EM_OBSERVACAO'
            ? ('EM_OBSERVACAO' as const)
            : ('AGUARDANDO_MEDICACAO' as const);

    return {
      cadeira,
      estado,
      sessaoAtual: sessao,
      livreEm: sessao ? sessao.previsaoDeFim : null,
    };
  });

  return {
    giro: {
      total: 10,
      ocupadas: 5,
      emPreparo: 2,
      aguardandoMedicacao: 1,
      emObservacao: 1,
      disponiveis: 1,
      taxaDeOcupacao: 90,
      tempoMedioDeOcupacaoEmMinutos: 138,
      proximaCadeiraLivreEm: horaDeHoje(14, 35),
      atrasoAcumuladoEmMinutos: 27,
      porCadeira,
    },
    janelasLivres: [
      {
        cadeiraId: 'cad-10',
        numero: 10,
        de: horaDeHoje(15, 10),
        ate: horaDeHoje(19, 0),
        minutos: 230,
      },
      {
        cadeiraId: 'cad-6',
        numero: 6,
        de: horaDeHoje(16, 30),
        ate: horaDeHoje(19, 0),
        minutos: 150,
      },
    ],
    sessoesDoDia,
    expediente: { abertura: horaDeHoje(7, 0), fechamento: horaDeHoje(19, 0) },
  };
})();
