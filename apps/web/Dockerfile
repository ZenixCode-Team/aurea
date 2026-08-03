# AUREA — front (Next 16 + React 19)
#
# O contexto de build é a RAIZ do monorepo: `@aurea/contratos` é pacote de workspace.

FROM node:22-slim AS base
# curl: a sonda de saúde da Coolify roda dentro do contêiner e depende dele.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates tzdata curl \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.5.1 --activate

# ---------------------------------------------------------------------------
# Construção
# ---------------------------------------------------------------------------
FROM base AS construcao
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/contratos/package.json packages/contratos/
COPY packages/triagem/package.json packages/triagem/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

RUN pnpm install --frozen-lockfile --filter @aurea/web...

COPY packages packages
COPY apps/web apps/web

# `NEXT_PUBLIC_*` é substituído no bundle do navegador em tempo de BUILD, não lido do
# ambiente em tempo de execução. Endereço errado aqui não se conserta com variável no
# contêiner: exige rebuild.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm --filter @aurea/contratos build \
 && pnpm --filter @aurea/web build

# ---------------------------------------------------------------------------
# Execução
# ---------------------------------------------------------------------------
FROM base AS producao
WORKDIR /app

ENV NODE_ENV=production
ENV TZ=America/Sao_Paulo

COPY --from=construcao /app /app

# Repetido no estágio de execução porque componente de servidor lê a variável em tempo
# de requisição — o valor do build cobre só o que foi para o bundle do navegador.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

WORKDIR /app/apps/web
EXPOSE 3000

CMD ["pnpm", "start"]
