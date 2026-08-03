'use client';

/**
 * Recuperação de senha.
 *
 * ADR-004: mesma soleira de `/entrar` — coluna estreita de formulário à esquerda,
 * painel institucional com o shader da landing à direita.
 *
 * Não existe backend de recuperação nesta fase, e simular um e-mail que nunca
 * sai seria enganar quem está preocupado em recuperar o acesso. Por isso a tela
 * assume a limitação em vez de fingir um envio: pede o dado, mas o retorno é a
 * orientação honesta de falar com o serviço.
 */

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { FundoOrganico } from '@/components/fundo-organico';
import { Aviso, Botao, Campo } from '@/componentes/sistema/primitivos';

export default function RecuperarSenhaPage() {
  const [identificador, setIdentificador] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (identificador.trim().length === 0) return;

    setEnviando(true);
    await new Promise((resolver) => setTimeout(resolver, 350));
    setEnviando(false);
    setEnviado(true);
  }

  return (
    <main className="flex min-h-dvh bg-[var(--color-superficie)]">
      <div className="flex w-full flex-col justify-between bg-[var(--color-superficie)] px-6 py-8 sm:px-12 lg:w-[46%] lg:max-w-[38rem]">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[0.5rem] bg-[var(--color-verde-profundo)] font-mono text-sm font-semibold text-[var(--color-lime)]">
            A
          </span>
          <span className="text-sm font-semibold tracking-tight text-[var(--color-texto)]">
            AUREA
          </span>
        </div>

        <div className="mx-auto w-full max-w-[24rem] py-10">
          <h1 className="text-[2rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--color-texto)]">
            Esqueci minha senha
          </h1>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-[var(--color-texto-suave)]">
            Informe o CPF ou o e-mail que você usa para entrar.
          </p>

          <form onSubmit={aoEnviar} className="mt-6 flex flex-col gap-4" noValidate>
            <Campo
              rotulo="CPF ou e-mail"
              type="text"
              autoComplete="username"
              value={identificador}
              onChange={(evento) => setIdentificador(evento.target.value)}
              disabled={enviando}
              required
            />
            <Botao type="submit" tamanho="amplo" disabled={enviando} className="mt-1">
              {enviando ? 'Verificando…' : 'Solicitar recuperação'}
            </Botao>
          </form>

          {enviado && (
            <div className="mt-5">
              <Aviso tom="informacao" titulo="A recuperação automática ainda não está disponível">
                Nesta fase do sistema, a troca de senha esquecida é feita direto com a
                equipe do serviço onde você faz o tratamento, por telefone ou
                presencialmente. Leve o CPF ou e-mail informado acima para agilizar o
                atendimento.
              </Aviso>
            </div>
          )}

          <p className="mt-5 text-sm text-[var(--color-texto-suave)]">
            <Link href="/entrar" className="text-[var(--color-texto)] underline underline-offset-2">
              Voltar para entrar
            </Link>
          </p>
        </div>

        <p className="text-xs text-[var(--color-texto-fraco)]">
          Monitoramento remoto de toxicidade em quimioterapia.
        </p>
      </div>

      <aside
        aria-hidden
        className="relative hidden overflow-hidden bg-[var(--color-verde-profundo)] lg:block lg:flex-1"
      >
        <FundoOrganico escalas={[2.6, 2.2, 3.1, 2.4]} />
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
            {'// recuperação de acesso'}
          </p>

          <div className="max-w-[26rem]">
            <p className="display text-[3rem] text-[var(--color-creme)]">
              Não fingimos
              <br />
              um e-mail que não chega.
            </p>
            <p className="mt-5 text-[0.9375rem] leading-relaxed text-[var(--color-creme)]/80">
              Nesta fase, recuperar o acesso passa pela equipe do seu serviço, de
              propósito, e não por falta de atenção com o seu tempo.
            </p>
          </div>

          <p className="text-[1.75rem] leading-tight text-[var(--color-creme)]">
            Estamos aqui.
          </p>
        </div>
      </aside>
    </main>
  );
}
