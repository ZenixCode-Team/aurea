import { Botao } from "./primitivos";
import { TituloRevelado } from "./titulo-revelado";

/**
 * Rodapé + CTA final.
 *
 * A menção ao PPGITS/UFS não é modéstia — é prova de procedência. Produto
 * de saúde sem origem declarada é o que a audiência clínica desconfia
 * primeiro. Ver ADR-002, seção de anti-claims.
 */
export function Rodape() {
  return (
    <footer
      data-cor-fundo="#091d2a"
      className="relative overflow-hidden bg-azul-profundo-alto px-6 pb-12 pt-28 text-creme md:px-10 md:pb-14 md:pt-40 lg:px-16"
    >
      <div className="mx-auto w-full max-w-[1180px]">
        <div data-revelar>
          <TituloRevelado className="display max-w-[14ch] text-[clamp(2.5rem,7vw,6rem)] text-lime">
          Ninguém deveria passar esses dias sozinho.
        </TituloRevelado>
          <p className="mt-8 max-w-[48ch] text-lg leading-relaxed text-creme/80">
            Uma pergunta por dia. Uma cor que diz o que fazer. E alguém do
            outro lado quando a cor pede atenção.
          </p>
          <div className="mt-10">
            <Botao href="/entrar">Entrar no AUREA</Botao>
          </div>
        </div>

        <div className="mt-24 grid gap-10 border-t border-creme/12 pt-10 md:mt-32 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="display text-3xl text-creme">aurea</p>
            <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-creme/55">
              Monitoramento remoto de toxicidade em tratamento antineoplásico.
              Produto tecnológico desenvolvido no âmbito do mestrado
              profissional do PPGITS, Universidade Federal de Sergipe.
            </p>
          </div>

          <p className="rotulo-editorial text-creme/40">
            © {new Date().getFullYear()} AUREA
          </p>
        </div>

        <p className="mt-10 max-w-[70ch] text-xs leading-relaxed text-creme/35">
          O AUREA não emite diagnóstico, não substitui avaliação médica e não
          decide conduta clínica. As orientações apresentadas seguem o
          protocolo cadastrado pelo serviço de saúde responsável pelo
          acompanhamento do paciente.
        </p>
      </div>
    </footer>
  );
}
