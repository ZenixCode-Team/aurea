"use client";

import Link from "next/link";

const NAVEGACAO = [
  { href: "#funcionamento", rotulo: "Como funciona" },
  { href: "#verde", rotulo: "As cores" },
  { href: "#limites", rotulo: "Limites" },
  { href: "#perguntas", rotulo: "Perguntas" },
];

/**
 * Cabeçalho da landing — barra flutuante em cápsula.
 *
 * A cápsula resolve um problema que a barra anterior tinha: o corpo da página troca de
 * cor com a rolagem (`data-cor-fundo`, do azul da hero ao creme das seções ao
 * #091d2a do rodapé), e uma barra que herda o fundo precisa se redesenhar em cada
 * troca. A cápsula carrega o próprio fundo, então funciona por cima dos três — e é
 * por isso que o estado `rolou` sumiu daqui: não há mais nada que precise saber a cor
 * do que está atrás. O cabeçalho inteiro virou um objeto só.
 *
 * Decisão de UX vinculante (ADR-001): a landing é a porta de entrada única dos três
 * perfis, então "Entrar" é persistente. Continua sendo — mudou o que o torna
 * inconfundível. Não é mais preenchimento sólido: é estar SOZINHO no canto, em
 * pastilha própria e mais densa que a navegação. Item isolado num campo vazio é achado
 * antes de item numa fila de cinco, que é o que a barra pede.
 */
export function Cabecalho() {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 py-4 md:py-6">
      {/* Grade de três colunas com a cápsula na do meio: é o que mantém a navegação
          centrada na PÁGINA, e não centrada no espaço que sobra à esquerda do "Entrar".
          A primeira coluna existe vazia só para isso.

          Abaixo de `lg` os links somem e a cápsula fica só com a marca — aí centrar é
          errado: marca no meio da tela com o resto vazio parece deslocamento, não
          composição. A coluna vazia sai junto com os links e a marca volta para a
          esquerda, "Entrar" na direita. */}
      <div className="mx-auto grid w-full max-w-[1180px] grid-cols-[auto_1fr] items-center px-6 md:px-10 lg:grid-cols-[1fr_auto_1fr] lg:px-16">
        <div className="hidden lg:block" />

        {/* A cápsula da navegação.

            Translúcida: `bg-white/45` com desfoque forte e saturação puxada para cima.
            A saturação é o que impede o vidro de cinzar — sem ela, o desfoque lava o
            azul do campo e a cápsula fica com aquele cinza de plástico. Com ela, o
            fundo continua sendo lido como azul através do vidro.

            A marca mora DENTRO. Fora dela, flutuava nua sobre o conteúdo que passa por
            baixo do cabeçalho fixo: na primeira seção o filete de divisão cortava o
            wordmark ao meio. */}
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/40 bg-white/45 p-1.5 pl-5 shadow-[var(--sombra-elevada)] backdrop-blur-2xl backdrop-saturate-150">
          <Link
            href="/"
            aria-label="AUREA, início"
            className="display mr-2 text-2xl leading-none text-tinta"
          >
            aurea
          </Link>

          <nav
            aria-label="Navegação principal"
            className="hidden items-center lg:flex"
          >
            {NAVEGACAO.map((item) => (
              <a
                key={item.href}
                href={item.href}
                /* Link em `tinta` cheia, não em `tinta-suave`. Sobre o vidro o fundo
                   efetivo fica em torno de rgb(180,190,170) — com o cinza suave o
                   contraste cai para ~4.2:1, abaixo do mínimo para texto de 15px.
                   O destaque do hover mudou de cor para fundo, que é o que sobra
                   quando o texto já está no tom mais escuro disponível. */
                className="rounded-full px-4 py-2 text-[0.9375rem] leading-none text-tinta transition-colors duration-300 hover:bg-white/45"
              >
                {item.rotulo}
              </a>
            ))}
          </nav>
        </div>

        {/* "Entrar" fora da cápsula, pastilha própria, alinhada à direita.

            Densidade maior que a da navegação (`bg-white/70` contra `/45`) e é de
            propósito: peça isolada precisa se sustentar sozinha sobre o campo verde,
            e ADR-001 manda que a porta de entrada seja achável em 2 segundos. Aqui a
            hierarquia vem da separação e da opacidade, não do preenchimento. */}
        <div className="flex justify-end">
          <Link
            href="/entrar"
            className="pointer-events-auto rounded-full border border-white/50 bg-white/70 px-7 py-3 text-[0.9375rem] font-semibold leading-none text-tinta shadow-[var(--sombra-elevada)] backdrop-blur-2xl backdrop-saturate-150 transition-colors duration-300 hover:bg-white/90"
          >
            Entrar
          </Link>
        </div>
      </div>

      {/* Acesso às seções no mobile.

          Abaixo de `lg` a navegação some da cápsula (ver comentário acima) e
          sobra só rolagem, mas a landing tem 11 seções: sem atalho, achar
          "Limites" ou "Perguntas" de novo é rolar às cegas. A solução não é
          reabrir a navegação inteira nem inventar hambúrguer com painel: é
          uma tira horizontal, discreta, dos mesmos rótulos, com o próprio
          `overflow-x-auto` resolvendo o espaço que a cápsula não tem. Barra
          de rolagem escondida porque o scroll aqui é affordance de toque
          (like tabs), não de leitura de conteúdo longo. */}
      <nav
        aria-label="Seções da página"
        className="pointer-events-auto mx-auto mt-2 flex w-full max-w-[1180px] gap-2 overflow-x-auto px-6 [scrollbar-width:none] md:px-10 lg:hidden [&::-webkit-scrollbar]:hidden"
      >
        {NAVEGACAO.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="rotulo-editorial shrink-0 whitespace-nowrap rounded-full border border-white/35 bg-white/30 px-3 py-1.5 text-tinta backdrop-blur-2xl backdrop-saturate-150 transition-colors duration-300 hover:bg-white/50"
          >
            {item.rotulo}
          </a>
        ))}
      </nav>
    </header>
  );
}
