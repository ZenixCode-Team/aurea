'use client';

/**
 * Registro operacional do paciente.
 *
 * Existe porque metade das telas da onda E nascia vazia: barreira, pendência,
 * internação e contexto social entravam pela API e não tinham por onde ser
 * preenchidos. Campo que não tem formulário é campo que fica nulo para sempre — e o
 * mapa de barreiras, os alertas de amanhã e a estratificação de risco dependem
 * inteiramente deles.
 *
 * ## Por que fica no prontuário e não na administração
 *
 * Quem descobre que o paciente depende de carona é a enfermagem no telefone, e ela
 * não tem `GERENCIAR_CADASTROS`. Pôr isto atrás do perfil administrativo garantiria
 * que nunca fosse preenchido. Identidade do paciente continua do outro lado.
 *
 * ## ECOG não está aqui
 *
 * É atribuição médica, não observação de plantão. Entra pelo cadastro administrativo.
 * Mostrar o campo aqui convidaria a enfermagem a arbitrar um valor clínico que não é
 * dela, e ECOG errado desloca a estratificação inteira.
 */

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bloco, CabecalhoDePainel } from '@/componentes/sistema/painel';
import {
  Aviso,
  Botao,
  Carregando,
  juntar,
} from '@/componentes/sistema/primitivos';
import {
  ErroDaFonte,
  buscarHistoricoNoPainel,
  registrarBarreira,
  registrarInternacao,
  registrarPendencia,
  resolverBarreira,
  resolverPendencia,
  salvarContextoSocial,
} from '@/sistema/fonte';
import { formatarData } from '@/sistema/formato';
import type { HistoricoDoPaciente } from '@/sistema/tipos';

const TIPOS_DE_BARREIRA = [
  ['TRANSPORTE', 'Transporte'],
  ['AUTORIZACAO', 'Autorização'],
  ['FINANCEIRA', 'Financeira'],
  ['ANSIEDADE', 'Ansiedade'],
  ['REDE_DE_APOIO', 'Rede de apoio'],
  ['DISTANCIA', 'Distância'],
  ['TRABALHO', 'Trabalho'],
  ['OUTRA', 'Outra'],
] as const;

const TIPOS_DE_PENDENCIA = [
  ['EXAME', 'Exame pendente'],
  ['AUTORIZACAO', 'Autorização pendente'],
  ['CONSULTA_MEDICA', 'Consulta médica pendente'],
  ['TOXICIDADE_EM_ACOMPANHAMENTO', 'Toxicidade em acompanhamento'],
  ['INTERNACAO_RECENTE', 'Internação recente'],
  ['OUTRA', 'Outra'],
] as const;

const ROTULO_DA_BARREIRA = Object.fromEntries(TIPOS_DE_BARREIRA);
const ROTULO_DA_PENDENCIA = Object.fromEntries(TIPOS_DE_PENDENCIA);

/** Data de hoje em `yyyy-mm-dd` para `input type="date"`, no fuso do navegador. */
function hojeParaCampo(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

export default function PaginaDeRegistroOperacional({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <Conteudo pacienteId={id} />;
}

function Conteudo({ pacienteId }: { pacienteId: string }) {
  const router = useRouter();
  const [historico, setHistorico] = useState<HistoricoDoPaciente | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroDaGravacao, setErroDaGravacao] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [recarregar, setRecarregar] = useState(0);

  useEffect(() => {
    let cancelado = false;
    buscarHistoricoNoPainel(pacienteId)
      .then((resultado) => {
        if (!cancelado) setHistorico(resultado);
      })
      .catch((motivo: unknown) => {
        if (cancelado) return;
        setErro(
          motivo instanceof ErroDaFonte
            ? motivo.message
            : 'Não foi possível carregar o paciente.',
        );
      });
    return () => {
      cancelado = true;
    };
  }, [pacienteId, recarregar]);

  /**
   * Toda gravação passa por aqui.
   *
   * Recarrega do servidor em vez de atualizar o estado local: o que a tela mostra
   * depois de gravar tem que ser o que o servidor guardou, e não o que o cliente
   * torceu para ter sido guardado. Foi a divergência da tarefa 072.
   */
  async function gravar(acao: () => Promise<void>) {
    setSalvando(true);
    setErroDaGravacao(null);
    try {
      await acao();
      setRecarregar((n) => n + 1);
    } catch (motivo: unknown) {
      setErroDaGravacao(
        motivo instanceof ErroDaFonte
          ? motivo.message
          : 'Não foi possível gravar. Nada foi alterado.',
      );
    } finally {
      setSalvando(false);
    }
  }

  if (erro) {
    return (
      <Aviso tom="grave" titulo="Não foi possível carregar">
        {erro}
      </Aviso>
    );
  }

  if (!historico) return <Carregando />;

  const paciente = historico.paciente;

  return (
    <>
      <CabecalhoDePainel
        trilha={[
          { rotulo: 'Plantão', href: '/painel' },
          { rotulo: paciente.nome, href: `/painel/pacientes/${pacienteId}` },
          { rotulo: 'Registro' },
        ]}
        titulo="Registro operacional"
        descricao="O que a equipe descobre no acompanhamento. Alimenta o mapa de barreiras, os alertas de amanhã e a estratificação de risco."
        acao={
          <Botao
            variante="secundario"
            onClick={() => router.push(`/painel/pacientes/${pacienteId}`)}
          >
            Voltar ao prontuário
          </Botao>
        }
      />

      {erroDaGravacao && (
        <Aviso tom="grave" titulo="A gravação falhou">
          {erroDaGravacao}
        </Aviso>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <ContextoSocial
          paciente={paciente}
          salvando={salvando}
          aoSalvar={(contexto) =>
            gravar(() => salvarContextoSocial(pacienteId, contexto))
          }
        />

        <Barreiras
          barreiras={paciente.barreiras ?? []}
          salvando={salvando}
          aoAdicionar={(tipo, descricao) =>
            gravar(() => registrarBarreira(pacienteId, tipo, descricao))
          }
          aoResolver={(barreiraId) => gravar(() => resolverBarreira(barreiraId))}
        />

        <Pendencias
          pendencias={paciente.pendencias ?? []}
          salvando={salvando}
          aoAdicionar={(tipo, referenteA, descricao) =>
            gravar(() => registrarPendencia(pacienteId, tipo, referenteA, descricao))
          }
          aoResolver={(pendenciaId) => gravar(() => resolverPendencia(pendenciaId))}
        />

        <Internacoes
          internacoes={paciente.internacoes ?? []}
          salvando={salvando}
          aoAdicionar={(dados) => gravar(() => registrarInternacao(pacienteId, dados))}
        />
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- contexto social */

function ContextoSocial({
  paciente,
  salvando,
  aoSalvar,
}: {
  paciente: HistoricoDoPaciente['paciente'];
  salvando: boolean;
  aoSalvar: (contexto: {
    moraSozinho: boolean;
    dificuldadeDeTransporte: boolean;
    temCuidador: boolean;
  }) => void;
}) {
  const [moraSozinho, setMoraSozinho] = useState(paciente.moraSozinho ?? false);
  const [transporte, setTransporte] = useState(
    paciente.dificuldadeDeTransporte ?? false,
  );
  const [cuidador, setCuidador] = useState(paciente.temCuidador ?? false);

  const jaAvaliado = paciente.contextoSocialAvaliadoEm != null;

  return (
    <Bloco
      titulo="Contexto social"
      descricao="Pesa no risco porque muda quem consegue chegar ao serviço quando piora, não porque muda o tratamento."
    >
      {!jaAvaliado && (
        <p className="mb-4 rounded-[var(--radius-sistema)] bg-[var(--color-superficie-baixa)] px-3 py-2 text-xs leading-relaxed text-[var(--color-texto-suave)]">
          Nunca avaliado. Enquanto ninguém responder, o motor de risco trata os três
          itens como ausentes, e não como negativos: não perguntar não é a mesma coisa
          que a pessoa dizer que não.
        </p>
      )}

      <div className="flex flex-col gap-3">
        <Marcador rotulo="Mora sozinho" valor={moraSozinho} aoMudar={setMoraSozinho} />
        <Marcador
          rotulo="Tem dificuldade de transporte"
          valor={transporte}
          aoMudar={setTransporte}
        />
        <Marcador rotulo="Tem cuidador" valor={cuidador} aoMudar={setCuidador} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--color-borda)] pt-4">
        <span className="text-xs text-[var(--color-texto-fraco)]">
          {jaAvaliado
            ? `Avaliado em ${formatarData(paciente.contextoSocialAvaliadoEm ?? '')}`
            : 'Ainda não avaliado'}
        </span>
        <Botao
          disabled={salvando}
          onClick={() =>
            aoSalvar({
              moraSozinho,
              dificuldadeDeTransporte: transporte,
              temCuidador: cuidador,
            })
          }
        >
          {salvando ? 'Gravando…' : 'Gravar avaliação'}
        </Botao>
      </div>
    </Bloco>
  );
}

function Marcador({
  rotulo,
  valor,
  aoMudar,
}: {
  rotulo: string;
  valor: boolean;
  aoMudar: (valor: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
      <span className="text-[var(--color-texto)]">{rotulo}</span>
      <input
        type="checkbox"
        checked={valor}
        onChange={(evento) => aoMudar(evento.target.checked)}
        className="h-4 w-4 shrink-0 accent-[var(--color-dado-1)]"
      />
    </label>
  );
}

/* --------------------------------------------------------------------- barreiras */

function Barreiras({
  barreiras,
  salvando,
  aoAdicionar,
  aoResolver,
}: {
  barreiras: readonly {
    id: string;
    tipo: string;
    descricao: string | null;
    criadaEm: string;
  }[];
  salvando: boolean;
  aoAdicionar: (tipo: string, descricao?: string) => void;
  aoResolver: (barreiraId: string) => void;
}) {
  const [tipo, setTipo] = useState<string>(TIPOS_DE_BARREIRA[0][0]);
  const [descricao, setDescricao] = useState('');

  return (
    <Bloco
      titulo="Barreiras de acesso"
      descricao="O que impede o paciente de chegar ao tratamento. Alimenta o mapa da tela de navegação."
    >
      {barreiras.length === 0 ? (
        <p className="text-sm text-[var(--color-texto-fraco)]">
          Nenhuma barreira aberta.
        </p>
      ) : (
        <ul className="mb-4 flex flex-col gap-2">
          {barreiras.map((barreira) => (
            <li
              key={barreira.id}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--color-borda)] pb-2 text-sm last:border-b-0"
            >
              <span>
                <span className="text-[var(--color-texto)]">
                  {ROTULO_DA_BARREIRA[barreira.tipo] ?? barreira.tipo}
                </span>
                {barreira.descricao && (
                  <span className="ml-1.5 text-xs text-[var(--color-texto-fraco)]">
                    {barreira.descricao}
                  </span>
                )}
              </span>
              {/* Resolver, não apagar: o histórico mostra o que o serviço destravou. */}
              <Botao
                variante="discreto"
                tamanho="compacto"
                disabled={salvando}
                onClick={() => aoResolver(barreira.id)}
              >
                Resolver
              </Botao>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2.5 border-t border-[var(--color-borda)] pt-4">
        <Selecao valor={tipo} aoMudar={setTipo} opcoes={TIPOS_DE_BARREIRA} />
        <Texto
          valor={descricao}
          aoMudar={setDescricao}
          marcador="Detalhe, se houver"
        />
        <Botao
          disabled={salvando}
          onClick={() => {
            aoAdicionar(tipo, descricao.trim() || undefined);
            setDescricao('');
          }}
        >
          Registrar barreira
        </Botao>
      </div>
    </Bloco>
  );
}

/* -------------------------------------------------------------------- pendências */

function Pendencias({
  pendencias,
  salvando,
  aoAdicionar,
  aoResolver,
}: {
  pendencias: readonly {
    id: string;
    tipo: string;
    descricao: string | null;
    referenteA: string;
  }[];
  salvando: boolean;
  aoAdicionar: (tipo: string, referenteA: string, descricao?: string) => void;
  aoResolver: (pendenciaId: string) => void;
}) {
  const [tipo, setTipo] = useState<string>(TIPOS_DE_PENDENCIA[0][0]);
  const [descricao, setDescricao] = useState('');
  const [referenteA, setReferenteA] = useState(hojeParaCampo());

  return (
    <Bloco
      titulo="Pendências pré-tratamento"
      descricao="O que pode suspender a sessão. Aparece na tela de navegação no dia anterior."
    >
      {pendencias.length === 0 ? (
        <p className="text-sm text-[var(--color-texto-fraco)]">
          Nenhuma pendência aberta.
        </p>
      ) : (
        <ul className="mb-4 flex flex-col gap-2">
          {pendencias.map((pendencia) => (
            <li
              key={pendencia.id}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--color-borda)] pb-2 text-sm last:border-b-0"
            >
              <span>
                <span className="text-[var(--color-texto)]">
                  {ROTULO_DA_PENDENCIA[pendencia.tipo] ?? pendencia.tipo}
                </span>
                <span className="ml-1.5 text-xs text-[var(--color-texto-fraco)]">
                  {formatarData(pendencia.referenteA)}
                  {pendencia.descricao ? ` · ${pendencia.descricao}` : ''}
                </span>
              </span>
              <Botao
                variante="discreto"
                tamanho="compacto"
                disabled={salvando}
                onClick={() => aoResolver(pendencia.id)}
              >
                Resolver
              </Botao>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2.5 border-t border-[var(--color-borda)] pt-4">
        <Selecao valor={tipo} aoMudar={setTipo} opcoes={TIPOS_DE_PENDENCIA} />
        <Data valor={referenteA} aoMudar={setReferenteA} rotulo="Data do tratamento" />
        <Texto
          valor={descricao}
          aoMudar={setDescricao}
          marcador="Detalhe, se houver"
        />
        <Botao
          disabled={salvando || !referenteA}
          onClick={() => {
            aoAdicionar(tipo, referenteA, descricao.trim() || undefined);
            setDescricao('');
          }}
        >
          Registrar pendência
        </Botao>
      </div>
    </Bloco>
  );
}

/* -------------------------------------------------------------------- internações */

function Internacoes({
  internacoes,
  salvando,
  aoAdicionar,
}: {
  internacoes: readonly {
    id: string;
    motivo: string;
    local: string | null;
    iniciadaEm: string;
    altaEm: string | null;
  }[];
  salvando: boolean;
  aoAdicionar: (dados: {
    motivo: string;
    local?: string;
    iniciadaEm: string;
    altaEm?: string;
  }) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [local, setLocal] = useState('');
  const [iniciadaEm, setIniciadaEm] = useState(hojeParaCampo());
  const [altaEm, setAltaEm] = useState('');

  const dataInvalida = altaEm !== '' && altaEm < iniciadaEm;

  return (
    <Bloco
      titulo="Internações"
      descricao="Alta recente sobe o paciente na fila do plantão por sete dias."
    >
      {internacoes.length === 0 ? (
        <p className="text-sm text-[var(--color-texto-fraco)]">
          Nenhuma internação registrada.
        </p>
      ) : (
        <ul className="mb-4 flex flex-col gap-2">
          {internacoes.map((internacao) => (
            <li
              key={internacao.id}
              className="border-b border-[var(--color-borda)] pb-2 text-sm last:border-b-0"
            >
              <span className="text-[var(--color-texto)]">{internacao.motivo}</span>
              <span className="ml-1.5 text-xs text-[var(--color-texto-fraco)]">
                {formatarData(internacao.iniciadaEm)}
                {internacao.altaEm
                  ? ` até ${formatarData(internacao.altaEm)}`
                  : ' · internado'}
                {internacao.local ? ` · ${internacao.local}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2.5 border-t border-[var(--color-borda)] pt-4">
        <Texto valor={motivo} aoMudar={setMotivo} marcador="Motivo da internação" />
        <Texto valor={local} aoMudar={setLocal} marcador="Local, se souber" />
        <Data valor={iniciadaEm} aoMudar={setIniciadaEm} rotulo="Entrada" />
        <Data
          valor={altaEm}
          aoMudar={setAltaEm}
          rotulo="Alta, se já saiu"
          permitirVazio
        />
        {dataInvalida && (
          <p className="text-xs text-[var(--color-texto-suave)]">
            A alta não pode ser anterior à entrada.
          </p>
        )}
        <Botao
          disabled={salvando || motivo.trim().length < 2 || dataInvalida}
          onClick={() => {
            aoAdicionar({
              motivo: motivo.trim(),
              local: local.trim() || undefined,
              iniciadaEm,
              altaEm: altaEm || undefined,
            });
            setMotivo('');
            setLocal('');
            setAltaEm('');
          }}
        >
          Registrar internação
        </Botao>
      </div>
    </Bloco>
  );
}

/* ------------------------------------------------------------------- primitivos */

const CLASSE_DE_CAMPO =
  'w-full rounded-[var(--radius-sistema)] border border-[var(--color-borda-forte)] bg-[var(--color-superficie-alta)] px-3 py-2 text-sm text-[var(--color-texto)]';

function Selecao({
  valor,
  aoMudar,
  opcoes,
}: {
  valor: string;
  aoMudar: (valor: string) => void;
  opcoes: readonly (readonly [string, string])[];
}) {
  return (
    <select
      value={valor}
      onChange={(evento) => aoMudar(evento.target.value)}
      className={CLASSE_DE_CAMPO}
    >
      {opcoes.map(([chave, rotulo]) => (
        <option key={chave} value={chave}>
          {rotulo}
        </option>
      ))}
    </select>
  );
}

function Texto({
  valor,
  aoMudar,
  marcador,
}: {
  valor: string;
  aoMudar: (valor: string) => void;
  marcador: string;
}) {
  return (
    <input
      type="text"
      value={valor}
      placeholder={marcador}
      onChange={(evento) => aoMudar(evento.target.value)}
      className={CLASSE_DE_CAMPO}
    />
  );
}

function Data({
  valor,
  aoMudar,
  rotulo,
  permitirVazio = false,
}: {
  valor: string;
  aoMudar: (valor: string) => void;
  rotulo: string;
  permitirVazio?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-[var(--color-texto-fraco)]">
      {rotulo}
      <input
        type="date"
        value={valor}
        required={!permitirVazio}
        onChange={(evento) => aoMudar(evento.target.value)}
        className={juntar(CLASSE_DE_CAMPO, 'font-mono')}
      />
    </label>
  );
}
