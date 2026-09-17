# Multi-stage Dockerfile para Railway — Maré Maricultura Nordeste
FROM node:22-alpine AS builder

WORKDIR /app

# Instala dependências
COPY package*.json ./
RUN npm ci

# Copia código-fonte e compila front-end (Vite) e servidor (esbuild)
COPY . .
RUN npm run build

# Imagem de produção enxuta
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Cria diretórios para dados e uploads (suporte a Railway Persistent Volume)
RUN mkdir -p /app/data /app/uploads_storage && chown -R node:node /app

# Copia arquivos compilados e dependências necessárias
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data
COPY --from=builder /app/public ./public

USER node

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
