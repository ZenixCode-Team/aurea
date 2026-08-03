import Link from "next/link";
import { TituloRevelado } from "../titulo-revelado";
import { Rotulo, Secao } from "../primitivos";

/**
 * Estado (11) — as três portas de acesso, de volta no creme.
 *
 * Esta seção existe porque a landing é a porta de entrada única dos três
 * perfis (ADR-001) — não é vitrine, é hall de entrada.
 */

const PORTAS = [
  {
    perfil: "Paciente",
    entrada: "Entra com CPF",
    corpo:
      "Responde como está hoje, recebe a orientação e acompanha o que já contou nos dias anteriores.",
    href: "/entrar?perfil=paciente",
  },
  {
    perfil: "Enfermagem",
    entrada: "Entra com e-mail",
    corpo:
      "Vê quem precisa de atenção hoje, abre o histórico do paciente e anota o contato que fez.",
    href: "/entrar?perfil=enfermagem",
  },
  {
    perfil: "Coordenação",
    entrada: "Entra com e-mail",
    corpo:
      "Mantém os protocolos, as orientações e os critérios que definem cada cor no serviço.",
    href: "/entrar?perfil=admin",
  },
];

export function Portas() {
  return (
    <Secao id="portas" corDeFundo="#f4f1e2" className="bg-creme-fundo">
      <div data-revelar>
        <Rotulo numero="11">Acesso</Rotulo>
        <TituloRevelado className="display mt-7 max-w-[15ch] text-[clamp(2.5rem,6vw,5rem)] text-tinta">
          Três perfis, uma porta.
        </TituloRevelado>
        <p className="mt-8 max-w-[52ch] text-lg leading-relaxed text-tinta-suave">
          O seu acesso é criado pelo serviço onde você faz o tratamento. Se
          esta é a sua primeira vez, o AUREA explica tudo antes de começar.
        </p>
      </div>

      <div className="mt-16 grid gap-5 md:mt-24 md:grid-cols-3">
        {PORTAS.map((porta) => (
          <Link
            key={porta.perfil}
            href={porta.href}
            data-revelar
            className="group relative flex flex-col justify-between rounded-2xl border border-tinta/12 bg-creme p-9 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-tinta/25 md:p-10"
          >
            <div>
              <span className="rotulo-editorial text-tinta-suave">{porta.entrada}</span>
              <h3 className="display mt-5 text-4xl text-tinta md:text-[2.75rem]">
                {porta.perfil}
              </h3>
              <p className="mt-5 text-[1.0625rem] leading-relaxed text-tinta-suave">
                {porta.corpo}
              </p>
            </div>

            <span className="rotulo-editorial mt-10 inline-flex items-center gap-2 text-tinta">
              Entrar
              <span
                aria-hidden="true"
                className="transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1"
              >
                →
              </span>
            </span>
          </Link>
        ))}
      </div>
    </Secao>
  );
}
