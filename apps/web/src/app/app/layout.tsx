'use client';

/**
 * Shell do app do paciente.
 *
 * Ref-base Brightharbor: tema sensível pede calor e tom de voz humano. O que a
 * pessoa vê ao abrir é o nome dela e o que falta fazer hoje, não um painel.
 *
 * DUAS NAVEGAÇÕES, UMA SÓ LISTA DE DESTINOS.
 *
 * No celular, barra embaixo, ao alcance do polegar, com cinco destinos no máximo.
 * No desktop, a mesma lateral do painel da equipe e da administração.
 *
 * A troca não é preferência de estilo. A lateral tem 16rem fixos: num aparelho de
 * 390px ela ocupa dois terços da tela, e o celular é o aparelho de quem está em
 * quimioterapia respondendo de casa. Já num monitor de 1440px a barra de polegar
 * fica perdida na borda de baixo e o conteúdo vira uma coluna estreita no meio de
 * dois vazios — que era exatamente o defeito desta tela.
 *
 * `DESTINOS` é a fonte única: a lateral mostra a lista inteira, agrupada; a barra
 * de polegar mostra os cinco marcados com `noPolegar`. Assim não existe destino que
 * exista num lugar e suma no outro por descuido de manutenção.
 *
 * Nenhum token de risco entra aqui — a escala de triagem vive só no painel da
 * equipe (lei inviolável 2).
 */

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Guarda } from '@/componentes/sistema/guarda';
import {
  AcaoDoTopo,
  Icone,
  ShellDePainel,
  type NomeDeIcone,
  type SecaoDeNavegacao,
} from '@/componentes/sistema/painel';
import { juntar } from '@/componentes/sistema/primitivos';
import { useSessao } from '@/sistema/sessao';

interface Destino {
  readonly href: string;
  readonly rotulo: string;
  readonly icone: NomeDeIcone;
  readonly grupo: string;
  /**
   * Entra na barra de polegar.
   *
   * São seis, e não cinco como antes. `Seu tratamento` entrou porque não existia
   * NENHUM caminho até ele no celular: nem a Conta nem a tela de Hoje linkavam para
   * `/app/perfil`, então a tela era inalcançável no aparelho que o paciente usa —
   * defeito que já existia e que ficou grave quando o mural passou a morar lá.
   *
   * Seis itens em 390px dão 65px de alvo, acima dos 44px mínimos. O custo é o rótulo
   * curto; o benefício é a tela existir.
   */
  readonly noPolegar?: true;
  /** Só para o polegar: "Seu tratamento" não cabe em 65px. */
  readonly rotuloCurto?: string;
}

const DESTINOS: readonly Destino[] = [
  { href: '/app', rotulo: 'Hoje', icone: 'hoje', grupo: 'Seu dia', noPolegar: true },
  { href: '/app/historico', rotulo: 'Histórico', icone: 'historico', grupo: 'Seu dia', noPolegar: true },
  { href: '/app/agenda', rotulo: 'Agenda', icone: 'agenda', grupo: 'Seu dia', noPolegar: true },
  {
    href: '/app/perfil',
    rotulo: 'Seu tratamento',
    rotuloCurto: 'Tratamento',
    icone: 'cadastro',
    grupo: 'Sobre você',
    noPolegar: true,
  },
  { href: '/app/biblioteca', rotulo: 'Biblioteca', icone: 'orientacao', grupo: 'Sobre você', noPolegar: true },
  { href: '/app/conta', rotulo: 'Conta', icone: 'conta', grupo: 'Você', noPolegar: true },
];

/* Agrupa preservando a ordem de declaração — a ordem da lista É a hierarquia. */
const SECOES: readonly SecaoDeNavegacao[] = DESTINOS.reduce<SecaoDeNavegacao[]>(
  (secoes, destino) => {
    const existente = secoes.find((secao) => secao.titulo === destino.grupo);
    const item = { href: destino.href, rotulo: destino.rotulo, icone: destino.icone };
    if (existente) {
      (existente.itens as typeof item[]).push(item);
      return secoes;
    }
    secoes.push({ titulo: destino.grupo, itens: [item] });
    return secoes;
  },
  [],
);

const NO_POLEGAR = DESTINOS.filter((destino) => destino.noPolegar);

export default function LayoutDoPaciente({ children }: { children: React.ReactNode }) {
  const caminho = usePathname();
  const { usuario, sair } = useSessao();
  const router = useRouter();

  async function encerrar() {
    await sair();
    router.replace('/entrar');
  }

  const barraDePolegar = (
    /* Estado ativo em bloco preenchido, não em tracinho de 2px: num aparelho de
       390px o tracinho praticamente não se enxerga. */
    <nav
      aria-label="Navegação principal"
      className="border-t border-[var(--color-borda)] bg-[var(--color-superficie-alta)] pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-2xl px-1 py-2">
        {NO_POLEGAR.map(({ href, rotulo, rotuloCurto, icone }) => {
          const ativo = href === '/app' ? caminho === href : caminho.startsWith(href);
          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={ativo ? 'page' : undefined}
                /* `aria-label` com o rótulo inteiro: quem usa leitor de tela ouve
                   "Seu tratamento", não a abreviação que existe só por causa de pixel. */
                aria-label={rotuloCurto ? rotulo : undefined}
                className={juntar(
                  'flex flex-col items-center gap-1 rounded-[0.625rem] px-0.5 py-2 text-[0.6875rem]',
                  'transition-colors duration-150',
                  ativo
                    ? 'bg-[var(--color-nav-ativo)] font-medium text-[var(--color-texto)]'
                    : 'text-[var(--color-texto-fraco)]',
                )}
              >
                <Icone nome={icone} />
                <span className="max-w-full truncate">{rotuloCurto ?? rotulo}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <Guarda perfil="PACIENTE">
      <ShellDePainel
        produto="AUREA"
        /* No painel este campo diz a função de quem está logado. Aqui diz o nome da
           pessoa: ela abre o app uma vez por dia e não precisa ser lembrada do papel
           dela dentro de um sistema. */
        contexto={usuario?.nome ?? 'Acompanhamento diário'}
        secoes={SECOES}
        caminhoAtual={caminho}
        barraInferior={barraDePolegar}
        larguraDoConteudo="leitura"
        acoes={<AcaoDoTopo titulo="Avisos" href="/app/notificacoes" icone="aviso" />}
        rodape={
          <div className="flex flex-col gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--color-texto)]">
                {usuario?.nome}
              </p>
              <p className="truncate text-xs text-[var(--color-texto-fraco)]">
                Acompanhamento diário
              </p>
            </div>
            <button
              type="button"
              onClick={encerrar}
              className="self-start text-xs text-[var(--color-texto-suave)] underline underline-offset-4 transition-colors hover:text-[var(--color-texto)]"
            >
              Sair
            </button>
          </div>
        }
      >
        {children}
      </ShellDePainel>
    </Guarda>
  );
}
