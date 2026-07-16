# Multi-stage build для Railway. Собирает shared + backend, гоняет Prisma migrate deploy на старте.
FROM node:24-alpine AS builder
WORKDIR /app

# Корневой манифест + workspaces
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/

RUN npm install

# Исходники
COPY packages/shared ./packages/shared
COPY backend ./backend

RUN npm run build:shared
RUN npm run prisma:generate -w backend
RUN npm run build -w backend

# --- Runtime ---
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package.json ./backend/
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

WORKDIR /app/backend
EXPOSE 3001
# Миграции + запуск
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
