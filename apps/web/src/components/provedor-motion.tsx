"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

/**
 * Patamar 2 · Deep Combine — Lenis conduz o scroll, GSAP/ScrollTrigger
 * conduz a progressão cromática, Framer Motion cuida dos reveals locais.
 *
 * A transição de cor entre seções não é decoração: ela percorre a escala de
 * triagem do produto (verde -> âmbar -> vermelho -> verde). Ver ADR-002,
 * "a escala é a espinha narrativa".
 */
export function ProvedorMotion() {
  useEffect(() => {
    const prefereMenosMovimento = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    gsap.registerPlugin(ScrollTrigger);

    const contexto = gsap.context(() => {
      // --- Progressão cromática da página ---------------------------------
      const secoes = gsap.utils.toArray<HTMLElement>("[data-cor-fundo]");

      secoes.forEach((secao) => {
        const cor = secao.dataset.corFundo;
        if (!cor) return;

        ScrollTrigger.create({
          trigger: secao,
          start: "top 55%",
          end: "bottom 45%",
          onEnter: () => aplicarCor(cor),
          onEnterBack: () => aplicarCor(cor),
        });
      });

      // --- Reveal de blocos ------------------------------------------------
      if (!prefereMenosMovimento) {
        gsap.utils.toArray<HTMLElement>("[data-revelar]").forEach((alvo) => {
          gsap.from(alvo, {
            y: 34,
            opacity: 0,
            duration: 1.1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: alvo,
              start: "top 88%",
              once: true,
            },
          });
        });
      }
    });

    // --- Scroll suave -----------------------------------------------------
    let lenis: Lenis | null = null;
    let quadro = 0;

    if (!prefereMenosMovimento) {
      lenis = new Lenis({ duration: 1.1, smoothWheel: true });

      lenis.on("scroll", ScrollTrigger.update);

      const tick = (tempo: number) => {
        lenis?.raf(tempo);
        quadro = requestAnimationFrame(tick);
      };
      quadro = requestAnimationFrame(tick);
    }

    ScrollTrigger.refresh();

    return () => {
      cancelAnimationFrame(quadro);
      lenis?.destroy();
      contexto.revert();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return null;
}

function aplicarCor(cor: string) {
  document.body.style.backgroundColor = cor;
}
