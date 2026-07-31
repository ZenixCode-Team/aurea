"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Botao } from "./primitivos";

const NAVEGACAO = [
  { href: "#funcionamento", rotulo: "Como funciona" },
  { href: "#verde", rotulo: "As cores" },
  { href: "#limites", rotulo: "Limites" },
  { href: "#perguntas", rotulo: "Perguntas" },
];

/**
 * Cabeçalho da landing.
 *
 * Decisão de UX vinculante (ADR-001): a landing é a porta de entrada única
 * dos três perfis. Por isso "Entrar" é persistente e sólido — é navegação,
 * não CTA de marketing. Um paciente debilitado precisa achar em 2 segundos.
 */
export function Cabecalho() {
  const [rolou, setRolou] = useState(false);

  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 40);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        rolou
          ? "bg-creme/80 py-3 shadow-[0_1px_0_0_rgba(20,32,26,0.08)] backdrop-blur-xl"
          : "py-6"
      }`}
    >
      <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-6 md:px-10 lg:px-16">
        <Link
          href="/"
          aria-label="AUREA — início"
          className={`display text-3xl transition-colors duration-500 ${
            rolou ? "text-tinta" : "text-creme"
          }`}
        >
          aurea
        </Link>

        <nav
          aria-label="Navegação principal"
          className="hidden items-center gap-9 lg:flex"
        >
          {NAVEGACAO.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`rotulo transition-colors duration-500 ${
                rolou
                  ? "text-tinta-suave hover:text-tinta"
                  : "text-white hover:text-lime"
              }`}
              style={
                rolou
                  ? undefined
                  : { textShadow: "0 1px 20px rgba(28,43,33,0.5)" }
              }
            >
              {item.rotulo}
            </a>
          ))}
        </nav>

        {/* Sobre a hero, a chamada é um oval de contorno como na ref oevra.
            Assim que a página rola para o creme, vira o pill lime sólido —
            a landing é porta de entrada e "Entrar" não pode sumir. */}
        {rolou ? (
          <Botao href="/entrar" className="!px-6 !py-2.5 !text-sm">
            Entrar
          </Botao>
        ) : (
          <Link
            href="/entrar"
            className="rotulo rounded-full border border-creme/60 px-7 py-3 text-creme transition-colors duration-300 hover:border-creme hover:bg-creme/10"
          >
            Entrar
          </Link>
        )}
      </div>
    </header>
  );
}
