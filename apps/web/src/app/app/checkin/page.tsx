'use client';

/**
 * P2 — Check-in. A tela mais importante do sistema.
 *
 * Uma pergunta por vez. `buscarArvoreDeTriagem()` devolve ramos (um por sintoma);
 * cada ramo é uma porta booleana seguida de detalhes que só aparecem se a porta
 * for "sim". A árvore inteira é achatada numa lista de passos e, a cada resposta,
 * a lista de passos VISÍVEIS é recalculada a partir de `dependeDe` — assim, dizer
 * "não" numa porta faz os detalhes daquele ramo desaparecerem do fluxo sozinhos.
 *
 * O resultado é renderizado dentro desta mesma página (fase "resultado"), como o
 * briefing permite. `/app/checkin/resultado` existe só como redirecionamento.
 *
 * Lei clínica: esta tela nunca lê nem mostra classificação, regra ou nome de campo
 * técnico — só `RetornoDoCheckin.orientacoes`, que é texto pronto escrito pela equipe.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarraDeProgresso } from '@/componentes/sistema/painel';
import {
  Aviso,
  Botao,
  Campo,
  Cartao,
  Carregando,
  EscolhaSimNao,
  EstadoVazio,
  LinkComoBotao,
  Rotulo,
  juntar,
} from '@/componentes/sistema/primitivos';
import { buscarArvoreDeTriagem, enviarCheckin } from '@/sistema/fonte';
import type {
  CampoDaTriagem,
  RamoDaTriagem,
  RespostasDoCheckin,
  RetornoDoCheckin,
  ValorDeResposta,
} from '@/sistema/tipos';

const CHAVE_CHECKIN_DE_HOJE = 'aurea.checkinDeHoje';

interface Passo {
  readonly rotuloDoRamo: string;
  readonly campo: CampoDaTriagem;
}

function construirPassos(arvore: readonly RamoDaTriagem[]): readonly Passo[] {
  const todos: Passo[] = [];
  for (const ramo of arvore) {
    todos.push({ rotuloDoRamo: ramo.rotulo, campo: ramo.porta });
    for (const detalhe of ramo.detalhes) {
      todos.push({ rotuloDoRamo: ramo.rotulo, campo: detalhe });
    }
  }
  return todos;
}

function estaVisivel(campo: CampoDaTriagem, respostas: RespostasDoCheckin): boolean {
  if (!campo.dependeDe) return true;
  return respostas[campo.dependeDe.campo] === campo.dependeDe.valor;
}

type Fase = 'carregando' | 'erro' | 'perguntas' | 'enviando' | 'resultado';

export default function PaginaDeCheckin() {
  const router = useRouter();
  const [fase, setFase] = useState<Fase>('carregando');
  const [mensagemDeErro, setMensagemDeErro] = useState('');
  const [arvore, setArvore] = useState<readonly RamoDaTriagem[]>([]);
  const [respostas, setRespostas] = useState<RespostasDoCheckin>({});
  const [indice, setIndice] = useState(0);
  const [resultado, setResultado] = useState<RetornoDoCheckin | null>(null);
  /**
   * O Aviso de erro é o mesmo componente para "não carregou o questionário" e
   * "não conseguiu enviar", mas só o segundo caso tem como retentar sem perder
   * trabalho (as respostas já estão no state). Guardamos a origem só pra decidir
   * se o botão "Tentar de novo" aparece — o texto do Aviso já diz qual foi.
   */
  const [origemDoErro, setOrigemDoErro] = useState<'carregar' | 'enviar' | null>(null);

  useEffect(() => {
    let cancelado = false;
    buscarArvoreDeTriagem()
      .then((dados) => {
        if (cancelado) return;
        setArvore(dados);
        setFase('perguntas');
      })
      .catch(() => {
        if (!cancelado) {
          setMensagemDeErro('Não foi possível carregar o questionário de hoje. Tente novamente em instantes.');
          setOrigemDoErro('carregar');
          setFase('erro');
        }
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const todosOsPassos = useMemo(() => construirPassos(arvore), [arvore]);
  const passos = useMemo(
    () => todosOsPassos.filter((passo) => estaVisivel(passo.campo, respostas)),
    [todosOsPassos, respostas],
  );
  const passoAtual = passos[indice];

  async function enviar(respostasFinais: RespostasDoCheckin) {
    setFase('enviando');
    try {
      const retorno = await enviarCheckin(respostasFinais);
      sessionStorage.setItem(CHAVE_CHECKIN_DE_HOJE, JSON.stringify(retorno));
      setResultado(retorno);
      setFase('resultado');
    } catch {
      setMensagemDeErro('Não conseguimos enviar suas respostas agora. Tente de novo em instantes.');
      setOrigemDoErro('enviar');
      setFase('erro');
    }
  }

  function responderEAvancar(valor: ValorDeResposta) {
    if (!passoAtual) return;
    const novasRespostas: RespostasDoCheckin = { ...respostas, [passoAtual.campo.campo]: valor };
    setRespostas(novasRespostas);

    const proximosVisiveis = todosOsPassos.filter((passo) => estaVisivel(passo.campo, novasRespostas));
    const proximoIndice = indice + 1;
    if (proximoIndice >= proximosVisiveis.length) {
      void enviar(novasRespostas);
    } else {
      setIndice(proximoIndice);
    }
  }

  function voltar() {
    if (indice === 0) {
      router.push('/app');
      return;
    }
    setIndice((atual) => atual - 1);
  }

  if (fase === 'carregando') {
    return <Carregando linhas={4} />;
  }

  if (fase === 'erro') {
    return (
      <div className="flex flex-col gap-4">
        <Aviso tom="grave" titulo="Algo não carregou">
          {mensagemDeErro}
        </Aviso>
        {/* Só reenvia quando o erro foi no envio: as respostas já estão no state e
            refazer o questionário do zero seria punir a pessoa por uma falha nossa. */}
        {origemDoErro === 'enviar' && (
          <Botao type="button" tamanho="amplo" onClick={() => void enviar(respostas)}>
            Tentar de novo
          </Botao>
        )}
      </div>
    );
  }

  if (fase === 'resultado') {
    if (!resultado) return <Carregando linhas={4} />;
    return <ResultadoDoCheckin resultado={resultado} />;
  }

  if (fase === 'enviando') {
    return <Carregando linhas={3} />;
  }

  if (passos.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhuma pergunta disponível agora"
        descricao="Tente novamente em alguns instantes."
      />
    );
  }

  if (!passoAtual) {
    return <Carregando linhas={3} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <BarraDeProgresso
        atual={indice + 1}
        total={passos.length}
        descricao={`Pergunta ${indice + 1} de ${passos.length}`}
      />

      <Rotulo>{passoAtual.rotuloDoRamo}</Rotulo>

      <PassoDoQuestionario
        key={passoAtual.campo.campo}
        campo={passoAtual.campo}
        valorAtual={respostas[passoAtual.campo.campo] ?? null}
        aoResponder={responderEAvancar}
      />

      <Botao variante="discreto" tamanho="padrao" type="button" onClick={voltar}>
        Voltar
      </Botao>
    </div>
  );
}

/* ==========================================================================
   Um passo do questionário — despacha pelo tipo do campo
   ========================================================================== */

function PassoDoQuestionario({
  campo,
  valorAtual,
  aoResponder,
}: {
  campo: CampoDaTriagem;
  valorAtual: ValorDeResposta;
  aoResponder(valor: ValorDeResposta): void;
}) {
  if (campo.tipo === 'BOOLEANO') {
    return (
      <EscolhaSimNao
        pergunta={campo.pergunta}
        ajuda={campo.ajuda}
        valor={typeof valorAtual === 'boolean' ? valorAtual : null}
        aoEscolher={aoResponder}
      />
    );
  }

  if (campo.tipo === 'OPCAO') {
    return (
      <fieldset className="flex flex-col gap-3">
        <legend className="text-lg leading-snug text-[var(--color-texto)]">{campo.pergunta}</legend>
        {campo.ajuda && <p className="text-sm text-[var(--color-texto-suave)]">{campo.ajuda}</p>}
        <div className="flex flex-col gap-2">
          {(campo.opcoes ?? []).map((opcao) => (
            <button
              key={opcao}
              type="button"
              aria-pressed={valorAtual === opcao}
              onClick={() => aoResponder(opcao)}
              className={juntar(
                'rounded-[var(--radius-sistema)] border px-5 py-4 text-left text-base font-medium',
                'transition-colors duration-150',
                valorAtual === opcao
                  ? 'border-[var(--color-superficie-invertida)] bg-[var(--color-superficie-invertida)] text-[var(--color-texto-invertido)]'
                  : 'border-[var(--color-borda-forte)] bg-[var(--color-superficie-alta)] text-[var(--color-texto)] hover:bg-[var(--color-superficie-baixa)]',
              )}
            >
              {opcao}
            </button>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <PassoNumerico
      campo={campo}
      valorInicial={typeof valorAtual === 'number' ? valorAtual : null}
      aoConfirmar={aoResponder}
    />
  );
}

function PassoNumerico({
  campo,
  valorInicial,
  aoConfirmar,
}: {
  campo: CampoDaTriagem;
  valorInicial: number | null;
  aoConfirmar(valor: number): void;
}) {
  const [texto, setTexto] = useState(valorInicial === null ? '' : String(valorInicial));
  const [erro, setErro] = useState('');

  function confirmar() {
    const numero = Number(texto.replace(',', '.'));
    if (texto.trim() === '' || Number.isNaN(numero)) {
      setErro('Digite um número.');
      return;
    }
    if (campo.minimo !== undefined && numero < campo.minimo) {
      setErro(`O valor mínimo é ${campo.minimo}.`);
      return;
    }
    if (campo.maximo !== undefined && numero > campo.maximo) {
      setErro(`O valor máximo é ${campo.maximo}.`);
      return;
    }
    setErro('');
    aoConfirmar(numero);
  }

  const limite =
    campo.minimo !== undefined && campo.maximo !== undefined
      ? `Entre ${campo.minimo} e ${campo.maximo}${campo.unidade ? ` ${campo.unidade}` : ''}.`
      : campo.minimo !== undefined
        ? `A partir de ${campo.minimo}${campo.unidade ? ` ${campo.unidade}` : ''}.`
        : campo.maximo !== undefined
          ? `Até ${campo.maximo}${campo.unidade ? ` ${campo.unidade}` : ''}.`
          : null;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault();
        confirmar();
      }}
    >
      <div className="flex flex-col gap-1">
        <p className="text-lg leading-snug text-[var(--color-texto)]">{campo.pergunta}</p>
        {campo.ajuda && <p className="text-sm text-[var(--color-texto-suave)]">{campo.ajuda}</p>}
        {limite && <p className="text-xs text-[var(--color-texto-fraco)]">{limite}</p>}
      </div>
      <Campo
        rotulo={campo.unidade ? `Resposta (${campo.unidade})` : 'Resposta'}
        mono
        inputMode="decimal"
        type="text"
        value={texto}
        erro={erro || undefined}
        onChange={(evento) => setTexto(evento.target.value)}
        autoFocus
      />
      <Botao type="submit" tamanho="amplo">
        Continuar
      </Botao>
    </form>
  );
}

/* ==========================================================================
   Resultado — só orientações em português, nunca classificação
   ========================================================================== */

function ResultadoDoCheckin({ resultado }: { resultado: RetornoDoCheckin }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Mesmo cartão do check-in já feito em "Hoje": é o mesmo resultado visto de
          dentro do fluxo em vez de visto ao reabrir o app depois. */}
      <Cartao className="flex flex-col gap-5 p-6">
        <div>
          <Rotulo>Check-in concluído</Rotulo>
          <p className="mt-2 text-[1.375rem] font-medium leading-snug text-[var(--color-texto)]">
            Obrigada por responder hoje.
          </p>
        </div>

        {resultado.pedeContatoComServico && (
          <Aviso tom="grave" titulo="Entre em contato com o serviço hoje">
            Pelo que você relatou, a equipe pede que você entre em contato com o serviço ainda
            hoje.
          </Aviso>
        )}

        <div className="flex flex-col gap-4 border-t border-[var(--color-borda)] pt-4">
          {resultado.orientacoes.map((orientacao) => (
            <div key={orientacao.id} className="flex flex-col gap-1.5">
              <p className="text-base font-medium text-[var(--color-texto)]">
                {orientacao.titulo}
              </p>
              <p className="text-[1.0625rem] leading-relaxed text-[var(--color-texto-suave)]">
                {orientacao.texto}
              </p>
            </div>
          ))}
        </div>
      </Cartao>

      {resultado.pedeContatoComServico && (
        <LinkComoBotao href="/app/contato" tamanho="amplo">
          Falar com a enfermagem
        </LinkComoBotao>
      )}

      <LinkComoBotao href="/app" variante="secundario" tamanho="amplo">
        Voltar para o início
      </LinkComoBotao>
    </div>
  );
}
