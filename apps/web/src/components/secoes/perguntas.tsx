import { Rotulo, Secao } from "../primitivos";
import { TituloRevelado } from "../titulo-revelado";

/**
 * Estado (10) — perguntas frequentes.
 *
 * Acordeão em `<details>` nativo: acessível por teclado e por leitor de
 * tela sem uma linha de script. Para um público que inclui paciente idoso,
 * o componente nativo é mais confiável que qualquer implementação própria.
 *
 * Só entram aqui perguntas que a especificação do produto já responde.
 * Cuidador, canal de lembrete e cadência exata ainda são decisões abertas
 * e por isso não aparecem — ver as decisões em aberto no vault.
 */

const PERGUNTAS = [
  {
    pergunta: "Quanto tempo leva para responder?",
    resposta:
      "Menos do que você imagina. A primeira pergunta de cada sintoma é só sim ou não. Se você não sentiu nada daquilo, responde não e já passa para a próxima; as perguntas de detalhe só aparecem para quem tem a queixa.",
  },
  {
    pergunta: "E se eu não estiver sentindo nada?",
    resposta:
      "Responda mesmo assim. Um dia sem sintoma é uma informação importante para quem acompanha você, e é justamente o dia que menos custa: são poucos toques até o fim.",
  },
  {
    pergunta: "Preciso instalar algum aplicativo?",
    resposta:
      "Não. O AUREA abre no navegador do seu celular, como um site. Se quiser, você pode adicionar o atalho na tela inicial e ele passa a abrir direto no check-in do dia.",
  },
  {
    pergunta: "E se eu piorar depois de já ter respondido?",
    resposta:
      "Você não precisa esperar o dia seguinte. Dá para responder outra vez, e existe um botão para pedir contato da enfermagem a qualquer momento, independentemente da cor que apareceu.",
  },
  {
    pergunta: "Quem vai ler o que eu escrevi?",
    resposta:
      "A equipe que cuida de você no serviço onde faz o tratamento. Ela vê o que você respondeu, em que dia, e o que já foi orientado nas vezes anteriores.",
  },
  {
    pergunta: "As perguntas são sempre as mesmas?",
    resposta:
      "As perguntas iniciais sim. O que muda é o caminho: dependendo do que você marca, aparecem perguntas mais específicas sobre aquele sintoma: intensidade, quantas vezes, se houve febre junto.",
  },
  {
    pergunta: "Se eu marcar vermelho, alguém me liga na hora?",
    resposta:
      "A enfermagem é avisada imediatamente e o seu nome vai para o topo da lista. Mas não conte com uma ligação para decidir se procura atendimento: quando a tela diz para procurar o serviço, procure.",
  },
];

export function Perguntas() {
  return (
    <Secao id="perguntas" corDeFundo="#fbf9ef" className="bg-creme">
      <div data-revelar>
        <Rotulo numero="10">Perguntas frequentes</Rotulo>
        <TituloRevelado className="display mt-7 max-w-[15ch] text-[clamp(2.5rem,6vw,5rem)] text-tinta">
          O que as pessoas costumam perguntar.
        </TituloRevelado>
      </div>

      <div className="mt-16 border-t border-tinta/12 md:mt-24">
        {PERGUNTAS.map((item) => (
          <details
            key={item.pergunta}
            data-revelar
            className="group border-b border-tinta/12"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-8 py-7 text-xl text-tinta transition-colors duration-300 hover:text-tinta-suave md:text-2xl [&::-webkit-details-marker]:hidden">
              {item.pergunta}
              <span
                aria-hidden="true"
                className="shrink-0 text-2xl leading-none text-tinta-suave transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="max-w-[64ch] pb-9 pr-12 text-[1.0625rem] leading-relaxed text-tinta-suave">
              {item.resposta}
            </p>
          </details>
        ))}
      </div>
    </Secao>
  );
}
