'use client';

/**
 * A6 — Protocolos de tratamento.
 *
 * Cadastro simples: nome, descrição e duração do ciclo em dias. Sem origem de
 * escrita ainda — a criação fica em estado local até a Onda F ligar o backend.
 *
 * Composição conforme o ADR-004: cabeçalho com trilha e contexto, linha de
 * indicadores com o que importa (quantos protocolos, quantos ativos) e a lista
 * dentro de um bloco identificado — em vez de título solto sobre tabela nua.
 */

import { useEffect, useState } from 'react';
import { Modal } from '@/componentes/sistema/modal';
import { Bloco, CabecalhoDePainel, CartaoDeIndicador, LinhaDeIndicadores } from '@/componentes/sistema/painel';
import {
  Aviso,
  Botao,
  CabecalhoDaTabela,
  Campo,
  Carregando,
  Celula,
  EstadoVazio,
  LinhaDaTabela,
  Tabela,
} from '@/componentes/sistema/primitivos';
import { ErroDaFonte, buscarProtocolos } from '@/sistema/fonte';
import type { Protocolo } from '@/sistema/tipos';

type Carregamento =
  | { situacao: 'CARREGANDO' }
  | { situacao: 'ERRO'; mensagem: string }
  | { situacao: 'PRONTO' };

let proximoId = 1;

export default function PaginaDeProtocolos() {
  const [estado, setEstado] = useState<Carregamento>({ situacao: 'CARREGANDO' });
  const [protocolos, setProtocolos] = useState<readonly Protocolo[]>([]);
  const [modalAberto, setModalAberto] = useState(false);

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [erroDoFormulario, setErroDoFormulario] = useState<string | null>(null);

  useEffect(() => {
    buscarProtocolos()
      .then((lista) => {
        setProtocolos(lista);
        setEstado({ situacao: 'PRONTO' });
      })
      .catch((erro: unknown) => {
        setEstado({
          situacao: 'ERRO',
          mensagem:
            erro instanceof ErroDaFonte ? erro.message : 'Não foi possível carregar os protocolos.',
        });
      });
  }, []);

  function abrirModal() {
    setNome('');
    setDescricao('');
    setErroDoFormulario(null);
    setModalAberto(true);
  }

  function salvar() {
    if (!nome.trim()) {
      setErroDoFormulario('Informe o nome do protocolo.');
      return;
    }
    setProtocolos((atual) => [
      ...atual,
      {
        id: `local-${proximoId++}`,
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        ativo: true,
      },
    ]);
    setModalAberto(false);
  }

  return (
    <>
      <CabecalhoDePainel
        trilha={[{ rotulo: 'Administração' }, { rotulo: 'Protocolos' }]}
        titulo="Protocolos"
        descricao="Protocolos de tratamento usados para restringir regras e organizar o painel da equipe."
        acao={
          <Botao variante="principal" onClick={abrirModal}>
            Novo protocolo
          </Botao>
        }
      />

      {estado.situacao === 'CARREGANDO' && <Carregando linhas={5} />}

      {estado.situacao === 'ERRO' && (
        <Aviso tom="grave" titulo="Não foi possível carregar os protocolos">
          {estado.mensagem}
        </Aviso>
      )}

      {estado.situacao === 'PRONTO' && protocolos.length === 0 && (
        <EstadoVazio
          titulo="Nenhum protocolo cadastrado"
          descricao="Cadastre o primeiro protocolo de tratamento."
          acao={
            <Botao variante="principal" onClick={abrirModal}>
              Novo protocolo
            </Botao>
          }
        />
      )}

      {estado.situacao === 'PRONTO' && protocolos.length > 0 && (
        <>
          <LinhaDeIndicadores>
            <CartaoDeIndicador rotulo="Protocolos cadastrados" valor={protocolos.length} tom="neutro" />
            <CartaoDeIndicador
              rotulo="Ativos"
              valor={protocolos.filter((protocolo) => protocolo.ativo).length}
              apoio="disponíveis para uso em tratamentos"
              tom="neutro"
            />
          </LinhaDeIndicadores>

          <Bloco
            titulo="Todos os protocolos"
            descricao="Nome, descrição e situação de cada protocolo cadastrado."
            semPadding
          >
            <Tabela rotulo="Protocolos de tratamento">
              <CabecalhoDaTabela colunas={['Nome', 'Descrição', 'Ativo']} />
              <tbody>
                {protocolos.map((protocolo) => (
                  <LinhaDaTabela key={protocolo.id}>
                    <Celula>{protocolo.nome}</Celula>
                    <Celula>{protocolo.descricao ?? 'não informado'}</Celula>
                    <Celula>{protocolo.ativo ? 'Sim' : 'Não'}</Celula>
                  </LinhaDaTabela>
                ))}
              </tbody>
            </Tabela>
          </Bloco>
        </>
      )}

      <Modal
        aberto={modalAberto}
        titulo="Novo protocolo"
        aoFechar={() => setModalAberto(false)}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setModalAberto(false)}>
              Cancelar
            </Botao>
            <Botao variante="principal" onClick={salvar}>
              Salvar
            </Botao>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Campo rotulo="Nome" value={nome} onChange={(evento) => setNome(evento.target.value)} />
          <Campo
            rotulo="Descrição"
            value={descricao}
            onChange={(evento) => setDescricao(evento.target.value)}
          />
          {erroDoFormulario && (
            <p role="alert" className="text-xs text-[var(--color-risco-vermelho)]">
              {erroDoFormulario}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
