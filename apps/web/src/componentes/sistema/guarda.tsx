'use client';

/**
 * Guarda de rota do lado do navegador.
 *
 * Não é segurança — segurança é a API recusar o token. Isto evita que a pessoa veja
 * uma tela que não é dela e fique confusa. Quando o backend entrar (Onda F), a API
 * continua sendo a única autoridade sobre permissão.
 */

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { DESTINO_POR_PERFIL, useSessao } from '@/sistema/sessao';
import type { Perfil } from '@/sistema/tipos';
import { Carregando } from './primitivos';

export function Guarda({
  perfil,
  children,
}: {
  perfil: Perfil;
  children: React.ReactNode;
}) {
  const { usuario, carregando, consentiu } = useSessao();
  const router = useRouter();

  /* Só o paciente consente: o termo é sobre o dado de saúde dele. A equipe entra
     por vínculo profissional, não por consentimento de participação. */
  const precisaConsentir = usuario?.perfil === 'PACIENTE' && !consentiu;

  useEffect(() => {
    if (carregando) return;
    if (!usuario) {
      router.replace('/entrar');
      return;
    }
    if (usuario.perfil !== perfil) {
      router.replace(DESTINO_POR_PERFIL[usuario.perfil]);
      return;
    }
    if (precisaConsentir) {
      router.replace('/consentimento');
    }
  }, [carregando, usuario, perfil, precisaConsentir, router]);

  if (carregando || !usuario || usuario.perfil !== perfil || precisaConsentir) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16">
        <Carregando linhas={4} />
      </div>
    );
  }

  return <>{children}</>;
}
