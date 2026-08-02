# ADR-005 — Paleta de dados não-clínica

**Data:** 2026-08-01
**Estado:** aceito
**Substitui:** nada. Complementa o ADR-004.

## Contexto

O ADR-004 estabeleceu a lei inviolável 1: sage, âmbar e terracota significam
classificação de risco e nada mais. Cor sem significado é proibida.

A lei funcionou — e cobrou o preço previsto. Os painéis ficaram cromaticamente
mudos, porque a única cor autorizada é a que classifica paciente, e na maior parte
das telas não há classificação nenhuma para mostrar. O pedido de "mais vida" é
legítimo e não pode ser respondido afrouxando a lei.

O problema real não é falta de cor. É que o sistema tem UM vocabulário cromático,
e está tentando usá-lo para duas gramáticas diferentes: sinal clínico e volume
operacional.

## Decisão

Existe uma segunda paleta, separada por **matiz**, para dado não-clínico.

A escala de triagem ocupa a faixa quente do círculo cromático — vermelho 12°,
âmbar 38°, verde 78°. **Toda cor de dado mora entre 185° e 330°**, do outro lado:

| Token | Valor | Matiz |
|---|---|---|
| `--color-dado-1` | `#35597f` | azul-aço · 205° |
| `--color-dado-2` | `#2f6f74` | petróleo · 185° |
| `--color-dado-3` | `#4c4a86` | índigo · 245° |
| `--color-dado-4` | `#74477a` | ameixa · 292° |
| `--color-dado-5` | `#8a4668` | vinho-rosa · 330° |
| `--color-dado-neutro` | `#6f6f72` | cinza · saturação ~2% |

Cada uma tem par `-fundo` claro para área e preenchimento.

A separação **não é estética, é de segurança de leitura**. Nenhuma barra de gráfico
pode ser confundida com classificação de risco — nem de relance, nem por quem
enxerga cor de outro jeito. Evitar vermelho e verde de saída também resolve
deuteranopia de graça: a confusão mais comum simplesmente não tem como acontecer.

O efeito colateral é proposital: a paleta é fria sobre superfície creme e parece
vir de outro lugar. Gráfico neste produto **deve** parecer de outro lugar — é
informação de operação, não sinal clínico.

## Regras de uso

1. `--color-dado-*` para volume, série temporal e distribuição por categoria
   operacional. Nunca para classificar paciente.
2. `--color-risco-*` nunca em gráfico.
3. Série de gráfico não aceita cor arbitrária: a cor sai de `CORES_DE_DADO` por
   índice, em `componentes/sistema/painel.tsx`. Quem quiser pintar uma barra de
   vermelho precisa editar aquele arquivo, e ali vai ler o porquê de não poder.
4. Gráfico não pode depender de cor para ser lido: `title` por coluna com os
   números por extenso, e legenda com rótulo e valor em texto.
5. Seis séries é o teto. Acima disso, agrupar o excedente em "Outras" com o tom
   neutro — repetir cor faria duas categorias diferentes ficarem idênticas.

## Consequências

**Boas.** Existe onde colorir sem tocar na lei clínica. O gráfico é legível em
tons de cinza e para daltônicos. A cor da escala fica ainda mais exclusiva: agora
ela é a única coisa quente numa tela que tem cor.

**Ruins.** Duas paletas para manter. Alguém vai querer usar azul de decoração, e
isso volta ao problema que o ADR-004 resolveu — por isso a regra 3 tranca a cor no
componente, em vez de deixá-la como prop.

**Parcialmente coberto por verificador.** `scripts/conformidade.mjs` pega o caso
realista — token de dado na mesma linha que `situacao`, `classificacao`, `risco`
ou `FAIXAS`. Não é prova, é rede: um gráfico que classifique paciente por outro
caminho passaria. A trava forte continua sendo a regra 3.

## Primeira aplicação

`/admin/acessos` — volume de registros por dia, empilhado por tipo de ação.
Escolhido de propósito: registro de acesso é exigência de LGPD, operação pura,
nenhuma barra diz nada sobre paciente. Se o primeiro gráfico estivesse no plantão,
azul e ameixa dividiriam a tela com vermelho e âmbar da escala, e alguém em algum
plantão leria uma barra como classificação.
