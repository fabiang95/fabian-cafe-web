# Fabian Cafe ordering site: architecture

Status: draft, 2026-11-01. Open questions are listed at the end.

## Summary

Two TypeScript apps on Google Cloud Run:

- **fabian-cafe-web** (this repo): Next.js storefront and admin UI.
- **fabian-cafe-backend**: Node API that alone talks to Supabase and Telegram.

Customers order menu items for an open date without creating an account, using their phone number. Items are counted in a unit named by the config map (bowls for now). Customers can opt into Telegram updates by tapping a link that opens the bot. Fabian gets a Telegram alert for every new order.

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js (App Router, TypeScript), Tailwind CSS | One app for public menu, checkout and admin; small container |
| Backend | Node 22 + Fastify (TypeScript), Zod | Small and fast on Cloud Run; one place for business rules |
| Database | Supabase Postgres, migrations via Supabase CLI | Managed Postgres with backups |
| Images | Supabase Storage, folders set by the config map | Public URLs for menu photos |
| Admin login | Supabase Auth (Google provider), allowlist checked by the API | Google OAuth handled for us; the API decides who is admin |
| Messaging | One Telegram bot per environment, webhook into the API | Owner alerts and customer updates |
| Hosting / CI | Cloud Run, Artifact Registry, GitHub Actions | Scales to zero, near-zero cost when idle |

## System overview

```
 Customer phone ─┐                         ┌─ sign-in ──▶ Supabase Auth (Google)
                 ├─▶ fabian-cafe-web ──────┤
 Admin (Fabian) ─┘   (Next.js, no secrets) └─ REST ─▶ fabian-cafe-backend ─▶ Supabase Postgres + Storage
                                                         │   ▲
                                                    send │   │ webhook
                                                         ▼   │
                                                       Telegram bot ─▶ Fabian + linked customers
                                       Secret Manager ─▶ backend (config map + keys)
```

The browser only reaches Supabase to sign an admin in with Google. Everything else goes through the backend, which reads its config map from Secret Manager at startup.

## Frontend: fabian-cafe-web

```
fabian-cafe-web/
  app/
    page.tsx                 menu and upcoming open dates
    order/[date]/page.tsx    pick items, enter name and phone
    order/done/[id]/page.tsx confirmation + "Get updates on Telegram" button
    track/page.tsx           look up an order by phone + order number
    admin/
      login/page.tsx         Google sign-in
      orders/page.tsx        orders by date, change status
      dates/page.tsx         open or close dates, per-date limits
      menu/page.tsx          items, prices, photos
  lib/api.ts                 typed client for fabian-cafe-backend
  lib/auth.ts                Supabase Auth (Google) for admin only
  Dockerfile                 Next.js standalone build
  .github/workflows/deploy.yml
  .env.example
```

- Mobile first.
- Phone input normalized to E.164 (e.g. +6591234567) with `libphonenumber-js`.
- Unit word, limits and days shown come from `GET /config/public`; nothing is hard-coded.
- Admin pages render only after `GET /admin/me` succeeds.

## Backend: fabian-cafe-backend

```
fabian-cafe-backend/
  src/
    server.ts                Fastify app, CORS for the web origin
    config.ts                loads and validates the config map (Zod)
    db.ts                    Supabase client with the service role key
    routes/public.ts         config, menu, dates, place order, track order
    routes/admin.ts          orders, dates, menu, image upload URLs
    routes/telegram.ts       bot webhook
    services/orders.ts       place_order call, status changes
    services/telegram.ts     send helpers, message templates
    auth/admin.ts            verifies Supabase JWT, checks allowlist
  supabase/migrations/       SQL migrations, applied by CI
  supabase/seed.sql          sample items and dates for dev
  config/dev.yaml            config map for dev
  config/prod.yaml           config map for prod
  Dockerfile
  .github/workflows/deploy.yml
```

### API

| Method and path | Who | Does |
| --- | --- | --- |
| GET /config/public | Public | Business name, unit singular/plural, max units per order, days ahead shown |
| GET /menu | Public | Active menu items with image URLs |
| GET /dates | Public | Upcoming open dates with units left |
| POST /orders | Public | Places an order; rejects it if the date is full |
| GET /orders/track | Public | Order status by phone + order number |
| POST /telegram/webhook | Telegram | Bot updates, checked with the webhook secret header |
| GET /admin/me | Admin | Confirms the signed-in email is allowed |
| GET, PATCH /admin/orders | Admin | List by date, change status (triggers customer message) |
| GET, PUT /admin/dates | Admin | Open, close or limit a date |
| CRUD /admin/menu | Admin | Items, prices, photos |
| POST /admin/uploads | Admin | Signed upload URL into a configured image folder |

## Supabase schema

| Table | Key columns | Notes |
| --- | --- | --- |
| customers | id uuid, phone_e164 text unique, name, telegram_chat_id bigint null, telegram_linked_at, created_at | Phone number is the customer's identity |
| menu_items | id, name, description, price_cents int, image_path, is_active, sort_order | image_path relative to the configured menu folder |
| available_dates | date (PK), is_open bool, max_units_override int null, order_cutoff_at timestamptz, note | Null override = config default |
| orders | id, order_number text unique, customer_id, date, status, total_units, total_cents, customer_note, created_at | Status: pending, confirmed, ready, completed, cancelled |
| order_items | order_id, menu_item_id, quantity, unit_price_cents | Price copied at order time |
| telegram_links | token text, customer_id, order_id, expires_at, used_at | One-time token in the Telegram deep link |
| notifications | id, order_id, chat_id, kind, status, error, sent_at | Log of every Telegram send |

`place_order(phone, name, date, items)` runs in one transaction:

1. Upsert the customer by phone.
2. Lock the `available_dates` row (`SELECT … FOR UPDATE`); reject if closed or past cutoff.
3. Sum units on that date's non-cancelled orders; reject if the new total passes the limit.
4. Insert the order and items; return the order number.

Row Level Security is on for every table with no public policies. Only the backend's service role key reads or writes. The browser's anon key is used for admin sign-in only.

## Config map per environment

Cloud Run has no Kubernetes ConfigMap. Equivalent: one YAML file per environment stored in Secret Manager, mounted into the backend at `/config/app.yaml`. Change = new secret version + redeploy (about a minute, no code change). The reviewed copies live in `fabian-cafe-backend/config/`.

```yaml
# config/prod.yaml
environment: prod
business:
  name: "Fabian Cafe"
  timezone: Asia/Singapore        # placeholder, confirm
orders:
  max_units_per_date: 40          # default limit, overridable per date in admin
  max_units_per_order: 10
  unit:                           # the word customers see
    singular: bowl
    plural: bowls
  days_ahead_shown: 14
  cutoff_hours_before: 24
images:
  bucket: images
  folders:
    menu: prod/menu
    banners: prod/banners
    gallery: prod/gallery
admin:
  allowed_emails:
    - fabian@example.com
telegram:
  bot_username: fabian_cafe_bot
  owner_chat_ids: [123456789]     # who gets new-order alerts
web:
  origin: https://order.example.com
```

`dev.yaml` has the same shape with `environment: dev`, `dev/` image folders, a test bot and a smaller allowlist. The backend validates the file with Zod at startup and refuses to boot if it is invalid. Secrets (Supabase service role key, bot token, webhook secret) are separate Secret Manager entries exposed as env vars, never in this file.

## Auth

**Customers** have no account. The phone number links their orders. Because anyone could type someone else's number:

- Placing an order needs name + phone.
- Viewing an order needs phone + the order number from the confirmation page.
- Telegram linking proves ownership of the number (Telegram shares a verified phone number).
- SMS codes can be added later if abuse appears.

**Admins:**

1. Admin page signs in with Supabase Auth, Google provider.
2. Supabase issues a short-lived JWT.
3. The browser sends it as `Authorization: Bearer <jwt>` on every `/admin` call.
4. The backend verifies the JWT and checks the lowercased email against `admin.allowed_emails`; anyone else gets 403.

One Google OAuth client per environment, each with that environment's site URL as a redirect URL in Google Cloud and Supabase.

## Telegram flows

A bot can only message someone who has opened it and pressed Start, and it cannot look users up by phone. Customers link once; after that every order from the same phone gets messages.

**Owner alerts:** on each new order, send order number, date, customer name and phone, items and quantities, total, units left for that date to `telegram.owner_chat_ids`. Confirm/Ready/Cancel buttons can come later.

**Linking a customer:**

1. Confirmation page shows "Get updates on Telegram" → `https://t.me/<bot>?start=<token>` (random, single use, expires in 7 days).
2. Telegram sends `/start <token>` to the webhook; the backend finds the token and customer.
3. Bot replies with a "Share my phone number" button (contact request).
4. Customer taps it; Telegram sends the verified number for their account.
5. If it matches the order's phone, save `telegram_chat_id` and confirm in chat. If not, link nothing.

**Customer messages** (only when `telegram_chat_id` is set):

| When | Message |
| --- | --- |
| Linked | Your order and its date |
| Admin confirms | Order confirmed |
| Admin marks ready | Ready for pickup or on its way |
| Admin cancels | Cancelled, with a note |
| Evening before | Reminder for tomorrow |

On a 403 from Telegram (user blocked the bot), clear `telegram_chat_id`. The webhook checks the `X-Telegram-Bot-Api-Secret-Token` header.

## Deploy and environments

| | Dev | Prod |
| --- | --- | --- |
| Deploys when | Every merge to `main` | GitHub release tag, e.g. v1.2.0 |
| Cloud Run services | fabian-cafe-web-dev, fabian-cafe-backend-dev | fabian-cafe-web-prod, fabian-cafe-backend-prod |
| Supabase project | fabian-cafe-dev (free tier) | fabian-cafe-prod |
| Telegram bot | test bot | real bot |
| Config secret | app-config-dev | app-config-prod |
| Domain | Cloud Run default URLs | own domain, e.g. order.example.com / api.example.com |

Pipeline per repo (GitHub Actions):

1. Lint, type check, test on every PR.
2. Build the Docker image, push to Artifact Registry.
3. Backend only: apply Supabase migrations to that environment.
4. `gcloud run deploy` with the image (backend: mounted config secret + env var secrets).
5. Backend only: register that environment's bot webhook URL if it changed.

GitHub authenticates to Google Cloud with Workload Identity Federation (no key files). Cloud Run scales to zero, so the first request after idle takes 1–2 s; one minimum instance on prod backend removes that. Supabase pauses free projects after a week of inactivity, so prod should be on a paid plan.

## Build phases

1. **Foundations:** repos, Supabase projects, GCP project, Artifact Registry, Workload Identity; hello-world deploy to dev.
2. **Ordering:** schema + `place_order`, public endpoints, menu, date picker, checkout, confirmation page.
3. **Admin:** Google sign-in + allowlist, orders by date with status changes, dates, menu and photo upload.
4. **Telegram:** owner alerts, customer deep-link linking, status messages, evening reminder.
5. **Prod launch:** prod config, domain, real bot, end-to-end test order.
6. **Later:** owner buttons in Telegram, online payment, SMS codes, sales totals.

## Open questions

- [ ] Is the unit limit per day (as drafted), per order, or per item type? Does every item count as one unit, or can some count differently?
- [ ] Pickup, delivery, or both?
- [ ] Pay on pickup, bank transfer, or online card payment?
- [ ] Usual open days, and how late can someone order for a date?
- [ ] Can customers cancel or change orders themselves?
- [ ] Country and timezone.
- [ ] Domain name.
- [ ] Admin Google emails.
