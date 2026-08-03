'use client';

/**
 * Um sintoma do mural, em página própria.
 *
 * É o caminho SECUNDÁRIO. O caminho principal é o cartão que abre no lugar, em
 * `/app/perfil` — quem está comparando sintomas não quer ir e voltar. Esta página
 * existe para link direto: a enfermagem manda o endereço de um assunto específico
 * para uma pessoa específica, e ela cai já no texto.
 *
 * O conteúdo em si mora em `ConteudoDoVerbete`, compartilhado com o cartão. Texto
 * clínico duplicado é texto que diverge na primeira correção.
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { MURAL_VALIDADO_CLINICAMENTE, verbetePorApelido } from '@aurea/contratos';
import { Bloco, CabecalhoDePainel } from '@/componentes/sistema/painel';
import { Aviso, SeloDeNaoValidado } from '@/componentes/sistema/primitivos';
import { ConteudoDoVerbete } from '@/componentes/sistema/verbete-do-mural';

export default function PaginaDoVerbete() {
  const parametros = useParams<{ sintoma: string }>();
  const verbete = parametros?.sintoma ? verbetePorApelido(parametros.sintoma) : undefined;

  if (!verbete) {
    return (
      <>
        <CabecalhoDePainel
          trilha={[
            { rotulo: 'Seu tratamento', href: '/app/perfil' },
            { rotulo: 'Sintoma' },
          ]}
          titulo="Não encontramos este assunto"
        />
        <Aviso tom="informacao">
          O endereço pode ter mudado.{' '}
          <Link href="/app/perfil" className="underline underline-offset-4">
            Voltar para o seu tratamento
          </Link>
          .
        </Aviso>
      </>
    );
  }

  /* Coluna de leitura, não largura de painel.
     No shell inteiro (56rem) a linha passava de 120 caracteres, e a partir de ~80 o
     olho começa a errar a volta da linha. E o corpo sobe de 15px para 16px: quem lê
     isto está em quimioterapia, às vezes idoso, às vezes cansado — 15px é medida de
     tabela de plantão, não de texto para ser lido inteiro. */
  return (
    <div className="max-w-[36rem]">
      <CabecalhoDePainel
        trilha={[
          { rotulo: 'Seu tratamento', href: '/app/perfil' },
          { rotulo: verbete.titulo },
        ]}
        titulo={verbete.titulo}
        descricao={verbete.resumo}
        acao={MURAL_VALIDADO_CLINICAMENTE ? undefined : <SeloDeNaoValidado />}
      />

      <Bloco>
        <ConteudoDoVerbete verbete={verbete} />
      </Bloco>
    </div>
  );
}
