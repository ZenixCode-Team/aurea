import { Rotulo, Secao } from "../primitivos";
import { TituloRevelado } from "../titulo-revelado";

/**
 * Estado (09) — os dados do paciente, em linguagem de pessoa.
 *
 * Diagnóstico, sintoma, medicação e alergia são dado sensível de saúde.
 * Esta seção diz ao paciente o que acontece com o que ele conta, sem
 * usar uma única palavra de tecnologia. Ver `Modelo de dados.md:64-70`.
 */

const GARANTIAS = [
  {
    titulo: "Quem vê o que você responde",
    corpo:
      "A equipe que cuida de você no serviço onde faz o tratamento. Ninguém de fora, nenhuma empresa, nenhum plano de saúde.",
  },
  {
    titulo: "Fica marcado quem abriu",
    corpo:
      "Toda vez que alguém abre o seu histórico, fica anotado quem foi e quando. Não é possível olhar a sua ficha sem deixar rastro.",
  },
  {
    titulo: "O que você conta não vira propaganda",
    corpo:
      "Nada do que você responde é vendido, cedido ou usado para anúncio. O único motivo pelo qual perguntamos é o seu acompanhamento.",
  },
  {
    titulo: "Você sabe antes de aceitar",
    corpo:
      "No primeiro acesso, você lê o que está sendo pedido e para quê. Se algo não estiver claro, a equipe explica antes de você continuar.",
  },
];

export function Dados() {
  return (
    <Secao id="dados" corDeFundo="#f4f1e2" className="bg-creme-fundo">
      <div className="grid gap-14 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)] md:gap-20">
        <div data-revelar>
          <Rotulo numero="09">Seus dados</Rotulo>
          <TituloRevelado className="display mt-7 text-[clamp(2.5rem,6vw,5rem)] text-tinta">
          O que você conta fica com quem cuida de você.
        </TituloRevelado>
        </div>

        <div className="flex flex-col">
          {GARANTIAS.map((garantia) => (
            <div
              key={garantia.titulo}
              data-revelar
              className="border-b border-tinta/12 py-7 first:border-t first:border-tinta/12"
            >
              <h3 className="rotulo-editorial text-tinta">{garantia.titulo}</h3>
              <p className="mt-4 max-w-[52ch] text-[1.0625rem] leading-relaxed text-tinta-suave">
                {garantia.corpo}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Secao>
  );
}
