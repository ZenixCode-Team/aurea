# AUREA

Monitoramento remoto de toxicidade em quimioterapia.

O AUREA pergunta ao paciente, todos os dias em casa, como ele está passando. Classifica a
resposta com uma regra clínica versionada e avisa a enfermagem quando o sinal aparece. O
objetivo é encurtar a distância entre o sintoma surgir em casa e a equipe saber disso.

> ⚠️ **Todo dado neste repositório é sintético.** Nome, CPF, diagnóstico e sintoma de
> pessoa real só entram no sistema depois da aprovação do Comitê de Ética. Vale para o
> banco de desenvolvimento, para o ambiente de demonstração e para print em apresentação.

---

## As três leis do produto

Não são preferências de estilo. São regras clínicas, e o código as trata como tal.

1. **O paciente nunca vê cor de risco, nome de regra ou nome de campo.** Ele recebe
   orientação em português escrita pela equipe. A lei é imposta por tipo: `RetornoDoCheckin`
   não tem campo para classificação, então a tela não consegue exibi-la nem por engano.
   Um verificador automático (`scripts/conformidade.mjs`) barra qualquer regressão.
2. **Toda classificação vem acompanhada da regra que a produziu**, com a justificativa por
   extenso. Sem isso o painel vira caixa-preta — inaceitável em software clínico.
3. **Silêncio não é verde.** Questionário começado e não terminado não recebe
   classificação: as duas causas mais prováveis são opostas — a pessoa está bem e se
   distraiu, ou está mal demais para continuar.

## O algoritmo é dado, não código

Os cortes de risco vivem em tabela versionada, não em `if`. O orientador clínico muda o
limiar sem deploy, e toda classificação guarda qual conjunto a produziu — porque uma
classificação feita em março precisa continuar explicável depois que a regra mudar em maio.
Conjunto publicado nunca é editado: publica-se outro.

Enquanto ninguém com responsabilidade clínica assinar os cortes, a interface é **obrigada**
a exibir a marca "não validado clinicamente".

---

## Estrutura

```
aurea/
├── apps/
│   ├── api/          Fastify + Prisma + MySQL — 40+ endpoints, 28 tabelas
│   └── web/          Next 16 + React 19 + Tailwind 4 — 41 telas
└── packages/
    ├── contratos/    tipos, validações e a árvore de triagem (compartilhados)
    └── triagem/      o motor de classificação (24 testes)
```

**Três aplicações num só frontend**, com regimes de uso opostos:

| Área | Público | Regime |
|---|---|---|
| `/app` | paciente em quimioterapia | mobile-first, 2 min por dia, calmo |
| `/painel` | enfermagem de plantão | desktop, denso, decisão em segundos |
| `/admin` | orientador clínico | desktop, o algoritmo como tabela |

## Stack

TypeScript estrito · pnpm workspaces · Next 16 · React 19 · Tailwind 4 · Fastify · Prisma ·
MySQL · Zod · Vitest

Identificadores, comentários e commits em **português**. É a convenção do projeto.

---

## Como rodar

```bash
pnpm install

# banco (MySQL local)
cd apps/api
cp .env.example .env          # gere o SEGREDO_DA_SESSAO: openssl rand -hex 32
pnpm prisma:migrate
pnpm seed

# api + web
cd ../..
pnpm dev                       # api :3333 · web :3000
```

Para abrir as telas **sem servidor e sem banco** — útil para revisão visual:

```bash
NEXT_PUBLIC_ORIGEM_DOS_DADOS=sintetico pnpm dev:web
```

### Credenciais do ambiente de demonstração

Senha única: `aurea-demo-2026`

| Perfil | Usuário |
|---|---|
| Paciente | CPF `12345678909` |
| Enfermagem | `enfermagem@aurea.local` |
| Administração | `admin@aurea.local` |

## Verificação

```bash
pnpm typecheck                       # 4 projetos
pnpm lint
pnpm test                            # 61 testes
cd apps/web && node scripts/conformidade.mjs   # as leis clínicas
```

O `conformidade.mjs` falha o processo se qualquer cor de risco vazar para o app do
paciente, se um token de risco for usado como decoração, ou se aparecer `any`. Revisão por
leitura humana falha no arquivo 30; isso não falha.

---

## Decisões de arquitetura

Em `.maestri/maestro/decisoes/`:

- **ADR-001** — o algoritmo como dado versionado
- **ADR-002** — direção visual da landing
- **ADR-003** — monorepo e núcleo da triagem
- **ADR-004** — direção visual dos painéis internos

## Estado

Frontend completo e ligado à API. O ciclo clínico foi provado ponta a ponta: login por CPF
→ check-in com febre alta → gravação no banco → o paciente aparece no painel da enfermagem
com a regra e a justificativa que produziram a classificação.

**Em aberto:** testes automatizados das rotas novas · envio real de e-mail na recuperação
de senha · rota de publicação de conjunto de orientações · telas de cadastro ainda não
gravam pela interface (os endpoints existem).
