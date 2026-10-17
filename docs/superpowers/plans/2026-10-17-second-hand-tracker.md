# Трекер завозів у секонд-хендах — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Закрита веб-апка, що показує, у яких секонд-хендах найближчим часом завіз і чи вони відкриті зараз, з журналом фактичних завозів від групи друзів.

**Architecture:** Next.js App Router (Server Components + Server Actions) над Supabase (Postgres, magic-link Auth, RLS). Уся календарна арифметика — у чистих модулях `lib/schedule` і `lib/opening-hours`, без React і БД. Екрани тонкі, запити до БД лише через `lib/db`.

**Tech Stack:** Next.js (App Router), TypeScript, Supabase (`@supabase/ssr`), Vitest, Playwright, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-16-second-hand-tracker-design.md`

## Global Constraints

- Часова зона: `Europe/Kyiv`, одна константа `TIMEZONE` у `lib/config.ts`.
- Дати завозів — `date` без часу; в коді це рядок `"YYYY-MM-DD"` (тип `ISODate`). Арифметика днів — через UTC-півночі, щоб DST не зсував дні.
- Дні тижня: `0 = понеділок … 6 = неділя` скрізь (БД, код, UI).
- `kind` правила: `weekly | every_n_weeks | monthly_nth | irregular`; `monthly_nth.nth` ∈ {1,2,3,4,-1}; `every_n_weeks.interval_weeks ≥ 2`.
- Журнал: унікальність `(store_id, date, reported_by)`.
- Доступ: лише email із `allowed_emails`; видалення магазину — тільки `created_by`, видалення запису журналу — тільки `reported_by`.
- Не в MVP: нагадування, карта, фото, рейтинги, коментарі, публічна реєстрація.
- UI українською. Компоненти не імпортують Supabase напряму.

## Review Focus

- `every_n_weeks`, якір у майбутньому відносно `from`: фаза береться назад від якоря, завіз до якоря не вигадується… але дати ≥ `from` мають бути коректні (тест у Task 2).
- `monthly_nth` з `nth=-1` у місяцях з 4 і 5 потрібними днями тижня (Task 2).
- `from` збігається з днем завозу — результат містить сьогодні (Task 2).
- Магазин працює «до 00:00» і інтервал через полуніч; вихідний (Task 4).
- Перехід на літній/зимовий час у `Europe/Kyiv`: «сьогодні» і `isOpenAt` у ніч переходу (Task 4).
- Магазин без жодного запису журналу й без правил — не падає, показується внизу списку з «немає даних» (Task 7).
- Повторна відмітка тієї ж людини на ту ж дату — оновлює запис, а не падає з помилкою унікальності (Task 8).

---

### Task 1: Каркас проєкту

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `lib/config.ts`, `.env.example`, `.gitignore`, `app/layout.tsx`, `app/page.tsx`

**Interfaces:**
- Produces: `TIMEZONE: "Europe/Kyiv"` у `lib/config.ts`; скрипти `npm test` (vitest run), `npm run e2e` (playwright test), `npm run dev`.

- [ ] **Step 1:** `npx create-next-app@latest . --ts --app --no-tailwind --eslint --use-npm` у корені (зберегти `docs/`), додати dev-залежності `vitest`, `@playwright/test`, залежності `@supabase/supabase-js`, `@supabase/ssr`.
- [ ] **Step 2:** Додати `vitest.config.ts` (environment `node`, include `lib/**/*.test.ts`), скрипти в `package.json`, `lib/config.ts`, `.env.example` з `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] **Step 3:** Run: `npm test -- --passWithNoTests && npm run build` → Expected: обидві команди успішні.
- [ ] **Step 4:** Commit: `chore: scaffold next.js, vitest, playwright`

### Task 2: Прогноз завозів за правилом

**Files:**
- Create: `lib/schedule/types.ts`, `lib/schedule/dates.ts`, `lib/schedule/occurrences.ts`
- Test: `lib/schedule/occurrences.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  `type ISODate = string`;
  `type Rule = { kind: "weekly"; weekday: number } | { kind: "every_n_weeks"; weekday: number; intervalWeeks: number; anchorDate: ISODate } | { kind: "monthly_nth"; weekday: number; nth: 1|2|3|4|-1 } | { kind: "irregular" }`.
- Produces (`dates.ts`): `addDays(d: ISODate, n: number): ISODate`, `weekdayOf(d: ISODate): number` (0=пн), `daysBetween(a: ISODate, b: ISODate): number`.
- Produces (`occurrences.ts`): `nextOccurrences(rule: Rule, from: ISODate, count: number): ISODate[]` (включно з `from`; `irregular` → `[]`).

- [ ] **Step 1: Failing tests** у `occurrences.test.ts` (всі очікування — точні дати):
  - `weekly` пн, `from = "2026-10-12"` (пн) → перший елемент `"2026-10-12"`; `from = "2026-10-13"` → `"2026-10-19"`.
  - `every_n_weeks` ср, інтервал 2, якір `"2026-10-07"`: `from "2026-10-08"` → `["2026-10-21", "2026-11-04"]` (count 2); `from "2026-10-07"` → починається з `"2026-10-07"`.
  - `every_n_weeks`, якір у майбутньому (`"2026-12-02"`), `from "2026-10-07"` → перший `"2026-10-07"` (фаза екстраполюється назад).
  - `every_n_weeks` через кінець року: якір `"2026-12-23"`, інтервал 2 → друга дата `"2027-01-06"`.
  - `monthly_nth` чт, `nth=1`, `from "2026-10-01"` → `["2026-10-01", "2026-11-05"]`.
  - `monthly_nth` чт, `nth=-1`: жовтень 2026 (5 четвергів) → `"2026-10-29"`; листопад 2026 (4 четверги) → `"2026-11-26"`.
  - `irregular` → `[]`.
- [ ] **Step 2:** Run: `npx vitest run lib/schedule/occurrences.test.ts` → Expected: FAIL (модуль не існує).
- [ ] **Step 3:** Implement `dates.ts` (UTC-арифметика через `Date.UTC`, ніколи локальний час) і `nextOccurrences`. Для `every_n_weeks`: `k = ceil(daysBetween(anchor, from) / (7*interval))`, дозволений від'ємний `k`. Для `monthly_nth`: ітерація по місяцях, обчислення n-го/останнього дня тижня в місяці.
- [ ] **Step 4:** Run: той самий тест → Expected: PASS.
- [ ] **Step 5:** Commit: `feat(schedule): next occurrences for weekly, every-n-weeks, monthly-nth rules`

### Task 3: Прогноз для irregular і оцінка довіри

**Files:**
- Create: `lib/schedule/confidence.ts`, `lib/schedule/irregular.ts`
- Test: `lib/schedule/confidence.test.ts`, `lib/schedule/irregular.test.ts`

**Interfaces:**
- Consumes: `Rule`, `ISODate`, `nextOccurrences`, `addDays`, `daysBetween`.
- Produces: `type DeliveryEvent = { date: ISODate; happened: boolean }`;
  `predictIrregular(events: DeliveryEvent[], from: ISODate): ISODate | null` — медіана інтервалів між останніми 5 `happened`-фактами, якщо їх ≥ 3, від останнього факту; інакше `null`;
  `type Confidence = { matched: number; total: number; daysSinceLastEvent: number | null; stale: boolean }`;
  `confidence(rule: Rule, events: DeliveryEvent[], today: ISODate): Confidence`.

- [ ] **Step 1: Failing tests:**
  - `predictIrregular`: 0 і 2 факти → `null`; факти `2026-09-01, 09-08, 09-15` → від `from "2026-09-16"` повертає `"2026-09-22"`; `happened:false` ігноруються.
  - `confidence`: правило `weekly` пн, 5 останніх понеділків усі з `happened:true` → `matched 5, total 5`; факт із зсувом +1 день теж зараховується; жодного факту → `matched 0`, `daysSinceLastEvent null`.
  - `stale`: `every_n_weeks` інтервал 2 (період 14 днів), останній запис 29 днів тому → `stale true`; 27 днів → `false`; `irregular` — поріг 30 днів.
- [ ] **Step 2:** Run: `npx vitest run lib/schedule` → Expected: FAIL.
- [ ] **Step 3:** Implement. Період правила: weekly = 7, every_n_weeks = 7×інтервал, monthly_nth = 31, irregular — поріг 30 (без подвоєння). Останні 5 прогнозованих дат `total` рахуються назад від `today` (дати < `today`); для цього додати внутрішню допоміжну `previousOccurrences` у `confidence.ts`.
- [ ] **Step 4:** Run: `npx vitest run lib/schedule` → Expected: PASS.
- [ ] **Step 5:** Commit: `feat(schedule): irregular prediction and confidence scoring`

### Task 4: Години роботи і «сьогодні» у Києві

**Files:**
- Create: `lib/opening-hours/index.ts`, `lib/schedule/today.ts`
- Test: `lib/opening-hours/index.test.ts`, `lib/schedule/today.test.ts`

**Interfaces:**
- Consumes: `TIMEZONE`, `ISODate`.
- Produces: `type DayHours = { weekday: number; opens: string | null; closes: string | null; isClosed: boolean }` (час `"HH:MM"`);
  `isOpenAt(hours: DayHours[], instant: Date): boolean`; `closesAt(hours: DayHours[], instant: Date): string | null` (`"HH:MM"` найближчого закриття, якщо зараз відкрито);
  `todayInKyiv(instant: Date): ISODate`; `kyivParts(instant: Date): { date: ISODate; weekday: number; minutes: number }`.

- [ ] **Step 1: Failing tests:**
  - 10:00–19:00: відкрито о 10:00, закрито о 19:00 (права межа виключна), 09:59 закрито.
  - Інтервал `22:00–00:00` (closes `"00:00"`): відкрито о 23:30, закрито о 00:00 наступного дня.
  - Інтервал через полуніч `20:00–02:00` у понеділок: у вівторок о 01:00 відкрито; `closesAt` повертає `"02:00"`.
  - `isClosed: true` → завжди `false`.
  - DST: `instant = 2026-10-25T00:30:00Z` (ніч переходу на зимовий час у Києві; о 04:00 локального годинники повертаються на 03:00) → `todayInKyiv` = `"2026-10-25"`; `instant = 2026-10-24T21:30:00Z` → `"2026-10-25"` (ще літній час, 00:30 за Києвом); `instant = 2026-10-24T20:59:00Z` → `"2026-10-24"`.
  - Літній перехід: `instant = 2026-03-28T21:30:00Z` → `"2026-03-28"` (23:30 за Києвом, +2); `2026-03-28T22:00:00Z` → `"2026-03-29"`.
- [ ] **Step 2:** Run: `npx vitest run lib/opening-hours lib/schedule/today.test.ts` → Expected: FAIL.
- [ ] **Step 3:** Implement `kyivParts` через `Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, ... }).formatToParts`; `isOpenAt` перевіряє сьогоднішній інтервал і «хвіст» учорашнього, що перейшов за полуніч.
- [ ] **Step 4:** Run: ті самі тести → Expected: PASS.
- [ ] **Step 5:** Commit: `feat: opening hours and Kyiv-local date helpers`

### Task 5: Схема БД, RLS, ключі

**Files:**
- Create: `supabase/migrations/0001_schema.sql`, `supabase/migrations/0002_rls.sql`, `supabase/seed.sql`
- Test: `supabase/tests/rls.sql` (pgTAP) або ручна перевірка в Step 4

**Interfaces:**
- Produces: таблиці `profiles`, `allowed_emails`, `stores`, `opening_hours`, `delivery_rules`, `delivery_events` точно за розділом 3 спеку, зі CHECK-обмеженнями: `every_n_weeks` ⇒ `interval_weeks ≥ 2 AND anchor_date NOT NULL`; `monthly_nth` ⇒ `nth IN (1,2,3,4,-1)`; `irregular` ⇒ `weekday IS NULL`; `UNIQUE(store_id, weekday)` на `opening_hours`; `UNIQUE(store_id, date, reported_by)` на `delivery_events`. Функція `is_allowed() returns boolean` (SECURITY DEFINER: `auth.jwt()->>'email'` є в `allowed_emails`). Тригер створення `profiles` при реєстрації.

- [ ] **Step 1:** Написати `0001_schema.sql` (таблиці, enum `rule_kind`, обмеження, тригер профілю).
- [ ] **Step 2:** Написати `0002_rls.sql`: RLS увімкнено на всіх таблицях; select/insert/update — `is_allowed()`; delete `stores` — `created_by = auth.uid()`; delete `delivery_events` — `reported_by = auth.uid()`; `allowed_emails` — жодної політики для клієнта.
- [ ] **Step 3:** `seed.sql` — один тестовий email у `allowed_emails`, два магазини з правилами (для e2e і локальної розробки).
- [ ] **Step 4:** Run: `supabase db reset` (локально) → Expected: міграції застосовуються без помилок; в `psql` перевірити, що вставка `every_n_weeks` без `anchor_date` відхиляється, а анонімний `select * from stores` повертає 0 рядків.
- [ ] **Step 5:** Commit: `feat(db): schema and RLS policies`

### Task 6: Auth, клієнти Supabase, шар `lib/db`

**Files:**
- Create: `lib/supabase/server.ts`, `lib/supabase/browser.ts`, `middleware.ts`, `app/login/page.tsx`, `app/auth/callback/route.ts`, `app/no-access/page.tsx`, `lib/db/stores.ts`, `lib/db/rules.ts`, `lib/db/hours.ts`, `lib/db/events.ts`

**Interfaces:**
- Consumes: типи з Task 2–4.
- Produces: `createServerClient(): SupabaseClient`; у `lib/db/*`:
  `listStores(): Promise<StoreWithDetails[]>` (магазин + `hours: DayHours[]` + `rules: RuleRow[]` + `events: DeliveryEvent[]` — останні 20),
  `getStore(id: string): Promise<StoreWithDetails | null>`,
  `saveStore(input: StoreInput): Promise<string>` (повертає id; пише магазин, години й правила однією транзакцією через RPC `save_store`),
  `deleteStore(id: string): Promise<void>`,
  `markDelivery(storeId: string, date: ISODate, happened: boolean, note?: string): Promise<void>` — upsert за `(store_id, date, reported_by)`.
  Тип `StoreWithDetails`, `StoreInput`, `RuleRow` експортуються з `lib/db/types.ts`.

- [ ] **Step 1:** Middleware: без сесії → редирект на `/login`; із сесією, але `is_allowed()` = false → `/no-access`.
- [ ] **Step 2:** `/login` — форма email → `signInWithOtp`; `/auth/callback` обмінює код на сесію; `/no-access` — текст «Попроси доступ у автора» і кнопка виходу.
- [ ] **Step 3:** Додати RPC `save_store(...)` у нову міграцію `0003_save_store.sql`; реалізувати `lib/db/*`.
- [ ] **Step 4:** Run: `npm run build` → Expected: успіх. Ручна перевірка: логін із email із seed → потрапляєш на `/`; інший email → `/no-access`.
- [ ] **Step 5:** Commit: `feat: auth flow and db access layer`

### Task 7: Екран «Сьогодні»

**Files:**
- Create: `lib/schedule/overview.ts`, `app/page.tsx`, `app/_components/StoreRow.tsx`
- Test: `lib/schedule/overview.test.ts`

**Interfaces:**
- Consumes: `StoreWithDetails`, `nextOccurrences`, `predictIrregular`, `confidence`, `isOpenAt`, `closesAt`, `todayInKyiv`.
- Produces: `type StoreOverview = { id: string; name: string; nextDelivery: ISODate | null; daysUntil: number | null; openNow: boolean; closesAt: string | null; ruleLabel: string; confidence: Confidence | null }`;
  `buildOverview(stores: StoreWithDetails[], now: Date): StoreOverview[]` — відсортовано за `daysUntil` зростанням, `null` у кінці; для кількох правил береться найближча дата.

- [ ] **Step 1: Failing tests:** сортування (сьогодні → завтра → через 4 дні → `null`); магазин без правил і без журналу → `nextDelivery null`, не падає, у кінці; два правила в одного магазину → береться раніша дата; `ruleLabel` для `every_n_weeks` ср, 2 тижні = `"кожні 2 тижні, ср"`, для `weekly` пн = `"щотижня, пн"`.
- [ ] **Step 2:** Run: `npx vitest run lib/schedule/overview.test.ts` → Expected: FAIL.
- [ ] **Step 3:** Implement `buildOverview` (чиста функція); `app/page.tsx` — Server Component: `listStores()` → `buildOverview(…, new Date())` → список `StoreRow` з бейджами «ЗАВІЗ СЬОГОДНІ» / «завтра» / «через N дн.», «відкрито до HH:MM» / «зараз закрито», прапорець застарілості.
- [ ] **Step 4:** Run: `npx vitest run lib/schedule && npm run build` → Expected: PASS і успішна збірка.
- [ ] **Step 5:** Commit: `feat: today screen with delivery overview`

### Task 8: Екран магазину і відмітка завозу

**Files:**
- Create: `app/stores/[id]/page.tsx`, `app/stores/[id]/actions.ts`, `app/stores/[id]/_components/MarkButtons.tsx`

**Interfaces:**
- Consumes: `getStore`, `markDelivery`, `buildOverview`.
- Produces: Server Action `markDeliveryAction(storeId: string, happened: boolean, date?: ISODate): Promise<{ ok: true } | { ok: false; error: string }>` — `date` за замовчуванням `todayInKyiv(new Date())`; після успіху `revalidatePath("/")` і `revalidatePath(\`/stores/${storeId}\`)`.

- [ ] **Step 1:** Сторінка: години на тиждень, активні правила, останні 10 записів журналу (хто, коли, нотатка), оцінка довіри («збіглося K з N», «останнє підтвердження N дн. тому»).
- [ ] **Step 2:** `MarkButtons` (client): «Завіз був» / «Завозу не було»; на `{ ok:false }` показує помилку під кнопками і лишає кнопки активними; повторна відмітка тієї ж дати оновлює запис (upsert у `markDelivery`).
- [ ] **Step 3:** Run: `npm run build` → Expected: успіх. Ручна перевірка: двічі натиснути «Завіз був» за сьогодні → у журналі один рядок; відмітка «не було» після цього змінює його.
- [ ] **Step 4:** Commit: `feat: store page with one-tap delivery marking`

### Task 9: Список магазинів і форма

**Files:**
- Create: `app/stores/page.tsx`, `app/stores/new/page.tsx`, `app/stores/[id]/edit/page.tsx`, `app/stores/_components/StoreForm.tsx`, `app/stores/actions.ts`, `lib/schedule/validate.ts`
- Test: `lib/schedule/validate.test.ts`

**Interfaces:**
- Produces: `validateRule(input: unknown): { ok: true; rule: Rule } | { ok: false; error: string }` — відхиляє `interval_weeks < 2`, відсутній якір, `nth` поза {1,2,3,4,-1}, `weekday` поза 0–6, `irregular` із `weekday`;
  Server Actions `saveStoreAction(formData: FormData)` і `deleteStoreAction(id: string)`.

- [ ] **Step 1: Failing tests** для `validateRule` (по одному кейсу на кожне відхилення + по одному валідному на кожен `kind`).
- [ ] **Step 2:** Run: `npx vitest run lib/schedule/validate.test.ts` → Expected: FAIL.
- [ ] **Step 3:** Implement `validateRule`; список із пошуком по назві й адресі (параметр `?q=`, фільтр на сервері); форма: назва, адреса, 7 рядків годин (відкрито/закрито/вихідний), динамічні рядки правил; одна форма для створення й редагування; кнопка «Видалити» лише коли `created_by` = поточний користувач.
- [ ] **Step 4:** Run: `npx vitest run && npm run build` → Expected: усе PASS.
- [ ] **Step 5:** Commit: `feat: stores list and create/edit form`

### Task 10: Помилки, офлайн і відстань

**Files:**
- Create: `app/_components/OfflineBanner.tsx`, `app/_components/Distance.tsx`, `lib/geo.ts`, `app/error.tsx`
- Modify: `app/layout.tsx`, `app/_components/StoreRow.tsx`
- Test: `lib/geo.test.ts`

**Interfaces:**
- Produces: `distanceKm(a: {lat:number;lng:number}, b: {lat:number;lng:number}): number` (гаверсинус).

- [ ] **Step 1: Failing test:** `distanceKm` — Київ (50.4501, 30.5234) ↔ Львів (49.8397, 24.0297) ≈ 468 км (допуск ±3).
- [ ] **Step 2:** Run: `npx vitest run lib/geo.test.ts` → Expected: FAIL. Implement; PASS.
- [ ] **Step 3:** `OfflineBanner` (client, слухає `online/offline`) — текст «Немає зв'язку, дані можуть бути несвіжі»; `app/error.tsx` — повідомлення й кнопка «Спробувати ще раз»; `Distance` показує «за N км» лише коли браузер дав геолокацію і в магазину є координати.
- [ ] **Step 4:** Commit: `feat: offline banner, error boundary, optional distance`

### Task 11: E2E і деплой

**Files:**
- Create: `e2e/happy-path.spec.ts`, `e2e/auth.setup.ts`, `README.md`
- Modify: `playwright.config.ts`

- [ ] **Step 1:** `auth.setup.ts` — отримує сесію для seed-email (через admin API `generateLink` локального Supabase) і зберігає `storageState`.
- [ ] **Step 2: Test** `happy-path.spec.ts`: відкрити `/stores/new` → заповнити «Тест Секонд», правило «кожні 2 тижні, середа» з якорем на найближчу середу, години → зберегти → на сторінці магазину натиснути «Завіз був» → відкрити `/` → бачити «Тест Секонд» і запис про завіз.
- [ ] **Step 3:** Run: `npm run e2e` → Expected: PASS.
- [ ] **Step 4:** `README.md`: як створити проєкт Supabase, застосувати міграції, додати email у `allowed_emails`, виставити змінні оточення на Vercel.
- [ ] **Step 5:** Commit: `test: e2e happy path; docs: setup and deploy`
