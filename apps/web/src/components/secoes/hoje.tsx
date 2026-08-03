import { Rotulo, Secao } from "../primitivos";
import { TituloRevelado } from "../titulo-revelado";

/**
 * Estado (02) — o problema, em creme.
 *
 * Comparação lado a lado herdada de titanintake. Sem métrica inventada:
 * cada linha da coluna "hoje" sai da descrição do problema no vault
 * (`AUREA Visão geral.md:20-22`), reescrita em linguagem de paciente.
 *
 * A comparação só funciona se o leitor souber QUAL coluna é qual. No desktop
 * isso vinha implícito na posição; no mobile, onde as colunas viram blocos
 * empilhados, se perdia por completo — sobravam dois parágrafos seguidos, um
 * claro e um escuro, sem nada dizendo que o primeiro é o presente e o segundo
 * é a proposta. Daí cabeçalho de coluna no desktop e rótulo por bloco no
 * mobile: a mesma informação, dita do jeito que cada largura comporta.
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

/** Uma definição só da malha — cabeçalho e linhas não saem de prumo por descuido. */
const MALHA =
  "md:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] md:gap-10 lg:gap-14";

export function Hoje() {
  return (
    <Secao id="hoje" corDeFundo="#fbf9ef" className="bg-creme">
      <div data-revelar>
        <Rotulo numero="02">O que acontece hoje</Rotulo>
        <TituloRevelado className="display mt-7 max-w-[19ch] text-[clamp(2.5rem,6vw,5rem)] text-tinta">
          Entre uma sessão e outra, você fica sozinho com o que sente.
        </TituloRevelado>
      </div>

      <div className="mt-16 md:mt-24">
        {/* Cabeçalho só onde existem colunas para nomear. No mobile viraria um
            par de palavras órfãs, longe do texto que qualificam. */}
        <div
          data-revelar
          className={`hidden border-b border-tinta/15 pb-4 md:grid ${MALHA}`}
        >
          <span aria-hidden="true" />
          <span className="rotulo-editorial text-tinta/40">Hoje</span>
          <span className="rotulo-editorial text-sage md:pl-10 lg:pl-14">
            Com o AUREA
          </span>
        </div>

        <div className="border-t border-tinta/12 md:border-t-0">
          {CONTRASTES.map((linha, indice) => (
            <div
              key={linha.eixo}
              data-revelar
              className={`group grid gap-6 border-b border-tinta/12 py-9 transition-colors duration-500 md:gap-10 md:py-11 md:hover:bg-tinta/[0.015] ${MALHA}`}
            >
              <div className="flex items-baseline gap-4">
                <span className="rotulo-editorial text-tinta/30 transition-colors duration-500 md:group-hover:text-sage">
                  {String(indice + 1).padStart(2, "0")}
                </span>
                {/* Sobe de `tinta-suave` para `tinta`: o eixo é a pergunta que a
                    linha responde, e lia mais fraco que as duas respostas que
                    governa. */}
                <span className="rotulo-editorial text-tinta">{linha.eixo}</span>
              </div>

              <div>
                <span
                  aria-hidden="true"
                  className="rotulo-editorial mb-2 block text-tinta/35 md:hidden"
                >
                  Hoje
                </span>
                <p className="text-[1.0625rem] leading-relaxed text-tinta/55">
                  {linha.hoje}
                </p>
              </div>

              {/* Fio à esquerda no desktop: separa as duas respostas sem caixa e
                  sem fundo colorido. No mobile ele seria uma barra vertical
                  solta, então quem separa é o rótulo. */}
              <div className="md:border-l md:border-tinta/12 md:pl-10 lg:pl-14">
                <span
                  aria-hidden="true"
                  className="rotulo-editorial mb-2 block text-sage md:hidden"
                >
                  Com o AUREA
                </span>
                <p className="relative pl-5 text-[1.0625rem] leading-relaxed text-tinta">
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-[0.62em] h-1.5 w-1.5 rounded-full bg-sage"
                  />
                  {linha.aurea}
                </p>
              </div>
            </div>
          ))}
        </div>
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
