FROM docker.1ms.run/library/node:22-alpine AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /app

RUN corepack enable

COPY . .

ARG VITE_BASE=/
ARG VITE_GLOB_API_URL=/api
ARG VITE_GINGER_API_URL=/api/ginger
ARG VITE_MX_SIGN_SALT=mx-custom-v1

RUN cat > apps/web-antd/.env.production.local <<EOF
VITE_BASE=${VITE_BASE}
VITE_GLOB_API_URL=${VITE_GLOB_API_URL}
VITE_GINGER_API_URL=${VITE_GINGER_API_URL}
VITE_MX_SIGN_SALT=${VITE_MX_SIGN_SALT}
EOF

RUN pnpm install --frozen-lockfile
RUN pnpm run build:antd

FROM docker.1ms.run/library/nginx:stable-alpine AS runner

COPY apps/web-antd/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web-antd/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
