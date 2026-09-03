'use client';

/**
 * Tela de entrar — porta única para os três perfis.
 *
 * Um campo só recebe CPF (paciente) ou e-mail (equipe); quem separa os dois é o
 * próprio conteúdo digitado, não uma escolha extra que a pessoa teria de fazer
 * antes de digitar. A autenticação é da API — a tela não decide quem entra.
 *
 * O erro é sempre genérico: nunca dizemos se o CPF ou e-mail existe. Num sistema
 * de oncologia, distinguir "senha errada" de "usuário não encontrado" transforma a
 * tela de entrada num verificador de quem é paciente do serviço.
 *
 * Os atalhos de demonstração no rodapé existem apenas no modo sintético.
 */

import { Suspense, useState, type FormEvent } from 'react';
import { GradienteAnimado } from '@/components/gradiente-animado';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Aviso, Botao, Campo, Rotulo } from '@/componentes/sistema/primitivos';
import { ErroDaFonte } from '@/sistema/erros';
import {
  DESTINO_POR_PERFIL,
  MODO_SINTETICO,
  useSessao,
  type ChaveDeUsuario,
} from '@/sistema/sessao';
import type { Perfil } from '@/sistema/tipos';

const MENSAGEM_DE_ERRO = 'CPF, e-mail ou senha não conferem.';

const PERFIL_POR_CHAVE: Record<ChaveDeUsuario, Perfil> = {
  paciente: 'PACIENTE',
  enfermagem: 'PROFISSIONAL',
  administrador: 'ADMINISTRADOR',
};

/**
 * A landing manda `?perfil=paciente|enfermagem|admin` pra dar contexto a quem já
 * escolheu o caminho por lá — mas quem decide quem entra continua sendo a API, a
 * partir do que a pessoa digita. Por isso o parâmetro só troca a ajuda do campo de
 * identificação; um valor estranho ou ausente devolve `undefined` e a tela volta a
 * se comportar como hoje, sem pista nenhuma.
 */
function ajudaDoIdentificador(perfil: string | null): string | undefined {
  if (perfil === 'paciente') return 'Digite seu CPF';
  if (perfil === 'enfermagem' || perfil === 'admin') return 'Digite seu e-mail';
  return undefined;
}

export default function EntrarPage() {
  return (
    /* `useSearchParams` opta a árvore em client-side rendering até resolver a busca,
       e Next 16 passou a exigir a fronteira de Suspense explícita pra isso — sem ela,
       o build falha. O fallback não precisa ser rico: a troca é praticamente instantânea. */
    <Suspense fallback={null}>
      <ConteudoDeEntrar />
    </Suspense>
  );
}

function ConteudoDeEntrar() {
  const searchParams = useSearchParams();
  const ajudaIdentificador = ajudaDoIdentificador(searchParams.get('perfil'));
  const [identificador, setIdentificador] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { entrar, entrarComoSintetico } = useSessao();
  const router = useRouter();

  /** Atalho do modo sintético — não aparece quando o sistema fala com a API. */
  async function entrarComo(chave: ChaveDeUsuario) {
    setErro(null);
    setEnviando(true);
    await new Promise((resolver) => setTimeout(resolver, 350));
    entrarComoSintetico(chave);
    router.replace(DESTINO_POR_PERFIL[PERFIL_POR_CHAVE[chave]]);
  }

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (identificador.trim().length === 0 || senha.length === 0) {
      setErro(MENSAGEM_DE_ERRO);
      return;
    }

    setErro(null);
    setEnviando(true);
    try {
      const perfil = await entrar(identificador, senha);
      router.replace(DESTINO_POR_PERFIL[perfil]);
    } catch (motivo: unknown) {
      /* Erro sempre genérico, qualquer que seja a causa. Distinguir "senha errada"
         de "usuário não existe" transforma esta tela num verificador de quem é
         paciente do serviço — vazamento de dado de saúde por dedução. A única
         exceção é a rede, porque aí a pessoa precisa saber que o problema é dela. */
      setErro(
        motivo instanceof ErroDaFonte && motivo.causa === 'REDE'
          ? motivo.message
          : MENSAGEM_DE_ERRO,
      );
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-dvh bg-[var(--color-superficie)]">
      {/* Coluna do formulário. Estreita de propósito: campo de entrada largo demais
          atrapalha a leitura do que se digitou, e é a primeira coisa que separa uma
          tela de login desenhada de um formulário centralizado genérico. */}
      <div className="flex w-full flex-col justify-between bg-[var(--color-superficie)] px-6 py-8 sm:px-12 lg:w-[46%] lg:max-w-[38rem]">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[0.5rem] bg-[var(--color-azul-profundo)] font-mono text-sm font-semibold text-[var(--color-lime)]">
            A
          </span>
          <span className="text-sm font-semibold tracking-tight text-[var(--color-texto)]">
            AUREA
          </span>
        </div>

        <div className="mx-auto w-full max-w-[24rem] py-10">
          <h1 className="text-[2rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--color-texto)]">
            Entrar
          </h1>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-[var(--color-texto-suave)]">
            Paciente entra com o CPF. Equipe entra com o e-mail cadastrado.
          </p>

          {erro && (
            <div className="mt-5">
              <Aviso tom="grave">
                {erro}{' '}
                {/* A mensagem continua única por decisão de segurança (não revelar se o
                    usuário existe), mas "não conferem" sozinho deixa a pessoa sem próximo
                    passo — o link aponta pra ele sem abrir exceção nenhuma na mensagem. */}
                <Link href="/entrar/recuperar" className="inline-block py-2 underline underline-offset-2">
                  Recuperar acesso
                </Link>
              </Aviso>
            </div>
          )}

          <form onSubmit={aoEnviar} className="mt-6 flex flex-col gap-4" noValidate>
            <Campo
              rotulo="CPF ou e-mail"
              ajuda={ajudaIdentificador}
              type="text"
              autoComplete="username"
              value={identificador}
              onChange={(evento) => setIdentificador(evento.target.value)}
              disabled={enviando}
              required
            />
            <Campo
              rotulo="Senha"
              type="password"
              autoComplete="current-password"
              comAlternadorDeSenha
              value={senha}
              onChange={(evento) => setSenha(evento.target.value)}
              disabled={enviando}
              required
            />
            <Botao type="submit" tamanho="amplo" disabled={enviando} className="mt-1">
              {enviando ? 'Entrando…' : 'Entrar'}
            </Botao>
          </form>

          <p className="mt-5 text-sm text-[var(--color-texto-suave)]">
            Esqueceu a senha?{' '}
            <Link
              href="/entrar/recuperar"
              /* `inline-block` com padding vertical: o alvo de toque cresce sem
                 empurrar a linha de texto que o contém. */
              className="inline-block py-2 text-[var(--color-texto)] underline underline-offset-2"
            >
              Recuperar acesso
            </Link>
          </p>

          {/* Os atalhos existem só no modo sintético. Deixá-los à mostra quando o
              sistema fala com a API real seria oferecer entrada sem credencial numa
              tela que guarda dado de saúde. */}
          {MODO_SINTETICO && (
            <div className="mt-8 rounded-[var(--radius-amplo)] border border-dashed border-[var(--color-borda-forte)] px-4 py-4">
              <Rotulo>Atalho de demonstração</Rotulo>
              <p className="mt-2 text-xs leading-relaxed text-[var(--color-texto-suave)]">
                Os dados deste ambiente são sintéticos; nenhum pertence a paciente real.
              </p>
              {/* Uma coluna no celular, três a partir de `sm`.
                  Três botões lado a lado em 390px dão 29px de altura e ~100px de
                  largura — abaixo do alvo de toque confortável, e são justamente os
                  botões que quem chega por QR code aperta primeiro. */}
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(
                  [
                    ['paciente', 'Paciente'],
                    ['enfermagem', 'Enfermagem'],
                    ['administrador', 'Administração'],
                  ] as const
                ).map(([chave, texto]) => (
                  <Botao
                    key={chave}
                    type="button"
                    variante="secundario"
                    disabled={enviando}
                    onClick={() => entrarComo(chave)}
                  >
                    {texto}
                  </Botao>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-[var(--color-texto-fraco)]">
          Monitoramento remoto de toxicidade em quimioterapia.
        </p>
      </div>

      {/*
        Painel institucional — campo de gradiente animado no verde da marca.

        Nas refs este espaço é foto ou arte de marca. Foto de paciente seria a escolha
        errada num produto que ainda não passou pelo Comitê de Ética — e o campo em
        WebGL resolve melhor: quem entra vem da landing, e reencontrar o mesmo verde
        ondulando faz a porta parecer parte da mesma casa, em vez de um formulário que
        por acaso tem a cor certa.

        Preset `Aurea`: as três massas são as mesmas cores do campo da hero, então a
        troca de shader não trocou a paleta. Velocidade 8 e `prefers-reduced-motion`
        respeitado dentro do componente — este produto atende gente em quimioterapia,
        e massa de cor derivando devagar não é gatilho vestibular.
      */}
      <aside
        aria-hidden
        className="relative hidden overflow-hidden bg-[var(--color-azul-profundo)] lg:block lg:flex-1"
      >
        <GradienteAnimado config={{ preset: 'Aurea' }} />
        <div className="grain absolute inset-0" />
        {/*
          Véu de contraste. O campo é animado: a mesma área passa de verde escuro a
          creme claro ao longo da deriva, e texto claro sobre ela fica ilegível em
          metade dos quadros. Um degradê fixo garante o contraste em qualquer estado
          — legibilidade não pode depender do instante em que a pessoa olhou.
        */}
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(20,32,26,0.72)] via-[rgba(20,32,26,0.28)] to-[rgba(20,32,26,0.12)]" />
        <div className="relative flex h-full flex-col justify-between px-12 py-12">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-[var(--color-creme)]/80">
            {'// acompanhamento diário'}
          </p>

          <div className="max-w-[26rem]">
            <p className="display text-[3rem] text-[var(--color-creme)]">
              Pergunta todo dia.
              <br />
              Avisa quando precisa.
            </p>
            <p className="mt-5 text-[0.9375rem] leading-relaxed text-[var(--color-creme)]/80">
              O efeito colateral achado no começo é muito mais fácil de resolver. É para
              isso que o sistema pergunta todos os dias, e é por isso que a equipe vê
              antes de a pessoa precisar ligar.
            </p>
          </div>

          <p className="text-[1.75rem] leading-tight text-[var(--color-creme)]">
            Bem-vindo.
          </p>
        </div>
      </aside>
    </main>
  );
}
