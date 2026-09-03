'use client';

/**
 * A3 — Editor de um novo conjunto de limiares.
 *
 * Sem origem de escrita ainda (Onda F): o resultado fica em estado local e, ao
 * salvar, a tela deixa claro que o conjunto nasceu como rascunho — nunca como
 * publicado. Regra sem justificativa não entra: é a defesa do corte, não um
 * campo opcional.
 *
 * Composição refeita conforme o ADR-004: cabeçalho com contexto, indicadores do
 * que já foi montado (regras adicionadas, sintomas cobertos) e cada etapa do
 * formulário como um bloco identificado, em vez de cartões soltos sem hierarquia.
 */

import {
  CLASSIFICACOES,
  EFEITOS_DO_ANTITERMICO,
  OPERADORES,
  POLITICAS_DE_COMBINACAO,
  SINTOMAS,
  TRATAMENTOS_DE_ABANDONO,
} from '@aurea/contratos';
import type {
  Classificacao,
  EfeitoDoAntitermico,
  Operador,
  PoliticaDeCombinacao,
  Sintoma,
  TratamentoDeAbandono,
} from '@aurea/contratos';
import { useId, useMemo, useState } from 'react';
import { Bloco, CabecalhoDePainel, CartaoDeIndicador, LinhaDeIndicadores } from '@/componentes/sistema/painel';
import {
  Aviso,
  Botao,
  CabecalhoDaTabela,
  Campo,
  LinkComoBotao,
  Celula,
  LinhaDaTabela,
  SeloDeRisco,
  Tabela,
  juntar,
} from '@/componentes/sistema/primitivos';
import { ROTULO_DA_CLASSIFICACAO, ROTULO_DO_OPERADOR, ROTULO_DO_SINTOMA } from '@/sistema/formato';
import type { RegraResumida } from '@/sistema/tipos';

const EXPLICACAO_DA_COMBINACAO: Record<PoliticaDeCombinacao, string> = {
  PIOR_ISOLADO: 'Cada sintoma é avaliado sozinho; o resultado do dia é o pior entre eles.',
  DOIS_AMARELOS_VIRAM_VERMELHO:
    'Dois ou mais sintomas amarelos no mesmo dia elevam o resultado do dia a vermelho.',
};

const EXPLICACAO_DO_ANTITERMICO: Record<EfeitoDoAntitermico, string> = {
  IGNORAR: 'O uso de antitérmico não altera a classificação da febre.',
  ELEVAR_UM_NIVEL:
    'Febre respondida com antitérmico sobe um nível na classificação (verde vira amarelo, amarelo vira vermelho).',
};

const EXPLICACAO_DO_ABANDONO: Record<TratamentoDeAbandono, string> = {
  NAO_CLASSIFICAR: 'Questionário abandonado no meio não gera classificação nesse dia.',
  PIOR_DOS_RESPONDIDOS:
    'Questionário abandonado é classificado pelo pior resultado entre os sintomas já respondidos.',
};

function estiloDoCampo(): string {
  return juntar(
    'rounded-[var(--radius-sistema)] border bg-[var(--color-superficie-alta)] px-3 py-2.5 text-base',
    'text-[var(--color-texto)] transition-colors duration-150',
    'border-[var(--color-borda-forte)] focus:border-[var(--color-texto-suave)]',
  );
}

function Selecao<T extends string>({
  rotulo,
  valor,
  opcoes,
  rotulos,
  aoMudar,
}: {
  rotulo: string;
  valor: T;
  opcoes: readonly T[];
  rotulos: Record<T, string>;
  aoMudar(valor: T): void;
}) {
  const identificador = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={identificador} className="text-sm font-medium text-[var(--color-texto)]">
        {rotulo}
      </label>
      <select
        id={identificador}
        value={valor}
        onChange={(evento) => aoMudar(evento.target.value as T)}
        className={estiloDoCampo()}
      >
        {opcoes.map((opcao) => (
          <option key={opcao} value={opcao}>
            {rotulos[opcao]}
          </option>
        ))}
      </select>
    </div>
  );
}

interface RascunhoDeRegra {
  sintoma: Sintoma;
  campo: string;
  operador: Operador;
  valor: string;
  classificacao: Classificacao;
  justificativa: string;
}

function rascunhoVazio(): RascunhoDeRegra {
  return {
    sintoma: SINTOMAS[0],
    campo: '',
    operador: OPERADORES[0],
    valor: '',
    classificacao: CLASSIFICACOES[0],
    justificativa: '',
  };
}

let proximoId = 1;

export default function PaginaDeNovoConjunto() {
  const [versao, setVersao] = useState('');
  const [descricao, setDescricao] = useState('');
  const [origem, setOrigem] = useState('');

  const [combinacao, setCombinacao] = useState<PoliticaDeCombinacao>(POLITICAS_DE_COMBINACAO[0]);
  const [efeitoDoAntitermico, setEfeitoDoAntitermico] = useState<EfeitoDoAntitermico>(
    EFEITOS_DO_ANTITERMICO[0],
  );
  const [tratamentoDeAbandono, setTratamentoDeAbandono] = useState<TratamentoDeAbandono>(
    TRATAMENTOS_DE_ABANDONO[0],
  );

  const [regras, setRegras] = useState<RegraResumida[]>([]);
  const [rascunho, setRascunho] = useState<RascunhoDeRegra>(rascunhoVazio());
  const [erroDoRascunho, setErroDoRascunho] = useState<string | null>(null);
  const [erroDoFormulario, setErroDoFormulario] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const sintomasCobertos = useMemo(
    () => new Set(regras.map((regra) => regra.sintoma)).size,
    [regras],
  );

  function adicionarRegra() {
    if (!rascunho.campo.trim()) {
      setErroDoRascunho('Informe o campo que a regra observa.');
      return;
    }
    if (!rascunho.justificativa.trim()) {
      setErroDoRascunho('Justificativa é obrigatória; regra sem justificativa não entra.');
      return;
    }
    const valorNumerico = rascunho.valor.trim() === '' ? null : Number(rascunho.valor);
    if (valorNumerico !== null && Number.isNaN(valorNumerico)) {
      setErroDoRascunho('O valor precisa ser um número.');
      return;
    }

    setRegras((atual) => [
      ...atual,
      {
        id: `local-${proximoId++}`,
        sintoma: rascunho.sintoma,
        campo: rascunho.campo.trim(),
        operador: rascunho.operador,
        valor: valorNumerico,
        classificacao: rascunho.classificacao,
        justificativa: rascunho.justificativa.trim(),
      },
    ]);
    setRascunho(rascunhoVazio());
    setErroDoRascunho(null);
  }

  function removerRegra(id: string) {
    setRegras((atual) => atual.filter((regra) => regra.id !== id));
  }

  function salvar() {
    if (!versao.trim() || !descricao.trim() || !origem.trim()) {
      setErroDoFormulario('Preencha versão, descrição e origem antes de salvar.');
      return;
    }
    if (regras.length === 0) {
      setErroDoFormulario('Adicione pelo menos uma regra antes de salvar.');
      return;
    }
    setErroDoFormulario(null);
    setSalvo(true);
  }

  return (
    <>
      <CabecalhoDePainel
        trilha={[
          { rotulo: 'Administração' },
          { rotulo: 'Conjuntos de limiares', href: '/admin/limiares' },
          { rotulo: 'Novo conjunto' },
        ]}
        titulo="Novo conjunto de limiares"
        descricao="Sem origem de escrita ainda: o conjunto fica em estado local até a Onda F ligar o backend."
        acao={
          <div className="flex gap-2">
            <LinkComoBotao href="/admin/limiares" variante="secundario">
              Cancelar
            </LinkComoBotao>
            <Botao variante="principal" onClick={salvar}>
              Salvar como rascunho
            </Botao>
          </div>
        }
      />

      {salvo && (
        <div className="mb-6">
          <Aviso tom="informacao" titulo="Conjunto criado como rascunho">
            {`O conjunto "${versao}" foi criado como rascunho local, com ${regras.length} regra(s). Ele não classifica ninguém até ser publicado, e publicação depende da origem de escrita da Onda F.`}
          </Aviso>
        </div>
      )}

      {erroDoFormulario && (
        <div className="mb-6">
          <Aviso tom="grave">{erroDoFormulario}</Aviso>
        </div>
      )}

      <LinhaDeIndicadores>
        <CartaoDeIndicador rotulo="Regras adicionadas" valor={regras.length} tom="neutro" />
        <CartaoDeIndicador rotulo="Sintomas cobertos" valor={sintomasCobertos} tom="neutro" />
      </LinhaDeIndicadores>

      <div className="flex flex-col gap-4">
        <Bloco titulo="Metadados">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Campo
              rotulo="Versão *"
              mono
              placeholder="ex.: rascunho-2"
              value={versao}
              onChange={(evento) => setVersao(evento.target.value)}
            />
            <Campo
              rotulo="Descrição *"
              placeholder="O que muda neste conjunto"
              value={descricao}
              onChange={(evento) => setDescricao(evento.target.value)}
            />
            <Campo
              rotulo="Origem *"
              placeholder="ex.: CTCAE v5.0 + protocolo do serviço"
              value={origem}
              onChange={(evento) => setOrigem(evento.target.value)}
            />
          </div>
        </Bloco>

        <Bloco
          titulo="Política de classificação"
          descricao="São decisões clínicas, não preferências de interface; cada opção muda o resultado que o paciente recebe."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Selecao<PoliticaDeCombinacao>
                rotulo="Combinação de sintomas"
                valor={combinacao}
                opcoes={POLITICAS_DE_COMBINACAO}
                rotulos={{
                  PIOR_ISOLADO: 'Pior isolado',
                  DOIS_AMARELOS_VIRAM_VERMELHO: 'Dois amarelos viram vermelho',
                }}
                aoMudar={setCombinacao}
              />
              <p className="mt-1.5 text-xs text-[var(--color-texto-suave)]">
                {EXPLICACAO_DA_COMBINACAO[combinacao]}
              </p>
            </div>
            <div>
              <Selecao<EfeitoDoAntitermico>
                rotulo="Efeito do antitérmico"
                valor={efeitoDoAntitermico}
                opcoes={EFEITOS_DO_ANTITERMICO}
                rotulos={{ IGNORAR: 'Ignorar', ELEVAR_UM_NIVEL: 'Elevar um nível' }}
                aoMudar={setEfeitoDoAntitermico}
              />
              <p className="mt-1.5 text-xs text-[var(--color-texto-suave)]">
                {EXPLICACAO_DO_ANTITERMICO[efeitoDoAntitermico]}
              </p>
            </div>
            <div>
              <Selecao<TratamentoDeAbandono>
                rotulo="Tratamento de abandono"
                valor={tratamentoDeAbandono}
                opcoes={TRATAMENTOS_DE_ABANDONO}
                rotulos={{
                  NAO_CLASSIFICAR: 'Não classificar',
                  PIOR_DOS_RESPONDIDOS: 'Pior dos respondidos',
                }}
                aoMudar={setTratamentoDeAbandono}
              />
              <p className="mt-1.5 text-xs text-[var(--color-texto-suave)]">
                {EXPLICACAO_DO_ABANDONO[tratamentoDeAbandono]}
              </p>
            </div>
          </div>
        </Bloco>

        <Bloco titulo="Adicionar regra">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Selecao
              rotulo="Sintoma"
              valor={rascunho.sintoma}
              opcoes={SINTOMAS}
              rotulos={ROTULO_DO_SINTOMA as Record<Sintoma, string>}
              aoMudar={(sintoma) => setRascunho((atual) => ({ ...atual, sintoma }))}
            />
            <Campo
              rotulo="Campo observado *"
              mono
              placeholder="ex.: temperaturaMaxima"
              value={rascunho.campo}
              onChange={(evento) =>
                setRascunho((atual) => ({ ...atual, campo: evento.target.value }))
              }
            />
            <Selecao
              rotulo="Operador"
              valor={rascunho.operador}
              opcoes={OPERADORES}
              rotulos={ROTULO_DO_OPERADOR as Record<Operador, string>}
              aoMudar={(operador) => setRascunho((atual) => ({ ...atual, operador }))}
            />
            <Campo
              rotulo="Valor"
              mono
              placeholder="ex.: 38"
              value={rascunho.valor}
              onChange={(evento) => setRascunho((atual) => ({ ...atual, valor: evento.target.value }))}
            />
            <Selecao
              rotulo="Classificação"
              valor={rascunho.classificacao}
              opcoes={CLASSIFICACOES}
              rotulos={ROTULO_DA_CLASSIFICACAO}
              aoMudar={(classificacao) => setRascunho((atual) => ({ ...atual, classificacao }))}
            />
          </div>
          <div className="mt-4 flex flex-col gap-1.5">
            <label
              htmlFor="justificativa-da-regra"
              className="text-sm font-medium text-[var(--color-texto)]"
            >
              Justificativa clínica *
            </label>
            <textarea
              id="justificativa-da-regra"
              rows={3}
              placeholder="Por que este corte existe; vai para a explicação do resultado e para a defesa do critério."
              value={rascunho.justificativa}
              onChange={(evento) =>
                setRascunho((atual) => ({ ...atual, justificativa: evento.target.value }))
              }
              className={juntar(estiloDoCampo(), 'resize-y')}
            />
          </div>
          {erroDoRascunho && (
            <p role="alert" className="mt-2 text-xs text-[var(--color-risco-vermelho)]">
              {erroDoRascunho}
            </p>
          )}
          <div className="mt-4">
            <Botao variante="secundario" onClick={adicionarRegra}>
              Adicionar regra
            </Botao>
          </div>
        </Bloco>

        <Bloco titulo={`Regras adicionadas (${regras.length})`} semPadding>
          {regras.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[var(--color-texto-suave)]">
              Nenhuma regra adicionada ainda.
            </p>
          ) : (
            <Tabela rotulo="Regras adicionadas ao novo conjunto">
              <CabecalhoDaTabela
                colunas={[
                  'Sintoma',
                  'Campo',
                  'Operador',
                  'Valor',
                  'Classificação',
                  'Justificativa clínica',
                  '',
                ]}
              />
              <tbody>
                {regras.map((regra) => (
                  <LinhaDaTabela key={regra.id}>
                    <Celula>{ROTULO_DO_SINTOMA[regra.sintoma] ?? regra.sintoma}</Celula>
                    <Celula mono>{regra.campo}</Celula>
                    <Celula>{ROTULO_DO_OPERADOR[regra.operador] ?? regra.operador}</Celula>
                    <Celula mono>{regra.valor ?? 'sem valor'}</Celula>
                    <Celula>
                      <SeloDeRisco situacao={regra.classificacao} />
                    </Celula>
                    <Celula className="max-w-md">{regra.justificativa}</Celula>
                    <Celula>
                      <Botao
                        variante="discreto"
                        tamanho="compacto"
                        onClick={() => removerRegra(regra.id)}
                      >
                        Remover
                      </Botao>
                    </Celula>
                  </LinhaDaTabela>
                ))}
              </tbody>
            </Tabela>
          )}
        </Bloco>
      </div>
    </>
  );
}
