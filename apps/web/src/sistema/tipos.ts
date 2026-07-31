/**
 * Os formatos que o sistema consome.
 *
 * Foram extraídos das respostas REAIS da API rodando, não inventados — por isso
 * ligar as telas na Onda F é trocar a origem em `fonte.ts`, não reescrever tela.
 *
 * Quando um campo aqui divergir da API, a API vence e este arquivo é corrigido.
 */

import type {
  Classificacao,
  ConjuntoDeLimiares,
  RegraDisparada,
  Sintoma,
} from '@aurea/contratos';

export type { Classificacao, ConjuntoDeLimiares, RegraDisparada, Sintoma };

/* ==========================================================================
   Sessão
   ========================================================================== */

export type Perfil = 'PACIENTE' | 'PROFISSIONAL' | 'ADMINISTRADOR';

export interface SessaoAberta {
  readonly token: string;
  readonly expiraEm: string;
  readonly perfil: Perfil;
  readonly precisaVerPrimeiroAcesso: boolean;
}

export interface UsuarioDaSessao {
  readonly nome: string;
  readonly perfil: Perfil;
  /** Só profissional tem. Governa o que aparece no painel e no admin. */
  readonly permissoes: readonly Permissao[];
}

export type Permissao =
  | 'ATENDER_PLANTAO'
  | 'VER_HISTORICO_DE_PACIENTE'
  | 'REGISTRAR_INTERVENCAO'
  | 'EDITAR_ALGORITMO'
  | 'PUBLICAR_ALGORITMO'
  | 'EDITAR_ORIENTACAO'
  | 'GERENCIAR_CADASTROS'
  | 'GERENCIAR_USUARIOS'
  | 'EXPORTAR_CONJUNTO_DE_PESQUISA';

/* ==========================================================================
   Paciente
   ========================================================================== */

export type Sexo = 'FEMININO' | 'MASCULINO' | 'OUTRO' | 'NAO_INFORMADO';

export type FuncaoProfissional =
  | 'MEDICO'
  | 'ENFERMEIRO'
  | 'TECNICO_DE_ENFERMAGEM'
  | 'NUTRICIONISTA'
  | 'PSICOLOGO';

export interface Contato {
  readonly id: string;
  readonly nome: string;
  readonly telefone: string;
  readonly relacao: string | null;
}

export interface Alergia {
  readonly id: string;
  readonly substancia: string;
  readonly reacao: string | null;
  readonly origem: 'EQUIPE' | 'PACIENTE';
}

export interface PerfilDoPaciente {
  readonly paciente: {
    readonly id: string;
    readonly nome: string;
    readonly dataNascimento: string;
    readonly sexo: Sexo;
    readonly diagnostico: string;
    readonly convenio: string | null;
    readonly tipoSanguineo: string | null;
    readonly urlDaFoto: string | null;
    readonly habitoIntestinalBasal: number | null;
  };
  readonly medicoAssistente: {
    readonly nome: string;
    readonly funcao: FuncaoProfissional;
    readonly registroDoConselho: string;
  } | null;
  readonly tratamento: {
    readonly protocolo: { readonly id: string; readonly nome: string };
    readonly iniciadoEm: string;
  } | null;
  readonly ciclo: {
    readonly numero: number;
    readonly sessaoRealizadaEm: string;
    readonly previsaoDaProximaSessao: string | null;
    readonly diaDoCiclo: number;
  } | null;
  readonly contatos: {
    readonly doPaciente: readonly Contato[];
    readonly deEmergencia: readonly Contato[];
  };
  readonly alergias: readonly Alergia[];
}

/* ==========================================================================
   Agenda, biblioteca, notificações
   ========================================================================== */

export type TipoDeEvento =
  | 'QUIMIOTERAPIA'
  | 'CONSULTA'
  | 'EXAME'
  | 'RETORNO'
  | 'OUTRO';

export interface ItemDaAgenda {
  readonly id: string;
  readonly tipo: TipoDeEvento;
  readonly aconteceEm: string;
  readonly local: string | null;
  readonly observacoes: string | null;
  readonly profissional: {
    readonly nome: string;
    readonly funcao: FuncaoProfissional;
  } | null;
}

export type CategoriaDaBiblioteca =
  | 'ALIMENTACAO'
  | 'CUIDADOS_EM_CASA'
  | 'EFEITOS_COLATERAIS'
  | 'QUANDO_PROCURAR_AJUDA'
  | 'TRATAMENTO';

export interface VerbeteResumido {
  readonly id: string;
  readonly titulo: string;
  readonly resumo: string;
  readonly categoria: CategoriaDaBiblioteca;
}

export interface Verbete extends VerbeteResumido {
  readonly conteudo: string;
  readonly atualizadoEm: string;
}

export interface Notificacao {
  readonly id: string;
  readonly titulo: string;
  readonly corpo: string;
  readonly criadaEm: string;
  readonly lidaEm: string | null;
}

/* ==========================================================================
   Triagem — o check-in
   ========================================================================== */

export type TipoDeCampo = 'BOOLEANO' | 'NUMERICO' | 'INTEIRO' | 'OPCAO';

export interface CampoDaTriagem {
  readonly campo: string;
  readonly pergunta: string;
  readonly tipo: TipoDeCampo;
  readonly dependeDe?: { readonly campo: string; readonly valor: boolean };
  readonly minimo?: number;
  readonly maximo?: number;
  readonly casasDecimais?: number;
  readonly unidade?: string;
  readonly opcoes?: readonly string[];
  readonly ajuda?: string;
}

export interface RamoDaTriagem {
  readonly sintoma: Sintoma;
  readonly rotulo: string;
  readonly porta: CampoDaTriagem;
  readonly detalhes: readonly CampoDaTriagem[];
}

export type ValorDeResposta = boolean | number | string | null;

export type RespostasDoCheckin = Record<string, ValorDeResposta>;

export type EstadoDaSessao = 'EM_ANDAMENTO' | 'CONCLUIDA' | 'ABANDONADA';

/**
 * O que o PACIENTE recebe ao terminar o check-in.
 *
 * Note o que NÃO existe aqui: `classificacao`, `regrasDisparadas`, nome de campo.
 * Isso é a lei inviolável 2 expressa em tipo — a tela do paciente não consegue
 * mostrar a cor de risco porque o dado não chega até ela.
 */
export interface RetornoDoCheckin {
  readonly sessaoId: string;
  readonly estado: EstadoDaSessao;
  readonly concluidaEm: string;
  /** Texto em português, escrito pela equipe. Nunca gerado a partir da cor. */
  readonly orientacoes: readonly {
    readonly id: string;
    readonly titulo: string;
    readonly texto: string;
  }[];
  /** Verdadeiro quando a orientação manda procurar o serviço hoje. */
  readonly pedeContatoComServico: boolean;
}

export interface DiaDoHistorico {
  readonly sessaoId: string;
  readonly dia: string;
  readonly estado: EstadoDaSessao;
  readonly diaDoCiclo: number | null;
  readonly sintomasRelatados: readonly Sintoma[];
}

export type SituacaoDaSolicitacao = 'ABERTA' | 'EM_ATENDIMENTO' | 'ATENDIDA';

export interface SolicitacaoDeContato {
  readonly id: string;
  readonly motivo: string | null;
  readonly criadaEm: string;
  readonly situacao: SituacaoDaSolicitacao;
  readonly atendidaEm: string | null;
}

/* ==========================================================================
   Painel da equipe — aqui a cor é informação legítima
   ========================================================================== */

export type SituacaoNoPainel =
  | 'VERMELHO'
  | 'AMARELO'
  | 'VERDE'
  | 'SEM_RESPOSTA_HOJE'
  | 'NAO_CLASSIFICADA';

export interface CartaoDoPainel {
  readonly pacienteId: string;
  readonly nome: string;
  readonly protocolo: string;
  readonly situacao: SituacaoNoPainel;
  readonly respondeuHoje: boolean;
  readonly diasSemResponder: number | null;
  readonly nuncaRespondeu: boolean;
  readonly ultimaSessaoId: string | null;
  readonly diaDoCiclo: number | null;
}

export interface ResumoDoPainel {
  readonly total: number;
  readonly vermelhos: number;
  readonly amarelos: number;
  readonly verdes: number;
  readonly semResposta: number;
}

export interface PacientesDoDia {
  readonly cards: readonly CartaoDoPainel[];
  readonly resumo: ResumoDoPainel;
}

export interface RespostaRegistrada {
  readonly sintoma: Sintoma;
  readonly campo: string;
  readonly pergunta: string;
  readonly valor: ValorDeResposta;
  readonly unidade: string | null;
}

export interface SessaoNoHistorico {
  readonly sessaoId: string;
  readonly dia: string;
  readonly estado: EstadoDaSessao;
  readonly diaDoCiclo: number | null;
  readonly classificacao: Classificacao | null;
  readonly naoClassificadaPorque: string | null;
  readonly versaoDoConjunto: string;
  readonly validadoClinicamente: boolean;
  readonly respostas: readonly RespostaRegistrada[];
  /** A explicação. Sem ela o painel vira caixa-preta — inaceitável em software clínico. */
  readonly regrasDisparadas: readonly RegraDisparada[];
  readonly intervencoes: readonly Intervencao[];
}

export interface HistoricoDoPaciente {
  readonly paciente: {
    readonly id: string;
    readonly nome: string;
    readonly diagnostico: string;
    readonly protocolo: string | null;
    readonly diaDoCiclo: number | null;
  };
  readonly sessoes: readonly SessaoNoHistorico[];
}

/**
 * As duas situações que a API aceita ao registrar intervenção.
 *
 * O schema do banco tem mais valores, mas `POST /painel/sessoes/:id/intervencoes`
 * só aceita estes dois — e a tela precisa oferecer exatamente o que a API grava,
 * senão o profissional escolhe uma opção que o servidor recusa.
 */
export type SituacaoDoSintoma = 'RESOLVIDO' | 'EM_ACOMPANHAMENTO';

export interface Intervencao {
  readonly id: string;
  readonly registradaEm: string;
  readonly profissional: string;
  readonly conduta: string;
  readonly situacaoDoSintoma: SituacaoDoSintoma;
}

export interface SolicitacaoNaFila extends SolicitacaoDeContato {
  readonly paciente: {
    readonly id: string;
    readonly nome: string;
    readonly telefone: string | null;
  };
}

/* ==========================================================================
   Administração — o algoritmo como dado
   ========================================================================== */

export type EstadoDoConjunto = 'RASCUNHO' | 'PUBLICADO' | 'ARQUIVADO';

export interface ConjuntoResumido {
  readonly id: string;
  readonly versao: string;
  readonly descricao: string;
  readonly origem: string;
  readonly estado: EstadoDoConjunto;
  readonly validadoClinicamente: boolean;
  readonly criadoEm: string;
  readonly publicadoEm: string | null;
  readonly quantidadeDeRegras: number;
}

export interface DiferencaEntreConjuntos {
  readonly de: string;
  readonly para: string;
  readonly incluidas: readonly RegraResumida[];
  readonly removidas: readonly RegraResumida[];
  readonly alteradas: readonly {
    readonly antes: RegraResumida;
    readonly depois: RegraResumida;
  }[];
}

export interface RegraResumida {
  readonly id: string;
  readonly sintoma: Sintoma;
  readonly campo: string;
  readonly operador: string;
  readonly valor: number | null;
  readonly classificacao: Classificacao;
  readonly justificativa: string;
}

/**
 * Protocolo não tem duração de ciclo.
 *
 * A tentação de guardar `duracaoDoCicloEmDias` aqui e calcular a próxima sessão é
 * forte e está errada: o banco modela `Ciclo.previsaoDaProximaSessao` como campo
 * informado, porque a data real depende de exame, de leucócito e de agenda do
 * serviço — não de aritmética sobre o protocolo.
 */
export interface Protocolo {
  readonly id: string;
  readonly nome: string;
  readonly descricao: string | null;
  readonly ativo: boolean;
}

export interface Medicamento {
  readonly id: string;
  readonly nome: string;
  readonly principioAtivo: string | null;
}

export interface Orientacao {
  readonly id: string;
  readonly sintoma: Sintoma | null;
  readonly classificacao: Classificacao;
  readonly titulo: string;
  readonly texto: string;
}

/** Espelha o enum `AcaoDeAcesso` do banco. Divergir daqui é registrar auditoria errada. */
export type AcaoDeAcesso =
  | 'LOGIN'
  | 'LOGIN_RECUSADO'
  | 'LOGOUT'
  | 'TROCA_DE_SENHA'
  | 'CONSENTIMENTO_REGISTRADO'
  | 'LEITURA_DE_HISTORICO'
  | 'LEITURA_DE_PACIENTE'
  | 'REGISTRO_DE_INTERVENCAO'
  | 'ATENDIMENTO_DE_SOLICITACAO'
  | 'CRIACAO_DE_CADASTRO'
  | 'EDICAO_DE_CADASTRO'
  | 'EDICAO_DE_ORIENTACAO'
  | 'EDICAO_DE_ALGORITMO'
  | 'PUBLICACAO_DE_ALGORITMO'
  | 'VALIDACAO_CLINICA_DE_ALGORITMO'
  | 'REPROCESSAMENTO_DE_HISTORICO'
  | 'EXPORTACAO_DE_PESQUISA';

export interface RegistroDeAcesso {
  readonly id: string;
  readonly aconteceuEm: string;
  readonly usuario: string;
  readonly acao: AcaoDeAcesso;
  readonly recurso: string | null;
  readonly enderecoDeOrigem: string | null;
}

/* ==========================================================================
   Paginação — o formato que a API usa em toda listagem
   ========================================================================== */

export interface Pagina<T> {
  readonly itens: readonly T[];
  readonly proximoCursor: string | null;
}
