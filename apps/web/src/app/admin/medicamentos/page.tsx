'use client';

/**
 * A7 — Medicamentos.
 *
 * Cadastro simples: nome, princípio ativo e via padrão. Sem origem de escrita
 * ainda — a criação fica em estado local até a Onda F ligar o backend.
 *
 * Composição conforme o ADR-004: cabeçalho com trilha e contexto, linha de
 * indicadores e a lista dentro de um bloco identificado.
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
import { ErroDaFonte, buscarMedicamentos } from '@/sistema/fonte';
import type { Medicamento } from '@/sistema/tipos';

type Carregamento =
  | { situacao: 'CARREGANDO' }
  | { situacao: 'ERRO'; mensagem: string }
  | { situacao: 'PRONTO' };

let proximoId = 1;

export default function PaginaDeMedicamentos() {
  const [estado, setEstado] = useState<Carregamento>({ situacao: 'CARREGANDO' });
  const [medicamentos, setMedicamentos] = useState<readonly Medicamento[]>([]);
  const [modalAberto, setModalAberto] = useState(false);

  const [nome, setNome] = useState('');
  const [principioAtivo, setPrincipioAtivo] = useState('');
  const [erroDoFormulario, setErroDoFormulario] = useState<string | null>(null);
  const [avisoDeGravacao, setAvisoDeGravacao] = useState(false);

  useEffect(() => {
    buscarMedicamentos()
      .then((lista) => {
        setMedicamentos(lista);
        setEstado({ situacao: 'PRONTO' });
      })
      .catch((erro: unknown) => {
        setEstado({
          situacao: 'ERRO',
          mensagem:
            erro instanceof ErroDaFonte
              ? erro.message
              : 'Não foi possível carregar os medicamentos.',
        });
      });
  }, []);

  function abrirModal() {
    setNome('');
    setPrincipioAtivo('');
    setErroDoFormulario(null);
    setModalAberto(true);
  }

  /* "Via padrão" saiu do formulário.
     Ela era coletada e descartada em `salvar()` — o usuário preenchia um campo que
     nunca chegava a lugar nenhum. A causa é mais funda que o descarte: `Medicamento`
     não tem essa coluna no schema (`apps/api/prisma/schema.prisma`, model
     Medicamento). Guardar num tipo de contrato da API só no front repetiria a
     divergência front/banco que já mordeu a biblioteca. Campo que não tem destino
     mente para quem preenche; então sai. Voltar exige migration, e isso é Onda F. */
  function salvar() {
    if (!nome.trim()) {
      setErroDoFormulario('Informe o nome do medicamento.');
      return;
    }
    setMedicamentos((atual) => [
      ...atual,
      {
        id: `local-${proximoId++}`,
        nome: nome.trim(),
        principioAtivo: principioAtivo.trim() || null,
      },
    ]);
    setModalAberto(false);
    setAvisoDeGravacao(true);
  }

  return (
    <>
      <CabecalhoDePainel
        trilha={[{ rotulo: 'Administração' }, { rotulo: 'Medicamentos' }]}
        titulo="Medicamentos"
        descricao="Medicamentos usados nas prescrições e nas orientações da equipe."
        acao={
          <Botao variante="principal" onClick={abrirModal}>
            Novo medicamento
          </Botao>
        }
      />

      {avisoDeGravacao && (
        <div className="mb-6">
          <Aviso tom="informacao" titulo="Medicamento adicionado apenas à lista local">
            <div className="flex items-center justify-between gap-4">
              <span>
                Nada foi gravado no servidor; a API não tem endpoint de escrita para medicamento
                ainda. Isso é a Onda F.
              </span>
              <Botao variante="discreto" tamanho="compacto" onClick={() => setAvisoDeGravacao(false)}>
                Entendi
              </Botao>
            </div>
          </Aviso>
        </div>
      )}

      {estado.situacao === 'CARREGANDO' && <Carregando linhas={5} />}

      {estado.situacao === 'ERRO' && (
        <Aviso tom="grave" titulo="Não foi possível carregar os medicamentos">
          {estado.mensagem}
        </Aviso>
      )}

      {estado.situacao === 'PRONTO' && medicamentos.length === 0 && (
        <EstadoVazio
          titulo="Nenhum medicamento cadastrado"
          descricao="Cadastre o primeiro medicamento."
          acao={
            <Botao variante="principal" onClick={abrirModal}>
              Novo medicamento
            </Botao>
          }
        />
      )}

      {estado.situacao === 'PRONTO' && medicamentos.length > 0 && (
        <>
          <LinhaDeIndicadores>
            <CartaoDeIndicador rotulo="Medicamentos cadastrados" valor={medicamentos.length} tom="neutro" />
            <CartaoDeIndicador
              rotulo="Com princípio ativo informado"
              valor={medicamentos.filter((medicamento) => medicamento.principioAtivo).length}
              tom="neutro"
            />
          </LinhaDeIndicadores>

          <Bloco
            titulo="Todos os medicamentos"
            descricao="Nome e princípio ativo de cada medicamento cadastrado."
            semPadding
          >
            <Tabela rotulo="Medicamentos">
              <CabecalhoDaTabela colunas={['Nome', 'Princípio ativo']} />
              <tbody>
                {medicamentos.map((medicamento) => (
                  <LinhaDaTabela key={medicamento.id}>
                    <Celula>{medicamento.nome}</Celula>
                    <Celula>{medicamento.principioAtivo ?? 'não informado'}</Celula>
                  </LinhaDaTabela>
                ))}
              </tbody>
            </Tabela>
          </Bloco>
        </>
      )}

      <Modal
        aberto={modalAberto}
        titulo="Novo medicamento"
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
            rotulo="Princípio ativo"
            value={principioAtivo}
            onChange={(evento) => setPrincipioAtivo(evento.target.value)}
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
