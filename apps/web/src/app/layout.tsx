import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ProvedorDeSessao } from "@/sistema/sessao";

/**
 * Instrument Sans na interface — e não a Geist, que estava aqui antes.
 *
 * A Geist é competente e é o default da Vercel, o que a torna a fonte que todo
 * produto feito por desenvolvedor usa. A Instrument Sans tem a mesma legibilidade em
 * corpo pequeno e mais caráter no peso alto, com terminais levemente cortados que
 * seguram bem títulos grandes.
 *
 * O motivo principal, porém, é de sistema: a landing já usa Instrument Serif. Usar a
 * irmã sans faz das duas uma família só, em vez de duas escolhas que por acaso
 * convivem.
 */
const sansDaInterface = Instrument_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

/**
 * JetBrains Mono para número clínico.
 *
 * Zero cortado, 1 com serifa e 7 sem barra ambígua — em uma tela onde 38,5 e 39,5
 * mudam a conduta, distinguir dígito de relance não é preciosismo tipográfico.
 */
const monoDosDados = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${sansDaInterface.variable} ${monoDosDados.variable} ${serifDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ProvedorDeSessao>{children}</ProvedorDeSessao>
      </body>
    </html>
  );
}
