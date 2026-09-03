'use client';

/**
 * P11 — Alergias. Lista o que já está registrado e permite adicionar uma nova.
 * Sem backend, o novo registro entra em estado local e a pessoa é avisada de que
 * ele vai para conferência da equipe — nada aqui vira "verdade clínica" sozinho.
 */

import { useEffect, useState } from 'react';
import { Bloco, CabecalhoDePainel } from '@/componentes/sistema/painel';
import { Aviso, Botao, Campo, Carregando } from '@/componentes/sistema/primitivos';
import { buscarPerfilDoPaciente } from '@/sistema/fonte';
import type { Alergia } from '@/sistema/tipos';

type Fase = 'carregando' | 'erro' | 'pronto';

export default function PaginaDeAlergias() {
  const [fase, setFase] = useState<Fase>('carregando');
  const [alergias, setAlergias] = useState<readonly Alergia[]>([]);
  const [substancia, setSubstancia] = useState('');
  const [reacao, setReacao] = useState('');
  const [confirmacao, setConfirmacao] = useState(false);

  useEffect(() => {
    let cancelado = false;
    buscarPerfilDoPaciente()
      .then((perfil) => {
        if (cancelado) return;
        setAlergias(perfil.alergias);
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
    return <Carregando linhas={4} />;
  }

  if (fase === 'erro') {
    return (
      <Aviso tom="grave" titulo="Algo não carregou">
        Não foi possível carregar suas alergias agora. Tente novamente em instantes.
      </Aviso>
    );
  }

  function adicionar() {
    if (!substancia.trim()) return;
    const nova: Alergia = {
      id: `local-${Date.now()}`,
      substancia: substancia.trim(),
      reacao: reacao.trim() || null,
      origem: 'PACIENTE',
    };
    setAlergias((atuais) => [...atuais, nova]);
    setSubstancia('');
    setReacao('');
    setConfirmacao(true);
  }

  return (
    <div className="flex flex-col gap-5">
      <CabecalhoDePainel titulo="Alergias" descricao="O que já está registrado e como adicionar uma nova." />

      <Bloco titulo="Alergias registradas">
        {alergias.length === 0 ? (
          <p className="text-sm text-[var(--color-texto-suave)]">
            Nenhuma alergia registrada ainda.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {alergias.map((alergia) => (
              <li key={alergia.id} className="text-sm text-[var(--color-texto)]">
                {alergia.substancia}
                {alergia.reacao ? `, ${alergia.reacao}` : ''}
              </li>
            ))}
          </ul>
        )}
      </Bloco>

      <Bloco titulo="Adicionar alergia">
        <form
          className="flex flex-col gap-4"
          onSubmit={(evento) => {
            evento.preventDefault();
            adicionar();
          }}
        >
          <Campo
            rotulo="Substância"
            value={substancia}
            onChange={(evento) => setSubstancia(evento.target.value)}
            placeholder="Ex.: Dipirona"
            required
          />
          <Campo
            rotulo="Reação (opcional)"
            value={reacao}
            onChange={(evento) => setReacao(evento.target.value)}
            placeholder="Ex.: Coceira, inchaço"
          />
          <Botao type="submit" tamanho="amplo">
            Adicionar
          </Botao>
        </form>
      </Bloco>

      {confirmacao && (
        <Aviso tom="informacao">Este registro será enviado à equipe para conferência.</Aviso>
      )}
    </div>
  );
}
