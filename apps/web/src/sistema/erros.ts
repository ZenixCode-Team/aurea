/**
 * O erro único do sistema.
 *
 * Mora em arquivo próprio porque tanto `api.ts` quanto `fonte.ts` precisam dele —
 * deixá-lo em qualquer um dos dois criaria dependência circular entre a camada que
 * fala HTTP e a que serve as telas.
 *
 * `causa` existe para que a tela escolha o texto certo sem inspecionar status HTTP:
 * "não encontrado" pede um estado vazio, "permissão" pede um caminho de volta, e
 * "rede" pede um botão de tentar de novo.
 */
export class ErroDaFonte extends Error {
  constructor(
    mensagem: string,
    readonly causa: 'REDE' | 'PERMISSAO' | 'NAO_ENCONTRADO' | 'DESCONHECIDA' = 'DESCONHECIDA',
  ) {
    super(mensagem);
    this.name = 'ErroDaFonte';
  }
}
