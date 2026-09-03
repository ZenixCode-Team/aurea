'use client';

/**
 * Troca de senha obrigatória do primeiro acesso.
 *
 * ADR-004: mesma soleira de `/entrar` — coluna estreita de formulário à esquerda,
 * painel institucional com o shader da landing à direita. As três telas de entrada
 * (entrar, primeiro acesso, recuperar) e o consentimento são a mesma porta.
 *
 * Alcançada depois de entrar com senha provisória. Sem backend ainda (Onda F),
 * então não há chamada real de troca — o que importa aqui é a validação e o
 * destino correto ao final, que já ficam prontos para a API entrar por baixo.
 */

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { FundoOrganico } from '@/components/fundo-organico';
import { Botao, Campo } from '@/componentes/sistema/primitivos';
import { DESTINO_POR_PERFIL, useSessao } from '@/sistema/sessao';

const TAMANHO_MINIMO_DA_SENHA = 10;

export default function PrimeiroAcessoPage() {
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [erroConfirmacao, setErroConfirmacao] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { usuario } = useSessao();
  const router = useRouter();

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErroSenha(null);
    setErroConfirmacao(null);

    let temErro = false;
    if (senha.length < TAMANHO_MINIMO_DA_SENHA) {
      setErroSenha(`A senha precisa ter pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres.`);
      temErro = true;
    }
    if (confirmacao !== senha) {
      setErroConfirmacao('As duas senhas precisam ser iguais.');
      temErro = true;
    }
    if (temErro) return;

    setEnviando(true);
    await new Promise((resolver) => setTimeout(resolver, 350));
    router.replace(usuario ? DESTINO_POR_PERFIL[usuario.perfil] : '/entrar');
  }

  return (
    <main className="flex min-h-dvh bg-[var(--color-superficie)]">
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
            Defina sua senha
          </h1>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-[var(--color-texto-suave)]">
            A senha provisória que trouxe você até aqui deixa de valer assim que você
            concluir esta troca.
          </p>

          <form onSubmit={aoEnviar} className="mt-6 flex flex-col gap-4" noValidate>
            <Campo
              rotulo="Nova senha"
              type="password"
              autoComplete="new-password"
              value={senha}
              onChange={(evento) => setSenha(evento.target.value)}
              ajuda={`Mínimo de ${TAMANHO_MINIMO_DA_SENHA} caracteres.`}
              erro={erroSenha ?? undefined}
              disabled={enviando}
              required
            />
            <Campo
              rotulo="Confirme a nova senha"
              type="password"
              autoComplete="new-password"
              value={confirmacao}
              onChange={(evento) => setConfirmacao(evento.target.value)}
              erro={erroConfirmacao ?? undefined}
              disabled={enviando}
              required
            />
            <Botao type="submit" tamanho="amplo" disabled={enviando} className="mt-1">
              {enviando ? 'Salvando…' : 'Salvar e continuar'}
            </Botao>
          </form>
        </div>

        <p className="text-xs text-[var(--color-texto-fraco)]">
          Monitoramento remoto de toxicidade em quimioterapia.
        </p>
      </div>

      <aside
        aria-hidden
        className="relative hidden overflow-hidden bg-[var(--color-azul-profundo)] lg:block lg:flex-1"
      >
        <FundoOrganico paleta="azul" escalas={[2.6, 2.2, 3.1, 2.4]} />
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
            {'// primeiro acesso'}
          </p>

          <div className="max-w-[26rem]">
            <p className="display text-[3rem] text-[var(--color-creme)]">
              Essa senha
              <br />
              só você conhece.
            </p>
            <p className="mt-5 text-[0.9375rem] leading-relaxed text-[var(--color-creme)]/80">
              A senha provisória fazia sentido para chegar até aqui. Daqui em diante,
              a que você escolher agora é a que abre a porta.
            </p>
          </div>

          <p className="text-[1.75rem] leading-tight text-[var(--color-creme)]">
            Quase lá.
          </p>
        </div>
      </aside>
    </main>
  );
}
