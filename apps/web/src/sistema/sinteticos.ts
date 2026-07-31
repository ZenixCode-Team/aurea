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
    local: 'Centro de infusão — sala 2',
    observacoes: 'Chegar com 30 minutos de antecedência.',
    profissional: { nome: 'Enfermeira de demonstração', funcao: 'ENFERMEIRO' },
  },
  {
    id: 'ag-2',
    tipo: 'CONSULTA',
    aconteceEm: em('2026-08-10', '14:30'),
    local: 'Ambulatório — consultório 4',
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
    titulo: 'Quando a febre precisa de atenção imediata',
    resumo: 'Febre durante a quimioterapia não é como uma febre comum.',
    categoria: 'QUANDO_PROCURAR_AJUDA',
    conteudo:
      'Durante a quimioterapia, a defesa do corpo fica mais baixa. Por isso a febre pede atenção mesmo quando você se sente bem no resto.\n\nMeça a temperatura sempre que sentir calor, calafrio ou moleza. Se passar de 37,8 °C, entre em contato com a equipe no mesmo dia — não espere a febre subir mais para ver o que acontece.\n\nNão tome remédio para baixar a febre antes de falar com a equipe. O remédio esconde o sinal e atrasa a avaliação.',
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
    categoria: 'CUIDADOS_EM_CASA',
    conteudo:
      'A quimioterapia pode deixar a boca sensível, com feridas ou ardência.\n\nUse escova de cerdas macias e evite enxaguante com álcool, que arde e resseca. Bochecho com água morna e uma pitada de sal ajuda a manter a boca limpa.\n\nSe aparecer ferida que atrapalhe comer ou beber, avise a equipe.',
    atualizadoEm: em('2026-06-02'),
  },
  {
    id: 'v-4',
    titulo: 'Por que o check-in é todo dia',
    resumo: 'A pergunta diária serve para achar o sinal cedo, não para vigiar você.',
    categoria: 'TRATAMENTO',
    conteudo:
      'O check-in leva cerca de dois minutos e existe por um motivo simples: efeito colateral achado no começo é muito mais fácil de resolver.\n\nResponder que está tudo bem é tão útil quanto relatar um sintoma — é assim que a equipe sabe que o dia foi tranquilo.\n\nSe você não conseguir responder um dia, tudo bem. A equipe vê que faltou resposta e entra em contato.',
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
          'Questionário começado e não terminado. Silêncio não é verde — as duas causas mais prováveis são opostas.',
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
