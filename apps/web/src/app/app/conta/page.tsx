'use client';

/**
 * P12 — Conta. Nome, trocar senha, o termo aceito e sair.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bloco } from '@/componentes/sistema/painel';
import { Botao, LinkComoBotao } from '@/componentes/sistema/primitivos';
import { useSessao } from '@/sistema/sessao';

export default function PaginaDeConta() {
  const { usuario, sair } = useSessao();
  const router = useRouter();

  return (
    <div className="flex flex-col gap-5">
      <Bloco titulo="Sua conta">
        <p className="text-lg text-[var(--color-texto)]">{usuario?.nome ?? ''}</p>
      </Bloco>

      <LinkComoBotao href="/entrar/primeiro-acesso" variante="secundario" tamanho="amplo">
        Trocar senha
      </LinkComoBotao>

      <Link
        href="/termos"
        className="text-center text-sm text-[var(--color-texto-suave)] underline underline-offset-4 hover:text-[var(--color-texto)]"
      >
        Ver o termo que você aceitou
      </Link>

      <Botao
        variante="secundario"
        tamanho="amplo"
        type="button"
        onClick={() => {
          sair();
          router.replace('/entrar');
        }}
      >
        Sair
      </Botao>
    </div>
  );
}
