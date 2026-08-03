"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Marcador de escala fixo na lateral.
 *
 * Equivale aos rótulos numerados que a oevra mantém visíveis enquanto as
 * seções empilham. Aqui ele carrega significado do produto em vez de só
 * numerar: mostra em qual estado da escala o leitor está, e os três juntos
 * ensinam a sequência antes mesmo de a pessoa terminar de ler.
 *
 * Só aparece durante as seções de cor. Fora delas seria ruído.
 */

const ESTADOS = [
  { id: "verde", nome: "Verde", cor: "bg-sage" },
  { id: "ambar", nome: "Amarelo", cor: "bg-ambar" },
  { id: "vermelho", nome: "Vermelho", cor: "bg-terracota" },
];

export function IndicadorEscala() {
  const [ativo, setAtivo] = useState<string | null>(null);

  useEffect(() => {
    const secoes = ESTADOS.map((estado) =>
      document.getElementById(estado.id),
    ).filter((elemento): elemento is HTMLElement => elemento !== null);

    if (secoes.length === 0) return;

    /*
     * `IntersectionObserver` não serve aqui, e vale registrar o porquê:
     * `intersectionRatio` é medido em relação ao tamanho da PRÓPRIA seção.
     * No empilhamento, a Verde continua inteira na tela — escondida atrás da
     * Amarela — e marca 1.0, enquanto a Amarela que a cobre marca 0.91. Pela
     * razão, a seção invisível ganha.
     *
     * O critério correto é a ordem de empilhamento: vale a ÚLTIMA seção que
     * já cruzou o meio da tela, porque é ela que está por cima.
     */
    let pendente = 0;

    const avaliar = () => {
      pendente = 0;
      const meio = window.innerHeight * 0.5;
      let atualId: string | null = null;

      for (const secao of secoes) {
        const caixa = secao.getBoundingClientRect();
        if (caixa.top <= meio && caixa.bottom > meio * 0.35) {
          atualId = secao.id;
        }
      }

      setAtivo(atualId);
    };

    const aoRolar = () => {
      if (pendente) return;
      pendente = requestAnimationFrame(avaliar);
    };

    avaliar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRolar, { passive: true });

    return () => {
      cancelAnimationFrame(pendente);
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", aoRolar);
    };
  }, []);

  const indiceAtivo = ESTADOS.findIndex((estado) => estado.id === ativo);

  return (
    <AnimatePresence>
      {ativo ? (
        <motion.aside
          aria-hidden="true"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none fixed right-6 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-5 lg:flex"
        >
          {ESTADOS.map((estado, indice) => {
            const eAtivo = estado.id === ativo;
            const jaPassou = indice < indiceAtivo;
            const eUltimo = indice === ESTADOS.length - 1;

            return (
              /* Os três ficam sempre à vista, como os rótulos numerados que
                 a oevra mantém empilhados. Juntos, ensinam a sequência da
                 escala antes de a pessoa terminar de ler a seção. */
              <div
                key={estado.id}
                className="relative flex items-center justify-end gap-3.5"
              >
                {/* Fio ligando um ponto ao seguinte. Sem ele são três marcas
                    soltas; com ele lê como o que é — uma escala, com ordem e
                    sentido.

                    Fica na LINHA, não dentro do ponto: o ponto sofre `scale`
                    quando está inativo, e um fio ali dentro encolheria junto e
                    sairia do lugar. Aqui a geometria é fixa — 5px é o meio do
                    ponto de 10px encostado na direita, e `h-5` casa com o
                    `gap-5` da coluna. Se um mudar, o outro muda junto. */}
                {eUltimo ? null : (
                  <motion.span
                    aria-hidden="true"
                    className="absolute right-[5px] block h-5 w-px translate-x-1/2 bg-current"
                    style={{ top: "calc(50% + 5px)" }}
                    animate={{ opacity: jaPassou || eAtivo ? 0.26 : 0.13 }}
                    transition={{ duration: 0.45 }}
                  />
                )}

                <motion.span
                  className="rotulo-editorial whitespace-nowrap"
                  animate={{
                    opacity: eAtivo ? 1 : jaPassou ? 0.45 : 0.26,
                    x: eAtivo ? 0 : 5,
                  }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                >
                  {estado.nome}
                </motion.span>

                <motion.span
                  className="relative block shrink-0"
                  // Dimensão em style, não em classe: o ponto é medido em
                  // px e precisa existir mesmo antes do CSS de utilitário.
                  style={{ width: 10, height: 10 }}
                  animate={{ scale: eAtivo ? 1 : 0.55 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                >
                  <motion.span
                    className={`absolute inset-0 block rounded-full ${estado.cor}`}
                    animate={{ opacity: eAtivo ? 1 : jaPassou ? 0.7 : 0.32 }}
                    transition={{ duration: 0.45 }}
                  />

                  {/* Contorno POR DENTRO da borda do ponto, em currentColor.
                      É o que impede o estado ativo de sumir quando a cor dele é
                      a cor da seção — sage sobre a seção verde e terracota sobre
                      a vermelha. Sem ele o ativo virava um círculo vazado e lia
                      MAIS fraco que os inativos, que continuavam preenchidos:
                      a hierarquia saía invertida justamente no item que deveria
                      dominar. */}
                  <motion.span
                    className="absolute inset-0 block rounded-full border border-current"
                    animate={{ opacity: eAtivo ? 0.55 : 0.25 }}
                    transition={{ duration: 0.45 }}
                  />

                  {/* Anel externo e halo só no ativo. Nos inativos eram ruído:
                      três alvos concêntricos competindo pela mesma leitura. */}
                  <motion.span
                    className="absolute rounded-full border border-current"
                    style={{ inset: -4 }}
                    animate={{ opacity: eAtivo ? 0.4 : 0, scale: eAtivo ? 1 : 0.8 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  />
                  <motion.span
                    className={`absolute -inset-2 block rounded-full ${estado.cor}`}
                    animate={{ opacity: eAtivo ? 0.18 : 0 }}
                    transition={{ duration: 0.45 }}
                  />

                </motion.span>
              </div>
            );
          })}
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
