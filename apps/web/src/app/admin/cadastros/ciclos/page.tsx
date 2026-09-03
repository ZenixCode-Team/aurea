'use client';

/**
 * Cadastro de ciclos.
 *
 * Não existe endpoint de escrita para ciclo — a API só devolve o que veio do
 * seed. Esta tela guarda o cadastro em estado local e diz isso a cada envio.
 *
 * A lista de tratamentos disponíveis para escolher aqui é local a esta tela: os
 * cinco cadastros desta onda ainda não compartilham uma base de dados entre si.
 * O protocolo de cada tratamento vem de `buscarProtocolos()` — a mesma fronteira
 * que o resto do sistema usa — para que a duração de ciclo usada na previsão seja
 * real, não inventada.
 *
 * Composição conforme o ADR-004: cabeçalho com trilha e contexto, linha de
 * indicadores e a lista dentro de um bloco identificado.
 */

import { useEffect, useMemo, useState } from 'react';
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

interface TratamentoDisponivel {
  readonly id: string;
  readonly pacienteNome: string;
  readonly protocolo: Protocolo;
}

const PACIENTES_DE_REFERENCIA: readonly string[] = [
  'Marta Ferreira (fictícia)',
  'Antônio Reis (fictício)',
  'Iris Costa (fictícia)',
];

function montarTratamentosDisponiveis(protocolos: readonly Protocolo[]): readonly TratamentoDisponivel[] {
  if (protocolos.length === 0) return [];
  return PACIENTES_DE_REFERENCIA.map((pacienteNome, indice) => ({
    id: `trat-disp-${indice + 1}`,
    pacienteNome,
    protocolo: protocolos[indice % protocolos.length] as Protocolo,
  }));
}

interface CicloCadastrado {
  readonly id: string;
  readonly pacienteNome: string;
  readonly numero: number;
  readonly sessaoRealizadaEm: string;
  /* Nula enquanto não houver previsão — a data real depende de exame e de agenda. */
  readonly previsaoDaProximaSessao: string | null;
}

function comAtraso<T>(valor: T, ms = 220): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), ms));
}

/* ==========================================================================
   Formulário
   ========================================================================== */

interface FormularioDeCiclo {
  tratamentoId: string;
  numero: string;
  dataDaSessao: string;
  previsaoDaProxima: string;
}

const FORMULARIO_VAZIO: FormularioDeCiclo = {
  tratamentoId: '',
  numero: '',
  dataDaSessao: '',
  previsaoDaProxima: '',
};

type ErrosDoFormulario = Partial<Record<keyof FormularioDeCiclo, string>>;

function validar(formulario: FormularioDeCiclo): ErrosDoFormulario {
  const erros: ErrosDoFormulario = {};
  if (!formulario.tratamentoId) erros.tratamentoId = 'Selecione um tratamento.';

  if (!formulario.numero.trim()) {
    erros.numero = 'Informe o número do ciclo.';
  } else {
    const numero = Number(formulario.numero);
    if (!Number.isInteger(numero) || numero < 1) {
      erros.numero = 'Informe um número inteiro maior ou igual a 1.';
    }
  }

  if (!formulario.dataDaSessao) erros.dataDaSessao = 'Informe a data da sessão realizada.';

  return erros;
}

/* ==========================================================================
   Página
   ========================================================================== */

type EstadoDeCarregamento = 'carregando' | 'pronto' | 'erro';

export default function PaginaDeCiclos() {
  const [estado, setEstado] = useState<EstadoDeCarregamento>('carregando');
  const [mensagemDeErro, setMensagemDeErro] = useState<string | null>(null);
  const [tratamentosDisponiveis, setTratamentosDisponiveis] = useState<
    readonly TratamentoDisponivel[]
  >([]);
  const [ciclos, setCiclos] = useState<readonly CicloCadastrado[]>([]);

  const [modalAberto, setModalAberto] = useState(false);
  const [formulario, setFormulario] = useState<FormularioDeCiclo>(FORMULARIO_VAZIO);
  const [erros, setErros] = useState<ErrosDoFormulario>({});
  const [enviando, setEnviando] = useState(false);
  const [avisoDeGravacao, setAvisoDeGravacao] = useState(false);

  useEffect(() => {
    carregar();
  }, []);

  function carregar() {
    setEstado('carregando');
    setMensagemDeErro(null);
    buscarProtocolos()
      .then((protocolosCarregados) => {
        const disponiveis = montarTratamentosDisponiveis(protocolosCarregados);
        const primeiro = disponiveis[0];
        const segundo = disponiveis[1];
        const semente: readonly CicloCadastrado[] = [
          ...(primeiro
            ? [
                {
                  id: 'ciclo-seed-1',
                  pacienteNome: primeiro.pacienteNome,
                  numero: 1,
                  sessaoRealizadaEm: '2026-05-31T12:00:00.000Z',
                  previsaoDaProximaSessao: '2026-06-21T12:00:00.000Z',
                },
              ]
            : []),
          ...(segundo
            ? [
                {
                  id: 'ciclo-seed-2',
                  pacienteNome: segundo.pacienteNome,
                  numero: 2,
                  sessaoRealizadaEm: '2026-06-21T12:00:00.000Z',
                  previsaoDaProximaSessao: '2026-07-12T12:00:00.000Z',
                },
              ]
            : []),
        ];
        return comAtraso({ disponiveis, semente });
      })
      .then(({ disponiveis, semente }) => {
        setTratamentosDisponiveis(disponiveis);
        setCiclos(semente);
        setEstado('pronto');
      })
      .catch((erro: unknown) => {
        setMensagemDeErro(
          erro instanceof ErroDaFonte ? erro.message : 'Não foi possível carregar os tratamentos.',
        );
        setEstado('erro');
      });
  }

  const tratamentoSelecionado = useMemo(
    () => tratamentosDisponiveis.find((item) => item.id === formulario.tratamentoId) ?? null,
    [tratamentosDisponiveis, formulario.tratamentoId],
  );

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
    if (!tratamentoSelecionado) return;

    setEnviando(true);
    const novoCiclo: CicloCadastrado = await comAtraso(
      {
        id: crypto.randomUUID(),
        pacienteNome: tratamentoSelecionado.pacienteNome,
        numero: Number(formulario.numero),
        sessaoRealizadaEm: `${formulario.dataDaSessao}T12:00:00.000Z`,
        previsaoDaProximaSessao: formulario.previsaoDaProxima
          ? `${formulario.previsaoDaProxima}T12:00:00.000Z`
          : null,
      },
      420,
    );

    setCiclos((atual) => [novoCiclo, ...atual]);
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
          { rotulo: 'Ciclos' },
        ]}
        titulo="Ciclos"
        descricao="Registra a sessão realizada dentro de um tratamento e projeta a próxima."
        acao={
          <Botao onClick={abrirModal} disabled={estado !== 'pronto'}>
            Novo ciclo
          </Botao>
        }
      />

      {avisoDeGravacao && (
        <div className="mb-6">
          <Aviso tom="informacao" titulo="Ciclo adicionado apenas à lista local">
            <div className="flex items-center justify-between gap-4">
              <span>
                Nada foi gravado no servidor; a API não tem endpoint de escrita para ciclo ainda.
                Isso é a Onda F.
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
        <Aviso tom="grave" titulo="Não foi possível carregar os ciclos">
          <div className="flex items-center justify-between gap-4">
            <span>{mensagemDeErro}</span>
            <Botao variante="secundario" tamanho="compacto" onClick={carregar}>
              Tentar novamente
            </Botao>
          </div>
        </Aviso>
      )}

      {estado === 'pronto' && ciclos.length === 0 && (
        <EstadoVazio
          titulo="Nenhum ciclo cadastrado"
          descricao="Cadastre o primeiro ciclo para começar."
          acao={<Botao onClick={abrirModal}>Novo ciclo</Botao>}
        />
      )}

      {estado === 'pronto' && ciclos.length > 0 && (
        <>
          <LinhaDeIndicadores>
            <CartaoDeIndicador rotulo="Ciclos cadastrados" valor={ciclos.length} tom="neutro" />
            <CartaoDeIndicador
              rotulo="Com previsão registrada"
              valor={ciclos.filter((c) => c.previsaoDaProximaSessao !== null).length}
              tom="neutro"
            />
          </LinhaDeIndicadores>

          <Bloco
            titulo="Todos os ciclos"
            descricao="Sessão realizada e previsão da próxima, por paciente."
            semPadding
          >
            <Tabela rotulo="Ciclos cadastrados" larguraMinima="44rem">
              <CabecalhoDaTabela colunas={[
                  { rotulo: 'Paciente', largura: '16rem' },
                  { rotulo: 'Número do ciclo', largura: '8rem', alinhamento: 'direita' },
                  { rotulo: 'Data da sessão', largura: '8rem' },
                  { rotulo: 'Previsão da próxima' },
                ]} />
              <tbody>
                {ciclos.map((ciclo) => (
                  <LinhaDaTabela key={ciclo.id}>
                    <Celula>{ciclo.pacienteNome}</Celula>
                    <Celula mono alinhamento="direita">{ciclo.numero}</Celula>
                    <Celula mono inteira>{formatarData(ciclo.sessaoRealizadaEm)}</Celula>
                    <Celula mono>
                      {ciclo.previsaoDaProximaSessao
                        ? formatarData(ciclo.previsaoDaProximaSessao)
                        : 'Sem previsão'}
                    </Celula>
                  </LinhaDaTabela>
                ))}
              </tbody>
            </Tabela>
          </Bloco>
        </>
      )}

      <Modal
        aberto={modalAberto}
        titulo="Novo ciclo"
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
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ciclo-tratamento" className="text-sm font-medium text-[var(--color-texto)]">
              Tratamento *
            </label>
            <select
              id="ciclo-tratamento"
              value={formulario.tratamentoId}
              onChange={(evento) =>
                setFormulario((atual) => ({ ...atual, tratamentoId: evento.target.value }))
              }
              className={juntar(
                'rounded-[var(--radius-sistema)] border bg-[var(--color-superficie-alta)]',
                'px-3 py-2.5 text-base text-[var(--color-texto)] transition-colors duration-150',
                erros.tratamentoId
                  ? 'border-[var(--color-risco-vermelho)]'
                  : 'border-[var(--color-borda-forte)] focus:border-[var(--color-texto-suave)]',
              )}
            >
              <option value="">Selecione…</option>
              {tratamentosDisponiveis.map((tratamento) => (
                <option key={tratamento.id} value={tratamento.id}>
                  {tratamento.pacienteNome}, {tratamento.protocolo.nome}
                </option>
              ))}
            </select>
            {erros.tratamentoId && (
              <p role="alert" className="text-xs text-[var(--color-risco-vermelho)]">
                {erros.tratamentoId}
              </p>
            )}
          </div>

          <Campo
            rotulo="Número do ciclo *"
            type="number"
            min={1}
            step={1}
            mono
            value={formulario.numero}
            onChange={(evento) => setFormulario((atual) => ({ ...atual, numero: evento.target.value }))}
            erro={erros.numero}
          />

          <Campo
            rotulo="Data da sessão realizada *"
            type="date"
            value={formulario.dataDaSessao}
            onChange={(evento) =>
              setFormulario((atual) => ({ ...atual, dataDaSessao: evento.target.value }))
            }
            erro={erros.dataDaSessao}
          />

          <Campo
            rotulo="Previsão da próxima sessão"
            ajuda="É previsão, não compromisso agendado; a data real depende de exame, de contagem de leucócitos e da agenda do serviço. Deixe em branco se ainda não houver previsão."
            type="date"
            mono
            value={formulario.previsaoDaProxima}
            onChange={(evento) =>
              setFormulario((atual) => ({ ...atual, previsaoDaProxima: evento.target.value }))
            }
          />
        </form>
      </Modal>
    </>
  );
}
