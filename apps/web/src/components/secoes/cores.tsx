import { FundoOrganico, type PaletaNome } from "../fundo-organico";
import { Rotulo } from "../primitivos";
import { TituloRevelado } from "../titulo-revelado";

/**
 * As três cores da escala, uma seção inteira para cada.
 *
 * Regra de copy vinculante (ADR-002, revisão de 2026-07-30): nenhum termo
 * de programação. O texto é escrito como enfermeiro ou médico falando com
 * o paciente. Nada de "cadastro", "versionado", "regra fixa", "registro",
 * "sistema" — o paciente não precisa saber como foi construído para
 * confiar no que aparece na tela dele.
 */

interface Etapa {
  titulo: string;
  corpo: string;
}

interface PropsSecaoCor {
  id: string;
  numero: string;
  rotulo: string;
  titulo: string;
  chamada: string;
  etapas: Etapa[];
  fecho: string;
  corDeFundo: string;
  paleta: PaletaNome;
  classes: {
    secao: string;
    rotulo: "claro" | "escuro" | "lime";
    titulo: string;
    texto: string;
    textoSuave: string;
    divisor: string;
  };
}

function SecaoCor({
  id,
  numero,
  rotulo,
  titulo,
  chamada,
  etapas,
  fecho,
  corDeFundo,
  paleta,
  classes,
}: PropsSecaoCor) {
  return (
    /* Empilhamento pegajoso, herdado da oevra: cada cor gruda no topo e a
       seguinte desliza por cima. O efeito percorre a escala fisicamente —
       o verde não sai de cena, ele é coberto pelo amarelo. */
    <section
      id={id}
      data-cor-fundo={corDeFundo}
      className={`sticky top-0 flex min-h-[100svh] items-center overflow-hidden px-6 py-24 md:px-10 md:py-28 lg:px-16 ${classes.secao}`}
    >
      {/* O mesmo campo da hero, na paleta da seção. A cor chapada da classe
          fica por baixo como reserva, caso não haja WebGL. */}
      <FundoOrganico paleta={paleta} />

      <div className="relative z-10 mx-auto w-full max-w-[1180px]">
        <div>
          <Rotulo numero={numero} tom={classes.rotulo}>
            {rotulo}
          </Rotulo>
          {/* Sem marcador de cor: a seção inteira já É a cor. Um ponto aqui
              seria redundância decorativa.
              A largura máxima vive no próprio h2 — `ch` precisa ser medido
              na fonte do display, não na do container. */}
          <TituloRevelado
            className={`display mt-7 max-w-[15ch] text-[clamp(2.25rem,5.2vw,4.25rem)] ${classes.titulo}`}
          >
            {titulo}
          </TituloRevelado>
        </div>

        <p
          data-revelar
          className={`mt-7 max-w-[56ch] text-lg leading-relaxed md:text-xl ${classes.texto}`}
        >
          {chamada}
        </p>

        <div
          className={`mt-12 grid gap-px border-t md:mt-16 md:grid-cols-3 ${classes.divisor}`}
        >
          {etapas.map((etapa) => (
            <div key={etapa.titulo} data-revelar className="pt-7 md:pr-10">
              <h3 className={`rotulo-editorial ${classes.texto}`}>{etapa.titulo}</h3>
              <p
                className={`mt-4 text-base leading-relaxed ${classes.textoSuave}`}
              >
                {etapa.corpo}
              </p>
            </div>
          ))}
        </div>

        <p
          data-revelar
          className={`mt-10 max-w-[60ch] text-[1.0625rem] leading-relaxed md:mt-12 ${classes.texto}`}
        >
          {fecho}
        </p>
      </div>
    </section>
  );
}

/* ========================================================================== */

export function CorVerde() {
  return (
    <SecaoCor
      id="verde"
      numero="04"
      rotulo="Verde"
      titulo="Verde é seguir o seu dia."
      chamada="Você respondeu, e nada no que você contou hoje precisa da equipe agora."
      corDeFundo="#7a8b53"
      paleta="verde"
      classes={{
        secao: "bg-sage text-tinta",
        rotulo: "escuro",
        titulo: "text-tinta",
        texto: "text-tinta",
        textoSuave: "text-tinta/75",
        divisor: "border-tinta/25",
      }}
      etapas={[
        {
          titulo: "O que isso quer dizer",
          corpo:
            "Os sintomas que você marcou estão dentro do que se espera para o seu tratamento neste momento do ciclo. Verde não quer dizer que você está bem; quer dizer que o que você sentiu hoje não pede uma ligação agora.",
        },
        {
          titulo: "O que você faz",
          corpo:
            "Você recebe na tela as orientações de cuidado em casa para o que marcou: o que comer, quanto beber, o que observar. Segue o seu dia e responde de novo amanhã.",
        },
        {
          titulo: "O que a equipe faz",
          corpo:
            "Ninguém é chamado. A sua resposta fica no seu acompanhamento, e a enfermagem vê no dia em que abrir o seu histórico.",
        },
      ]}
      fecho="Se você piorar depois de responder, não precisa esperar o dia seguinte. Você pode responder outra vez ou pedir contato da enfermagem pelo próprio aplicativo, a qualquer hora."
    />
  );
}

/* ========================================================================== */

export function CorAmbar() {
  return (
    <SecaoCor
      id="ambar"
      numero="05"
      rotulo="Amarelo"
      titulo="Amarelo é a equipe olhando junto."
      chamada="Alguma coisa no que você respondeu merece acompanhamento hoje; não é emergência, e também não é para deixar passar."
      corDeFundo="#e8a33d"
      paleta="ambar"
      classes={{
        secao: "bg-ambar text-tinta",
        rotulo: "escuro",
        titulo: "text-tinta",
        texto: "text-tinta",
        /* `/75` sobre o âmbar (#e8a33d) cai para ~4,5:1, no limiar da AA e
           sensível a antialiasing de fonte. `/90` sobe para ~6,3:1 mantendo
           o fundo da seção intocado (é a própria escala de triagem,
           imprint aprovado) e ainda lê mais claro que `classes.texto`. */
        textoSuave: "text-tinta/90",
        divisor: "border-tinta/25",
      }}
      etapas={[
        {
          titulo: "O que isso quer dizer",
          corpo:
            "Um sintoma apareceu com intensidade ou frequência que muda a conduta do seu cuidado. Febre que subiu, diarreia que se repetiu, vômito que não deixou você beber água.",
        },
        {
          titulo: "O que você faz",
          corpo:
            "A tela mostra a orientação do seu tratamento para aquele sintoma. Se houver remédio a tomar, só aparece o que já está na sua receita; nada novo é sugerido.",
        },
        {
          titulo: "O que a equipe faz",
          corpo:
            "A enfermagem é avisada na mesma hora. Alguém abre o seu histórico, entra em contato com você e anota o que foi orientado e como você respondeu.",
        },
      ]}
      fecho="Amarelo não é motivo para você ir ao pronto-socorro por conta própria. É o momento em que a equipe passa a acompanhar de perto, e o contato parte dela até você."
    />
  );
}

/* ========================================================================== */

export function CorVermelho() {
  return (
    <SecaoCor
      id="vermelho"
      numero="06"
      rotulo="Vermelho"
      titulo="Vermelho é procurar atendimento agora."
      chamada="O que você respondeu indica um sinal que precisa ser visto por alguém presencialmente, hoje."
      corDeFundo="#c2452d"
      paleta="vermelho"
      classes={{
        secao: "bg-terracota text-creme",
        rotulo: "claro",
        titulo: "text-creme",
        texto: "text-creme",
        textoSuave: "text-creme/80",
        divisor: "border-creme/30",
      }}
      etapas={[
        {
          titulo: "O que isso quer dizer",
          corpo:
            "Febre alta, muitos episódios seguidos, sangue, falta de ar mesmo parado. Em quem está fazendo quimioterapia, esses sinais não esperam o próximo dia; o corpo está com menos defesa para segurar sozinho.",
        },
        {
          titulo: "O que você faz",
          corpo:
            "Procura atendimento. A tela mostra para onde ir e o telefone do seu serviço. Se você estiver sozinho e não conseguir se deslocar, ligue para o contato de emergência que você cadastrou.",
        },
        {
          titulo: "O que a equipe faz",
          corpo:
            "A enfermagem é avisada imediatamente e o seu nome vai para o topo da lista do dia. Quem atender você já vai saber o que você respondeu antes de chegar.",
        },
      ]}
      fecho="Vermelho não é um diagnóstico. Ninguém está dizendo o que você tem; está dizendo que isso precisa ser avaliado por uma pessoa, agora, e não amanhã."
    />
  );
}
