'use client';

/**
 * Cadastro de prescrições.
 *
 * Não existe endpoint de escrita para prescrição — a API só devolve o que veio
 * do seed. Esta tela guarda o cadastro em estado local e diz isso a cada envio.
 *
 * O medicamento vem de `buscarMedicamentos()`, a mesma fronteira que o resto do
 * sistema usa — trocar a origem na Onda F não muda esta tela. O paciente é texto
 * livre: os cinco cadastros desta onda ainda não compartilham uma base de dados
 * entre si.
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
import { ErroDaFonte, buscarMedicamentos } from '@/sistema/fonte';
import type { Medicamento } from '@/sistema/tipos';

/* ==========================================================================
   Dados — sintéticos, locais, sem servidor
   ========================================================================== */

interface PrescricaoCadastrada {
  readonly id: string;
  readonly pacienteNome: string;
  readonly medicamentoNome: string;
  readonly dose: string;
  readonly via: string;
  readonly posologia: string;
  readonly periodoInicio: string;
  readonly periodoFim: string | null;
}

const SEMENTE_DE_PRESCRICOES: readonly PrescricaoCadastrada[] = [
  {
    id: 'presc-seed-1',
    pacienteNome: 'Marta Ferreira (fictícia)',
    medicamentoNome: 'Ondansetrona',
    dose: '8 mg',
    via: 'Oral',
    posologia: '1 comprimido a cada 8 horas, se náusea',
    periodoInicio: '2026-05-31T12:00:00.000Z',
    periodoFim: null,
  },
  {
    id: 'presc-seed-2',
    pacienteNome: 'Antônio Reis (fictício)',
    medicamentoNome: 'Loperamida',
    dose: '2 mg',
    via: 'Oral',
    posologia: '1 cápsula após cada evacuação líquida, máximo 4 por dia',
    periodoInicio: '2026-03-10T12:00:00.000Z',
    periodoFim: '2026-03-17T12:00:00.000Z',
  },
];

function comAtraso<T>(valor: T, ms = 220): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), ms));
}

/* ==========================================================================
   Formulário
   ========================================================================== */

interface FormularioDePrescricao {
  pacienteNome: string;
  medicamentoId: string;
  dose: string;
  via: string;
  posologia: string;
  periodoInicio: string;
  periodoFim: string;
}

const FORMULARIO_VAZIO: FormularioDePrescricao = {
  pacienteNome: '',
  medicamentoId: '',
  dose: '',
  via: '',
  posologia: '',
  periodoInicio: '',
  periodoFim: '',
};

type ErrosDoFormulario = Partial<Record<keyof FormularioDePrescricao, string>>;

function validar(formulario: FormularioDePrescricao): ErrosDoFormulario {
  const erros: ErrosDoFormulario = {};
  if (!formulario.pacienteNome.trim()) erros.pacienteNome = 'Informe o nome do paciente.';
  if (!formulario.medicamentoId) erros.medicamentoId = 'Selecione um medicamento.';
  if (!formulario.dose.trim()) erros.dose = 'Informe a dose.';
  if (!formulario.via.trim()) erros.via = 'Informe a via.';
  if (!formulario.posologia.trim()) erros.posologia = 'Informe a posologia.';
  if (!formulario.periodoInicio) erros.periodoInicio = 'Informe o início do período.';
  if (
    formulario.periodoInicio &&
    formulario.periodoFim &&
    formulario.periodoFim < formulario.periodoInicio
  ) {
    erros.periodoFim = 'O fim do período não pode vir antes do início.';
  }
  return erros;
}

/* ==========================================================================
   Página
   ========================================================================== */

type EstadoDeCarregamento = 'carregando' | 'pronto' | 'erro';

export default function PaginaDePrescricoes() {
  const [estado, setEstado] = useState<EstadoDeCarregamento>('carregando');
  const [mensagemDeErro, setMensagemDeErro] = useState<string | null>(null);
  const [medicamentos, setMedicamentos] = useState<readonly Medicamento[]>([]);
  const [prescricoes, setPrescricoes] = useState<readonly PrescricaoCadastrada[]>([]);

  const [modalAberto, setModalAberto] = useState(false);
  const [formulario, setFormulario] = useState<FormularioDePrescricao>(FORMULARIO_VAZIO);
  const [erros, setErros] = useState<ErrosDoFormulario>({});
  const [enviando, setEnviando] = useState(false);
  const [avisoDeGravacao, setAvisoDeGravacao] = useState(false);

  useEffect(() => {
    carregar();
  }, []);

  function carregar() {
    setEstado('carregando');
    setMensagemDeErro(null);
    Promise.all([buscarMedicamentos(), comAtraso(SEMENTE_DE_PRESCRICOES)])
      .then(([medicamentosCarregados, prescricoesCarregadas]) => {
        setMedicamentos(medicamentosCarregados);
        setPrescricoes(prescricoesCarregadas);
        setEstado('pronto');
      })
      .catch((erro: unknown) => {
        setMensagemDeErro(
          erro instanceof ErroDaFonte ? erro.message : 'Não foi possível carregar os medicamentos.',
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

  function selecionarMedicamento(medicamentoId: string) {
    setFormulario((atual) => ({
      ...atual,
      medicamentoId,
    }));
  }

  async function enviar() {
    const errosEncontrados = validar(formulario);
    setErros(errosEncontrados);
    if (Object.keys(errosEncontrados).length > 0) return;

    const medicamento = medicamentos.find((item) => item.id === formulario.medicamentoId);
    if (!medicamento) return;

    setEnviando(true);
    const novaPrescricao: PrescricaoCadastrada = await comAtraso(
      {
        id: crypto.randomUUID(),
        pacienteNome: formulario.pacienteNome.trim(),
        medicamentoNome: medicamento.nome,
        dose: formulario.dose.trim(),
        via: formulario.via.trim(),
        posologia: formulario.posologia.trim(),
        periodoInicio: `${formulario.periodoInicio}T12:00:00.000Z`,
        periodoFim: formulario.periodoFim ? `${formulario.periodoFim}T12:00:00.000Z` : null,
      },
      420,
    );

    setPrescricoes((atual) => [novaPrescricao, ...atual]);
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
          { rotulo: 'Prescrições' },
        ]}
        titulo="Prescrições"
        descricao="Associa um medicamento, dose, via e posologia a um paciente."
        acao={
          <Botao onClick={abrirModal} disabled={estado !== 'pronto'}>
            Nova prescrição
          </Botao>
        }
      />

      {avisoDeGravacao && (
        <div className="mb-6">
          <Aviso tom="informacao" titulo="Prescrição adicionada apenas à lista local">
            <div className="flex items-center justify-between gap-4">
              <span>
                Nada foi gravado no servidor; a API não tem endpoint de escrita para prescrição
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
        <Aviso tom="grave" titulo="Não foi possível carregar as prescrições">
          <div className="flex items-center justify-between gap-4">
            <span>{mensagemDeErro}</span>
            <Botao variante="secundario" tamanho="compacto" onClick={carregar}>
              Tentar novamente
            </Botao>
          </div>
        </Aviso>
      )}

      {estado === 'pronto' && prescricoes.length === 0 && (
        <EstadoVazio
          titulo="Nenhuma prescrição cadastrada"
          descricao="Cadastre a primeira prescrição para começar."
          acao={<Botao onClick={abrirModal}>Nova prescrição</Botao>}
        />
      )}

      {estado === 'pronto' && prescricoes.length > 0 && (
        <>
          <LinhaDeIndicadores>
            <CartaoDeIndicador rotulo="Prescrições cadastradas" valor={prescricoes.length} tom="neutro" />
            <CartaoDeIndicador
              rotulo="Ativas (sem fim definido)"
              valor={prescricoes.filter((p) => p.periodoFim === null).length}
              tom="neutro"
            />
          </LinhaDeIndicadores>

          <Bloco
            titulo="Todas as prescrições"
            descricao="Medicamento, dose, via e posologia de cada prescrição cadastrada."
            semPadding
          >
            <Tabela rotulo="Prescrições cadastradas">
              <CabecalhoDaTabela colunas={['Paciente', 'Medicamento', 'Dose', 'Via', 'Posologia']} />
              <tbody>
                {prescricoes.map((prescricao) => (
                  <LinhaDaTabela key={prescricao.id}>
                    <Celula>{prescricao.pacienteNome}</Celula>
                    <Celula>{prescricao.medicamentoNome}</Celula>
                    <Celula mono>{prescricao.dose}</Celula>
                    <Celula>{prescricao.via}</Celula>
                    <Celula>{prescricao.posologia}</Celula>
                  </LinhaDaTabela>
                ))}
              </tbody>
            </Tabela>
          </Bloco>
        </>
      )}

      <Modal
        aberto={modalAberto}
        titulo="Nova prescrição"
        descricao="Todos os campos marcados com * são obrigatórios. Dado sintético, não é gravado no servidor."
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
          className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto pr-1"
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
            <label htmlFor="prescricao-medicamento" className="text-sm font-medium text-[var(--color-texto)]">
              Medicamento *
            </label>
            <select
              id="prescricao-medicamento"
              value={formulario.medicamentoId}
              onChange={(evento) => selecionarMedicamento(evento.target.value)}
              className={juntar(
                'rounded-[var(--radius-sistema)] border bg-[var(--color-superficie-alta)]',
                'px-3 py-2.5 text-base text-[var(--color-texto)] transition-colors duration-150',
                erros.medicamentoId
                  ? 'border-[var(--color-risco-vermelho)]'
                  : 'border-[var(--color-borda-forte)] focus:border-[var(--color-texto-suave)]',
              )}
            >
              <option value="">Selecione…</option>
              {medicamentos.map((medicamento) => (
                <option key={medicamento.id} value={medicamento.id}>
                  {medicamento.nome}
                  {medicamento.principioAtivo ? ` (${medicamento.principioAtivo})` : ''}
                </option>
              ))}
            </select>
            {erros.medicamentoId && (
              <p role="alert" className="text-xs text-[var(--color-risco-vermelho)]">
                {erros.medicamentoId}
              </p>
            )}
          </div>

          <Campo
            rotulo="Dose *"
            placeholder="Ex.: 8 mg"
            mono
            value={formulario.dose}
            onChange={(evento) => setFormulario((atual) => ({ ...atual, dose: evento.target.value }))}
            erro={erros.dose}
          />

          <Campo
            rotulo="Via *"
            placeholder="Ex.: Oral"
            value={formulario.via}
            onChange={(evento) => setFormulario((atual) => ({ ...atual, via: evento.target.value }))}
            erro={erros.via}
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="prescricao-posologia" className="text-sm font-medium text-[var(--color-texto)]">
              Posologia *
            </label>
            <textarea
              id="prescricao-posologia"
              rows={3}
              placeholder="Ex.: 1 comprimido a cada 8 horas, se náusea"
              value={formulario.posologia}
              onChange={(evento) =>
                setFormulario((atual) => ({ ...atual, posologia: evento.target.value }))
              }
              aria-invalid={erros.posologia ? true : undefined}
              className={juntar(
                'rounded-[var(--radius-sistema)] border bg-[var(--color-superficie-alta)]',
                'px-3 py-2.5 text-base text-[var(--color-texto)] transition-colors duration-150',
                erros.posologia
                  ? 'border-[var(--color-risco-vermelho)]'
                  : 'border-[var(--color-borda-forte)] focus:border-[var(--color-texto-suave)]',
              )}
            />
            {erros.posologia && (
              <p role="alert" className="text-xs text-[var(--color-risco-vermelho)]">
                {erros.posologia}
              </p>
            )}
          </div>

          <Campo
            rotulo="Início do período *"
            type="date"
            value={formulario.periodoInicio}
            onChange={(evento) =>
              setFormulario((atual) => ({ ...atual, periodoInicio: evento.target.value }))
            }
            erro={erros.periodoInicio}
          />

          <Campo
            rotulo="Fim do período"
            ajuda="Deixe em branco para uso contínuo ou conforme necessário."
            type="date"
            value={formulario.periodoFim}
            onChange={(evento) =>
              setFormulario((atual) => ({ ...atual, periodoFim: evento.target.value }))
            }
            erro={erros.periodoFim}
          />
        </form>
      </Modal>
    </>
  );
}
