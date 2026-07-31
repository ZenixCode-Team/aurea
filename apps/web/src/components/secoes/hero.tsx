"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import { FundoOrganico } from "../fundo-organico";
import { HaloCursor } from "../halo-cursor";

/**
 * Hero — reconstruída sobre a estrutura da ref oevra.com, a pedido do João.
 *
 * O que vem literalmente dela:
 * - campo WebGL verde claro ocupando tudo, sem véu escuro por cima
 * - três frases em grotesca branca minúscula, escalonadas na horizontal
 * - filetes de 1px preenchendo o vão de cada linha escalonada
 * - "role" na vertical no canto inferior esquerdo, com filete
 * - parágrafo curto e chamada em mono no rodapé do quadro
 *
 * O display serif em lime (assinatura vinda da titanintake) segue vivo nas
 * seções internas — as duas refs continuam presentes, cada uma no seu lugar.
 * Ver ADR-002.
 */

const FRASES = [
  "uma pergunta por dia",
  "uma cor que orienta",
  "alguém do outro lado",
];

const SOMBRA_TEXTO = { textShadow: "0 2px 34px rgba(28,43,33,0.42)" };

export function Hero() {
  const refSecao = useRef<HTMLElement>(null);
  // Vira true quando a entrada do título termina; a partir daí as máscaras
  // saem e a mescla do halo volta a ser uniforme sobre o texto.
  const [revelado, setRevelado] = useState(false);

  const { scrollYProgress } = useScroll({
    target: refSecao,
    offset: ["start start", "end start"],
  });

  const deslocamento = useTransform(scrollYProgress, [0, 1], ["0%", "34%"]);
  const opacidade = useTransform(scrollYProgress, [0, 0.72], [1, 0]);
  const escala = useTransform(scrollYProgress, [0, 1], [1, 1.14]);

  return (
    <section
      ref={refSecao}
      id="hero"
      data-cor-fundo="#8fa05e"
      className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden"
    >
      {/* Camada 1 — o campo. Fica atrás de tudo. */}
      <motion.div style={{ scale: escala }} className="absolute inset-0">
        <FundoOrganico />
      </motion.div>

      {/* Três frases escalonadas, com filete no vão de cada uma. */}
      <motion.div
        style={{ y: deslocamento, opacity: opacidade }}
        className="relative z-10 w-full px-6 md:px-10 lg:px-14"
      >
        <h1
          className="flex flex-col gap-1 text-[clamp(2rem,6.4vw,5.5rem)] font-normal leading-[1.12] tracking-[-0.025em] text-white md:gap-2"
          style={SOMBRA_TEXTO}
        >
          {/* Linha 1 — centralizada */}
          <LinhaHero
            className="justify-center"
            atraso={0.15}
            revelado={revelado}
            aoTerminar={() => setRevelado(true)}
          >
            {FRASES[0]}
          </LinhaHero>

          {/* Linha 2 — à esquerda, filete à direita */}
          <LinhaHero
            className="items-center justify-start gap-[4vw] pl-[2%]"
            atraso={0.28}
            revelado={revelado}
            filete="depois"
          >
            {FRASES[1]}
          </LinhaHero>

          {/* Linha 3 — à direita, filete à esquerda */}
          <LinhaHero
            className="items-center justify-end gap-[4vw] pr-[2%]"
            atraso={0.41}
            revelado={revelado}
            filete="antes"
          >
            {FRASES[2]}
          </LinhaHero>
        </h1>
      </motion.div>

      {/* Camada 3 — o rastro do cursor, em plus-lighter POR CIMA do texto.
          É onde a oevra coloca o dela (z-index 2, sobre o conteúdo), e é
          esse brilho atravessando as letras que dá o acabamento.
          Fora do parallax de propósito: o rastro segue o cursor na tela,
          não o conteúdo que está rolando. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 mix-blend-plus-lighter"
      >
        <HaloCursor />
      </div>

      {/* Rodapé do quadro: role · parágrafo · chamada */}
      <motion.div
        style={{ opacity: opacidade }}
        className="absolute inset-x-0 bottom-0 z-10 px-6 pb-9 md:px-10 md:pb-11 lg:px-14"
      >
        <div className="flex items-end justify-between gap-10">
          <IndicadorRolagem />

          <motion.p
            className="hidden max-w-[42ch] text-[0.9375rem] leading-snug text-white md:block"
            style={SOMBRA_TEXTO}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.85, ease: [0.16, 1, 0.3, 1] }}
          >
            O AUREA acompanha você nos dias em casa, entre uma sessão e outra.
            Quando alguma coisa precisa de atenção, a equipe que cuida de você
            fica sabendo na hora.
          </motion.p>

          <motion.a
            href="/entrar"
            className="group hidden shrink-0 items-center gap-3 text-white md:flex"
            style={SOMBRA_TEXTO}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.95, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="rotulo">Entrar no AUREA</span>
            <span
              aria-hidden="true"
              className="flex items-center gap-1.5 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1.5"
            >
              <span className="block h-px w-1.5 bg-white" />
              <span className="block h-px w-5 bg-white" />
              <span className="text-[0.6rem] leading-none">▶</span>
            </span>
          </motion.a>
        </div>
      </motion.div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Linha do título da hero.
 *
 * Enquanto revela, a linha usa máscara (`overflow-hidden`) com o texto
 * transformado por dentro. Terminada a entrada, a máscara e a transformação
 * SÃO REMOVIDAS.
 *
 * Isso não é limpeza opcional: elemento com `overflow-hidden` e filho
 * transformado vira camada de composição própria, e o halo em
 * `mix-blend-plus-lighter` passa a mesclar contra cada camada em vez de
 * contra o fundo inteiro — o que desenha um retângulo visível atrás de cada
 * linha. Sem transformação, não há camada, e a mescla volta a ser uniforme.
 */
function LinhaHero({
  children,
  className = "",
  atraso,
  revelado,
  filete,
  aoTerminar,
}: {
  children: string;
  className?: string;
  atraso: number;
  revelado: boolean;
  filete?: "antes" | "depois";
  aoTerminar?: () => void;
}) {
  const texto = revelado ? (
    <span className="block whitespace-nowrap">{children}</span>
  ) : (
    <span className="block overflow-hidden">
      <motion.span
        className="block whitespace-nowrap"
        initial={{ y: "108%" }}
        animate={{ y: "0%" }}
        transition={{ duration: 1.25, delay: atraso, ease: [0.16, 1, 0.3, 1] }}
        onAnimationComplete={aoTerminar}
      >
        {children}
      </motion.span>
    </span>
  );

  return (
    <span className={`flex pb-[0.06em] ${className}`}>
      {filete === "antes" ? <Filete atraso={1.05} /> : null}
      {texto}
      {filete === "depois" ? <Filete atraso={0.9} /> : null}
    </span>
  );
}

function Filete({ atraso }: { atraso: number }) {
  return (
    <motion.span
      aria-hidden="true"
      className="block h-px w-[10vw] max-w-[210px] shrink-0 origin-left bg-white/70"
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 1.1, delay: atraso, ease: [0.16, 1, 0.3, 1] }}
    />
  );
}

function IndicadorRolagem() {
  return (
    <motion.div
      aria-hidden="true"
      className="flex shrink-0 flex-col items-center gap-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, delay: 1.15 }}
    >
      <span className="relative block h-16 w-px overflow-hidden bg-white/30">
        <motion.span
          className="absolute inset-x-0 top-0 block h-1/2 bg-white"
          animate={{ y: ["-110%", "220%"] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: [0.7, 0, 0.3, 1] }}
        />
      </span>
      <span
        className="rotulo text-white [writing-mode:vertical-rl]"
        style={SOMBRA_TEXTO}
      >
        role
      </span>
    </motion.div>
  );
}
