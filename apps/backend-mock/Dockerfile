FROM docker.1ms.run/library/node:22-alpine AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm -F @vben/backend-mock run build

FROM docker.1ms.run/library/node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5320

COPY --from=builder /app/apps/backend-mock/.output /app/.output

EXPOSE 5320

CMD ["node", "/app/.output/server/index.mjs"]
