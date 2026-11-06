# Progress tracker

Where the MVP stands. Update this file in the same PR as the work it describes.

Legend: `[x]` done · `[~]` in progress · `[ ]` not started · `[?]` blocked on an open decision

Last updated: 2026-11-05

## Milestones

Build order follows spec section 12: calendar → menu → cart → checkout → QR page.

### 0. Scaffold — `chore/scaffold-next-app`
- [x] Next.js (App Router) + TypeScript + Tailwind
- [x] ESLint, `typecheck`, Vitest scripts
- [x] `.env.example` with `NEXT_PUBLIC_API_URL`; real `.env*` git-ignored
- [x] `AGENTS.md` with project rules and cart/add-on contract (`CLAUDE.md` imports it)
- [ ] Prettier set up (listed in conventions, not installed yet)
- [ ] First commit and PR into `main`
- [ ] CI on every PR (lint, typecheck, test, build, per `docs/development.md`). Deferred until there is presentable UI

### 1. Cart logic (`lib/cart.ts`)
- [x] Merge key built from add-ons sorted by ID, quantities included
- [x] Add, merge, set quantity, remove, edit add-ons (with re-merge)
- [x] Line total, cart total, bowl count, in integer cents
- [x] Unit tests (17 passing)
- [ ] `sessionStorage` persistence + React state wrapper

### 2. API layer (`lib/api.ts`, mocked)
- [x] Types for café date, menu item, order submission, order summary (spec sections 5 and 6, with per-add-on quantities)
- [x] Fake `getCafeDates(month)`, `getMenu(date)`, `createOrder()`, `getOrder(accessToken)` with simulated latency and `ApiError`
- [x] `MenuItem` and `SelectedAddon` moved here from `lib/cart.ts`
- [x] Unit tests (9 passing): backend-side repricing, validation, no personal data in order summary
- [?] Payment QR field on the order (open decision 3)

### 3. Landing / calendar
- [ ] Brand **THE LITTLE BOWL** + **Block 269, Singapore 600269**, no tagline
- [ ] Replace the default Next.js page and metadata
- [ ] Calendar with available dates from the API, not colour-only, keyboard accessible
- [ ] Dates shown in `Asia/Singapore`

### 4. Menu for a date
- [ ] Selected date shown prominently
- [ ] Add-on quantity pickers (0 = not selected), bowl quantity ≥ 1
- [ ] Live display total
- [ ] Add to cart, stay on menu, cart always reachable

### 5. Cart page
- [ ] Lines with per-line totals, bowl count, grand total
- [ ] Change quantity, edit add-ons, remove line
- [?] One date per cart (open decision 8)

### 6. Guest checkout
- [ ] Phone required, normalised to E.164 with `libphonenumber-js` (default `+65`)
- [ ] Name and email optional; email format validated if given
- [ ] Order summary before submit
- [ ] Duplicate-submit guard; a failure keeps the cart with a recoverable error
- [ ] Checkout validation tests

### 7. Payment QR page
- [ ] Reached via an unguessable token, not an enumerable ID
- [ ] Shows QR, order reference and backend-calculated amount
- [ ] Never marks the order paid
- [ ] Cart cleared only after the order reference is safely stored
- [?] QR format and payee details (open decision 3)

### 8. Backend integration
- [ ] Swap mocks in `lib/api.ts` for real calls once `fabian-cafe-backend` exists
- [?] Hosting (not decided)

## Acceptance criteria (spec section 11)

Frontend-owned or shared criteria. Criteria 11, 13 and 14 belong to the backend.

| # | Criterion | Status |
|---|---|---|
| 1 | Brand and address, no tagline | [ ] |
| 2 | Calendar marks server-provided dates | [ ] |
| 3 | Date opens its menu | [ ] |
| 4 | Choose add-ons and quantity | [ ] |
| 5 | Several configurations in cart | [~] logic done |
| 6 | Duplicate configuration merges | [~] logic done |
| 7 | Quantity/removal updates totals | [~] logic done |
| 8 | Refresh keeps cart | [ ] |
| 9 | Checkout with phone alone | [ ] |
| 10 | Rejects bad email / missing phone | [ ] |
| 12 | QR shown for new order | [ ] |
| 15 | Not auto-marked paid | [ ] |
| 16 | Failed submit keeps cart | [ ] |
| 17 | No login or native app | [x] by design |

## Open decisions to watch (spec section 10)

Ask before building anything that depends on these: fulfilment model, real prices, QR type/payee, payment review, date capacity, order expiry, hosting/email, one date per cart.
