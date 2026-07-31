'use client';

/**
 * P10 — Perfil. Tratamento, médico assistente, contatos e alergias — tudo o que
 * a pessoa cadastrou ou a equipe registrou sobre ela, em um lugar só.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bloco } from '@/componentes/sistema/painel';
import { Aviso, Carregando, Medida, Rotulo } from '@/componentes/sistema/primitivos';
import { buscarPerfilDoPaciente } from '@/sistema/fonte';
import { formatarDataPorExtenso, formatarTelefone, ROTULO_DA_FUNCAO } from '@/sistema/formato';
import type { PerfilDoPaciente } from '@/sistema/tipos';

type Fase = 'carregando' | 'erro' | 'pronto';

export default function PaginaDePerfil() {
  const [fase, setFase] = useState<Fase>('carregando');
  const [perfil, setPerfil] = useState<PerfilDoPaciente | null>(null);

  useEffect(() => {
    let cancelado = false;
    buscarPerfilDoPaciente()
      .then((dados) => {
        if (cancelado) return;
        setPerfil(dados);
        setFase('pronto');
      })
      .catch(() => {
        if (!cancelado) setFase('erro');
      });
    return () => {
      cancelado = true;
    };
  }, []);

  if (fase === 'carregando') {
    return <Carregando linhas={5} />;
  }

  if (fase === 'erro' || !perfil) {
    return (
      <Aviso tom="grave" titulo="Algo não carregou">
        Não foi possível carregar seu perfil agora. Tente novamente em instantes.
      </Aviso>
    );
  }

  const { tratamento, ciclo, medicoAssistente, contatos, alergias } = perfil;
  const semContatos = contatos.doPaciente.length === 0 && contatos.deEmergencia.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <Bloco titulo="Tratamento">
        <div className="flex flex-col gap-2">
          {tratamento ? (
            <p className="text-base text-[var(--color-texto)]">{tratamento.protocolo.nome}</p>
          ) : (
            <p className="text-sm text-[var(--color-texto-suave)]">
              Nenhum tratamento registrado.
            </p>
          )}
          {ciclo && (
            <p className="text-sm text-[var(--color-texto-suave)]">
              Ciclo <Medida>{ciclo.numero}</Medida> — dia <Medida>{ciclo.diaDoCiclo}</Medida>
            </p>
          )}
          {ciclo?.previsaoDaProximaSessao && (
            <p className="text-sm text-[var(--color-texto-suave)]">
              Próxima sessão: {formatarDataPorExtenso(ciclo.previsaoDaProximaSessao)}
            </p>
          )}
        </div>
      </Bloco>

      {medicoAssistente && (
        <Bloco titulo="Médico assistente">
          <div className="flex flex-col gap-1">
            <p className="text-base text-[var(--color-texto)]">{medicoAssistente.nome}</p>
            <p className="text-sm text-[var(--color-texto-suave)]">
              {ROTULO_DA_FUNCAO[medicoAssistente.funcao]} — {medicoAssistente.registroDoConselho}
            </p>
          </div>
        </Bloco>
      )}

      <Bloco titulo="Contatos">
        {semContatos ? (
          <p className="text-sm text-[var(--color-texto-suave)]">Nenhum contato registrado.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {contatos.doPaciente.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Rotulo>Seus contatos</Rotulo>
                {contatos.doPaciente.map((contato) => (
                  <p key={contato.id} className="text-sm text-[var(--color-texto)]">
                    {contato.nome} — <Medida>{formatarTelefone(contato.telefone)}</Medida>
                  </p>
                ))}
              </div>
            )}
            {contatos.deEmergencia.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Rotulo>Contato de emergência</Rotulo>
                {contatos.deEmergencia.map((contato) => (
                  <p key={contato.id} className="text-sm text-[var(--color-texto)]">
                    {contato.nome}
                    {contato.relacao ? ` (${contato.relacao})` : ''} —{' '}
                    <Medida>{formatarTelefone(contato.telefone)}</Medida>
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </Bloco>

      <Bloco
        titulo="Alergias"
        acao={
          <Link
            href="/app/perfil/alergias"
            className="text-sm text-[var(--color-texto-suave)] underline underline-offset-4 hover:text-[var(--color-texto)]"
          >
            Ver e adicionar
          </Link>
        }
      >
        {alergias.length === 0 ? (
          <p className="text-sm text-[var(--color-texto-suave)]">Nenhuma alergia registrada.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {alergias.map((alergia) => (
              <li key={alergia.id} className="text-sm text-[var(--color-texto)]">
                {alergia.substancia}
                {alergia.reacao ? ` — ${alergia.reacao}` : ''}
              </li>
            ))}
          </ul>
        )}
      </Bloco>
    </div>
  );
}
