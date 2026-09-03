import { Rotulo, Secao } from "../primitivos";
import { TituloRevelado } from "../titulo-revelado";

/**
 * Estado (07) — o silêncio, sobre o fundo profundo da marca.
 *
 * Esta seção existe porque a ausência de resposta é o indicador mais
 * importante do acompanhamento e o único sem cor própria na escala.
 * Ver `Painel da enfermagem.md:50-51` no vault.
 */
export function Silencio() {
  return (
    <Secao
      id="silencio"
      corDeFundo="#0e2739"
      className="bg-azul-profundo text-creme"
    >
      <div className="grid gap-14 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-20">
        <div data-revelar>
          <Rotulo numero="07" tom="lime">
            Quando você não responde
          </Rotulo>
          <TituloRevelado className="display mt-7 text-[clamp(2.5rem,6vw,5rem)] text-lime">
          Ficar em silêncio também é uma resposta.
        </TituloRevelado>
        </div>

        <div data-revelar className="flex flex-col gap-7 md:pt-4">
          <p className="text-xl leading-relaxed text-creme/85">
            Um dia sem resposta pode ser um bom sinal; você estava bem e
            esqueceu. Pode ser o contrário: você piorou tanto que não
            conseguiu pegar o celular.
          </p>
          <p className="text-lg leading-relaxed text-creme/70">
            São as duas explicações mais prováveis, e elas são opostas. Por
            isso a sua ausência não passa em branco: depois de um período sem
            resposta, a enfermagem procura você. Não é cobrança; é a parte
            do cuidado que ninguém consegue fazer só olhando o que chegou.
          </p>
          <p className="text-lg leading-relaxed text-creme/70">
            Se você for internado, viajar ou precisar parar por qualquer
            motivo, avise a equipe. Assim ninguém liga achando que houve
            algo errado.
          </p>
        </div>
      </div>
    </Secao>
  );
}
