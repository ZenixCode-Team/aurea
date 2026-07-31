/**
 * O único lugar do frontend que conhece HTTP.
 *
 * Telas não sabem o que é status code, cabeçalho ou token — chamam `fonte.ts`, que
 * chama daqui. Concentrar isso num arquivo é o que torna o erro de rede uma coisa
 * só em todo o sistema, em vez de trinta tratamentos diferentes.
 */

import { ErroDaFonte } from './erros';

const CHAVE_DO_TOKEN = 'aurea.token';

export function enderecoDaApi(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';
}

/* ==========================================================================
   Token
   ========================================================================== */

export function guardarToken(token: string): void {
  sessionStorage.setItem(CHAVE_DO_TOKEN, token);
}

export function lerToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(CHAVE_DO_TOKEN);
}

export function esquecerToken(): void {
  sessionStorage.removeItem(CHAVE_DO_TOKEN);
}

/* ==========================================================================
   Chamada
   ========================================================================== */

interface OpcoesDaChamada {
  readonly metodo?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  readonly corpo?: unknown;
  /** Rotas públicas (entrar, recuperar) não mandam token. */
  readonly semAutenticacao?: boolean;
  readonly busca?: Record<string, string | number | undefined>;
}

/**
 * Quem é avisado quando a sessão morre.
 *
 * A alternativa seria cada tela tratar 401 por conta própria — e bastaria uma
 * esquecer para a pessoa ficar olhando uma tela vazia sem entender que precisa
 * entrar de novo. O provedor de sessão assina isto uma vez.
 */
const ouvintesDeSessaoExpirada = new Set<() => void>();

export function aoExpirarSessao(ouvinte: () => void): () => void {
  ouvintesDeSessaoExpirada.add(ouvinte);
  return () => ouvintesDeSessaoExpirada.delete(ouvinte);
}

function montarEndereco(caminho: string, busca?: OpcoesDaChamada['busca']): string {
  const endereco = new URL(caminho, enderecoDaApi());
  if (busca) {
    for (const [chave, valor] of Object.entries(busca)) {
      if (valor !== undefined) endereco.searchParams.set(chave, String(valor));
    }
  }
  return endereco.toString();
}

/** A API responde erro como `{ mensagem }` ou `{ message }` conforme a origem. */
async function mensagemDoErro(resposta: Response, padrao: string): Promise<string> {
  try {
    const corpo: unknown = await resposta.json();
    if (corpo && typeof corpo === 'object') {
      const registro = corpo as Record<string, unknown>;
      const texto = registro['mensagem'] ?? registro['message'] ?? registro['error'];
      if (typeof texto === 'string' && texto.length > 0) return texto;
    }
  } catch {
    /* Corpo vazio ou não-JSON: o padrão serve. */
  }
  return padrao;
}

export async function chamar<T>(caminho: string, opcoes: OpcoesDaChamada = {}): Promise<T> {
  const { metodo = 'GET', corpo, semAutenticacao = false, busca } = opcoes;

  const cabecalhos: Record<string, string> = {};
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';

  if (!semAutenticacao) {
    const token = lerToken();
    if (!token) {
      throw new ErroDaFonte('Sua sessão expirou. Entre de novo.', 'PERMISSAO');
    }
    cabecalhos['Authorization'] = `Bearer ${token}`;
  }

  let resposta: Response;
  try {
    resposta = await fetch(montarEndereco(caminho, busca), {
      method: metodo,
      headers: cabecalhos,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    /* Falha antes de chegar ao servidor: rede caída, servidor fora do ar, CORS. */
    throw new ErroDaFonte(
      'Não foi possível falar com o servidor. Verifique sua conexão.',
      'REDE',
    );
  }

  if (resposta.status === 401) {
    esquecerToken();
    for (const ouvinte of ouvintesDeSessaoExpirada) ouvinte();
    throw new ErroDaFonte('Sua sessão expirou. Entre de novo.', 'PERMISSAO');
  }

  if (resposta.status === 403) {
    throw new ErroDaFonte(
      await mensagemDoErro(resposta, 'Você não tem acesso a esta informação.'),
      'PERMISSAO',
    );
  }

  if (resposta.status === 404) {
    throw new ErroDaFonte(
      await mensagemDoErro(resposta, 'Não encontramos o que você procura.'),
      'NAO_ENCONTRADO',
    );
  }

  if (!resposta.ok) {
    throw new ErroDaFonte(
      await mensagemDoErro(resposta, 'Não foi possível concluir a operação.'),
      'DESCONHECIDA',
    );
  }

  if (resposta.status === 204) return undefined as T;
  return (await resposta.json()) as T;
}
