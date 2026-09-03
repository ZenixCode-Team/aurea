'use client';

/**
 * A sessão do lado do navegador.
 *
 * No modo API o token vem de `/autenticacao/entrar` e quem responde "quem é você" é
 * `/autenticacao/eu` — o servidor, nunca o navegador. O que fica guardado aqui é o
 * token e uma cópia do perfil para desenhar a tela; permissão de verdade é decidida
 * na API, e a guarda de rota daqui só evita que a pessoa veja uma tela que não é dela.
 *
 * `sessionStorage` e não `localStorage` porque o computador do plantão é
 * compartilhado. Sessão que sobrevive ao fechamento da aba em terminal comum é
 * problema de LGPD, não conveniência.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { aoExpirarSessao, chamar, esquecerToken, guardarToken } from './api';
import { ORIGEM_DOS_DADOS } from './fonte';
import { USUARIOS_SINTETICOS } from './sinteticos';
import type { Permissao, Perfil, UsuarioDaSessao } from './tipos';

const CHAVE_DO_USUARIO = 'aurea.usuario';

export type ChaveDeUsuario = keyof typeof USUARIOS_SINTETICOS;

/** Para onde cada perfil vai depois de entrar. */
export const DESTINO_POR_PERFIL: Record<Perfil, string> = {
  PACIENTE: '/app',
  PROFISSIONAL: '/painel',
  ADMINISTRADOR: '/admin',
};

/* ==========================================================================
   O que a API responde
   ========================================================================== */

interface RespostaDeEntrada {
  readonly token: string;
  readonly expiraEm: string;
  readonly perfil: Perfil;
  readonly precisaVerPrimeiroAcesso: boolean;
}

interface RespostaDeQuemSou {
  readonly perfil: Perfil;
  readonly permissoes: readonly Permissao[];
  readonly perfilDetalhado: { readonly nome: string } | null;
}

interface EstadoDoConsentimento {
  readonly exigido: boolean;
  readonly versaoVigente: string;
  readonly aceito: boolean;
}

/* ==========================================================================
   Contexto
   ========================================================================== */

interface EstadoDaSessao {
  readonly usuario: UsuarioDaSessao | null;
  readonly carregando: boolean;
  /** Falso enquanto o paciente não aceitou a versão vigente do termo. */
  readonly consentiu: boolean;
  /** Verdadeiro quando a API pede troca de senha antes de seguir. */
  readonly precisaTrocarSenha: boolean;
  entrar(identificador: string, senha: string): Promise<Perfil>;
  entrarComoSintetico(chave: ChaveDeUsuario): void;
  sair(): Promise<void>;
  aceitarConsentimento(): Promise<void>;
  pode(permissao: Permissao): boolean;
}

const Contexto = createContext<EstadoDaSessao | null>(null);

const usandoApi = ORIGEM_DOS_DADOS === 'api';

function lerUsuarioGuardado(): UsuarioDaSessao | null {
  const texto = sessionStorage.getItem(CHAVE_DO_USUARIO);
  if (!texto) return null;
  try {
    return JSON.parse(texto) as UsuarioDaSessao;
  } catch {
    sessionStorage.removeItem(CHAVE_DO_USUARIO);
    return null;
  }
}

export function ProvedorDeSessao({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioDaSessao | null>(null);
  const [consentiu, setConsentiu] = useState(false);
  const [precisaTrocarSenha, setPrecisaTrocarSenha] = useState(false);
  const [carregando, setCarregando] = useState(true);

  /**
   * Restaura a sessão ao abrir a aba.
   *
   * O usuário guardado é só um palpite para não piscar a tela; quem confirma é a
   * API. Se `/autenticacao/eu` recusar, a sessão morreu e a pessoa volta ao início.
   */
  useEffect(() => {
    let cancelado = false;

    async function restaurar() {
      const guardado = lerUsuarioGuardado();
      if (!guardado) {
        if (!cancelado) setCarregando(false);
        return;
      }

      if (!usandoApi) {
        if (!cancelado) {
          setUsuario(guardado);
          setConsentiu(sessionStorage.getItem('aurea.consentimento') === 'demo-0');
          setCarregando(false);
        }
        return;
      }

      try {
        const eu = await chamar<RespostaDeQuemSou>('/autenticacao/eu');
        if (cancelado) return;
        setUsuario({
          nome: eu.perfilDetalhado?.nome ?? guardado.nome,
          perfil: eu.perfil,
          permissoes: eu.permissoes,
        });
        await conferirConsentimento(eu.perfil, cancelado);
      } catch {
        if (!cancelado) descartarSessaoLocal();
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    async function conferirConsentimento(perfil: Perfil, jaCancelado: boolean) {
      if (perfil !== 'PACIENTE') {
        if (!jaCancelado) setConsentiu(true);
        return;
      }
      try {
        const estado = await chamar<EstadoDoConsentimento>('/conta/consentimento');
        if (!jaCancelado) setConsentiu(!estado.exigido || estado.aceito);
      } catch {
        /* Não dá para afirmar que consentiu — a guarda leva ao termo, que é o
           lado seguro do erro. */
        if (!jaCancelado) setConsentiu(false);
      }
    }

    void restaurar();
    return () => {
      cancelado = true;
    };
  }, []);

  /* A API avisa quando o token morreu no meio do uso. */
  useEffect(() => aoExpirarSessao(() => descartarSessaoLocal()), []);

  function descartarSessaoLocal() {
    esquecerToken();
    sessionStorage.removeItem(CHAVE_DO_USUARIO);
    setUsuario(null);
    setConsentiu(false);
    setPrecisaTrocarSenha(false);
  }

  const entrar = useCallback(async (identificador: string, senha: string) => {
    const limpo = identificador.trim();
    const corpo = limpo.includes('@')
      ? { email: limpo, senha }
      : { cpf: limpo.replace(/\D/g, ''), senha };

    const entrada = await chamar<RespostaDeEntrada>('/autenticacao/entrar', {
      metodo: 'POST',
      corpo,
      semAutenticacao: true,
    });

    guardarToken(entrada.token);
    setPrecisaTrocarSenha(entrada.precisaVerPrimeiroAcesso);

    const eu = await chamar<RespostaDeQuemSou>('/autenticacao/eu');
    const identificado: UsuarioDaSessao = {
      nome: eu.perfilDetalhado?.nome ?? null,
      perfil: eu.perfil,
      permissoes: eu.permissoes,
    };
    sessionStorage.setItem(CHAVE_DO_USUARIO, JSON.stringify(identificado));
    setUsuario(identificado);

    if (eu.perfil === 'PACIENTE') {
      const estado = await chamar<EstadoDoConsentimento>('/conta/consentimento');
      setConsentiu(!estado.exigido || estado.aceito);
    } else {
      setConsentiu(true);
    }

    return eu.perfil;
  }, []);

  /** Atalho do modo sintético — não existe quando o sistema fala com a API. */
  const entrarComoSintetico = useCallback((chave: ChaveDeUsuario) => {
    const escolhido = USUARIOS_SINTETICOS[chave];
    sessionStorage.setItem(CHAVE_DO_USUARIO, JSON.stringify(escolhido));
    setUsuario(escolhido);
    setConsentiu(sessionStorage.getItem('aurea.consentimento') === 'demo-0');
  }, []);

  const sair = useCallback(async () => {
    if (usandoApi) {
      /* Encerrar a sessão no servidor é o que importa; se a chamada falhar, a
         sessão local cai do mesmo jeito — deixar a pessoa presa numa tela porque
         a rede oscilou seria pior. */
      try {
        await chamar<unknown>('/autenticacao/sair', { metodo: 'POST' });
      } catch {
        /* segue o descarte local */
      }
    }
    descartarSessaoLocal();
  }, []);

  const aceitarConsentimento = useCallback(async () => {
    if (usandoApi) {
      await chamar<unknown>('/conta/consentimento', { metodo: 'POST', corpo: {} });
    } else {
      sessionStorage.setItem('aurea.consentimento', 'demo-0');
    }
    setConsentiu(true);
  }, []);

  const pode = useCallback(
    (permissao: Permissao) => usuario?.permissoes.includes(permissao) ?? false,
    [usuario],
  );

  const valor = useMemo<EstadoDaSessao>(
    () => ({
      usuario,
      carregando,
      consentiu,
      precisaTrocarSenha,
      entrar,
      entrarComoSintetico,
      sair,
      aceitarConsentimento,
      pode,
    }),
    [
      usuario,
      carregando,
      consentiu,
      precisaTrocarSenha,
      entrar,
      entrarComoSintetico,
      sair,
      aceitarConsentimento,
      pode,
    ],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao(): EstadoDaSessao {
  const contexto = useContext(Contexto);
  if (!contexto) {
    throw new Error('useSessao precisa estar dentro de <ProvedorDeSessao>.');
  }
  return contexto;
}

/** Exposto para a tela de entrar decidir se mostra os atalhos de demonstração. */
export const MODO_SINTETICO = !usandoApi;
