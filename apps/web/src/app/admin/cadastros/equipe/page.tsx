'use client';

/**
 * Cadastro de equipe — profissionais e usuários do sistema.
 *
 * Não existe endpoint de escrita para profissional — a API só devolve o que veio
 * do seed. Esta tela guarda o cadastro em estado local e diz isso a cada envio.
 *
 * A regra do produto que a tela precisa deixar visível: quem edita o algoritmo
 * não atende plantão. São responsabilidades separadas de propósito, e a API
 * recusa a chamada cruzada com 403 — o formulário bloqueia a combinação antes de
 * o admin descobrir isso do jeito difícil.
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
import { ROTULO_DA_FUNCAO } from '@/sistema/formato';
import type { FuncaoProfissional, Permissao } from '@/sistema/tipos';

/* ==========================================================================
   Dados — sintéticos, locais, sem servidor
   ========================================================================== */

interface ProfissionalCadastrado {
  readonly id: string;
  readonly nome: string;
  readonly funcao: FuncaoProfissional;
  readonly registroDoConselho: string;
  readonly email: string;
  readonly permissoes: readonly Permissao[];
}

const SEMENTE_DE_PROFISSIONAIS: readonly ProfissionalCadastrado[] = [
  {
    id: 'prof-seed-1',
    nome: 'Enfermeira de demonstração',
    funcao: 'ENFERMEIRO',
    registroDoConselho: 'COREN-XX 000000',
    email: 'enfermagem@aurea.local',
    permissoes: ['ATENDER_PLANTAO', 'VER_HISTORICO_DE_PACIENTE', 'REGISTRAR_INTERVENCAO'],
  },
  {
    id: 'prof-seed-2',
    nome: 'Orientador de demonstração',
    funcao: 'MEDICO',
    registroDoConselho: 'CRM-XX 000000',
    email: 'admin@aurea.local',
    permissoes: [
      'EDITAR_ALGORITMO',
      'PUBLICAR_ALGORITMO',
      'EDITAR_ORIENTACAO',
      'GERENCIAR_CADASTROS',
      'GERENCIAR_USUARIOS',
      'EXPORTAR_CONJUNTO_DE_PESQUISA',
    ],
  },
  {
    id: 'prof-seed-3',
    nome: 'Nutricionista de demonstração',
    funcao: 'NUTRICIONISTA',
    registroDoConselho: 'CRN-XX 000000',
    email: 'nutricao@aurea.local',
    permissoes: ['VER_HISTORICO_DE_PACIENTE'],
  },
];

const OPCOES_DE_FUNCAO: readonly FuncaoProfissional[] = [
  'MEDICO',
  'ENFERMEIRO',
  'TECNICO_DE_ENFERMAGEM',
  'NUTRICIONISTA',
  'PSICOLOGO',
];

interface DefinicaoDePermissao {
  readonly permissao: Permissao;
  readonly rotulo: string;
  readonly explicacao: string;
}

const PERMISSOES: readonly DefinicaoDePermissao[] = [
  {
    permissao: 'ATENDER_PLANTAO',
    rotulo: 'Atender plantão',
    explicacao: 'Vê e responde pacientes no painel de plantão.',
  },
  {
    permissao: 'VER_HISTORICO_DE_PACIENTE',
    rotulo: 'Ver histórico de paciente',
    explicacao: 'Consulta o histórico de check-ins e classificações de um paciente.',
  },
  {
    permissao: 'REGISTRAR_INTERVENCAO',
    rotulo: 'Registrar intervenção',
    explicacao: 'Registra a conduta tomada depois de um contato com o paciente.',
  },
  {
    permissao: 'EDITAR_ALGORITMO',
    rotulo: 'Editar algoritmo',
    explicacao: 'Cria e altera rascunhos de conjuntos de limiares e regras.',
  },
  {
    permissao: 'PUBLICAR_ALGORITMO',
    rotulo: 'Publicar algoritmo',
    explicacao: 'Publica um conjunto de limiares como o ativo em produção.',
  },
  {
    permissao: 'EDITAR_ORIENTACAO',
    rotulo: 'Editar orientação',
    explicacao: 'Escreve e altera os textos de orientação mostrados ao paciente.',
  },
  {
    permissao: 'GERENCIAR_CADASTROS',
    rotulo: 'Gerenciar cadastros',
    explicacao: 'Cadastra pacientes, equipe, tratamentos, ciclos e prescrições.',
  },
  {
    permissao: 'GERENCIAR_USUARIOS',
    rotulo: 'Gerenciar usuários',
    explicacao: 'Cria e altera contas de acesso da equipe.',
  },
  {
    permissao: 'EXPORTAR_CONJUNTO_DE_PESQUISA',
    rotulo: 'Exportar conjunto de pesquisa',
    explicacao: 'Exporta dados anonimizados para pesquisa.',
  },
];

function comAtraso<T>(valor: T, ms = 220): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), ms));
}

/* ==========================================================================
   Formulário
   ========================================================================== */

interface FormularioDeProfissional {
  nome: string;
  funcao: FuncaoProfissional;
  registroDoConselho: string;
  email: string;
  permissoes: readonly Permissao[];
}

const FORMULARIO_VAZIO: FormularioDeProfissional = {
  nome: '',
  funcao: 'MEDICO',
  registroDoConselho: '',
  email: '',
  permissoes: [],
};

type ErrosDoFormulario = Partial<
  Record<'nome' | 'registroDoConselho' | 'email' | 'permissoes', string>
>;

const PADRAO_DE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function temConflito(permissoes: readonly Permissao[]): boolean {
  return permissoes.includes('EDITAR_ALGORITMO') && permissoes.includes('ATENDER_PLANTAO');
}

function validar(formulario: FormularioDeProfissional): ErrosDoFormulario {
  const erros: ErrosDoFormulario = {};

  if (!formulario.nome.trim()) erros.nome = 'Informe o nome completo.';
  if (!formulario.registroDoConselho.trim()) {
    erros.registroDoConselho = 'Informe o registro do conselho.';
  }
  if (!formulario.email.trim()) {
    erros.email = 'Informe o e-mail.';
  } else if (!PADRAO_DE_EMAIL.test(formulario.email.trim())) {
    erros.email = 'E-mail inválido.';
  }
  if (temConflito(formulario.permissoes)) {
    erros.permissoes = 'Remova uma das duas permissões em conflito antes de salvar.';
  }

  return erros;
}

/* ==========================================================================
   Página
   ========================================================================== */

type EstadoDeCarregamento = 'carregando' | 'pronto' | 'erro';

export default function PaginaDeEquipe() {
  const [estado, setEstado] = useState<EstadoDeCarregamento>('carregando');
  const [profissionais, setProfissionais] = useState<readonly ProfissionalCadastrado[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [formulario, setFormulario] = useState<FormularioDeProfissional>(FORMULARIO_VAZIO);
  const [erros, setErros] = useState<ErrosDoFormulario>({});
  const [enviando, setEnviando] = useState(false);
  const [avisoDeGravacao, setAvisoDeGravacao] = useState(false);

  useEffect(() => {
    comAtraso(SEMENTE_DE_PROFISSIONAIS)
      .then((dados) => {
        setProfissionais(dados);
        setEstado('pronto');
      })
      .catch(() => setEstado('erro'));
  }, []);

  const conflitoAtivo = useMemo(() => temConflito(formulario.permissoes), [formulario.permissoes]);

  function abrirModal() {
    setFormulario(FORMULARIO_VAZIO);
    setErros({});
    setModalAberto(true);
  }

  function fecharModal() {
    if (enviando) return;
    setModalAberto(false);
  }

  function alternarPermissao(permissao: Permissao) {
    setFormulario((atual) => ({
      ...atual,
      permissoes: atual.permissoes.includes(permissao)
        ? atual.permissoes.filter((item) => item !== permissao)
        : [...atual.permissoes, permissao],
    }));
  }

  async function enviar() {
    const errosEncontrados = validar(formulario);
    setErros(errosEncontrados);
    if (Object.keys(errosEncontrados).length > 0) return;

    setEnviando(true);
    const novoProfissional: ProfissionalCadastrado = await comAtraso(
      {
        id: crypto.randomUUID(),
        nome: formulario.nome.trim(),
        funcao: formulario.funcao,
        registroDoConselho: formulario.registroDoConselho.trim(),
        email: formulario.email.trim(),
        permissoes: formulario.permissoes,
      },
      420,
    );

    setProfissionais((atual) => [novoProfissional, ...atual]);
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
          { rotulo: 'Equipe' },
        ]}
        titulo="Equipe"
        descricao="Profissionais e usuários do sistema, com função e permissões de acesso."
        acao={<Botao onClick={abrirModal}>Novo profissional</Botao>}
      />

      {avisoDeGravacao && (
        <div className="mb-6">
          <Aviso tom="informacao" titulo="Profissional adicionado apenas à lista local">
            <div className="flex items-center justify-between gap-4">
              <span>
                Nada foi gravado no servidor — a API não tem endpoint de escrita para profissional
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
        <Aviso tom="grave" titulo="Não foi possível carregar a equipe">
          Tente novamente em instantes.
        </Aviso>
      )}

      {estado === 'pronto' && profissionais.length === 0 && (
        <EstadoVazio
          titulo="Nenhum profissional cadastrado"
          descricao="Cadastre o primeiro profissional para começar."
          acao={<Botao onClick={abrirModal}>Novo profissional</Botao>}
        />
      )}

      {estado === 'pronto' && profissionais.length > 0 && (
        <>
          <LinhaDeIndicadores>
            <CartaoDeIndicador rotulo="Profissionais cadastrados" valor={profissionais.length} tom="neutro" />
            <CartaoDeIndicador
              rotulo="Atendem plantão"
              valor={profissionais.filter((p) => p.permissoes.includes('ATENDER_PLANTAO')).length}
              tom="neutro"
            />
          </LinhaDeIndicadores>

          <Bloco
            titulo="Todos os profissionais"
            descricao="Função e registro de conselho de cada profissional cadastrado."
            semPadding
          >
            <Tabela rotulo="Profissionais cadastrados">
              <CabecalhoDaTabela colunas={['Nome', 'Função', 'Registro do conselho', 'E-mail']} />
              <tbody>
                {profissionais.map((profissional) => (
                  <LinhaDaTabela key={profissional.id}>
                    <Celula>{profissional.nome}</Celula>
                    <Celula>{ROTULO_DA_FUNCAO[profissional.funcao]}</Celula>
                    <Celula mono>{profissional.registroDoConselho}</Celula>
                    <Celula>{profissional.email}</Celula>
                  </LinhaDaTabela>
                ))}
              </tbody>
            </Tabela>
          </Bloco>
        </>
      )}

      <Modal
        aberto={modalAberto}
        titulo="Novo profissional"
        descricao="Todos os campos marcados com * são obrigatórios. Dado sintético — não é gravado no servidor."
        aoFechar={fecharModal}
        rodape={
          <>
            <Botao variante="secundario" onClick={fecharModal} disabled={enviando}>
              Cancelar
            </Botao>
            <Botao onClick={enviar} disabled={enviando || conflitoAtivo}>
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
            onChange={(evento) => setFormulario((atual) => ({ ...atual, nome: evento.target.value }))}
            erro={erros.nome}
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="profissional-funcao" className="text-sm font-medium text-[var(--color-texto)]">
              Função *
            </label>
            <select
              id="profissional-funcao"
              value={formulario.funcao}
              onChange={(evento) =>
                setFormulario((atual) => ({ ...atual, funcao: evento.target.value as FuncaoProfissional }))
              }
              className={juntar(
                'rounded-[var(--radius-sistema)] border border-[var(--color-borda-forte)] bg-[var(--color-superficie-alta)]',
                'px-3 py-2.5 text-base text-[var(--color-texto)] transition-colors duration-150',
                'focus:border-[var(--color-texto-suave)]',
              )}
            >
              {OPCOES_DE_FUNCAO.map((funcao) => (
                <option key={funcao} value={funcao}>
                  {ROTULO_DA_FUNCAO[funcao]}
                </option>
              ))}
            </select>
          </div>

          <Campo
            rotulo="Registro do conselho *"
            placeholder="Ex.: CRM-XX 000000"
            value={formulario.registroDoConselho}
            onChange={(evento) =>
              setFormulario((atual) => ({ ...atual, registroDoConselho: evento.target.value }))
            }
            erro={erros.registroDoConselho}
          />

          <Campo
            rotulo="E-mail *"
            type="email"
            value={formulario.email}
            onChange={(evento) => setFormulario((atual) => ({ ...atual, email: evento.target.value }))}
            erro={erros.email}
          />

          <fieldset className="flex flex-col gap-3 rounded-[var(--radius-sistema)] border border-[var(--color-borda)] p-3">
            <legend className="px-1 text-sm font-medium text-[var(--color-texto)]">Permissões</legend>

            {PERMISSOES.map(({ permissao, rotulo, explicacao }) => (
              <label key={permissao} className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-superficie-invertida)]"
                  checked={formulario.permissoes.includes(permissao)}
                  onChange={() => alternarPermissao(permissao)}
                />
                <span>
                  <span className="block text-sm font-medium text-[var(--color-texto)]">{rotulo}</span>
                  <span className="block text-xs text-[var(--color-texto-suave)]">{explicacao}</span>
                </span>
              </label>
            ))}

            {conflitoAtivo && (
              <Aviso tom="atencao" titulo="Conflito de permissões">
                Quem edita o algoritmo não atende plantão — são responsabilidades separadas de
                propósito, e a API recusa a chamada cruzada com 403. Desmarque uma das duas antes
                de salvar.
              </Aviso>
            )}
            {erros.permissoes && !conflitoAtivo && (
              <p role="alert" className="text-xs text-[var(--color-risco-vermelho)]">
                {erros.permissoes}
              </p>
            )}
          </fieldset>
        </form>
      </Modal>
    </>
  );
}
