import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Primitivos do design system da landing.
 * Ver ADR-002 — cada um carrega uma decisão declarada no Imprint da Ref.
 */

/* --------------------------------------------------------------------------
   Rótulo de seção
   Assinatura que funde as duas refs: prefixo `//` (titanintake) +
   numeração entre parênteses (oevra). É o elemento que amarra a landing
   inteira sem competir com o display.
   -------------------------------------------------------------------------- */

interface PropsRotulo {
  numero: string;
  children: ReactNode;
  tom?: "claro" | "escuro" | "lime";
}

const TONS_ROTULO = {
  claro: "text-creme/70",
  escuro: "text-tinta-suave",
  lime: "text-lime",
} as const;

export function Rotulo({ numero, children, tom = "escuro" }: PropsRotulo) {
  return (
    <p className={`rotulo ${TONS_ROTULO[tom]}`}>
      <span aria-hidden="true">{"// "}</span>({numero}) {children}
    </p>
  );
}

/* --------------------------------------------------------------------------
   CTA pill
   Origem: titanintake. Mas aqui não é botão de marketing — a landing é a
   porta de entrada dos três perfis, então "Entrar" é elemento de navegação
   e fica persistente e sólido. Ver ADR-001, regra da porta única.
   -------------------------------------------------------------------------- */

interface PropsBotao {
  href: string;
  children: ReactNode;
  variante?: "solido" | "contorno";
  className?: string;
}

export function Botao({
  href,
  children,
  variante = "solido",
  className = "",
}: PropsBotao) {
  const base =
    "group inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 text-base font-medium transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]";

  const variantes = {
    solido:
      "bg-lime text-verde-profundo hover:bg-creme hover:shadow-[0_8px_30px_-8px_rgba(223,241,120,0.6)]",
    contorno:
      "border border-current/30 text-current hover:border-current/70 hover:bg-current/5",
  } as const;

  return (
    <Link href={href} className={`${base} ${variantes[variante]} ${className}`}>
      {children}
      <span
        aria-hidden="true"
        className="transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      >
        ↗
      </span>
    </Link>
  );
}

/* --------------------------------------------------------------------------
   Invólucro de seção — largura e respiro consistentes.
   Padding vertical generoso é decisão das duas refs.
   -------------------------------------------------------------------------- */

interface PropsSecao {
  id: string;
  children: ReactNode;
  className?: string;
  /** Cor de fundo que o ScrollTrigger aplica ao body ao entrar nesta seção. */
  corDeFundo?: string;
}

export function Secao({ id, children, className = "", corDeFundo }: PropsSecao) {
  return (
    <section
      id={id}
      data-secao
      data-cor-fundo={corDeFundo}
      className={`relative px-6 py-28 md:px-10 md:py-40 lg:px-16 ${className}`}
    >
      <div className="mx-auto w-full max-w-[1180px]">{children}</div>
    </section>
  );
}
