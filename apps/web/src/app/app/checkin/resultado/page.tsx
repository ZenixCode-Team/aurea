'use client';

/**
 * P3 — Resultado.
 *
 * O resultado do check-in é renderizado dentro da própria `/app/checkin` (fase
 * "resultado" daquela página) para não precisar de um jeito de carregar dados
 * entre rotas sem backend. Esta rota existe só para que o link exista e leve a
 * pessoa para o lugar certo.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Carregando } from '@/componentes/sistema/primitivos';

export default function PaginaDeResultadoDoCheckin() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/app/checkin');
  }, [router]);

  /* `null` deixava a tela branca no instante entre o mount e o replace — troca de
     rota é assíncrona, não instantânea. `Carregando` cobre esse vão. */
  return <Carregando linhas={4} />;
}
