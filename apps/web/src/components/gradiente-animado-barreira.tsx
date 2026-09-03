'use client';

/**
 * Rede de proteção do campo WebGL do `GradienteAnimado`.
 *
 * Duas coisas diferentes moram aqui, e é de propósito:
 *
 * - `RecuoDoGradiente` — o que aparece quando não há WebGL. Não é um retângulo
 *   vazio: é o mesmo campo, congelado. Máquina antiga, GPU bloqueada por política ou
 *   aba sem aceleração continuam vendo a porta da AUREA, não um buraco.
 *
 *   As três cores vêm de FORA, do preset em uso. Antes eram o verde da porta
 *   escrito à mão aqui dentro, o que funcionava enquanto havia um campo só. Com a
 *   hero em azul e a porta em verde, recuo fixo mostraria a cor errada em metade
 *   dos casos — e logo no caso em que ninguém está olhando para conferir.
 * - `BarreiraDoGradiente` — barreira de erro de verdade. Erro dentro do `render` do
 *   canvas derrubaria a árvore inteira, e a árvore inteira aqui é a TELA DE ENTRAR.
 *   Ninguém fica sem conseguir entrar no sistema porque um shader não compilou.
 *
 * Barreira de erro precisa ser componente de classe: é o único jeito que o React
 * oferece de capturar erro de renderização de um filho.
 */

import { Component, type ReactNode } from 'react';

export interface PropsDoRecuo {
  className?: string;
  /** Vale, base e crista do preset, na ordem do mais escuro para o mais claro. */
  cores: [string, string, string];
}

export function RecuoDoGradiente({ className = '', cores }: PropsDoRecuo) {
  const [vale, base, crista] = cores;
  return (
    <div
      aria-hidden
      className={className}
      style={{
        background: `linear-gradient(165deg, ${crista} 0%, ${base} 42%, ${vale} 100%)`,
      }}
    />
  );
}

interface PropsDaBarreira {
  children: ReactNode;
  recuo: ReactNode;
}

interface EstadoDaBarreira {
  falhou: boolean;
}

export class BarreiraDoGradiente extends Component<PropsDaBarreira, EstadoDaBarreira> {
  state: EstadoDaBarreira = { falhou: false };

  static getDerivedStateFromError(): EstadoDaBarreira {
    return { falhou: true };
  }

  render() {
    return this.state.falhou ? this.props.recuo : this.props.children;
  }
}
