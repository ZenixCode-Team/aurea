'use client';

/**
 * P6 — Biblioteca. A enciclopédia do paciente.
 *
 * Mesmo padrão do mural de sintomas: cartão com título e resumo à vista, texto
 * completo abrindo no lugar. As duas superfícies existem para leitura, e quem lê
 * está comparando — abre um assunto, lê, fecha, abre outro. Cada leitura em página
 * separada custaria uma ida e uma volta, e a volta devolveria a pessoa ao topo da
 * lista, longe de onde parou.
 *
 * O TEXTO COMPLETO É BUSCADO SÓ AO ABRIR. A listagem traz título e resumo; o corpo
 * vem no primeiro toque e fica em memória para os toques seguintes. Trazer o texto
 * de todos os verbetes na primeira tela seria pagar, no 3G do corredor do hospital,
 * por conteúdo que a pessoa provavelmente não vai ler todo.
 *
 * A busca existe porque enciclopédia sem busca é lista. Filtra por título e resumo,
 * sem acento e sem caixa — quem procura "nausea" precisa achar "náusea".
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CartaoExpansivel,
  useCartaoAberto,
} from '@/componentes/sistema/cartao-expansivel';
import { CabecalhoDePainel } from '@/componentes/sistema/painel';
import {
  Aviso,
  Campo,
  Carregando,
  EstadoVazio,
  Rotulo,
} from '@/componentes/sistema/primitivos';
import { buscarBiblioteca, buscarVerbete } from '@/sistema/fonte';
import { ROTULO_DA_CATEGORIA } from '@/sistema/formato';
import type { Verbete, VerbeteResumido } from '@/sistema/tipos';

type Fase = 'carregando' | 'erro' | 'pronto';

/** "Náusea" e "nausea" têm de casar. Sem isto a busca só serve para quem digita com acento. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export default function PaginaDeBiblioteca() {
  const [fase, setFase] = useState<Fase>('carregando');
  const [biblioteca, setBiblioteca] = useState<readonly VerbeteResumido[]>([]);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    let cancelado = false;
    buscarBiblioteca()
      .then((dados) => {
        if (cancelado) return;
        setBiblioteca(dados);
        setFase('pronto');
      })
      .catch(() => {
        if (!cancelado) setFase('erro');
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim());
    if (!termo) return biblioteca;
    return biblioteca.filter((verbete) =>
      normalizar(`${verbete.titulo} ${verbete.resumo}`).includes(termo),
    );
  }, [biblioteca, busca]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, VerbeteResumido[]>();
    for (const verbete of filtrados) {
      const lista = mapa.get(verbete.categoria) ?? [];
      lista.push(verbete);
      mapa.set(verbete.categoria, lista);
    }
    return [...mapa.entries()];
  }, [filtrados]);

  if (fase === 'carregando') {
    return <Carregando linhas={5} />;
  }

  if (fase === 'erro') {
    return (
      <Aviso tom="grave" titulo="Algo não carregou">
        Não foi possível carregar a biblioteca agora. Tente novamente em instantes.
      </Aviso>
    );
  }

  return (
    <div className="max-w-[42rem]">
      <CabecalhoDePainel
        titulo="Biblioteca"
        descricao="Os textos que a sua equipe deixou disponíveis. Toque em um assunto para ler."
      />

      {biblioteca.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum texto disponível ainda"
          descricao="A equipe ainda não publicou nenhum material aqui."
        />
      ) : (
        <>
          <div className="mb-7">
            <Campo
              rotulo="Procurar"
              type="search"
              placeholder="Enjoo, febre, alimentação…"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
            />
          </div>

          {grupos.length === 0 ? (
            <EstadoVazio
              titulo="Nada encontrado"
              descricao={`Nenhum texto casa com "${busca.trim()}". Tente outra palavra.`}
            />
          ) : (
            <div className="flex flex-col gap-8">
              {grupos.map(([categoria, itens]) => (
                <section key={categoria} className="flex flex-col gap-3">
                  <Rotulo>{ROTULO_DA_CATEGORIA[categoria] ?? categoria}</Rotulo>
                  <ul className="flex flex-col gap-3">
                    {itens.map((verbete) => (
                      <li key={verbete.id}>
                        <VerbeteExpansivel resumido={verbete} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Um verbete da biblioteca.
 *
 * O estado de aberto é local a cada cartão aqui, e não do grupo inteiro como no
 * mural: a biblioteca é dividida por categoria e cresce sem teto conhecido, então
 * forçar "um por vez" fecharia, sem aviso, o texto que a pessoa está lendo em outra
 * categoria da mesma tela.
 */
function VerbeteExpansivel({ resumido }: { resumido: VerbeteResumido }) {
  const cartoes = useCartaoAberto();
  const [completo, setCompleto] = useState<Verbete | null>(null);
  const [erro, setErro] = useState(false);

  const aberto = cartoes.estaAberto(resumido.id);

  const alternar = useCallback(() => {
    cartoes.alternar(resumido.id);
    if (completo || erro) return;
    buscarVerbete(resumido.id)
      .then(setCompleto)
      .catch(() => setErro(true));
  }, [cartoes, completo, erro, resumido.id]);

  return (
    <CartaoExpansivel
      titulo={resumido.titulo}
      resumo={resumido.resumo}
      aberto={aberto}
      aoAlternar={alternar}
    >
      {erro ? (
        <Aviso tom="informacao">
          Não foi possível carregar este texto agora.{' '}
          <Link
            href={`/app/biblioteca/${resumido.id}`}
            className="underline underline-offset-4"
          >
            Abrir em página própria
          </Link>
          .
        </Aviso>
      ) : completo ? (
        <>
          {/* `whitespace-pre-line` porque o corpo vem do banco com quebra de parágrafo
              em `\n\n`, escrita por quem redigiu — e não por uma marcação. */}
          <p className="whitespace-pre-line text-base leading-relaxed text-[var(--color-texto-suave)]">
            {completo.conteudo}
          </p>
          <p className="mt-6 border-t border-[var(--color-borda)] pt-4 text-sm">
            <Link
              href={`/app/biblioteca/${resumido.id}`}
              className="text-[var(--color-texto-suave)] underline underline-offset-4 hover:text-[var(--color-texto)]"
            >
              Abrir só este assunto
            </Link>
          </p>
        </>
      ) : (
        <Carregando linhas={3} />
      )}
    </CartaoExpansivel>
  );
}
