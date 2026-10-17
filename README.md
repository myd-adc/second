# Трекер завозів у секонд-хендах

Закрита вебапка для групи друзів: показує, у яких секонд-хендах найближчим часом завіз і чи вони відкриті зараз, та веде журнал фактичних завозів («Завіз був» / «Завозу не було»). Next.js (App Router) + Supabase (Postgres, magic-link Auth, RLS), деплой на Vercel. Інтерфейс українською, дати за `Europe/Kyiv`, дні тижня `0 = понеділок`.

## Локальна розробка

Потрібні Node.js 20+ (краще 22), Docker.

```bash
npm install
npx supabase start          # локальний стек (перевірено з supabase CLI 2.121.0; `npx supabase@latest`)
scripts/e2e-env.sh          # створює .env.local із `supabase status` (файл у .gitignore)
npm run dev                 # http://127.0.0.1:3000
```

Відкривай саме `http://127.0.0.1:3000` (його дозволено в `supabase/config.toml`; `http://localhost:3000` теж у списку редіректів).
`supabase db reset` застосовує міграції `supabase/migrations/*` і `supabase/seed.sql`: у seed є дозволений користувач **`test@example.com`**, два магазини й правила завозів.
Лист зі входом містить і посилання, і 6-значний код (шаблон `supabase/templates/magic_link.html`, підключений у `supabase/config.toml`); локально листи потрапляють у Mailpit: <http://127.0.0.1:54324>. Студія: <http://127.0.0.1:54323>.
Зупинити стек: `npx supabase stop`.

## Тести

- `npm test` — юніт-тести (vitest) для `lib/*` і чистої логіки форм.
- `npm run e2e` — Playwright проти **реального** локального Supabase: справжній вхід за magic link і за 6-значним кодом (лист читається з Mailpit), створення магазину, відмітка завозу, перевірка доступу. Передумови: `npx supabase start`, `scripts/e2e-env.sh`, один раз `npx playwright install chromium`. Playwright сам збирає й запускає застосунок (`npm run build && npm run start -- -H 127.0.0.1`) — тобто тестується той самий production-білд, що їде на Vercel.
- Тести перезапускні на тій самій БД: магазин створюється з унікальною назвою й видаляється наприкінці; користувач `stranger@example.com` (поза `allowed_emails`) лишається в `auth.users` — це нешкідливо; чисту БД дає `npx supabase db reset`.
- SQL-тести політик і `save_store`: `docker exec -i supabase_db_second-hand-tracker psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/rls.sql` (і `save_store.sql`); обидва завершуються `ROLLBACK`.

## Продакшн

1. Створи проєкт на <https://supabase.com>.
2. Прив’яжи й застосуй міграції:
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
   **Не запускай `seed.sql` у продакшні** (тестовий користувач і магазини — лише для локальної розробки).
3. Додай себе й друзів у білий список (SQL editor у дашборді):
   ```sql
   insert into allowed_emails(email) values (lower('friend@example.com'));
   ```
   Друг просто відкриває застосунок, вводить цей email і заходить за посиланням з листа. Хто не в списку, потрапляє на «Немає доступу» і нічого не бачить (RLS).
4. **Свій SMTP (обов’язково для друзів).** Вбудований поштовий сервіс Supabase надсилає листи лише учасникам команди проєкту й має жорсткий ліміт (кілька листів на годину), тож друзі не отримають листів зі входом. Authentication → SMTP → *Enable Custom SMTP* і вкажи SMTP-доступ сервісу на кшталт Resend або Brevo (адреса відправника на підтвердженому домені). Потім перевір ліміт листів у Authentication → Rate Limits і підніми його під свою групу.
5. Authentication → налаштування в дашборді:
   - провайдер Email увімкнено, **Confirm email = ON**. Вимкнути вхід за паролем у хостовому Supabase не можна: реєстрація за паролем через API технічно можлива, але нешкідлива, бо `is_allowed()` вимагає підтверджений email **і** присутність адреси в `allowed_emails` (без доступу до пошти пароль-акаунт ні до чого не веде);
   - **Site URL** = адреса на Vercel (`https://<your-domain>`);
   - **Redirect URLs** — рівно `https://<your-domain>/auth/callback`, без wildcard-ів. Локальні адреси (`http://127.0.0.1:3000/...`, `http://localhost:3000/...`) живуть лише в локальному `supabase/config.toml`, у продакшн їх не додавай;
   - **Email Templates**: встав вміст `supabase/templates/magic_link.html` у шаблони **Magic Link** і **Confirm signup** (новий друг при першому вході отримує саме Confirm signup) і задай тему «Вхід у «Завози в секондах»». Шаблон має містити і `{{ .ConfirmationURL }}`, і `{{ .Token }}` (код), інакше резервний вхід за кодом не працюватиме. Довжину коду (Email OTP Length) лиши 6.
6. Vercel: імпортуй репозиторій і задай змінні оточення `NEXT_PUBLIC_SUPABASE_URL` та `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API), потім Deploy.
7. На телефоні відкрий сайт і «Додати на головний екран».

## Відомі обмеження

- Посилання з листа працює лише в тому браузері, де його запитували (PKCE: verifier лежить у cookie цього браузера); у вебзастосунку з головного екрана iOS cookie окремі від Safari, а поштові застосунки відкривають посилання у вбудованому браузері. Для цього є резервний вхід: на сторінці входу після надсилання листа введи 6-значний код з листа («Або введи код з листа») — він працює в будь-якому браузері.
- Service worker немає: холодне завантаження без мережі не працює (є лише банер офлайну для вже відкритої сторінки).
- `enable_signup` увімкнено, бо magic link створює користувача при першому вході; доступ усе одно обмежує таблиця `allowed_emails`.
- Карта: плитки OpenStreetMap (потрібна атрибуція, вона вже на карті), пошук адреси — публічний Nominatim (≈1 запит/сек, пошук обмежено Україною через `GEOCODE_COUNTRIES` у `lib/config.ts`). Для 5–20 друзів цього досить; якщо колись вийдете за межі такого навантаження, налаштуй власний геокодер і задай його адресу змінною `GEOCODER_URL` на Vercel.
