'use client';

/**
 * E7 — Todos os pacientes.
 *
 * A tela irmã de "Pacientes do dia", e a distinção entre as duas é a coisa mais
 * importante deste arquivo.
 *
 * "Pacientes do dia" responde **quem precisa de mim agora**: só quem tem ciclo em
 * andamento, ordenado por gravidade, com a escala de triagem em evidência. É a tela do
 * turno.
 *
 * Esta responde **quem são as pessoas sob nossos cuidados**: todo mundo, em ordem
 * alfabética, com o cadastro à vista — diagnóstico, quem cuida em casa, telefone,
 * última passagem pelo serviço. É a tela de quando a enfermagem precisa achar alguém,
 * ligar para uma família, conferir um dado antes de uma conduta.
 *
 * Por isso aqui NÃO há cor de escala. Ordenar 200 pessoas por gravidade e pintar a
 * lista inteira faria a cor virar textura de fundo — e a cor da classificação só
 * funciona porque é rara. Quem quer gravidade tem a outra tela, a um clique.
 */

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Bloco, CabecalhoDePainel } from '@/componentes/sistema/painel';
import {
  Aviso,
  CabecalhoDaTabela,
  Campo,
  Carregando,
  Celula,
  EstadoVazio,
  LinhaDaTabela,
  Tabela,
} from '@/componentes/sistema/primitivos';
import { ErroDaFonte, buscarTodosOsPacientes } from '@/sistema/fonte';
import { ROTULO_DO_EVENTO, formatarData } from '@/sistema/formato';
import type { PacienteAcompanhado } from '@/sistema/tipos';

type Estado =
  | { fase: 'carregando' }
  | { fase: 'erro'; mensagem: string }
  | { fase: 'pronto'; pacientes: readonly PacienteAcompanhado[] };

export default function PaginaDeTodosOsPacientes() {
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' });
  const [busca, setBusca] = useState('');

  useEffect(() => {
    let cancelado = false;
    buscarTodosOsPacientes()
      .then((pacientes) => {
        if (!cancelado) setEstado({ fase: 'pronto', pacientes });
      })
      .catch((motivo: unknown) => {
        if (cancelado) return;
        setEstado({
          fase: 'erro',
          mensagem:
            motivo instanceof ErroDaFonte
              ? motivo.message
              : 'Não foi possível carregar a lista de pacientes.',
        });
      });
    return () => {
      cancelado = true;
    };
  }, []);

  /* A busca cobre nome, diagnóstico e quem cuida em casa. Restringir ao nome obrigaria
     a enfermagem a lembrar o nome exato de quem ela está procurando — e às vezes o que
     ela tem na mão é o nome do filho que ligou. */
  const filtrados = useMemo(() => {
    if (estado.fase !== 'pronto') return [];
    const termo = busca.trim().toLowerCase();
    if (termo.length === 0) return estado.pacientes;
    return estado.pacientes.filter((paciente) =>
      [paciente.nome, paciente.diagnostico, paciente.responsavel?.nome ?? '']
        .join(' ')
        .toLowerCase()
        .includes(termo),
    );
  }, [estado, busca]);

  const emTratamento =
    estado.fase === 'pronto'
      ? estado.pacientes.filter((paciente) => paciente.emTratamento).length
      : 0;

  return (
    <>
      <CabecalhoDePainel
        trilha={[{ rotulo: 'Plantão' }, { rotulo: 'Todos os pacientes' }]}
        titulo="Todos os pacientes"
        descricao="Cadastro completo de quem está sob acompanhamento, em ordem alfabética. Para ver quem precisa de atenção hoje, use Pacientes do dia."
      />

      {estado.fase === 'carregando' && <Carregando linhas={8} />}

      {estado.fase === 'erro' && (
        <Aviso tom="grave" titulo="Não foi possível carregar">
          {estado.mensagem}
        </Aviso>
      )}

      {estado.fase === 'pronto' && (
        <Bloco
          titulo="Pacientes"
          descricao={`${estado.pacientes.length} no cadastro · ${emTratamento} em tratamento ativo. Toque na linha para abrir o prontuário completo.`}
          semPadding
        >
          <div className="border-b border-[var(--color-borda)] px-5 py-3">
            <Campo
              rotulo="Buscar"
              type="search"
              placeholder="Nome, diagnóstico ou quem cuida em casa"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
            />
          </div>

          {filtrados.length === 0 ? (
            <div className="p-6">
              <EstadoVazio
                titulo="Nenhum paciente encontrado"
                descricao="Confira a busca ou limpe o campo para ver a lista completa."
              />
            </div>
          ) : (
            <Tabela rotulo="Todos os pacientes">
              <CabecalhoDaTabela
                colunas={[
                  'Paciente',
                  'Diagnóstico',
                  'Quem cuida em casa',
                  'Telefone',
                  'Última visita',
                  'Tratamento',
                ]}
              />
              <tbody>
                {filtrados.map((paciente) => (
                  <LinhaDaTabela key={paciente.id}>
                    <Celula>
                      {/* A linha inteira leva ao prontuário, mas o alvo clicável é o
                          nome: linha-inteira-clicável quebra seleção de texto, e aqui a
                          pessoa copia telefone o tempo todo. */}
                      <Link
                        href={`/painel/pacientes/${paciente.id}`}
                        className="font-medium text-[var(--color-texto)] underline-offset-2 hover:underline"
                      >
                        {paciente.nome}
                      </Link>
                      <span className="mt-0.5 block text-xs text-[var(--color-texto-fraco)]">
                        {paciente.dataNascimento
                          ? `nasc. ${formatarData(paciente.dataNascimento)}`
                          : 'nascimento não cadastrado'}
                        {paciente.medicoAssistente ? ` · ${paciente.medicoAssistente}` : ''}
                      </span>
                    </Celula>

                    <Celula>{paciente.diagnostico}</Celula>

                    <Celula>
                      {paciente.responsavel ? (
                        <>
                          {paciente.responsavel.nome}
                          <span className="mt-0.5 block text-xs text-[var(--color-texto-fraco)]">
                            {paciente.responsavel.relacao ?? 'relação não informada'}
                            {paciente.responsavel.deEmergencia ? ' · emergência' : ''}
                          </span>
                        </>
                      ) : (
                        <span className="text-[var(--color-texto-fraco)]">
                          Ninguém cadastrado
                        </span>
                      )}
                    </Celula>

                    <Celula mono>
                      {paciente.responsavel ? (
                        <a
                          href={`tel:${paciente.responsavel.telefone}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {paciente.responsavel.telefone}
                        </a>
                      ) : (
                        'não informado'
                      )}
                    </Celula>

                    <Celula>
                      {paciente.ultimaVisita ? (
                        <>
                          {formatarData(paciente.ultimaVisita.aconteceEm)}
                          <span className="mt-0.5 block text-xs text-[var(--color-texto-fraco)]">
                            {ROTULO_DO_EVENTO[paciente.ultimaVisita.tipo]}
                          </span>
                        </>
                      ) : (
                        <span className="text-[var(--color-texto-fraco)]">Sem registro</span>
                      )}
                    </Celula>

                    <Celula>
                      {paciente.emTratamento ? (
                        <>
                          {paciente.protocolo ?? 'Protocolo não informado'}
                          <span className="mt-0.5 block text-xs text-[var(--color-texto-fraco)]">
                            {paciente.numeroDoCiclo != null
                              ? `ciclo ${paciente.numeroDoCiclo}`
                              : 'ciclo não iniciado'}
                            {paciente.diaDoCiclo != null ? ` · dia ${paciente.diaDoCiclo}` : ''}
                          </span>
                        </>
                      ) : (
                        <span className="text-[var(--color-texto-fraco)]">
                          Sem tratamento ativo
                        </span>
                      )}
                    </Celula>
                  </LinhaDaTabela>
                ))}
              </tbody>
            </Tabela>
          )}
        </Bloco>
      )}
    </>
  );
}
