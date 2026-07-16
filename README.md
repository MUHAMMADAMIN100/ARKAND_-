# Щебёночный завод — ERP-модуль холдинга Arkand

Система учёта карьера по ТЗ «Часть 4 — Щебёночный завод» (WeBrand, июнь 2026): добыча и дробление, продукция по фракциям, заказы, цифровые талоны на отгрузку, доставка и рейсы, солярка/электроэнергия, себестоимость и мощность, техника и ТО, финансы (наличные / бартер-долг), снабжение и инвентаризация, отчёты руководству.

## Структура

```
packages/shared/   — общие Zod-схемы и типы (фронт + бэк)
backend/           — NestJS (модульный монолит) + Prisma + Kysely + PostgreSQL
frontend/          — React + Vite, FSD, TanStack Query (оптимистичные мутации)
```

## Быстрый старт (dev)

```bash
npm install
# настроить backend/.env по образцу backend/.env.example (DATABASE_URL)
npm run build:shared
npm run prisma:migrate        # миграции
npm run prisma:seed           # тестовые данные и пользователи
npm run dev:backend           # http://localhost:3001 (Swagger: /api/docs)
npm run dev:frontend          # http://localhost:5173
```

Без Docker: достаточно локального PostgreSQL (Redis опционален — без него кэш работает in-memory, фоновые очереди отключены).

## Деплой

- **GitHub** — монорепо.
- **Vercel** — `frontend/` (Vite static build), env: `VITE_API_URL`.
- **Railway** — `backend/` + PostgreSQL + Redis, env: `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_ORIGIN`.

## Роли системы

Оператор (и касса), помощник оператора, менеджер по продажам (и касса), 3 шофёра самосвалов, шофёр экскаватора, механик, снабженец, финансист, владельцы, администратор.
