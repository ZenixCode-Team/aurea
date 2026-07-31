/**
 * Verificador das leis invioláveis do sistema AUREA.
 *
 * Existe porque as duas primeiras leis são clínicas, não estéticas: quebrá-las é
 * dano ao paciente, não deslize de estilo. Revisão por leitura humana falha em
 * arquivo 30; isto não falha.
 *
 * Uso: node scripts/conformidade.mjs
 * Sai com código 1 se qualquer lei for violada.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname;
const FONTE = join(RAIZ, 'src');

/** Comentários explicam as proibições — são o único lugar onde os termos podem aparecer. */
function semComentarios(texto) {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const LEIS = [
  {
    nome: 'Lei 2 — o paciente não vê cor de risco',
    escopo: /^src\/app\/app\//,
    proibido: [
      { padrao: /\bSeloDeRisco\b/, motivo: 'selo de classificação importado no app do paciente' },
      { padrao: /--color-risco-/, motivo: 'token da escala de risco usado no app do paciente' },
      { padrao: /\bClassificacao\b/, motivo: 'tipo de classificação usado no app do paciente' },
      { padrao: /\bregrasDisparadas\b/, motivo: 'explicação por regra exposta ao paciente' },
    ],
  },
  {
    nome: 'Lei 1 — cor de risco não decora',
    escopo: /^src\/(componentes|app)\//,
    proibido: [
      {
        padrao: /--color-risco-[a-z]+\)\s*\]?\s*(?:hover|group-hover)/,
        motivo: 'token de risco usado em estado de hover (decoração)',
      },
    ],
  },
  {
    nome: 'Tipos — proibido `any`',
    escopo: /^src\//,
    proibido: [{ padrao: /:\s*any\b|<any>|as any\b/, motivo: 'uso de `any`' }],
  },
];

async function* arquivos(diretorio) {
  for (const entrada of await readdir(diretorio, { withFileTypes: true })) {
    const caminho = join(diretorio, entrada.name);
    if (entrada.isDirectory()) {
      yield* arquivos(caminho);
    } else if (/\.(ts|tsx)$/.test(entrada.name)) {
      yield caminho;
    }
  }
}

const violacoes = [];

for await (const caminho of arquivos(FONTE)) {
  const relativo = relative(RAIZ, caminho);
  const conteudo = semComentarios(await readFile(caminho, 'utf8'));

  for (const lei of LEIS) {
    if (!lei.escopo.test(relativo)) continue;
    for (const { padrao, motivo } of lei.proibido) {
      const linhas = conteudo.split('\n');
      linhas.forEach((linha, indice) => {
        if (padrao.test(linha)) {
          violacoes.push({ lei: lei.nome, arquivo: relativo, linha: indice + 1, motivo });
        }
      });
    }
  }
}

if (violacoes.length === 0) {
  console.log('✅ Conformidade: nenhuma lei inviolável foi quebrada.');
  process.exit(0);
}

console.error(`❌ Conformidade: ${violacoes.length} violação(ões).\n`);
for (const { lei, arquivo, linha, motivo } of violacoes) {
  console.error(`  ${arquivo}:${linha}`);
  console.error(`    ${lei}`);
  console.error(`    → ${motivo}\n`);
}
process.exit(1);
