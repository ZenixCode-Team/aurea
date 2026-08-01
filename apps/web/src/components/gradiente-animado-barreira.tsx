'use client';

/**
 * Rede de proteção do campo WebGL do `GradienteAnimado`.
 *
 * Duas coisas diferentes moram aqui, e é de propósito:
 *
 * - `RecuoDoGradiente` — o que aparece quando não há WebGL. Não é um retângulo
 *   vazio: é o mesmo verde do campo, congelado. Máquina antiga, GPU bloqueada por
 *   política ou aba sem aceleração continuam vendo a porta da AUREA, não um buraco.
 * - `BarreiraDoGradiente` — barreira de erro de verdade. Erro dentro do `render` do
 *   canvas derrubaria a árvore inteira, e a árvore inteira aqui é a TELA DE ENTRAR.
 *   Ninguém fica sem conseguir entrar no sistema porque um shader não compilou.
 *
 * Barreira de erro precisa ser componente de classe: é o único jeito que o React
 * oferece de capturar erro de renderização de um filho.
 */

import { Component, type ReactNode } from 'react';

export function RecuoDoGradiente({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={className}
      style={{
        background:
          'linear-gradient(165deg, var(--color-sage) 0%, #46582f 42%, var(--color-verde-profundo-alto) 100%)',
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
