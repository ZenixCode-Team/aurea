/**
 * O conteúdo de um verbete do mural.
 *
 * Vive fora das duas telas que o usam — o cartão que expande em `/app/perfil` e a
 * página de link direto em `/app/perfil/sintomas/[sintoma]`. Texto clínico duplicado
 * em dois arquivos é texto que diverge na primeira correção: alguém ajusta o "quando
 * procurar" de um lado, esquece o outro, e passa a existir uma tela que orienta
 * diferente da outra sobre o mesmo sintoma.
 *
 * A ORDEM DOS BLOCOS É DECISÃO CLÍNICA, NÃO DIAGRAMAÇÃO.
 *
 * "O que costuma acontecer" vem antes de "quando procurar a equipe", e os dois estão
 * sempre juntos, sem dobra, sem "ver mais". Tranquilizar sem dizer onde o esperado
 * termina é como alguém em quimioterapia decide esperar até amanhã com febre em
 * neutropenia. O tipo `VerbeteDoMural` torna `quandoProcurar` obrigatório para que
 * nenhum verbete futuro consiga aparecer só com a parte que acalma.
 *
 * POR QUE O BLOCO DE PROCURA NÃO É VERMELHO. `Aviso tom="grave"` é permitido no app
 * do paciente — o verificador de conformidade diz isso com todas as letras, porque
 * "grave" ali é gravidade de mensagem e não classificação clínica. Mesmo assim não
 * entra: caixa vermelha nesta tela imita o vermelho da escala, que é exatamente o que
 * a lei 2 mantém fora dos olhos do paciente. A ênfase vem de posição, peso e do botão
 * de contato ao lado, não de cor.
 */

import type { VerbeteDoMural } from '@aurea/contratos';
import { LinkComoBotao } from './primitivos';

export function ConteudoDoVerbete({ verbete }: { verbete: VerbeteDoMural }) {
  return (
    <div className="flex flex-col gap-6">
      <Secao titulo="Por que acontece">
        <p className="text-base leading-relaxed text-[var(--color-texto-suave)]">
          {verbete.porQueAcontece}
        </p>
      </Secao>

      <Secao titulo="O que costuma acontecer">
        <ListaDoVerbete itens={verbete.oQueEsperar} />
      </Secao>

      <Secao titulo="O que dá para fazer em casa">
        <ListaDoVerbete itens={verbete.emCasa} />
        <p className="mt-4 text-sm leading-relaxed text-[var(--color-texto-fraco)]">
          Nada que não esteja na sua receita deve ser começado por conta própria, nem
          mesmo remédio que já ajudou alguém conhecido.
        </p>
      </Secao>

      {/* Fecha o verbete, com a ação de contato ao lado: é o que a pessoa precisa
          achar ao abrir isto às duas da manhã sem paciência para ler o resto. */}
      <Secao titulo="Quando procurar a equipe">
        <ListaDoVerbete itens={verbete.quandoProcurar} destacada />
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[var(--color-borda)] pt-4">
          <LinkComoBotao href="/app/contato">Falar com a enfermagem</LinkComoBotao>
          <p className="text-sm text-[var(--color-texto-suave)]">
            Em emergência, procure o serviço direto. Não espere resposta pelo aplicativo.
          </p>
        </div>
      </Secao>

      <p className="border-t border-[var(--color-borda)] pt-4 text-sm leading-relaxed text-[var(--color-texto-fraco)]">
        Este texto complementa o que a sua equipe explicou na consulta; não substitui. Se
        ficou diferente do que disseram para você, o que vale é a orientação da sua equipe.
      </p>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 text-sm font-semibold text-[var(--color-texto)]">{titulo}</h3>
      {children}
    </section>
  );
}

function ListaDoVerbete({
  itens,
  destacada = false,
}: {
  itens: readonly string[];
  destacada?: boolean;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {itens.map((item) => (
        <li key={item} className="flex gap-3">
          {/* Marcador em filete, não em bolinha colorida: nesta tela cor com
              significado é sempre cor de classificação, e essa não entra aqui. */}
          <span
            aria-hidden="true"
            className="mt-[0.62em] h-px w-3 shrink-0 bg-[var(--color-borda-forte)]"
          />
          <span
            className={
              destacada
                ? 'text-base leading-relaxed text-[var(--color-texto)]'
                : 'text-base leading-relaxed text-[var(--color-texto-suave)]'
            }
          >
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}
