# ADR-004 — Direção visual dos painéis internos

- **Data:** 2026-07-30
- **Estado:** aceito
- **Substitui:** o DC das telas internas registrado no briefing 038 (Brightharbor + Rhetorich)
- **Não afeta:** ADR-002 (direção visual da landing), que segue valendo para o que é público

## Contexto

O João revisou o sistema no navegador e reprovou o acabamento: *"tá com cara de protótipo
de jr, e não somos jr"*. Trouxe duas referências novas e pediu que os três painéis —
paciente, enfermagem e administração — sejam organizados como elas.

**Refs-base novas:**
1. **Airtable — Projects dashboard** (imagem fornecida pelo João)
2. **Quicken — Spending Plan** (imagem fornecida pelo João)

O briefing anterior acertou o *tom* (sóbrio, clínico, sem enfeite) e errou o *acabamento*:
produziu telas corretas e pobres. Densidade virou aperto, e sobriedade virou ausência de
hierarquia visual. As duas coisas são diferentes.

## Imprint das refs — o que é lei agora

Denominador comum das duas referências, e o que passa a valer:

1. **Sidebar persistente** com hierarquia (seção → itens) e item ativo com fundo sólido.
   Substitui o menu horizontal fino. Navegação é mobília, não decoração.
2. **Cabeçalho de página com trilha** (breadcrumb) + título grande + uma linha de
   contexto explicando o que a tela mostra. As duas refs fazem isso.
3. **Linha de indicadores** no topo do conteúdo: card próprio por número, número em
   corpo grande, rótulo acima. É o padrão dos três KPIs do Airtable.
4. **Filtros como pills** com rótulo visível, não como botões genéricos.
5. **Cards com respiro**: radius generoso, sombra suave em vez de borda dura, padding
   interno confortável.
6. **Badge arredondado** para estado, legível, com fundo tintado — padrão das duas refs.
7. **Barra de progresso** como informação primária onde houver proporção (Quicken).
8. **Ação primária sólida e destacada**, com ícone, no canto superior direito do bloco.

## O que NÃO vem das refs

**Cor decorativa.** As duas referências usam cor como categoria — ícone roxo para contas,
verde para renda, azul para metas. Aqui isso é proibido, e a proibição é clínica, não
estética:

> Sage, âmbar e terracota significam classificação de risco. Nada mais recebe essas
> cores, em nenhuma tela. E no app do paciente elas não existem.

Para navegação, ícones e acentos, o sistema usa o verde institucional (`--color-verde-profundo`)
e a escala de neutros. Um ícone bonito colorido custa a legibilidade do único sinal que
importa nesta tela.

## Consequências

- Os três shells são reescritos com sidebar.
- Novos primitivos: cartão de indicador, barra de progresso, badge, trilha, cabeçalho de
  página, filtro em pill.
- Tokens ganham escala de sombra e radius maior.
- O app do paciente **não** ganha sidebar: continua mobile-first com navegação inferior.
  O que ele herda das refs é o respiro, o cartão e a hierarquia tipográfica — sidebar em
  tela de 390px seria copiar a forma e perder a razão.
- Densidade continua sendo qualidade no painel — mas densidade organizada por hierarquia,
  não por compressão.

## Verificação

`scripts/conformidade.mjs` continua sendo o guarda das leis clínicas. Nenhuma mudança
visual pode fazê-lo falhar.
