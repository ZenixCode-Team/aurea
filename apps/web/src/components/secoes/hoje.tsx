import { Rotulo, Secao } from "../primitivos";
import { TituloRevelado } from "../titulo-revelado";

/**
 * Estado (02) — o problema, em creme.
 *
 * Comparação lado a lado herdada de titanintake. Sem métrica inventada:
 * cada linha da coluna "hoje" sai da descrição do problema no vault
 * (`AUREA Visão geral.md:20-22`), reescrita em linguagem de paciente.
 */

const CONTRASTES = [
  {
    eixo: "Quando os efeitos aparecem",
    hoje: "Em casa, nos dias entre uma sessão e outra — longe do hospital.",
    aurea: "Nos mesmos dias. A diferença é que alguém pergunta ali.",
  },
  {
    eixo: "Quem decide se está grave",
    hoje: "Você. Quem espera demais chega tarde; quem se assusta cedo passa a noite na emergência à toa.",
    aurea: "A pergunta chega antes de você ter que decidir sozinho.",
  },
  {
    eixo: "O que a equipe sabe",
    hoje: "O que você lembrar de contar no próximo retorno, semanas depois.",
    aurea: "O que você sentiu em cada dia, na data em que sentiu.",
  },
  {
    eixo: "O que conta como grave",
    hoje: "Muda conforme quem atende e o dia em que você liga.",
    aurea: "O mesmo critério para todo mundo do serviço, todos os dias.",
  },
];

export function Hoje() {
  return (
    <Secao id="hoje" corDeFundo="#fbf9ef" className="bg-creme">
      <div data-revelar>
        <Rotulo numero="02">O que acontece hoje</Rotulo>
        <TituloRevelado className="display mt-7 max-w-[19ch] text-[clamp(2.5rem,6vw,5rem)] text-tinta">
          Entre uma sessão e outra, você fica sozinho com o que sente.
        </TituloRevelado>
      </div>

      <div className="mt-16 border-t border-tinta/12 md:mt-24">
        {CONTRASTES.map((linha, indice) => (
          <div
            key={linha.eixo}
            data-revelar
            className="grid gap-5 border-b border-tinta/12 py-9 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,1fr)] md:gap-10 md:py-11"
          >
            <div className="flex items-baseline gap-4">
              <span className="rotulo text-tinta/35">
                {String(indice + 1).padStart(2, "0")}
              </span>
              <span className="rotulo text-tinta-suave">{linha.eixo}</span>
            </div>

            <p className="text-[1.0625rem] leading-relaxed text-tinta/55">
              {linha.hoje}
            </p>

            <p className="relative pl-5 text-[1.0625rem] leading-relaxed text-tinta">
              <span
                aria-hidden="true"
                className="absolute left-0 top-[0.6em] h-1.5 w-1.5 rounded-full bg-sage"
              />
              {linha.aurea}
            </p>
          </div>
        ))}
      </div>

      <p
        data-revelar
        className="mt-14 max-w-[62ch] text-lg leading-relaxed text-tinta-suave"
      >
        Os efeitos da quimioterapia costumam aparecer nos dias em que você
        está em casa. O AUREA não muda o seu tratamento — ele coloca a
        pergunta no dia certo e leva a sua resposta para quem sabe o que
        fazer com ela.
      </p>
    </Secao>
  );
}
