/**
 * A fronteira entre as telas e a origem dos dados.
 *
 * Nenhuma tela conhece `fetch`, status HTTP ou o formato cru da API. Todas chamam as
 * funções daqui, e é aqui que a resposta do servidor é traduzida para o vocabulário
 * das telas.
 *
 * `ORIGEM_DOS_DADOS` decide se o sistema fala com a API ou com o dado sintético. O
 * modo sintético não foi removido de propósito: ele é o que permite abrir as telas
 * sem servidor e sem banco, para revisão visual e para demonstração.
 *
 * Onde a API e a tela discordam de nome, quem cede é a tela — mas a tradução mora
 * aqui, não espalhada em trinta arquivos.
 */

import { ARVORE_DE_TRIAGEM } from '@aurea/contratos';
import { chamar } from './api';
import { ErroDaFonte } from './erros';
import {
  AGENDA_SINTETICA,
  BIBLIOTECA_SINTETICA,
  CONJUNTOS_SINTETICOS,
  FILA_DE_CONTATOS_SINTETICA,
  HISTORICOS_SINTETICOS,
  HISTORICO_DO_PACIENTE_SINTETICO,
  MEDICAMENTOS_SINTETICOS,
  NOTIFICACOES_SINTETICAS,
  ORIENTACOES_SINTETICAS,
  PACIENTES_DO_DIA_SINTETICOS,
  PERFIL_SINTETICO,
  PROTOCOLOS_SINTETICOS,
  REGISTRO_DE_ACESSOS_SINTETICO,
  REGRAS_SINTETICAS,
  SOLICITACOES_DO_PACIENTE_SINTETICAS,
  INDICADORES_DE_TOXICIDADE_SINTETICOS,
  NAVEGACAO_SINTETICA,
  INTERVENCOES_SINTETICAS,
} from './sinteticos';
import type {
  CartaoDoPainel,
  PacienteAcompanhado,
  Classificacao,
  ConjuntoResumido,
  DiaDoHistorico,
  HistoricoDoPaciente,
  Intervencao,
  ItemDaAgenda,
  Medicamento,
  Notificacao,
  Orientacao,
  PacientesDoDia,
  PerfilDoPaciente,
  Protocolo,
  RamoDaTriagem,
  RegistroDeAcesso,
  RegraDisparada,
  RegraResumida,
  RespostaRegistrada,
  RespostasDoCheckin,
  RetornoDoCheckin,
  SessaoNoHistorico,
  Sintoma,
  SituacaoDoSintoma,
  SituacaoNoPainel,
  SolicitacaoDeContato,
  AcompanhamentoDeIntervencoes,
  IndicadoresDeToxicidade,
  PainelDeNavegacao,
  SolicitacaoNaFila,
  Verbete,
  VerbeteResumido,
} from './tipos';

export { ErroDaFonte };

/**
 * De onde vêm os dados.
 *
 * `'api'` é o modo do produto. `'sintetico'` abre todas as telas sem servidor nem
 * banco — útil para revisão visual e demonstração, e é o único modo em que nenhum
 * dado real de paciente pode aparecer.
 */
export const ORIGEM_DOS_DADOS: 'sintetico' | 'api' =
  (process.env.NEXT_PUBLIC_ORIGEM_DOS_DADOS as 'sintetico' | 'api' | undefined) ?? 'api';

const usandoApi = ORIGEM_DOS_DADOS === 'api';

/**
 * Latência artificial do modo sintético.
 *
 * Existe para que os estados de carregamento sejam vistos durante o desenvolvimento,
 * e não descobertos quebrados quando a rede real aparece.
 */
function comAtraso<T>(valor: T, ms = 220): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), ms));
}

/* ==========================================================================
   Paciente
   ========================================================================== */

export async function buscarPerfilDoPaciente(): Promise<PerfilDoPaciente> {
  if (!usandoApi) return comAtraso(PERFIL_SINTETICO);
  return chamar<PerfilDoPaciente>('/paciente/perfil');
}

interface PaginaDaApi<T> {
  readonly itens: readonly T[];
  readonly proximoCursor: string | null;
}

export async function buscarAgenda(): Promise<readonly ItemDaAgenda[]> {
  if (!usandoApi) {
    return comAtraso(
      [...AGENDA_SINTETICA].sort((a, b) => a.aconteceEm.localeCompare(b.aconteceEm)),
    );
  }
  const pagina = await chamar<PaginaDaApi<ItemDaAgenda>>('/paciente/agenda');
  return pagina.itens;
}

/** A API chama o texto do verbete de `corpo`; a tela chama de `conteudo`. */
interface VerbeteDaApi {
  readonly id: string;
  readonly titulo: string;
  readonly resumo: string | null;
  readonly categoria: Verbete['categoria'];
  readonly corpo?: string;
  readonly conteudo?: string;
  readonly atualizadoEm?: string;
}

function comoVerbete(cru: VerbeteDaApi): Verbete {
  return {
    id: cru.id,
    titulo: cru.titulo,
    resumo: cru.resumo ?? '',
    categoria: cru.categoria,
    conteudo: cru.conteudo ?? cru.corpo ?? '',
    atualizadoEm: cru.atualizadoEm ?? new Date().toISOString(),
  };
}

export async function buscarBiblioteca(): Promise<readonly VerbeteResumido[]> {
  if (!usandoApi) {
    return comAtraso(
      BIBLIOTECA_SINTETICA.map(({ id, titulo, resumo, categoria }) => ({
        id,
        titulo,
        resumo,
        categoria,
      })),
    );
  }
  const pagina = await chamar<PaginaDaApi<VerbeteDaApi>>('/paciente/biblioteca');
  return pagina.itens.map((item) => ({
    id: item.id,
    titulo: item.titulo,
    resumo: item.resumo ?? '',
    categoria: item.categoria,
  }));
}

export async function buscarVerbete(id: string): Promise<Verbete> {
  if (!usandoApi) {
    const verbete = BIBLIOTECA_SINTETICA.find((v) => v.id === id);
    if (!verbete) throw new ErroDaFonte('Verbete não encontrado.', 'NAO_ENCONTRADO');
    return comAtraso(verbete);
  }
  return comoVerbete(await chamar<VerbeteDaApi>(`/paciente/biblioteca/${id}`));
}

interface NotificacaoDaApi {
  readonly id: string;
  readonly titulo: string;
  readonly corpo: string;
  readonly criadaEm: string;
  readonly lidaEm: string | null;
}

export async function buscarNotificacoes(): Promise<readonly Notificacao[]> {
  if (!usandoApi) return comAtraso(NOTIFICACOES_SINTETICAS);
  const pagina = await chamar<PaginaDaApi<NotificacaoDaApi>>('/paciente/notificacoes');
  return pagina.itens;
}

export async function marcarNotificacaoComoLida(id: string): Promise<void> {
  if (!usandoApi) return;
  await chamar<void>(`/paciente/notificacoes/${id}/leitura`, { metodo: 'POST' });
}

/* ==========================================================================
   Triagem
   ========================================================================== */

/**
 * A árvore vem do pacote de contratos, não da rede.
 *
 * Ela é a única coisa aqui que não é dado de paciente: é código versionado, a mesma
 * constante que a API serve em `/triagem/arvore`. Importar direto elimina a chamada
 * e, principalmente, impede que existam duas verdades sobre quais perguntas o
 * check-in faz — o que a fronteira declarada em `sintomas.ts` existe para evitar.
 */
export async function buscarArvoreDeTriagem(): Promise<readonly RamoDaTriagem[]> {
  return comAtraso(ARVORE_DE_TRIAGEM as readonly RamoDaTriagem[], usandoApi ? 0 : 220);
}

interface SessaoAbertaDaApi {
  readonly sessaoId: string;
  readonly estado: 'EM_ANDAMENTO' | 'CONCLUIDA' | 'ABANDONADA';
  /** Verdadeiro quando a chave de idempotência reencontrou a sessão do mesmo dia. */
  readonly reaproveitada: boolean;
}

/**
 * O que a API devolve ao fechar o check-in.
 *
 * Repare que `resultado` — a cor da triagem — chega até aqui. É correto que chegue:
 * a API não tem como saber quem está chamando. O que não pode é seguir adiante.
 * Esta função é a fronteira onde a classificação morre: `RetornoDoCheckin`, o tipo
 * que a tela recebe, não tem campo para ela. A lei clínica vira impossibilidade de
 * tipo em vez de disciplina de quem escreve a tela.
 */
interface RetornoDaApiDoCheckin {
  readonly sessaoId: string;
  readonly situacao: 'CLASSIFICADA' | 'NAO_CLASSIFICADA';
  readonly resultado: Classificacao | null;
  readonly orientacoes?: readonly {
    readonly id: string;
    readonly titulo: string;
    readonly corpo?: string;
    readonly texto?: string;
  }[];
  readonly enfermagemAvisada?: boolean;
}

/**
 * Traduz as respostas da tela para o formato que a API grava.
 *
 * A tela trabalha com um mapa plano de `campo → valor`, que é o que um formulário
 * naturalmente produz. O banco guarda agrupado por sintoma e com o valor separado
 * por tipo — `valorNumerico`, `valorBooleano` ou `valorTexto`, exatamente um por
 * resposta — porque é assim que o motor lê e que o reprocessamento do histórico
 * funciona quando o corte clínico muda.
 *
 * A qual sintoma cada campo pertence não é adivinhado: vem da árvore, que é a mesma
 * constante que a API usa para validar. Campo fora da árvore é descartado aqui em
 * vez de ser recusado lá — a tela nunca deveria tê-lo produzido.
 */
function agruparPorSintoma(respostas: RespostasDoCheckin) {
  const porSintoma = new Map<
    Sintoma,
    { campo: string; valorNumerico?: number; valorBooleano?: boolean; valorTexto?: string }[]
  >();

  for (const ramo of ARVORE_DE_TRIAGEM) {
    const campos = [ramo.porta, ...ramo.detalhes];
    for (const definicao of campos) {
      const valor = respostas[definicao.campo];
      if (valor === undefined || valor === null) continue;

      const lista = porSintoma.get(ramo.sintoma) ?? [];
      if (typeof valor === 'number') lista.push({ campo: definicao.campo, valorNumerico: valor });
      else if (typeof valor === 'boolean')
        lista.push({ campo: definicao.campo, valorBooleano: valor });
      else lista.push({ campo: definicao.campo, valorTexto: valor });
      porSintoma.set(ramo.sintoma, lista);
    }
  }

  return [...porSintoma.entries()].map(([sintoma, lista]) => ({
    sintoma,
    respostas: lista,
  }));
}

export async function enviarCheckin(
  respostas: RespostasDoCheckin,
): Promise<RetornoDoCheckin> {
  if (!usandoApi) {
    const relatouAlgo = Object.values(respostas).some(
      (valor) => valor === true || (typeof valor === 'number' && valor > 0),
    );
    const temperatura = respostas['temperaturaMaxima'];
    const febreAlta = typeof temperatura === 'number' && temperatura >= 38;

    const orientacoes = febreAlta
      ? ORIENTACOES_SINTETICAS.filter((o) => o.id === 'o-1')
      : relatouAlgo
        ? ORIENTACOES_SINTETICAS.filter((o) => o.id === 'o-3')
        : ORIENTACOES_SINTETICAS.filter((o) => o.id === 'o-4');

    return comAtraso(
      {
        sessaoId: 'sessao-sintetica',
        estado: 'CONCLUIDA' as const,
        concluidaEm: new Date().toISOString(),
        orientacoes: orientacoes.map(({ id, titulo, texto }) => ({ id, titulo, texto })),
        pedeContatoComServico: febreAlta,
      },
      420,
    );
  }

  /* A chave de idempotência é do cliente: reenvio por rede instável não pode virar
     dois check-ins do mesmo dia. */
  const sessao = await chamar<SessaoAbertaDaApi>('/triagem/sessoes', {
    metodo: 'POST',
    corpo: { chaveDeIdempotencia: crypto.randomUUID() },
  });

  const retorno = await chamar<RetornoDaApiDoCheckin>(
    `/triagem/sessoes/${sessao.sessaoId}/respostas`,
    {
      metodo: 'POST',
      corpo: { sessaoId: sessao.sessaoId, sintomas: agruparPorSintoma(respostas) },
    },
  );

  return {
    sessaoId: retorno.sessaoId,
    estado: 'CONCLUIDA',
    concluidaEm: new Date().toISOString(),
    orientacoes: (retorno.orientacoes ?? []).map((o) => ({
      id: o.id,
      titulo: o.titulo,
      texto: o.corpo ?? o.texto ?? '',
    })),
    /* A gravidade vira uma instrução, não uma cor: "procure o serviço hoje". A
       enfermagem avisada é o sinal mais fiel de que a equipe já está a caminho. */
    pedeContatoComServico:
      retorno.resultado === 'VERMELHO' || (retorno.enfermagemAvisada ?? false),
  };
}

interface SessaoDoHistoricoDaApi {
  readonly id: string;
  readonly iniciadaEm: string;
  readonly concluidaEm: string | null;
  readonly estado: 'EM_ANDAMENTO' | 'CONCLUIDA' | 'ABANDONADA';
  readonly diaDoCiclo: number | null;
  readonly respostas: readonly RespostaCruaDaApi[];
}

export async function buscarHistoricoDoPaciente(): Promise<readonly DiaDoHistorico[]> {
  if (!usandoApi) return comAtraso(HISTORICO_DO_PACIENTE_SINTETICO);

  const pagina = await chamar<PaginaDaApi<SessaoDoHistoricoDaApi>>('/triagem/historico');
  return pagina.itens.map((sessao) => ({
    sessaoId: sessao.id,
    dia: (sessao.concluidaEm ?? sessao.iniciadaEm).slice(0, 10),
    estado: sessao.estado,
    diaDoCiclo: sessao.diaDoCiclo ?? null,
    /* O paciente vê o que relatou, nunca a classificação — por isso só os sintomas
       com resposta positiva entram, e nenhum campo técnico atravessa. */
    sintomasRelatados: sintomasComRelato(sessao.respostas),
  }));
}

export async function buscarSolicitacoesDoPaciente(): Promise<
  readonly SolicitacaoDeContato[]
> {
  if (!usandoApi) return comAtraso(SOLICITACOES_DO_PACIENTE_SINTETICAS);
  const pagina = await chamar<PaginaDaApi<SolicitacaoDeContato>>(
    '/paciente/solicitacoes-de-contato',
  );
  return pagina.itens;
}

export async function pedirContatoComEnfermagem(motivo: string | null): Promise<void> {
  if (!usandoApi) return;
  await chamar<unknown>('/paciente/solicitacoes-de-contato', {
    metodo: 'POST',
    corpo: motivo ? { motivo } : {},
  });
}

export async function registrarAlergia(
  substancia: string,
  reacao: string | null,
): Promise<void> {
  if (!usandoApi) return;
  await chamar<unknown>('/paciente/alergias', {
    metodo: 'POST',
    corpo: { descricao: substancia, reacao },
  });
}

/* ==========================================================================
   Painel da equipe
   ========================================================================== */

export async function buscarPacientesDoDia(
  filtro?: SituacaoNoPainel,
): Promise<PacientesDoDia> {
  if (!usandoApi) {
    if (!filtro) return comAtraso(PACIENTES_DO_DIA_SINTETICOS);
    const cards: readonly CartaoDoPainel[] = PACIENTES_DO_DIA_SINTETICOS.cards.filter(
      (c) => c.situacao === filtro,
    );
    return comAtraso({ cards, resumo: PACIENTES_DO_DIA_SINTETICOS.resumo });
  }

  const dados = await chamar<PacientesDoDia>('/painel/pacientes-do-dia');
  if (!filtro) return dados;
  return { cards: dados.cards.filter((c) => c.situacao === filtro), resumo: dados.resumo };
}

/**
 * Todos os pacientes acompanhados.
 *
 * Sem espelho sintético próprio: em modo sintético a lista é derivada dos mesmos
 * pacientes do dia, com os campos de cadastro em branco. Inventar responsável, telefone
 * e diagnóstico plausíveis seria criar dado de saúde falso que passa por verdadeiro na
 * primeira captura de tela de apresentação — e este projeto tem regra explícita sobre
 * isso no README.
 */
export async function buscarTodosOsPacientes(): Promise<readonly PacienteAcompanhado[]> {
  if (!usandoApi) {
    return comAtraso(
      PACIENTES_DO_DIA_SINTETICOS.cards.map((cartao) => ({
        id: cartao.pacienteId,
        nome: cartao.nome,
        dataNascimento: null,
        sexo: 'NAO_INFORMADO' as const,
        diagnostico: 'não informado',
        convenio: null,
        protocolo: cartao.protocolo,
        emTratamento: true,
        diaDoCiclo: cartao.diaDoCiclo,
        numeroDoCiclo: null,
        medicoAssistente: null,
        responsavel: null,
        ultimaVisita: null,
        ultimoCheckinEm: null,
        respondeuHoje: cartao.respondeuHoje,
      })),
    );
  }

  const pagina = await chamar<PaginaDaApi<PacienteAcompanhado>>('/painel/pacientes');
  return pagina.itens;
}

/* --- O histórico do painel: onde a API e a tela mais divergem --- */

interface RespostaCruaDaApi {
  readonly sintoma: Sintoma;
  readonly campo: string;
  readonly valorNumerico: number | null;
  readonly valorBooleano: boolean | null;
  readonly valorTexto: string | null;
}

interface ClassificacaoCruaDaApi {
  readonly resultado: Classificacao | null;
  readonly situacao: 'CLASSIFICADA' | 'NAO_CLASSIFICADA';
  readonly motivo: string | null;
  readonly explicacao: unknown;
  readonly calculadaEm: string;
  readonly conjunto: { readonly versao: string; readonly validadoClinicamente: boolean };
}

interface IntervencaoCruaDaApi {
  readonly id: string;
  readonly conduta: string;
  readonly situacao: SituacaoDoSintoma;
  readonly contatoRealizadoEm: string | null;
  readonly criadaEm: string;
  readonly profissional: { readonly nome: string } | null;
}

interface HistoricoCruDaApi {
  readonly id: string;
  readonly nome: string;
  readonly diagnostico: string;
  readonly dataNascimento: string | null;
  readonly sexo: 'FEMININO' | 'MASCULINO' | 'NAO_INFORMADO';
  readonly convenio: string | null;
  readonly medicoAssistente: { readonly nome: string; readonly funcao: string } | null;
  readonly protocolo: string | null;
  readonly numeroDoCiclo: number | null;
  readonly diaDoCiclo: number | null;
  readonly contatos: readonly {
    readonly tipo: 'CONTATO_DO_PACIENTE' | 'CONTATO_DE_EMERGENCIA';
    readonly nome: string;
    readonly telefone: string;
    readonly relacao: string | null;
  }[];
  readonly prescricoes: readonly {
    readonly id: string;
    readonly posologia: string;
    readonly iniciadaEm: string;
    readonly encerradaEm: string | null;
    readonly medicamento: { readonly nome: string; readonly principioAtivo: string | null };
    readonly prescritaPor: { readonly nome: string; readonly funcao: string } | null;
  }[];
  readonly sessoesDeTriagem: readonly {
    readonly id: string;
    readonly iniciadaEm: string;
    readonly concluidaEm: string | null;
    readonly estado: 'EM_ANDAMENTO' | 'CONCLUIDA' | 'ABANDONADA';
    readonly diaDoCiclo: number | null;
    readonly respostas: readonly RespostaCruaDaApi[];
    readonly classificacoes: readonly ClassificacaoCruaDaApi[];
    readonly intervencoes: readonly IntervencaoCruaDaApi[];
  }[];
}

function valorDaResposta(resposta: RespostaCruaDaApi): number | boolean | string | null {
  if (resposta.valorNumerico !== null && resposta.valorNumerico !== undefined) {
    /* A coluna é decimal no MySQL e chega como string no JSON — `39.4`, não `39.4`
       numérico. Sem esta conversão o valor escapa da formatação em português e a
       tela mostra "39.4 °C" com ponto, num sistema em que todo número clínico é
       escrito com vírgula. Fora a coluna de valores que deixa de alinhar. */
    return Number(resposta.valorNumerico);
  }
  if (resposta.valorBooleano !== null && resposta.valorBooleano !== undefined) {
    return resposta.valorBooleano;
  }
  return resposta.valorTexto;
}

function sintomasComRelato(respostas: readonly RespostaCruaDaApi[]): readonly Sintoma[] {
  const relatados = new Set<Sintoma>();
  for (const resposta of respostas) {
    const valor = valorDaResposta(resposta);
    if (valor === true || (typeof valor === 'number' && valor > 0)) {
      relatados.add(resposta.sintoma);
    }
  }
  return [...relatados];
}

/**
 * A explicação vem gravada como JSON opaco no banco.
 *
 * Ela é o dado que permite reconstruir, meses depois, por que aquele dia foi
 * amarelo — e por isso é lida com cuidado: formato inesperado devolve lista vazia
 * em vez de derrubar a tela. Perder a explicação é ruim; perder o painel de plantão
 * inteiro por causa dela é pior.
 */
function regrasDaExplicacao(explicacao: unknown): readonly RegraDisparada[] {
  if (!explicacao || typeof explicacao !== 'object') return [];
  const porSintoma = (explicacao as { porSintoma?: unknown }).porSintoma;
  if (!Array.isArray(porSintoma)) return [];

  const regras: RegraDisparada[] = [];
  for (const entrada of porSintoma) {
    const disparadas = (entrada as { regrasDisparadas?: unknown }).regrasDisparadas;
    if (Array.isArray(disparadas)) regras.push(...(disparadas as RegraDisparada[]));
  }
  return regras;
}

export async function buscarHistoricoNoPainel(
  pacienteId: string,
): Promise<HistoricoDoPaciente> {
  if (!usandoApi) {
    const historico = HISTORICOS_SINTETICOS[pacienteId];
    if (!historico) {
      throw new ErroDaFonte('Paciente sem histórico registrado.', 'NAO_ENCONTRADO');
    }
    return comAtraso(historico);
  }

  const cru = await chamar<HistoricoCruDaApi>(`/painel/pacientes/${pacienteId}/historico`);

  const sessoes: SessaoNoHistorico[] = cru.sessoesDeTriagem.map((sessao) => {
    /* A API devolve as classificações da mais recente para a mais antiga: a
       primeira é a que vale hoje. As anteriores são reprocessamentos. */
    const vigente = sessao.classificacoes[0];

    const respostas: RespostaRegistrada[] = sessao.respostas.map((resposta) => ({
      sintoma: resposta.sintoma,
      campo: resposta.campo,
      pergunta: perguntaDoCampo(resposta.sintoma, resposta.campo),
      valor: valorDaResposta(resposta),
      unidade: unidadeDoCampo(resposta.sintoma, resposta.campo),
    }));

    const intervencoes: Intervencao[] = sessao.intervencoes.map((intervencao) => ({
      id: intervencao.id,
      registradaEm: intervencao.contatoRealizadoEm ?? intervencao.criadaEm,
      profissional: intervencao.profissional?.nome ?? 'Profissional do plantão',
      conduta: intervencao.conduta,
      situacaoDoSintoma: intervencao.situacao,
    }));

    return {
      sessaoId: sessao.id,
      dia: (sessao.concluidaEm ?? sessao.iniciadaEm).slice(0, 10),
      estado: sessao.estado,
      /* `?? null` e não `sessao.diaDoCiclo` direto: a API nem sempre devolve este
         campo, e `undefined` atravessa qualquer checagem `!== null` — foi assim que
         "Dia undefined do ciclo" apareceu na tela do plantão. */
      diaDoCiclo: sessao.diaDoCiclo ?? null,
      classificacao: vigente?.resultado ?? null,
      naoClassificadaPorque:
        vigente && vigente.situacao === 'NAO_CLASSIFICADA' ? vigente.motivo : null,
      versaoDoConjunto: vigente?.conjunto.versao ?? 'não informado',
      /* Ausência de classificação não é "validado": na dúvida, a interface avisa. */
      validadoClinicamente: vigente?.conjunto.validadoClinicamente ?? false,
      respostas,
      regrasDisparadas: regrasDaExplicacao(vigente?.explicacao),
      intervencoes,
    };
  });

  return {
    paciente: {
      id: cru.id,
      nome: cru.nome,
      diagnostico: cru.diagnostico,
      protocolo: cru.protocolo ?? null,
      numeroDoCiclo: cru.numeroDoCiclo ?? null,
      /* Dia do ciclo HOJE, vindo da API. Antes saía da sessão mais recente — o que
         mostrava o dia do último check-in, não o dia de hoje, e divergia da lista de
         pacientes quando a pessoa passava dois dias sem responder. */
      diaDoCiclo: cru.diaDoCiclo ?? null,
      dataNascimento: cru.dataNascimento ?? null,
      sexo: cru.sexo ?? 'NAO_INFORMADO',
      convenio: cru.convenio ?? null,
      medicoAssistente: cru.medicoAssistente?.nome ?? null,
      contatos: (cru.contatos ?? []).map((contato) => ({
        nome: contato.nome,
        telefone: contato.telefone,
        relacao: contato.relacao,
        deEmergencia: contato.tipo === 'CONTATO_DE_EMERGENCIA',
      })),
    },
    /* Receitas em vigor primeiro. A API já devolve nessa ordem; repetir a regra aqui
       seria duas verdades sobre a mesma coisa. */
    prescricoes: (cru.prescricoes ?? []).map((prescricao) => ({
      id: prescricao.id,
      medicamento: prescricao.medicamento.nome,
      principioAtivo: prescricao.medicamento.principioAtivo,
      posologia: prescricao.posologia,
      iniciadaEm: prescricao.iniciadaEm,
      encerradaEm: prescricao.encerradaEm,
      prescritaPor: prescricao.prescritaPor?.nome ?? null,
      emVigor: prescricao.encerradaEm === null,
    })),
    sessoes,
  };
}

/**
 * O texto da pergunta e a unidade não vêm com a resposta gravada — vêm da árvore,
 * que é código. Buscar aqui evita gravar texto de pergunta repetido em cada linha
 * do banco, e garante que a pergunta exibida é a que o sistema faz hoje.
 */
function campoDaArvore(sintoma: Sintoma, campo: string) {
  const ramo = ARVORE_DE_TRIAGEM.find((r) => r.sintoma === sintoma);
  if (!ramo) return undefined;
  if (ramo.porta.campo === campo) return ramo.porta;
  return ramo.detalhes.find((d) => d.campo === campo);
}

function perguntaDoCampo(sintoma: Sintoma, campo: string): string {
  return campoDaArvore(sintoma, campo)?.pergunta ?? campo;
}

function unidadeDoCampo(sintoma: Sintoma, campo: string): string | null {
  const definicao = campoDaArvore(sintoma, campo);
  return definicao && 'unidade' in definicao ? (definicao.unidade ?? null) : null;
}

export async function registrarIntervencao(
  sessaoId: string,
  conduta: string,
  situacao: SituacaoDoSintoma,
): Promise<void> {
  if (!usandoApi) return;
  await chamar<unknown>(`/painel/sessoes/${sessaoId}/intervencoes`, {
    metodo: 'POST',
    corpo: { conduta, situacao, contatoRealizadoEm: new Date().toISOString() },
  });
}

/** Bloco 7 dos prints — o follow-up das intervenções. */
export async function buscarAcompanhamentoDeIntervencoes(
  incluirResolvidas = false,
): Promise<AcompanhamentoDeIntervencoes> {
  if (!usandoApi) return comAtraso(INTERVENCOES_SINTETICAS);
  return chamar<AcompanhamentoDeIntervencoes>(
    `/painel/intervencoes?incluirResolvidas=${incluirResolvidas}`,
  );
}

/** Bloco 5 dos prints — agregado, sem dado identificável no retorno. */
export async function buscarIndicadoresDeToxicidade(
  dias = 30,
): Promise<IndicadoresDeToxicidade> {
  if (!usandoApi) return comAtraso(INDICADORES_DE_TOXICIDADE_SINTETICOS);
  return chamar<IndicadoresDeToxicidade>(
    `/painel/indicadores-de-toxicidade?dias=${dias}`,
  );
}

/** Blocos 6, 9, 10 e 11 — uma chamada só, porque é uma tela só. */
export async function buscarNavegacao(): Promise<PainelDeNavegacao> {
  if (!usandoApi) return comAtraso(NAVEGACAO_SINTETICA);
  return chamar<PainelDeNavegacao>('/painel/navegacao');
}

/* --------------------------------------------------------------------------
   Registro operacional do plantão.

   Todas gravam contra `/painel/*` e não `/admin/*`: quem descobre a barreira é a
   enfermagem no telefone, e ela não tem `GERENCIAR_CADASTROS`. Em modo sintético não
   fazem nada — o espelho é leitura, e fingir gravação daria à demonstração um
   comportamento que a API real não tem.
   -------------------------------------------------------------------------- */

export async function registrarBarreira(
  pacienteId: string,
  tipo: string,
  descricao?: string,
): Promise<void> {
  if (!usandoApi) return;
  await chamar<unknown>(`/painel/pacientes/${pacienteId}/barreiras`, {
    metodo: 'POST',
    corpo: descricao ? { tipo, descricao } : { tipo },
  });
}

export async function resolverBarreira(barreiraId: string): Promise<void> {
  if (!usandoApi) return;
  await chamar<unknown>(`/painel/barreiras/${barreiraId}/resolucao`, { metodo: 'POST' });
}

export async function registrarPendencia(
  pacienteId: string,
  tipo: string,
  referenteA: string,
  descricao?: string,
): Promise<void> {
  if (!usandoApi) return;
  await chamar<unknown>(`/painel/pacientes/${pacienteId}/pendencias`, {
    metodo: 'POST',
    corpo: descricao ? { tipo, referenteA, descricao } : { tipo, referenteA },
  });
}

export async function resolverPendencia(pendenciaId: string): Promise<void> {
  if (!usandoApi) return;
  await chamar<unknown>(`/painel/pendencias/${pendenciaId}/resolucao`, { metodo: 'POST' });
}

export async function registrarInternacao(
  pacienteId: string,
  dados: {
    motivo: string;
    local?: string;
    iniciadaEm: string;
    altaEm?: string;
  },
): Promise<void> {
  if (!usandoApi) return;
  await chamar<unknown>(`/painel/pacientes/${pacienteId}/internacoes`, {
    metodo: 'POST',
    corpo: dados,
  });
}

export async function salvarContextoSocial(
  pacienteId: string,
  contexto: {
    moraSozinho: boolean;
    dificuldadeDeTransporte: boolean;
    temCuidador: boolean;
  },
): Promise<void> {
  if (!usandoApi) return;
  await chamar<unknown>(`/painel/pacientes/${pacienteId}/contexto-social`, {
    metodo: 'PATCH',
    corpo: contexto,
  });
}

export async function buscarFilaDeContatos(): Promise<readonly SolicitacaoNaFila[]> {
  if (!usandoApi) return comAtraso(FILA_DE_CONTATOS_SINTETICA);
  const pagina = await chamar<PaginaDaApi<SolicitacaoNaFila>>(
    '/painel/solicitacoes-de-contato',
  );
  return pagina.itens;
}

export async function atenderSolicitacao(id: string, registro: string): Promise<void> {
  if (!usandoApi) return;
  await chamar<unknown>(`/painel/solicitacoes-de-contato/${id}/atendimento`, {
    metodo: 'POST',
    corpo: { registro },
  });
}

/* ==========================================================================
   Administração
   ========================================================================== */

interface ConjuntoCruDaApi {
  readonly id: string;
  readonly versao: string;
  readonly descricao: string;
  readonly origem: string;
  readonly ativo: boolean;
  readonly validadoClinicamente: boolean;
  readonly publicadoEm: string | null;
  readonly criadoEm: string;
  readonly regras: number;
}

export async function buscarConjuntos(): Promise<readonly ConjuntoResumido[]> {
  if (!usandoApi) return comAtraso(CONJUNTOS_SINTETICOS);

  const crus = await chamar<readonly ConjuntoCruDaApi[]>('/admin/limiares');
  return crus.map((cru) => ({
    id: cru.id,
    versao: cru.versao,
    descricao: cru.descricao,
    origem: cru.origem,
    /* A API modela o estado como "ativo": é o conjunto que está classificando gente
       agora. Só existe um ativo por vez, e conjunto publicado nunca é editado. */
    estado: cru.ativo ? 'PUBLICADO' : cru.publicadoEm ? 'ARQUIVADO' : 'RASCUNHO',
    validadoClinicamente: cru.validadoClinicamente,
    criadoEm: cru.criadoEm,
    publicadoEm: cru.publicadoEm,
    quantidadeDeRegras: cru.regras,
  }));
}

interface ConjuntoDetalhadoDaApi {
  readonly regras: readonly {
    readonly id: string;
    readonly sintoma: Sintoma;
    readonly campo: string;
    readonly operador: string;
    readonly valor: number | null;
    readonly classificacao: Classificacao;
    readonly justificativa: string;
  }[];
}

export async function buscarRegrasDoConjunto(
  conjuntoId: string,
): Promise<readonly RegraResumida[]> {
  if (!usandoApi) {
    if (!CONJUNTOS_SINTETICOS.some((c) => c.id === conjuntoId)) {
      throw new ErroDaFonte('Conjunto não encontrado.', 'NAO_ENCONTRADO');
    }
    return comAtraso(REGRAS_SINTETICAS);
  }
  const detalhe = await chamar<ConjuntoDetalhadoDaApi>(`/admin/limiares/${conjuntoId}`);
  return detalhe.regras;
}

export async function publicarConjunto(id: string): Promise<void> {
  if (!usandoApi) return;
  await chamar<unknown>(`/admin/limiares/${id}/publicar`, { metodo: 'POST' });
}

export async function validarConjunto(id: string, observacao: string): Promise<void> {
  if (!usandoApi) return;
  await chamar<unknown>(`/admin/limiares/${id}/validar`, {
    metodo: 'POST',
    corpo: { observacao },
  });
}

export async function buscarProtocolos(): Promise<readonly Protocolo[]> {
  if (!usandoApi) return comAtraso(PROTOCOLOS_SINTETICOS);
  return chamar<readonly Protocolo[]>('/admin/protocolos');
}

export async function criarProtocolo(
  nome: string,
  descricao: string | null,
): Promise<void> {
  if (!usandoApi) return;
  await chamar<unknown>('/admin/protocolos', { metodo: 'POST', corpo: { nome, descricao } });
}

export async function buscarMedicamentos(): Promise<readonly Medicamento[]> {
  if (!usandoApi) return comAtraso(MEDICAMENTOS_SINTETICOS);
  return chamar<readonly Medicamento[]>('/admin/medicamentos');
}

export async function criarMedicamento(
  nome: string,
  principioAtivo: string | null,
): Promise<void> {
  if (!usandoApi) return;
  await chamar<unknown>('/admin/medicamentos', {
    metodo: 'POST',
    corpo: { nome, principioAtivo },
  });
}

interface OrientacoesDaApi {
  readonly orientacoes: readonly {
    readonly id: string;
    readonly sintoma: Sintoma | null;
    readonly classificacao: Classificacao;
    readonly titulo: string;
    readonly corpo: string;
  }[];
}

export async function buscarOrientacoes(): Promise<readonly Orientacao[]> {
  if (!usandoApi) return comAtraso(ORIENTACOES_SINTETICAS);
  const resposta = await chamar<OrientacoesDaApi>('/admin/orientacoes');
  return resposta.orientacoes.map((o) => ({
    id: o.id,
    sintoma: o.sintoma,
    classificacao: o.classificacao,
    titulo: o.titulo,
    texto: o.corpo,
  }));
}

interface RegistroCruDaApi {
  readonly id: string;
  readonly acao: RegistroDeAcesso['acao'];
  readonly rota: string | null;
  readonly metodo: string | null;
  readonly ip: string | null;
  readonly ocorridoEm: string;
  readonly usuario: { readonly email: string | null } | null;
  readonly paciente: { readonly nome: string } | null;
}

export async function buscarRegistroDeAcessos(): Promise<readonly RegistroDeAcesso[]> {
  if (!usandoApi) return comAtraso(REGISTRO_DE_ACESSOS_SINTETICO);

  const crus = await chamar<readonly RegistroCruDaApi[]>('/admin/registro-de-acessos');
  return crus.map((cru) => ({
    id: cru.id,
    aconteceuEm: cru.ocorridoEm,
    usuario: cru.usuario?.email ?? 'Usuário removido',
    acao: cru.acao,
    /* O paciente tocado importa mais que a rota para quem audita — a rota entra
       como complemento quando não há paciente envolvido. */
    recurso: cru.paciente?.nome ?? cru.rota,
    enderecoDeOrigem: cru.ip,
  }));
}
