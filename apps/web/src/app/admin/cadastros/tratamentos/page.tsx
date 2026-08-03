'use client';

/**
 * Cadastro de tratamentos.
 *
 * Não existe endpoint de escrita para tratamento — a API só devolve o que veio
 * do seed. Esta tela guarda o cadastro em estado local e diz isso a cada envio.
 *
 * O protocolo vem de `buscarProtocolos()`, a mesma fronteira que o resto do
 * sistema usa — trocar a origem na Onda F não muda esta tela. O paciente é texto
 * livre: os cinco cadastros desta onda ainda não compartilham uma base de dados
 * entre si, então não há como este formulário saber que nome já existe em
 * Pacientes sem inventar uma integração que não existe de verdade.
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
  juntar,
} from '@/componentes/sistema/primitivos';
import { formatarData } from '@/sistema/formato';
import { ErroDaFonte, buscarProtocolos } from '@/sistema/fonte';
import type { Protocolo } from '@/sistema/tipos';

/* ==========================================================================
   Dados — sintéticos, locais, sem servidor
   ========================================================================== */

type EstadoDoTratamento = 'EM_ANDAMENTO' | 'CONCLUIDO' | 'INTERROMPIDO';

const ROTULO_DO_ESTADO: Record<EstadoDoTratamento, string> = {
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDO: 'Concluído',
  INTERROMPIDO: 'Interrompido',
};

interface TratamentoCadastrado {
  readonly id: string;
  readonly pacienteNome: string;
  readonly protocoloNome: string;
  readonly medicoAssistente: string;
  readonly iniciadoEm: string;
  readonly estado: EstadoDoTratamento;
}

const SEMENTE_DE_TRATAMENTOS: readonly TratamentoCadastrado[] = [
  {
    id: 'trat-seed-1',
    pacienteNome: 'Marta Ferreira (fictícia)',
    protocoloNome: 'Protocolo de demonstração',
    medicoAssistente: 'Médico de demonstração',
    iniciadoEm: '2026-05-31T12:00:00.000Z',
    estado: 'EM_ANDAMENTO',
  },
  {
    id: 'trat-seed-2',
    pacienteNome: 'Antônio Reis (fictício)',
    protocoloNome: 'AC-T (demonstração)',
    medicoAssistente: 'Médico de demonstração',
    iniciadoEm: '2026-03-10T12:00:00.000Z',
    estado: 'CONCLUIDO',
  },
];

function comAtraso<T>(valor: T, ms = 220): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), ms));
}

/* ==========================================================================
   Formulário
   ========================================================================== */

interface FormularioDeTratamento {
  pacienteNome: string;
  protocoloId: string;
  medicoAssistente: string;
  dataDeInicio: string;
}

const FORMULARIO_VAZIO: FormularioDeTratamento = {
  pacienteNome: '',
  protocoloId: '',
  medicoAssistente: '',
  dataDeInicio: '',
};

type ErrosDoFormulario = Partial<Record<keyof FormularioDeTratamento, string>>;

function validar(formulario: FormularioDeTratamento): ErrosDoFormulario {
  const erros: ErrosDoFormulario = {};
  if (!formulario.pacienteNome.trim()) erros.pacienteNome = 'Informe o nome do paciente.';
  if (!formulario.protocoloId) erros.protocoloId = 'Selecione um protocolo.';
  if (!formulario.medicoAssistente.trim()) erros.medicoAssistente = 'Informe o médico assistente.';
  if (!formulario.dataDeInicio) erros.dataDeInicio = 'Informe a data de início.';
  return erros;
}

/* ==========================================================================
   Página
   ========================================================================== */

type EstadoDeCarregamento = 'carregando' | 'pronto' | 'erro';

export default function PaginaDeTratamentos() {
  const [estado, setEstado] = useState<EstadoDeCarregamento>('carregando');
  const [mensagemDeErro, setMensagemDeErro] = useState<string | null>(null);
  const [protocolos, setProtocolos] = useState<readonly Protocolo[]>([]);
  const [tratamentos, setTratamentos] = useState<readonly TratamentoCadastrado[]>([]);

  const [modalAberto, setModalAberto] = useState(false);
  const [formulario, setFormulario] = useState<FormularioDeTratamento>(FORMULARIO_VAZIO);
  const [erros, setErros] = useState<ErrosDoFormulario>({});
  const [enviando, setEnviando] = useState(false);
  const [avisoDeGravacao, setAvisoDeGravacao] = useState(false);

  useEffect(() => {
    carregar();
  }, []);

  function carregar() {
    setEstado('carregando');
    setMensagemDeErro(null);
    Promise.all([buscarProtocolos(), comAtraso(SEMENTE_DE_TRATAMENTOS)])
      .then(([protocolosCarregados, tratamentosCarregados]) => {
        setProtocolos(protocolosCarregados);
        setTratamentos(tratamentosCarregados);
        setEstado('pronto');
      })
      .catch((erro: unknown) => {
        setMensagemDeErro(
          erro instanceof ErroDaFonte ? erro.message : 'Não foi possível carregar os protocolos.',
        );
        setEstado('erro');
      });
  }

  function abrirModal() {
    setFormulario(FORMULARIO_VAZIO);
    setErros({});
    setModalAberto(true);
  }

  function fecharModal() {
    if (enviando) return;
    setModalAberto(false);
  }

  async function enviar() {
    const errosEncontrados = validar(formulario);
    setErros(errosEncontrados);
    if (Object.keys(errosEncontrados).length > 0) return;

    const protocolo = protocolos.find((item) => item.id === formulario.protocoloId);
    if (!protocolo) return;

    setEnviando(true);
    const novoTratamento: TratamentoCadastrado = await comAtraso(
      {
        id: crypto.randomUUID(),
        pacienteNome: formulario.pacienteNome.trim(),
        protocoloNome: protocolo.nome,
        medicoAssistente: formulario.medicoAssistente.trim(),
        iniciadoEm: `${formulario.dataDeInicio}T12:00:00.000Z`,
        estado: 'EM_ANDAMENTO',
      },
      420,
    );

    setTratamentos((atual) => [novoTratamento, ...atual]);
    setEnviando(false);
    setModalAberto(false);
    setAvisoDeGravacao(true);
  }

  return (
    <>
      <CabecalhoDePainel
        trilha={[
          { rotulo: 'Administração' },
          { rotulo: 'Cadastros', href: '/admin/cadastros' },
          { rotulo: 'Tratamentos' },
        ]}
        titulo="Tratamentos"
        descricao="Liga um paciente a um protocolo e a um médico assistente."
        acao={
          <Botao onClick={abrirModal} disabled={estado !== 'pronto'}>
            Novo tratamento
          </Botao>
        }
      />

      {avisoDeGravacao && (
        <div className="mb-6">
          <Aviso tom="informacao" titulo="Tratamento adicionado apenas à lista local">
            <div className="flex items-center justify-between gap-4">
              <span>
                Nada foi gravado no servidor; a API não tem endpoint de escrita para tratamento
                ainda. Isso é a Onda F.
              </span>
              <Botao variante="discreto" tamanho="compacto" onClick={() => setAvisoDeGravacao(false)}>
                Entendi
              </Botao>
            </div>
          </Aviso>
        </div>
      )}

      {estado === 'carregando' && <Carregando linhas={5} />}

      {estado === 'erro' && (
        <Aviso tom="grave" titulo="Não foi possível carregar os tratamentos">
          <div className="flex items-center justify-between gap-4">
            <span>{mensagemDeErro}</span>
            <Botao variante="secundario" tamanho="compacto" onClick={carregar}>
              Tentar novamente
            </Botao>
          </div>
        </Aviso>
      )}

      {estado === 'pronto' && tratamentos.length === 0 && (
        <EstadoVazio
          titulo="Nenhum tratamento cadastrado"
          descricao="Cadastre o primeiro tratamento para começar."
          acao={<Botao onClick={abrirModal}>Novo tratamento</Botao>}
        />
      )}

      {estado === 'pronto' && tratamentos.length > 0 && (
        <>
          <LinhaDeIndicadores>
            <CartaoDeIndicador rotulo="Tratamentos cadastrados" valor={tratamentos.length} tom="neutro" />
            <CartaoDeIndicador
              rotulo="Em andamento"
              valor={tratamentos.filter((t) => t.estado === 'EM_ANDAMENTO').length}
              tom="neutro"
            />
          </LinhaDeIndicadores>

          <Bloco
            titulo="Todos os tratamentos"
            descricao="Paciente, protocolo e estado de cada tratamento cadastrado."
            semPadding
          >
            <Tabela rotulo="Tratamentos cadastrados">
              <CabecalhoDaTabela colunas={['Paciente', 'Protocolo', 'Início', 'Estado']} />
              <tbody>
                {tratamentos.map((tratamento) => (
                  <LinhaDaTabela key={tratamento.id}>
                    <Celula>{tratamento.pacienteNome}</Celula>
                    <Celula>{tratamento.protocoloNome}</Celula>
                    <Celula mono>{formatarData(tratamento.iniciadoEm)}</Celula>
                    <Celula>{ROTULO_DO_ESTADO[tratamento.estado]}</Celula>
                  </LinhaDaTabela>
                ))}
              </tbody>
            </Tabela>
          </Bloco>
        </>
      )}

      <Modal
        aberto={modalAberto}
        titulo="Novo tratamento"
        descricao="Todos os campos são obrigatórios. Dado sintético, não é gravado no servidor."
        aoFechar={fecharModal}
        rodape={
          <>
            <Botao variante="secundario" onClick={fecharModal} disabled={enviando}>
              Cancelar
            </Botao>
            <Botao onClick={enviar} disabled={enviando}>
              {enviando ? 'Salvando…' : 'Salvar'}
            </Botao>
          </>
        }
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(evento) => {
            evento.preventDefault();
            void enviar();
          }}
        >
          <Campo
            rotulo="Paciente *"
            ajuda="Digite o nome como está no cadastro de pacientes; os cadastros ainda não são ligados entre si."
            value={formulario.pacienteNome}
            onChange={(evento) =>
              setFormulario((atual) => ({ ...atual, pacienteNome: evento.target.value }))
            }
            erro={erros.pacienteNome}
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="tratamento-protocolo" className="text-sm font-medium text-[var(--color-texto)]">
              Protocolo *
            </label>
            <select
              id="tratamento-protocolo"
              value={formulario.protocoloId}
              onChange={(evento) =>
                setFormulario((atual) => ({ ...atual, protocoloId: evento.target.value }))
              }
              className={juntar(
                'rounded-[var(--radius-sistema)] border bg-[var(--color-superficie-alta)]',
                'px-3 py-2.5 text-base text-[var(--color-texto)] transition-colors duration-150',
                erros.protocoloId
                  ? 'border-[var(--color-risco-vermelho)]'
                  : 'border-[var(--color-borda-forte)] focus:border-[var(--color-texto-suave)]',
              )}
            >
              <option value="">Selecione…</option>
              {protocolos.map((protocolo) => (
                <option key={protocolo.id} value={protocolo.id}>
                  {protocolo.nome}
                </option>
              ))}
            </select>
            {erros.protocoloId && (
              <p role="alert" className="text-xs text-[var(--color-risco-vermelho)]">
                {erros.protocoloId}
              </p>
            )}
          </div>

          <Campo
            rotulo="Médico assistente *"
            value={formulario.medicoAssistente}
            onChange={(evento) =>
              setFormulario((atual) => ({ ...atual, medicoAssistente: evento.target.value }))
            }
            erro={erros.medicoAssistente}
          />

          <Campo
            rotulo="Data de início *"
            type="date"
            value={formulario.dataDeInicio}
            onChange={(evento) =>
              setFormulario((atual) => ({ ...atual, dataDeInicio: evento.target.value }))
            }
            erro={erros.dataDeInicio}
          />
        </form>
      </Modal>
    </>
  );
}
