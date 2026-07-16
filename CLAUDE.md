# CLAUDE.md — Щебёночный завод (ERP-модуль холдинга Arkand)

Учётная система карьера по ТЗ «Часть 4 — Щебёночный завод» (коды ЩЕБ-01…72 + ИНВ + правила ХОЛ). Часть единой CRM-экосистемы холдинга.

## Команды

```bash
# Разработка
npm run build:shared                      # собрать общий пакет (обязательно перед бэком)
npm run dev:backend                       # NestJS на :3001 (Swagger /api/docs, health /api/health)
npm run dev:frontend                      # Vite на :5173 (проксирует /api на :3001)

# БД (из backend/)
npm run prisma:migrate -w backend         # применить/создать миграцию
npm run prisma:seed -w backend            # тестовые данные (14 юзеров, пароль password123)

# Проверки
npm run build                             # сборка всего (shared → backend → frontend)
npm run lint                              # eslint бэк + фронт (бэк: границы модулей)
npm run test                              # jest (бэк) + vitest (фронт)
```

Локальная БД: PostgreSQL. `backend/.env` → `DATABASE_URL`. (В разработке использовался отдельный кластер на порту 5433.)

## Архитектура

Монорепо (npm workspaces): `packages/shared`, `backend`, `frontend`.

### packages/shared
Общий контракт фронт↔бэк: Zod-схемы (`src/schemas/`) и enum'ы с русскими подписями (`src/enums.ts`). **Единый источник валидации** — бэкенд валидирует теми же схемами, что фронт.
- Собирается в **CommonJS** (`dist/`) — так его потребляет NestJS (require).
- Фронтенд импортирует **из исходников** (`vite.config.ts` alias `@sheben/shared` → `src/index.ts`), Vite компилирует TS напрямую. Из-за этого фронту не нужен `dist`.
- Значения enum'ов строго = enum'ам Prisma.

### backend (NestJS — модульный монолит)
- `src/common/` — глобальная инфраструктура: `prisma/` (PrismaService + `TransactionHost` на AsyncLocalStorage — сквозные транзакции), `kysely/` (аналитика/отчёты), `stock/` (StockService — **единственный** способ менять остатки, append-only движения), `finance/` (DebtService — долги между бизнесами), `audit/`, `auth/` (JwtAuthGuard + RolesGuard — глобальные), `zod/` (ZBody/ZodQueryPipe).
- `src/modules/<домен>/` — controller/service/repository/mapper/module. Общение между доменами — только через глобальные фасады или чтение через PrismaService. Границы охраняет `eslint-plugin-boundaries`.
- Домены: auth, users, catalog(products), clients, warehouse, orders, shipments(talons), production, fleet, energy, finance, procurement, inventory, reports, health.
- API: `/api/v1/*` (URI-версионирование), health version-neutral на `/api/health`. Swagger `/api/docs`.
- Ключевые правила: деньги `Decimal(14,2)`, количества `Decimal(14,3)`; PK — UUIDv7; keyset-пагинация для больших таблиц (talons, movements).

### frontend (React + Vite — FSD упрощённый)
- `src/app/` — провайдеры (QueryClient, Router, ErrorBoundary), layout (сайдбар/десктоп + нижняя навигация/мобильный), роутер с lazy-загрузкой страниц, `nav.ts` (меню по ролям).
- `src/shared/` — `api/http.ts` (fetch-клиент + авто-refresh токена), `api/optimistic.ts` (`useOptimisticMutation` — **все мутации оптимистичны**), `auth/` (Zustand-стор, токены в localStorage), `ui/` (UI-кит: Button/Field/Input/Select/Modal/Card/DataTable/StatusChip/…), `lib/` (format, hooks, zodForm).
- `src/entities/<домен>/api.ts` — queryKeys + http-функции (типы из shared).
- `src/pages/<домен>/<Name>Page.tsx` — страницы (именованный экспорт `<Name>Page`, роутер импортирует по имени).
- Адаптив: mobile-first, **320–425px выглядит одинаково** (fluid, DataTable→карточки на мобильном). Токены в `app/styles/tokens.css`.

## Роли и доступ (RBAC + ABAC)
OWNER, ADMIN, OPERATOR, ASSISTANT_OPERATOR, SALES_MANAGER, DUMP_TRUCK_DRIVER, EXCAVATOR_DRIVER, MECHANIC, SUPPLY_MANAGER, FINANCIER.
- ABAC: водитель видит только свои талоны/рейсы; кассир (оператор/менеджер продаж) — только свою кассу.
- Оператор и менеджер продаж играют роль кассы.

## Ключевые бизнес-потоки
- **Производство**: смена → выпуск по фракциям (приход на склад FINISHED) + расход горной массы (склад RAW).
- **Продажа**: заказ → подтверждение → талон на машину (списание склада, при бартере INTERNAL-клиента → автодолг ХОЛ-30) → отгрузка/доставка.
- **Себестоимость** (ЩЕБ-33): расходы периода ÷ выпуск. **Мощность** (ЩЕБ-32): выпуск/смена из данных.
- **Снабжение**: заявка → крупная (≥ порога) уходит на согласие всех владельцев → закупка → оприходование.
- **Инвентаризация**: запуск (снабжение) → пересчёт (оператор) → недостача с ответственным / излишек приходуется.

## Деплой
GitHub → **Vercel** (frontend, env `VITE_API_URL`) + **Railway** (backend + PostgreSQL + Redis; `Dockerfile`, `railway.json`, миграции на старте). CORS настроен на раздельные домены.
