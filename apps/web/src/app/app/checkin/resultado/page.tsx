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

export default function PaginaDeResultadoDoCheckin() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/app/checkin');
  }, [router]);

  return null;
}
