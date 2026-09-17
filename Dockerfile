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

# Copia dependências e arquivos compilados
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data
COPY --from=builder /app/public ./public

# Garante existência e permissões totais para o diretório de dados e uploads
RUN mkdir -p /app/data /app/uploads_storage && chmod -R 777 /app/data /app/uploads_storage

EXPOSE 3000

# Script de inicialização que ajusta as permissões do volume montado pelo Railway na inicialização
CMD ["sh", "-c", "mkdir -p /app/data /app/uploads_storage && chmod -R 777 /app/data /app/uploads_storage 2>/dev/null || true; node dist/server.cjs"]
