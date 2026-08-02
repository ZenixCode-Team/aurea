# Decisões de arquitetura

Registro do **porquê**. O código diz o que o sistema faz; estes documentos dizem por que
ele faz assim, e o que foi descartado no caminho.

Antes de mudar qualquer coisa que um ADR descreve, leia o ADR. Se a decisão não valer
mais, o caminho é escrever um novo que a supere — não editar o antigo. ADR superado
continua no repositório: quem chega depois precisa saber que a alternativa foi
considerada e por que caiu.

## Índice

| # | Título | Estado |
|---|--------|--------|
| [ADR-001](ADR-001-plataforma-e-arquitetura.md) | Plataforma e arquitetura — o algoritmo como dado versionado | aceito, §3 superado pelo ADR-003 |
| ADR-002 | Direção visual da landing | **não existe como documento** — ver nota abaixo |
| [ADR-003](ADR-003-monorepo-e-nucleo-da-triagem.md) | Monorepo e núcleo da triagem | aceito |
| [ADR-004](ADR-004-direcao-visual-dos-paineis.md) | Direção visual dos painéis internos | aceito |
| [ADR-005](ADR-005-paleta-de-dados-nao-clinica.md) | Paleta de dados não-clínica | aceito |
| [DC-001](DC-001-ui-do-sistema-aurea.md) | Direção criativa da UI do sistema | vigente |

**Sobre o ADR-002:** o README do projeto e vários comentários no código citam "ADR-002 —
direção visual da landing" como se fosse um documento. Ele nunca foi escrito. A decisão
existe e está viva — paleta, tipografia da landing e as duas refs-base (titanintake e
oevra) —, mas mora espalhada em comentários de `globals.css`, `hero.tsx` e
`fundo-organico.tsx`. É dívida documentada, não esquecimento.

## As leis que atravessam tudo

Três regras nascem destes documentos e valem em qualquer tela. Não são preferência de
estilo — quebrá-las é dano ao paciente:

1. **O paciente nunca vê cor de risco, nome de regra ou nome de campo.** A lei é imposta
   por tipo: `RetornoDoCheckin` não tem campo para classificação.
2. **Toda classificação vem com a regra que a produziu**, por extenso. Sem isso o painel
   vira caixa-preta.
3. **Silêncio não é verde.** Questionário começado e não terminado não recebe
   classificação.

`apps/web/scripts/conformidade.mjs` verifica mecanicamente o que dá para verificar. O que
ele pega é rede, não prova — a leitura destes documentos continua sendo obrigatória.

## Onde mora o resto

O quadro de trabalho, os briefings e os relatórios de entrega ficam **fora** deste
repositório, em `~/.maestri/maestro/`. São processo, não produto: registram quem fez o
quê e em que ordem, e envelhecem em semanas. Estes ADRs registram decisão, e precisam
viajar com o código.
