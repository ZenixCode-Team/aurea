import type { Metadata, Viewport } from "next";
import {
  Bricolage_Grotesque,
  Familjen_Grotesk,
  IBM_Plex_Mono,
  Instrument_Serif,
} from "next/font/google";
import "./globals.css";
import { ProvedorDeSessao } from "@/sistema/sessao";

/**
 * Familjen Grotesk no corpo da interface.
 *
 * Quarta fonte nesta posição. O padrão das três anteriores era o mesmo: Geist, Instrument
 * Sans e Schibsted são todas neo-grotescas neutras, e neutro é exatamente o que faz um
 * produto parecer template. Uma grotesca sem assinatura resolve legibilidade e não
 * resolve identidade.
 *
 * A Familjen é humanista, não neo-grotesca — e a diferença aparece nas letras que mais
 * se repetem em português: `a` de gota com barriga assimétrica, `g` de orelha curva, `e`
 * de eixo levemente inclinado. Em corpo de 15px numa tabela clínica isso não atrapalha a
 * leitura; em parágrafo, dá voz.
 */
const sansDaInterface = Familjen_Grotesk({
  variable: "--fonte-sans",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Bricolage Grotesque nos títulos do sistema.
 *
 * O contraste que faltava. A Bricolage tem largura e peso variáveis e formas
 * declaradamente idiossincráticas — terminais cortados em ângulo, aberturas estreitas,
 * `R` de perna reta. É uma fonte que alguém DESENHOU, e é isso que separa um produto de
 * um template.
 *
 * Só em título, nunca em corpo: a mesma idiossincrasia que assina um `h1` de 2rem cansa
 * numa coluna de tabela. E ela entra no sistema, não na landing — lá o display continua
 * sendo a Instrument Serif, que é o imprint da ref escolhida pelo João no briefing.
 */
const tituloDoSistema = Bricolage_Grotesque({
  variable: "--fonte-titulo",
  subsets: ["latin"],
  display: "swap",
});

/**
 * IBM Plex Mono para número clínico.
 *
 * O requisito é clínico antes de ser estético: zero cortado, 1 com serifa e 7 sem barra
 * ambígua. Numa tela em que 38,5 e 39,5 mudam a conduta, distinguir dígito de relance
 * não é preciosismo tipográfico.
 *
 * Saiu a JetBrains Mono, que cumpria o requisito e trazia junto a aparência de editor
 * de código. A Plex tem a mesma desambiguação com desenho de origem editorial.
 */
const monoDosDados = IBM_Plex_Mono({
  variable: "--fonte-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

/* Instrument Serif é o stand-in livre de `PP Editorial New` (licença paga).
   Mesma família de decisão: didone editorial de alto contraste. A troca é
   drop-in — só muda a declaração da fonte. Ver ADR-002. */
const serifDisplay = Instrument_Serif({
  variable: "--fonte-display",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AUREA — monitoramento remoto de toxicidade em quimioterapia",
  description:
    "AUREA acompanha o paciente em quimioterapia nos dias em casa. Pergunta todo dia, classifica o risco com regra fixa e avisa a enfermagem quando o sinal aparece.",
  openGraph: {
    title: "AUREA — monitoramento remoto de toxicidade em quimioterapia",
    description:
      "Pergunta todo dia. Classifica com regra fixa. Avisa a enfermagem.",
    locale: "pt_BR",
    type: "website",
  },
  /**
   * Ambiente de demonstração fora de buscador.
   *
   * O conjunto de limiares em uso é o `rascunho-0`, que NÃO foi validado clinicamente, e
   * a senha de acesso está escrita no README do repositório. Nada aqui é dado de pessoa
   * real — mas software clínico não validado aparecendo em busca de sintoma é dano que
   * não se desfaz com correção depois.
   *
   * Não existe `Disallow` em robots.txt de propósito: bloquear o rastreamento impede o
   * robô de LER este `noindex`, e uma URL descoberta por link de fora acaba indexada
   * assim mesmo, só que sem descrição. Para tirar do índice é preciso deixar entrar e
   * dizer para não indexar. Reforço no cabeçalho `X-Robots-Tag` (`next.config.ts`), que
   * cobre também o que não é HTML.
   *
   * Isto sai quando o AUREA tiver corte assinado por responsável clínico e endereço
   * próprio — aí a landing passa a querer ser encontrada.
   */
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#fbf9ef",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${sansDaInterface.variable} ${tituloDoSistema.variable} ${monoDosDados.variable} ${serifDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ProvedorDeSessao>{children}</ProvedorDeSessao>
      </body>
    </html>
  );
}
