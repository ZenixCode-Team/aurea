"use client";

import { motion } from "framer-motion";

/**
 * Título que revela palavra a palavra ao entrar na tela.
 *
 * Cada palavra sobe por trás de uma máscara, com defasagem. É o mesmo
 * princípio de revelação usado na oevra, aplicado aos títulos internos.
 *
 * `whileInView` com `once` evita reanimação a cada passagem — repetir o
 * efeito na volta do scroll cansa e chama atenção para o efeito em vez do
 * texto. E o respeito a `prefers-reduced-motion` é da própria Framer
 * Motion, que reduz a animação quando o sistema pede.
 */
interface PropsTituloRevelado {
  children: string;
  className?: string;
  /** Tag renderizada. Default h2 — a hero usa h1 própria. */
  como?: "h1" | "h2" | "h3";
}

export function TituloRevelado({
  children,
  className = "",
  como = "h2",
}: PropsTituloRevelado) {
  const Tag = motion[como];
  const palavras = children.split(" ");

  return (
    <Tag
      className={className}
      initial="oculto"
      whileInView="visivel"
      viewport={{ once: true, margin: "-12% 0px -12% 0px" }}
      variants={{
        oculto: {},
        visivel: { transition: { staggerChildren: 0.055 } },
      }}
    >
      {palavras.map((palavra, indice) => (
        <span
          key={`${palavra}-${indice}`}
          className="inline-block overflow-hidden pb-[0.09em] align-bottom"
        >
          <motion.span
            className="inline-block"
            variants={{
              oculto: { y: "106%" },
              visivel: { y: "0%" },
            }}
            transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
          >
            {palavra}
          </motion.span>
          {indice < palavras.length - 1 ? " " : null}
        </span>
      ))}
    </Tag>
  );
}
