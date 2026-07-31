import { Cabecalho } from "@/components/cabecalho";
import { IndicadorEscala } from "@/components/indicador-escala";
import { ProvedorMotion } from "@/components/provedor-motion";
import { Rodape } from "@/components/rodape";
import { CorAmbar, CorVerde, CorVermelho } from "@/components/secoes/cores";
import { Dados } from "@/components/secoes/dados";
import { Funcionamento } from "@/components/secoes/funcionamento";
import { Hero } from "@/components/secoes/hero";
import { Hoje } from "@/components/secoes/hoje";
import { Limites } from "@/components/secoes/limites";
import { Perguntas } from "@/components/secoes/perguntas";
import { Portas } from "@/components/secoes/portas";
import { Silencio } from "@/components/secoes/silencio";

/**
 * Landing do AUREA — porta de entrada única dos três perfis (ADR-001).
 *
 * A ordem das seções percorre a escala de triagem do produto, e cada cor
 * ganha uma seção inteira para explicar o que significa, o que o paciente
 * faz e o que a equipe faz:
 *
 *   01 intervalo (verde) · 02 o problema · 03 como funciona
 *   04 verde · 05 amarelo · 06 vermelho · 07 o silêncio
 *   08 os limites · 09 os dados · 10 perguntas · 11 acesso
 *
 * A cor de fundo da página acompanha, conduzida por ScrollTrigger.
 */
export default function Landing() {
  return (
    <>
      <ProvedorMotion />
      <Cabecalho />
      <IndicadorEscala />
      <main>
        <Hero />
        <Hoje />
        <Funcionamento />
        {/* Contêiner próprio para o empilhamento. Sem ele, `sticky top-0`
            tem o <main> inteiro como bloco contêiner e as três seções ficam
            grudadas no topo até o fim da página — escondidas atrás do
            conteúdo seguinte, mas ainda desenhando. Aqui elas soltam ao
            terminar o bloco, que é onde a escala acaba. */}
        <div className="relative">
          <CorVerde />
          <CorAmbar />
          <CorVermelho />
        </div>
        <Silencio />
        <Limites />
        <Dados />
        <Perguntas />
        <Portas />
      </main>
      <Rodape />
    </>
  );
}
