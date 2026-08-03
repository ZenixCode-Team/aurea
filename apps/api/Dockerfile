# AUREA — API (Fastify + Prisma + MySQL)
#
# O contexto de build é a RAIZ do monorepo, não esta pasta: `@aurea/contratos` e
# `@aurea/triagem` são pacotes de workspace e não existem em nenhum registro. Build
# feito de dentro de `apps/api` falha na resolução de `workspace:*`.

FROM node:22-slim AS base

# openssl: o motor de consulta do Prisma linka contra ele em tempo de EXECUÇÃO, não só
# de build — imagem slim sem openssl sobe e só quebra na primeira query.
# tzdata: sem ele o contêiner não conhece America/Sao_Paulo e toda conta de dia do
# ciclo passa a ser feita em UTC, silenciosamente.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates tzdata \
 && rm -rf /var/lib/apt/lists/*

# `corepack prepare` baixa o pnpm AQUI, na camada compartilhada pelos dois estágios. Sem
# isso o contêiner de produção tentaria buscar o pnpm na internet no primeiro boot.
RUN corepack enable && corepack prepare pnpm@11.5.1 --activate

# ---------------------------------------------------------------------------
# Construção
# ---------------------------------------------------------------------------
FROM base AS construcao
WORKDIR /app

# Manifestos primeiro: a camada de dependências só invalida quando eles mudam, não a
# cada alteração de código. Os quatro projetos do workspace precisam existir em disco,
# senão `--frozen-lockfile` recusa o lockfile por divergência de importadores.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/contratos/package.json packages/contratos/
COPY packages/triagem/package.json packages/triagem/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# `@aurea/api...` = a API mais o que ela depende. O front e suas dependências (Next,
# GSAP, Framer) ficam de fora desta imagem.
RUN pnpm install --frozen-lockfile --filter @aurea/api...

COPY packages packages
COPY apps/api apps/api

# Os pacotes internos são consumidos por `dist/`, então precisam ser compilados antes
# da API. O build da API roda `prisma generate` antes do tsc.
RUN pnpm --filter @aurea/contratos build \
 && pnpm --filter @aurea/triagem build \
 && pnpm --filter @aurea/api build

# ---------------------------------------------------------------------------
# Execução
# ---------------------------------------------------------------------------
FROM base AS producao
WORKDIR /app

ENV NODE_ENV=production
ENV TZ=America/Sao_Paulo

# A árvore inteira, incluindo devDependencies: `pnpm start` roda `prisma migrate deploy`
# antes de subir, e o CLI do Prisma é devDependency. Podar aqui deixaria a imagem menor
# e o contêiner sem como migrar.
COPY --from=construcao /app /app

WORKDIR /app/apps/api
EXPOSE 3333

# `prisma migrate deploy && node dist/servidor.js` — migração aplicada antes de aceitar
# a primeira requisição.
CMD ["pnpm", "start"]
