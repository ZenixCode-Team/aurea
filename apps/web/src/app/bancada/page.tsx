'use client';

/**
 * BANCADA DE TESTE — não é interface de produto.
 *
 * Existe para exercitar a API à mão: entrar, responder o check-in, ver a classificação
 * com a explicação por regra, e abrir o painel da enfermagem. É deliberadamente feia e
 * literal — mostra o nome do campo, o valor gravado e a regra que disparou, que é
 * exatamente o que uma tela de paciente NÃO deve mostrar.
 *
 * A interface do app do paciente e a do painel nascem no Ritual de Briefing, com direção
 * visual própria. O ADR-002 vale para a landing e explicitamente não serve para dentro.
 */

import { useCallback, useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

type Tipo = 'BOOLEANO' | 'NUMERICO' | 'INTEIRO' | 'OPCAO';

interface Campo {
  campo: string;
  pergunta: string;
  tipo: Tipo;
  dependeDe?: { campo: string; valor: boolean };
  minimo?: number;
  maximo?: number;
  casasDecimais?: number;
  unidade?: string;
  opcoes?: string[];
  ajuda?: string;
}

interface Ramo {
  sintoma: string;
  rotulo: string;
  porta: Campo;
  detalhes: Campo[];
}

type Valor = boolean | number | string | undefined;
type Respostas = Record<string, Record<string, Valor>>;

const CORES: Record<string, string> = {
  VERDE: '#2f6d3f',
  AMARELO: '#b8860b',
  VERMELHO: '#a32c2c',
  SEM_RESPOSTA_HOJE: '#6b6b6b',
};

interface Credencial {
  rotulo: string;
  corpo: { cpf?: string; email?: string };
}

const CONTAS: Credencial[] = [
  { rotulo: 'Paciente Um (tem Ondansetrona prescrita)', corpo: { cpf: '12345678909' } },
  { rotulo: 'Paciente Dois (sem prescrição)', corpo: { cpf: '11144477735' } },
  { rotulo: 'Paciente Três', corpo: { cpf: '98765432100' } },
  { rotulo: 'Enfermagem (plantão)', corpo: { email: 'enfermagem@aurea.local' } },
  { rotulo: 'Administrador (edita algoritmo, NÃO atende)', corpo: { email: 'admin@aurea.local' } },
];

async function chamar(rota: string, opcoes: { metodo?: string; token?: string; corpo?: unknown } = {}) {
  const resposta = await fetch(`${API}${rota}`, {
    method: opcoes.metodo ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(opcoes.token ? { authorization: `Bearer ${opcoes.token}` } : {}),
    },
    body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
  });
  const texto = await resposta.text();
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null };
}

export default function Bancada() {
  const [apiNoAr, setApiNoAr] = useState<boolean | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [arvore, setArvore] = useState<Ramo[]>([]);
  const [respostas, setRespostas] = useState<Respostas>({});
  const [resultado, setResultado] = useState<Record<string, unknown> | null>(null);
  const [painel, setPainel] = useState<Record<string, unknown> | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [limiares, setLimiares] = useState<Array<Record<string, unknown>> | null>(null);
  const [conjuntoAberto, setConjuntoAberto] = useState<Record<string, unknown> | null>(null);
  const [meuApp, setMeuApp] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    chamar('/saude')
      .then((r) => setApiNoAr(r.status === 200))
      .catch(() => setApiNoAr(false));
  }, []);

  const entrar = useCallback(async (corpo: Credencial['corpo']) => {
    setErro(null);
    setResultado(null);
    setPainel(null);
    setRespostas({});
    const r = await chamar('/autenticacao/entrar', {
      metodo: 'POST',
      corpo: { ...corpo, senha: 'aurea-demo-2026' },
    });
    if (r.status !== 200) {
      setErro(r.corpo?.erro ?? 'falha ao entrar');
      return;
    }
    setToken(r.corpo.token);
    setPerfil(r.corpo.perfil);

    if (r.corpo.perfil === 'PACIENTE') {
      const a = await chamar('/triagem/arvore', { token: r.corpo.token });
      setArvore(a.corpo?.sintomas ?? []);
    }
  }, []);

  const definir = (sintoma: string, campo: string, valor: Valor) => {
    setRespostas((atual) => {
      const doSintoma = { ...(atual[sintoma] ?? {}), [campo]: valor };
      // Fechar a porta apaga os detalhes: enviar detalhe com a porta fechada é
      // justamente o que a validação do servidor recusa.
      if (valor === false) {
        const ramo = arvore.find((r) => r.sintoma === sintoma);
        for (const detalhe of ramo?.detalhes ?? []) {
          if (detalhe.dependeDe?.campo === campo) delete doSintoma[detalhe.campo];
        }
      }
      return { ...atual, [sintoma]: doSintoma };
    });
  };

  const visivel = (sintoma: string, campo: Campo) => {
    if (!campo.dependeDe) return true;
    return respostas[sintoma]?.[campo.dependeDe.campo] === campo.dependeDe.valor;
  };

  const enviar = async () => {
    if (!token) return;
    setErro(null);
    setOcupado(true);
    try {
      const sessao = await chamar('/triagem/sessoes', {
        metodo: 'POST',
        token,
        corpo: { chaveDeIdempotencia: crypto.randomUUID() },
      });

      const sintomas = Object.entries(respostas)
        .map(([sintoma, campos]) => ({
          sintoma,
          respostas: Object.entries(campos)
            .filter(([, valor]) => valor !== undefined && valor !== '')
            .map(([campo, valor]) => ({
              campo,
              valorBooleano: typeof valor === 'boolean' ? valor : undefined,
              valorNumerico: typeof valor === 'number' ? valor : undefined,
              valorTexto: typeof valor === 'string' ? valor : undefined,
            })),
        }))
        .filter((s) => s.respostas.length > 0);

      const r = await chamar(`/triagem/sessoes/${sessao.corpo.sessaoId}/respostas`, {
        metodo: 'POST',
        token,
        corpo: { sintomas },
      });

      if (r.status !== 200) {
        setErro(`${r.corpo?.erro ?? 'erro'} — ${JSON.stringify(r.corpo?.detalhes ?? {})}`);
        return;
      }
      setResultado(r.corpo);
    } finally {
      setOcupado(false);
    }
  };

  const abrirLimiares = async () => {
    if (!token) return;
    const r = await chamar('/admin/limiares', { token });
    if (r.status !== 200) {
      setErro(`limiares: ${r.status} — ${r.corpo?.erro ?? ''}`);
      setLimiares(null);
      return;
    }
    setErro(null);
    setLimiares(r.corpo);
    setConjuntoAberto(null);
  };

  const abrirConjunto = async (id: string) => {
    if (!token) return;
    const r = await chamar(`/admin/limiares/${id}`, { token });
    if (r.status === 200) setConjuntoAberto(r.corpo);
  };

  const abrirMeuApp = async () => {
    if (!token) return;
    const [perfil, agenda, biblioteca, notificacoes] = await Promise.all([
      chamar('/paciente/perfil', { token }),
      chamar('/paciente/agenda', { token }),
      chamar('/paciente/biblioteca', { token }),
      chamar('/paciente/notificacoes', { token }),
    ]);
    setErro(null);
    setMeuApp({
      perfil: perfil.corpo,
      agenda: agenda.corpo,
      biblioteca: biblioteca.corpo,
      notificacoes: notificacoes.corpo,
    });
  };

  const pedirContato = async () => {
    if (!token) return;
    const r = await chamar('/paciente/solicitacoes-de-contato', { metodo: 'POST', token, corpo: {} });
    setErro(r.status >= 400 ? `contato: ${r.corpo?.erro ?? r.status}` : null);
    if (r.status < 400) setMeuApp((atual) => ({ ...(atual ?? {}), ultimoPedido: r.corpo }));
  };

  const abrirPainel = async () => {
    if (!token) return;
    const r = await chamar('/painel/pacientes-do-dia', { token });
    if (r.status !== 200) {
      setErro(`painel: ${r.status} — ${r.corpo?.erro ?? ''}`);
      setPainel(null);
      return;
    }
    setErro(null);
    setPainel(r.corpo);
  };

  return (
    <main
      style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
      className="mx-auto min-h-screen max-w-3xl bg-white p-6 text-[13px] leading-relaxed text-neutral-900"
    >
      <header className="mb-6 border-b border-neutral-300 pb-4">
        <h1 className="text-base font-bold">AUREA — bancada de teste</h1>
        <p className="mt-1 text-neutral-600">
          Não é interface de produto. Existe para exercitar a API à mão e mostrar o que
          fica gravado no banco. Todo paciente aqui é inventado.
        </p>
        <p className="mt-2">
          API: <code>{API}</code>{' '}
          {apiNoAr === null ? '…' : apiNoAr ? <span style={{ color: CORES.VERDE }}>no ar</span> : <span style={{ color: CORES.VERMELHO }}>fora do ar</span>}
        </p>
      </header>

      {erro && (
        <div className="mb-4 border-l-4 p-3" style={{ borderColor: CORES.VERMELHO, background: '#fdf3f3' }}>
          {erro}
        </div>
      )}

      <section className="mb-6">
        <h2 className="mb-2 font-bold">1 · entrar</h2>
        <p className="mb-2 text-neutral-600">senha de todos: <code>aurea-demo-2026</code></p>
        <div className="flex flex-col gap-1">
          {CONTAS.map((conta) => (
            <button
              key={conta.rotulo}
              onClick={() => entrar(conta.corpo)}
              className="border border-neutral-400 px-3 py-2 text-left hover:bg-neutral-100"
            >
              {conta.rotulo}
            </button>
          ))}
        </div>
        {token && (
          <p className="mt-2">
            entrou como <strong>{perfil}</strong>{' '}
            <button onClick={() => { setToken(null); setPerfil(null); setResultado(null); setPainel(null); }} className="underline">
              sair
            </button>
          </p>
        )}
      </section>

      {token && perfil === 'PACIENTE' && (
        <section className="mb-6">
          <h2 className="mb-2 font-bold">2 · check-in do dia</h2>
          <p className="mb-3 text-neutral-600">
            As perguntas vêm do servidor. Responder &quot;não&quot; na porta fecha o ramo — é o
            que torna o check-in diário viável.
          </p>

          {arvore.map((ramo) => (
            <div key={ramo.sintoma} className="mb-4 border border-neutral-300 p-3">
              <div className="mb-2 font-bold">{ramo.rotulo}</div>
              {[ramo.porta, ...ramo.detalhes].map((campo) =>
                !visivel(ramo.sintoma, campo) ? null : (
                  <div key={campo.campo} className="mb-2">
                    <label className="block">
                      {campo.pergunta}{' '}
                      <span className="text-neutral-500">({campo.campo})</span>
                    </label>
                    {campo.ajuda && <div className="text-neutral-500">{campo.ajuda}</div>}

                    {campo.tipo === 'BOOLEANO' && (
                      <div className="mt-1 flex gap-2">
                        {[true, false].map((valor) => (
                          <button
                            key={String(valor)}
                            onClick={() => definir(ramo.sintoma, campo.campo, valor)}
                            className="border px-3 py-1"
                            style={{
                              borderColor: respostas[ramo.sintoma]?.[campo.campo] === valor ? '#000' : '#bbb',
                              background: respostas[ramo.sintoma]?.[campo.campo] === valor ? '#eee' : '#fff',
                            }}
                          >
                            {valor ? 'sim' : 'não'}
                          </button>
                        ))}
                      </div>
                    )}

                    {(campo.tipo === 'NUMERICO' || campo.tipo === 'INTEIRO') && (
                      <input
                        type="number"
                        step={campo.tipo === 'INTEIRO' ? 1 : 0.1}
                        min={campo.minimo}
                        max={campo.maximo}
                        value={(respostas[ramo.sintoma]?.[campo.campo] as number | undefined) ?? ''}
                        onChange={(evento) =>
                          definir(
                            ramo.sintoma,
                            campo.campo,
                            evento.target.value === '' ? undefined : Number(evento.target.value),
                          )
                        }
                        className="mt-1 w-40 border border-neutral-400 px-2 py-1"
                      />
                    )}

                    {campo.tipo === 'OPCAO' && (
                      <select
                        value={(respostas[ramo.sintoma]?.[campo.campo] as string | undefined) ?? ''}
                        onChange={(evento) => definir(ramo.sintoma, campo.campo, evento.target.value || undefined)}
                        className="mt-1 border border-neutral-400 px-2 py-1"
                      >
                        <option value="">—</option>
                        {campo.opcoes?.map((opcao) => (
                          <option key={opcao} value={opcao}>
                            {opcao}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ),
              )}
            </div>
          ))}

          <button
            onClick={enviar}
            disabled={ocupado}
            className="border-2 border-black px-4 py-2 font-bold hover:bg-neutral-100 disabled:opacity-40"
          >
            {ocupado ? 'enviando…' : 'enviar check-in'}
          </button>
        </section>
      )}

      {resultado && (
        <section className="mb-6">
          <h2 className="mb-2 font-bold">3 · resultado</h2>

          {resultado.validadoClinicamente === false && (
            <div className="mb-3 border-l-4 p-3" style={{ borderColor: CORES.AMARELO, background: '#fdf8e8' }}>
              <strong>Conjunto de limiares não validado clinicamente.</strong> Os cortes que
              produziram esta cor são de demonstração ({String(resultado.versaoDoConjunto)}).
              Não representam conduta.
            </div>
          )}

          <div
            className="mb-3 p-4 text-lg font-bold text-white"
            style={{ background: CORES[String(resultado.resultado ?? 'SEM_RESPOSTA_HOJE')] }}
          >
            {String(resultado.resultado ?? resultado.situacao)}
            {resultado.enfermagemAvisada ? ' · enfermagem avisada' : ' · enfermagem não acionada'}
          </div>

          <h3 className="mt-4 mb-1 font-bold">por que — a explicação gravada no banco</h3>
          <pre className="overflow-x-auto border border-neutral-300 bg-neutral-50 p-3 text-[11px]">
            {JSON.stringify(resultado.explicacao, null, 2)}
          </pre>

          <h3 className="mt-4 mb-1 font-bold">orientações entregues</h3>
          {Array.isArray(resultado.orientacoes) && resultado.orientacoes.length > 0 ? (
            (resultado.orientacoes as Array<Record<string, string>>).map((orientacao) => (
              <div key={orientacao.id} className="mb-2 border border-neutral-300 p-3">
                <div className="font-bold">
                  {orientacao.titulo} <span className="text-neutral-500">({orientacao.sintoma})</span>
                </div>
                <p className="mt-1">{orientacao.corpo}</p>
              </div>
            ))
          ) : (
            <p className="text-neutral-600">nenhuma — resultado verde não gera orientação</p>
          )}
        </section>
      )}

      {token && perfil === 'PACIENTE' && (
        <section className="mb-6">
          <h2 className="mb-2 font-bold">3b · o resto do app</h2>
          <div className="flex gap-2">
            <button onClick={abrirMeuApp} className="border border-neutral-400 px-3 py-2 hover:bg-neutral-100">
              perfil · agenda · biblioteca · notificações
            </button>
            <button onClick={pedirContato} className="border border-neutral-400 px-3 py-2 hover:bg-neutral-100">
              falar com a enfermagem
            </button>
          </div>
          {meuApp && (
            <pre className="mt-2 max-h-96 overflow-auto border border-neutral-300 bg-neutral-50 p-3 text-[11px]">
              {JSON.stringify(meuApp, null, 2)}
            </pre>
          )}
        </section>
      )}

      {token && (
        <section className="mb-6">
          <h2 className="mb-2 font-bold">5 · admin — o algoritmo como dado</h2>
          <p className="mb-2 text-neutral-600">
            É aqui que a regra 1 do ADR-001 vira algo que você usa: os cortes de risco são
            linhas de tabela, não código. Entre como administrador.
          </p>
          <button onClick={abrirLimiares} className="border border-neutral-400 px-3 py-2 hover:bg-neutral-100">
            listar conjuntos de limiares
          </button>

          {limiares && (
            <div className="mt-3">
              {limiares.map((conjunto) => (
                <div key={String(conjunto.id)} className="mb-2 border border-neutral-300 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{String(conjunto.versao)}</strong>
                    {conjunto.ativo ? (
                      <span className="px-2 py-0.5 text-white" style={{ background: CORES.VERDE }}>
                        ATIVO
                      </span>
                    ) : (
                      <span className="px-2 py-0.5" style={{ background: '#eee' }}>rascunho</span>
                    )}
                    {!conjunto.validadoClinicamente && (
                      <span className="px-2 py-0.5" style={{ background: '#fdf8e8', color: '#7a5518' }}>
                        NÃO validado clinicamente
                      </span>
                    )}
                    <span className="text-neutral-500">
                      {String(conjunto.regras)} regras · {String(conjunto.classificacoesProduzidas)} classificações produzidas
                    </span>
                    <button onClick={() => abrirConjunto(String(conjunto.id))} className="underline">
                      abrir
                    </button>
                  </div>
                  <div className="mt-1 text-neutral-600">{String(conjunto.origem)}</div>
                </div>
              ))}
            </div>
          )}

          {conjuntoAberto && (
            <div className="mt-3 border border-neutral-400 p-3">
              <div className="mb-2 font-bold">
                {String(conjuntoAberto.versao)} — as regras em português
              </div>
              {(conjuntoAberto.regras as Array<Record<string, string>>).map((regra) => (
                <div key={regra.id} className="mb-1 border-l-4 pl-2" style={{ borderColor: CORES[regra.classificacao] }}>
                  <div>{regra.descricao}</div>
                  <div className="text-neutral-500">{regra.justificativa}</div>
                </div>
              ))}
              {Array.isArray(conjuntoAberto.problemasDeIntegridade) &&
                conjuntoAberto.problemasDeIntegridade.length > 0 && (
                  <div className="mt-2 p-2" style={{ background: '#fdf3f3' }}>
                    <strong>Problemas de integridade:</strong>
                    <pre className="text-[11px]">{JSON.stringify(conjuntoAberto.problemasDeIntegridade, null, 2)}</pre>
                  </div>
                )}
            </div>
          )}
        </section>
      )}

      {token && (
        <section className="mb-10">
          <h2 className="mb-2 font-bold">4 · painel da enfermagem</h2>
          <p className="mb-2 text-neutral-600">
            Entre como enfermagem e clique. Como administrador, a mesma chamada devolve 403
            — quem edita o algoritmo não está de plantão.
          </p>
          <button onClick={abrirPainel} className="border border-neutral-400 px-3 py-2 hover:bg-neutral-100">
            abrir pacientes do dia
          </button>

          {painel && (
            <div className="mt-3">
              <p className="mb-2">{JSON.stringify(painel.resumo)}</p>
              {(painel.cards as Array<Record<string, unknown>>).map((card) => (
                <div
                  key={String(card.pacienteId)}
                  className="mb-1 flex items-center gap-3 border-l-4 border border-neutral-300 p-2"
                  style={{ borderLeftColor: CORES[String(card.situacao)] }}
                >
                  <strong style={{ color: CORES[String(card.situacao)] }}>{String(card.situacao)}</strong>
                  <span>{String(card.nome)}</span>
                  <span className="text-neutral-500">
                    dia {String(card.diaDoCiclo)} do ciclo ·{' '}
                    {card.nuncaRespondeu ? 'nunca respondeu' : `${String(card.diasSemResponder)}d desde a última resposta`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
