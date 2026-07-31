/**
 * Erro esperado, com status HTTP e mensagem que pode chegar ao cliente.
 *
 * Tudo que não for ErroDaApi vira 500 com mensagem genérica: mensagem de erro de banco
 * ou de biblioteca vazando para o cliente é vazamento de informação, e num sistema de
 * dado sensível de saúde isso não é detalhe de estilo.
 */
export class ErroDaApi extends Error {
  constructor(
    readonly status: number,
    override readonly message: string,
    readonly detalhes?: unknown,
  ) {
    super(message);
    this.name = 'ErroDaApi';
  }
}

export const naoAutenticado = (mensagem = 'Sessão ausente ou expirada.') =>
  new ErroDaApi(401, mensagem);

export const semPermissao = (mensagem = 'Sem permissão para esta operação.') =>
  new ErroDaApi(403, mensagem);

export const naoEncontrado = (mensagem = 'Recurso não encontrado.') => new ErroDaApi(404, mensagem);

export const requisicaoInvalida = (mensagem: string, detalhes?: unknown) =>
  new ErroDaApi(400, mensagem, detalhes);

export const conflito = (mensagem: string) => new ErroDaApi(409, mensagem);
