import { Rotulo, Secao } from "../primitivos";
import { TituloRevelado } from "../titulo-revelado";

/**
 * Estado (03) — como funciona, no creme de fundo.
 *
 * Quatro passos numerados, padrão herdado de titanintake. O conteúdo sai
 * do fluxo ponta a ponta (`AUREA Visão geral.md:41`), escrito na segunda
 * pessoa: quem lê é o paciente, não a equipe técnica.
 */

const PASSOS = [
  {
    numero: "01",
    titulo: "Você conta",
    corpo:
      "Um sintoma por vez. A primeira pergunta é só sim ou não — se você não sentiu aquilo, passa direto. Só quem tem a queixa responde as perguntas de detalhe.",
  },
  {
    numero: "02",
    titulo: "Aparece uma cor",
    corpo:
      "Verde, amarelo ou vermelho. A cor vem do que você acabou de responder e dos critérios que o seu serviço definiu para o seu tratamento.",
  },
  {
    numero: "03",
    titulo: "Você recebe a orientação",
    corpo:
      "O que fazer em casa para aquele sintoma. Se houver remédio, é sempre um que já está na sua receita — nada novo é indicado por aqui.",
  },
  {
    numero: "04",
    titulo: "A equipe é avisada",
    corpo:
      "Amarelo e vermelho chegam à enfermagem no mesmo momento. Alguém abre o seu histórico, entra em contato e anota o que foi feito.",
  },
];

export function Funcionamento() {
  return (
    <Secao id="funcionamento" corDeFundo="#f4f1e2" className="bg-creme-fundo">
      <div data-revelar>
        <Rotulo numero="03">Como funciona</Rotulo>
        <TituloRevelado className="display mt-7 max-w-[15ch] text-[clamp(2.5rem,6vw,5rem)] text-tinta">
          Quatro passos, uma vez por dia.
        </TituloRevelado>
      </div>

      <ol className="mt-16 grid gap-px overflow-hidden rounded-2xl bg-tinta/10 md:mt-24 md:grid-cols-2">
        {PASSOS.map((passo) => (
          <li
            key={passo.numero}
            data-revelar
            className="bg-creme p-9 transition-colors duration-500 hover:bg-creme-fundo md:p-12"
          >
            <span className="rotulo-editorial text-ambar">{passo.numero}</span>
            <h3 className="display mt-5 text-4xl text-tinta md:text-5xl">
              {passo.titulo}
            </h3>
            <p className="mt-4 max-w-[38ch] text-[1.0625rem] leading-relaxed text-tinta-suave">
              {passo.corpo}
            </p>
          </li>
        ))}
      </ol>

      <p
        data-revelar
        className="mt-14 max-w-[58ch] text-lg leading-relaxed text-tinta-suave md:mt-20"
      >
        Nos dias em que você não sente nada, o caminho inteiro leva poucos
        toques. O tempo maior fica reservado para os dias em que há algo a
        contar — que são exatamente os dias em que vale a pena.
      </p>
    </Secao>
  );
}
