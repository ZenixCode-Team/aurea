'use client';

/**
 * Cadastro de pacientes.
 *
 * Não existe endpoint de escrita para paciente — a API só devolve o que veio do
 * seed. Esta tela guarda o que for cadastrado em estado local, do jeito que vai
 * funcionar de fato quando a Onda F ligar a gravação, e diz isso a cada envio.
 *
 * ⚠️ Todo dado aqui é sintético até a aprovação do Comitê de Ética. Nome, CPF e
 * diagnóstico de pessoa real não entram no sistema antes disso — vale para tela,
 * print e apresentação.
 *
 * Composição conforme o ADR-004: cabeçalho com trilha e contexto, linha de
 * indicadores e a lista dentro de um bloco identificado.
 */

import { cpfEhValido } from '@aurea/contratos';
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
import { calcularIdade, formatarCpf } from '@/sistema/formato';
import type { Contato, Sexo } from '@/sistema/tipos';

/* ==========================================================================
   Dados — sintéticos, locais, sem servidor
   ========================================================================== */

interface PacienteCadastrado {
  readonly id: string;
  readonly nome: string;
  readonly cpf: string;
  readonly dataNascimento: string;
  readonly sexo: Sexo;
  readonly diagnostico: string;
  readonly convenio: string | null;
  readonly tipoSanguineo: string | null;
  readonly habitoIntestinalBasal: number | null;
  readonly protocolo: string | null;
  readonly contatoDoPaciente: Contato | null;
  readonly contatoDeEmergencia: Contato | null;
}

const ROTULO_DO_SEXO: Record<Sexo, string> = {
  FEMININO: 'Feminino',
  MASCULINO: 'Masculino',
  OUTRO: 'Outro',
  NAO_INFORMADO: 'Não informado',
};

const SEMENTE_DE_PACIENTES: readonly PacienteCadastrado[] = [
  {
    id: 'pac-seed-1',
    nome: 'Marta Ferreira (fictícia)',
    cpf: '12345678909',
    dataNascimento: '1968-03-11T12:00:00.000Z',
    sexo: 'FEMININO',
    diagnostico: 'Diagnóstico sintético de demonstração',
    convenio: null,
    tipoSanguineo: 'O+',
    habitoIntestinalBasal: 1,
    protocolo: 'Protocolo de demonstração',
    contatoDoPaciente: { id: 'ct-1', nome: 'Marta Ferreira (fictícia)', telefone: '11988887777', relacao: 'Própria' },
    contatoDeEmergencia: { id: 'ct-2', nome: 'João Ferreira (fictício)', telefone: '11988886666', relacao: 'Filho' },
  },
  {
    id: 'pac-seed-2',
    nome: 'Antônio Reis (fictício)',
    cpf: '98765432100',
    dataNascimento: '1975-11-02T12:00:00.000Z',
    sexo: 'MASCULINO',
    diagnostico: 'Diagnóstico sintético de demonstração',
    convenio: 'Convênio sintético',
    tipoSanguineo: 'A+',
    habitoIntestinalBasal: 2,
    protocolo: 'AC-T (demonstração)',
    contatoDoPaciente: { id: 'ct-3', nome: 'Antônio Reis (fictício)', telefone: '11977776666', relacao: 'Próprio' },
    contatoDeEmergencia: { id: 'ct-4', nome: 'Cecília Reis (fictícia)', telefone: '11977775555', relacao: 'Esposa' },
  },
  {
    id: 'pac-seed-3',
    nome: 'Iris Costa (fictícia)',
    cpf: '11144477735',
    dataNascimento: '1990-06-20T12:00:00.000Z',
    sexo: 'FEMININO',
    diagnostico: 'Diagnóstico sintético de demonstração',
    convenio: null,
    tipoSanguineo: null,
    habitoIntestinalBasal: null,
    protocolo: null,
    contatoDoPaciente: { id: 'ct-5', nome: 'Iris Costa (fictícia)', telefone: '11966665555', relacao: 'Própria' },
    contatoDeEmergencia: { id: 'ct-6', nome: 'Beatriz Costa (fictícia)', telefone: '11966664444', relacao: 'Irmã' },
  },
];

function comAtraso<T>(valor: T, ms = 220): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), ms));
}

/* ==========================================================================
   Formulário
   ========================================================================== */

interface FormularioDePaciente {
  nome: string;
  cpf: string;
  dataNascimento: string;
  sexo: Sexo;
  diagnostico: string;
  convenio: string;
  tipoSanguineo: string;
  habitoIntestinalBasal: string;
  contatoPacienteNome: string;
  contatoPacienteTelefone: string;
  contatoPacienteRelacao: string;
  contatoEmergenciaNome: string;
  contatoEmergenciaTelefone: string;
  contatoEmergenciaRelacao: string;
}

const FORMULARIO_VAZIO: FormularioDePaciente = {
  nome: '',
  cpf: '',
  dataNascimento: '',
  sexo: 'NAO_INFORMADO',
  diagnostico: '',
  convenio: '',
  tipoSanguineo: '',
  habitoIntestinalBasal: '',
  contatoPacienteNome: '',
  contatoPacienteTelefone: '',
  contatoPacienteRelacao: '',
  contatoEmergenciaNome: '',
  contatoEmergenciaTelefone: '',
  contatoEmergenciaRelacao: '',
};

type ErrosDoFormulario = Partial<Record<keyof FormularioDePaciente, string>>;

function validar(formulario: FormularioDePaciente): ErrosDoFormulario {
  const erros: ErrosDoFormulario = {};

  if (!formulario.nome.trim()) erros.nome = 'Informe o nome completo.';

  if (!formulario.cpf.trim()) {
    erros.cpf = 'Informe o CPF.';
  } else if (!cpfEhValido(formulario.cpf)) {
    erros.cpf = 'CPF inválido — confira os dígitos.';
  }

  if (!formulario.dataNascimento) {
    erros.dataNascimento = 'Informe a data de nascimento.';
  } else if (new Date(formulario.dataNascimento) > new Date()) {
    erros.dataNascimento = 'A data de nascimento não pode estar no futuro.';
  }

  if (!formulario.diagnostico.trim()) erros.diagnostico = 'Informe o diagnóstico.';

  if (formulario.habitoIntestinalBasal.trim()) {
    const numero = Number(formulario.habitoIntestinalBasal);
    if (!Number.isInteger(numero) || numero < 0) {
      erros.habitoIntestinalBasal = 'Informe um número inteiro maior ou igual a zero.';
    }
  }

  if (!formulario.contatoPacienteNome.trim()) erros.contatoPacienteNome = 'Informe o nome do contato.';
  if (!formulario.contatoPacienteTelefone.trim()) {
    erros.contatoPacienteTelefone = 'Informe o telefone do contato.';
  }

  if (!formulario.contatoEmergenciaNome.trim()) {
    erros.contatoEmergenciaNome = 'Informe o nome do contato de emergência.';
  }
  if (!formulario.contatoEmergenciaTelefone.trim()) {
    erros.contatoEmergenciaTelefone = 'Informe o telefone do contato de emergência.';
  }

  return erros;
}

function CampoDeSelecao({
  rotulo,
  id,
  valor,
  aoMudar,
  opcoes,
}: {
  rotulo: string;
  id: string;
  valor: string;
  aoMudar(valor: string): void;
  opcoes: readonly { valor: string; rotulo: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-[var(--color-texto)]">
        {rotulo}
      </label>
      <select
        id={id}
        value={valor}
        onChange={(evento) => aoMudar(evento.target.value)}
        className={juntar(
          'rounded-[var(--radius-sistema)] border border-[var(--color-borda-forte)] bg-[var(--color-superficie-alta)]',
          'px-3 py-2.5 text-base text-[var(--color-texto)] transition-colors duration-150',
          'focus:border-[var(--color-texto-suave)]',
        )}
      >
        {opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ==========================================================================
   Página
   ========================================================================== */

type EstadoDeCarregamento = 'carregando' | 'pronto' | 'erro';

export default function PaginaDePacientes() {
  const [estado, setEstado] = useState<EstadoDeCarregamento>('carregando');
  const [pacientes, setPacientes] = useState<readonly PacienteCadastrado[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [formulario, setFormulario] = useState<FormularioDePaciente>(FORMULARIO_VAZIO);
  const [erros, setErros] = useState<ErrosDoFormulario>({});
  const [enviando, setEnviando] = useState(false);
  const [avisoDeGravacao, setAvisoDeGravacao] = useState(false);

  useEffect(() => {
    comAtraso(SEMENTE_DE_PACIENTES)
      .then((dados) => {
        setPacientes(dados);
        setEstado('pronto');
      })
      .catch(() => setEstado('erro'));
  }, []);

  function abrirModal() {
    setFormulario(FORMULARIO_VAZIO);
    setErros({});
    setModalAberto(true);
  }

  function fecharModal() {
    if (enviando) return;
    setModalAberto(false);
  }

  function definirCampo<C extends keyof FormularioDePaciente>(campo: C, valor: FormularioDePaciente[C]) {
    setFormulario((atual) => ({ ...atual, [campo]: valor }));
  }

  async function enviar() {
    const errosEncontrados = validar(formulario);
    setErros(errosEncontrados);
    if (Object.keys(errosEncontrados).length > 0) return;

    setEnviando(true);
    const novoPaciente: PacienteCadastrado = await comAtraso(
      {
        id: crypto.randomUUID(),
        nome: formulario.nome.trim(),
        cpf: formulario.cpf.replace(/\D/g, ''),
        dataNascimento: `${formulario.dataNascimento}T12:00:00.000Z`,
        sexo: formulario.sexo,
        diagnostico: formulario.diagnostico.trim(),
        convenio: formulario.convenio.trim() || null,
        tipoSanguineo: formulario.tipoSanguineo.trim() || null,
        habitoIntestinalBasal: formulario.habitoIntestinalBasal.trim()
          ? Number(formulario.habitoIntestinalBasal)
          : null,
        protocolo: null,
        contatoDoPaciente: {
          id: crypto.randomUUID(),
          nome: formulario.contatoPacienteNome.trim(),
          telefone: formulario.contatoPacienteTelefone.trim(),
          relacao: formulario.contatoPacienteRelacao.trim() || null,
        },
        contatoDeEmergencia: {
          id: crypto.randomUUID(),
          nome: formulario.contatoEmergenciaNome.trim(),
          telefone: formulario.contatoEmergenciaTelefone.trim(),
          relacao: formulario.contatoEmergenciaRelacao.trim() || null,
        },
      },
      420,
    );

    setPacientes((atual) => [novoPaciente, ...atual]);
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
          { rotulo: 'Pacientes' },
        ]}
        titulo="Pacientes"
        descricao="Identificação, diagnóstico e contatos da pessoa em tratamento."
        acao={<Botao onClick={abrirModal}>Novo paciente</Botao>}
      />

      <div className="mb-6">
        <Aviso tom="atencao" titulo="Dado sintético até a aprovação do Comitê de Ética">
          Todo paciente listado aqui é fictício. Nome, CPF e diagnóstico de pessoa real não entram
          no sistema antes da aprovação do Comitê de Ética — vale para esta tela, para print e
          para apresentação.
        </Aviso>
      </div>

      {avisoDeGravacao && (
        <div className="mb-6">
          <Aviso tom="informacao" titulo="Paciente adicionado apenas à lista local">
            <div className="flex items-center justify-between gap-4">
              <span>
                Nada foi gravado no servidor — a API não tem endpoint de escrita para paciente
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
        <Aviso tom="grave" titulo="Não foi possível carregar os pacientes">
          Tente novamente em instantes.
        </Aviso>
      )}

      {estado === 'pronto' && pacientes.length === 0 && (
        <EstadoVazio
          titulo="Nenhum paciente cadastrado"
          descricao="Cadastre o primeiro paciente para começar."
          acao={<Botao onClick={abrirModal}>Novo paciente</Botao>}
        />
      )}

      {estado === 'pronto' && pacientes.length > 0 && (
        <>
          <LinhaDeIndicadores>
            <CartaoDeIndicador rotulo="Pacientes cadastrados" valor={pacientes.length} tom="neutro" />
            <CartaoDeIndicador
              rotulo="Com protocolo atribuído"
              valor={pacientes.filter((paciente) => paciente.protocolo !== null).length}
              tom="neutro"
            />
          </LinhaDeIndicadores>

          <Bloco
            titulo="Todos os pacientes"
            descricao="Identificação, diagnóstico e protocolo de cada paciente cadastrado."
            semPadding
          >
            <Tabela rotulo="Pacientes cadastrados">
              <CabecalhoDaTabela colunas={['Nome', 'CPF', 'Idade', 'Diagnóstico', 'Protocolo']} />
              <tbody>
                {pacientes.map((paciente) => (
                  <LinhaDaTabela key={paciente.id}>
                    <Celula>{paciente.nome}</Celula>
                    <Celula mono>{formatarCpf(paciente.cpf)}</Celula>
                    <Celula mono>{calcularIdade(paciente.dataNascimento)}</Celula>
                    <Celula>{paciente.diagnostico}</Celula>
                    <Celula>{paciente.protocolo ?? '—'}</Celula>
                  </LinhaDaTabela>
                ))}
              </tbody>
            </Tabela>
          </Bloco>
        </>
      )}

      <Modal
        aberto={modalAberto}
        titulo="Novo paciente"
        descricao="Todos os campos marcados com * são obrigatórios. Dado sintético — não é gravado no servidor."
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
            rotulo="Nome completo *"
            value={formulario.nome}
            onChange={(evento) => definirCampo('nome', evento.target.value)}
            erro={erros.nome}
          />
          <Campo
            rotulo="CPF *"
            mono
            placeholder="000.000.000-00"
            value={formulario.cpf}
            onChange={(evento) => definirCampo('cpf', evento.target.value)}
            erro={erros.cpf}
          />
          <Campo
            rotulo="Data de nascimento *"
            type="date"
            value={formulario.dataNascimento}
            onChange={(evento) => definirCampo('dataNascimento', evento.target.value)}
            erro={erros.dataNascimento}
          />
          <CampoDeSelecao
            rotulo="Sexo"
            id="paciente-sexo"
            valor={formulario.sexo}
            aoMudar={(valor) => definirCampo('sexo', valor as Sexo)}
            opcoes={Object.entries(ROTULO_DO_SEXO).map(([valor, rotulo]) => ({ valor, rotulo }))}
          />
          <Campo
            rotulo="Diagnóstico *"
            value={formulario.diagnostico}
            onChange={(evento) => definirCampo('diagnostico', evento.target.value)}
            erro={erros.diagnostico}
          />
          <Campo
            rotulo="Convênio"
            value={formulario.convenio}
            onChange={(evento) => definirCampo('convenio', evento.target.value)}
          />
          <Campo
            rotulo="Tipo sanguíneo"
            placeholder="Ex.: O+"
            value={formulario.tipoSanguineo}
            onChange={(evento) => definirCampo('tipoSanguineo', evento.target.value)}
          />
          <Campo
            rotulo="Hábito intestinal basal"
            ajuda="Número de evacuações por dia, antes do tratamento. Serve de referência para avaliar diarreia por comparação depois."
            type="number"
            min={0}
            step={1}
            mono
            value={formulario.habitoIntestinalBasal}
            onChange={(evento) => definirCampo('habitoIntestinalBasal', evento.target.value)}
            erro={erros.habitoIntestinalBasal}
          />

          <fieldset className="flex flex-col gap-3 rounded-[var(--radius-sistema)] border border-[var(--color-borda)] p-3">
            <legend className="px-1 text-sm font-medium text-[var(--color-texto)]">
              Contato do paciente
            </legend>
            <Campo
              rotulo="Nome *"
              value={formulario.contatoPacienteNome}
              onChange={(evento) => definirCampo('contatoPacienteNome', evento.target.value)}
              erro={erros.contatoPacienteNome}
            />
            <Campo
              rotulo="Telefone *"
              mono
              placeholder="(00) 00000-0000"
              value={formulario.contatoPacienteTelefone}
              onChange={(evento) => definirCampo('contatoPacienteTelefone', evento.target.value)}
              erro={erros.contatoPacienteTelefone}
            />
            <Campo
              rotulo="Relação"
              placeholder="Ex.: Própria"
              value={formulario.contatoPacienteRelacao}
              onChange={(evento) => definirCampo('contatoPacienteRelacao', evento.target.value)}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-3 rounded-[var(--radius-sistema)] border border-[var(--color-borda)] p-3">
            <legend className="px-1 text-sm font-medium text-[var(--color-texto)]">
              Contato de emergência
            </legend>
            <Campo
              rotulo="Nome *"
              value={formulario.contatoEmergenciaNome}
              onChange={(evento) => definirCampo('contatoEmergenciaNome', evento.target.value)}
              erro={erros.contatoEmergenciaNome}
            />
            <Campo
              rotulo="Telefone *"
              mono
              placeholder="(00) 00000-0000"
              value={formulario.contatoEmergenciaTelefone}
              onChange={(evento) => definirCampo('contatoEmergenciaTelefone', evento.target.value)}
              erro={erros.contatoEmergenciaTelefone}
            />
            <Campo
              rotulo="Relação"
              placeholder="Ex.: Filho"
              value={formulario.contatoEmergenciaRelacao}
              onChange={(evento) => definirCampo('contatoEmergenciaRelacao', evento.target.value)}
            />
          </fieldset>
        </form>
      </Modal>
    </>
  );
}
