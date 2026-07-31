import { Rotulo, Secao } from "../primitivos";
import { TituloRevelado } from "../titulo-revelado";

/**
 * Estado (08) — o que o AUREA não faz.
 *
 * Em produto de saúde, dizer o que a ferramenta NÃO faz constrói mais
 * confiança do que qualquer promessa. Esta seção também é o cumprimento
 * visível da política de anti-claims do ADR-002.
 */

const LIMITES = [
  {
    titulo: "Não dá diagnóstico",
    corpo:
      "As cores dizem se o que você sentiu precisa de atenção. Nenhuma delas diz o que você tem. Isso é do seu médico.",
  },
  {
    titulo: "Não substitui a consulta",
    corpo:
      "Responder todo dia não troca nenhum retorno marcado. As consultas continuam exatamente como o seu tratamento previu.",
  },
  {
    titulo: "Não receita remédio",
    corpo:
      "Quando aparece a orientação de um medicamento, é sempre um que já está na sua receita. Nada novo é sugerido aqui.",
  },
  {
    titulo: "Não é pronto-socorro",
    corpo:
      "Não é um canal de urgência e ninguém está lendo a tela 24 horas. Em emergência, procure atendimento ou ligue 192.",
  },
  {
    titulo: "Não decide o seu tratamento",
    corpo:
      "O protocolo, os medicamentos e as datas continuam sendo definidos pela equipe que cuida de você.",
  },
  {
    titulo: "Não fala por você",
    corpo:
      "Se você discorda de alguma orientação ou sente algo que não estava nas perguntas, diga à equipe. A conversa continua valendo mais.",
  },
];

export function Limites() {
  return (
    <Secao id="limites" corDeFundo="#fbf9ef" className="bg-creme">
      <div data-revelar>
        <Rotulo numero="08">Os limites</Rotulo>
        <TituloRevelado className="display mt-7 max-w-[15ch] text-[clamp(2.5rem,6vw,5rem)] text-tinta">
          O que o AUREA não faz.
        </TituloRevelado>
        <p className="mt-8 max-w-[54ch] text-xl leading-relaxed text-tinta-suave">
          Confiar em uma ferramenta de saúde começa por saber onde ela para.
          Estes são os limites, escritos antes de você precisar deles.
        </p>
      </div>

      <ul className="mt-16 grid gap-px overflow-hidden rounded-2xl bg-tinta/10 md:mt-24 md:grid-cols-3">
        {LIMITES.map((limite) => (
          <li
            key={limite.titulo}
            data-revelar
            className="bg-creme p-9 transition-colors duration-500 hover:bg-creme-fundo md:p-10"
          >
            <h3 className="display text-3xl text-tinta md:text-[2.125rem]">
              {limite.titulo}
            </h3>
            <p className="mt-4 text-[1.0625rem] leading-relaxed text-tinta-suave">
              {limite.corpo}
            </p>
          </li>
        ))}
      </ul>
    </Secao>
  );
}
