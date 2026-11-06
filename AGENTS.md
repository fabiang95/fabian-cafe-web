# AGENTS.md — fabian-cafe-web

Frontend for The Little Bowl, a small home-based café in Singapore that opens on selected dates. Customers pick an open date, customise pork rice bowls, add them to a session cart, check out as a guest, and see a payment QR code. This is a responsive web app, not a native mobile app.

`docs/THE_LITTLE_BOWL_SPEC.md` is the source of truth for the product. This file adds to it and wins where they differ (see "Cart and add-ons"). `docs/architecture.md` is superseded; do not build from it. `docs/development.md` still applies for branches, PRs and commits. `docs/progress.md` tracks MVP progress; read it when resuming work and update it in the same PR as the work.

This repo is frontend only. The backend lives in the sister repo `fabian-cafe-backend`.

## Working with Fabian: mentor mode
Fabian is a backend engineer using this project to learn frontend, and enjoys being tested. Act as a mentor.
- Work in small steps and explain why each one exists.
- Relate frontend ideas to backend concepts.
- Keep quizzing: ask one short question per step, such as predicting what code will do, then give clear feedback on the answer.
- Quizzes never block the work. If Fabian says to skip one or wants something finished quickly, explain and move on.

## Stack
- React with Next.js (App Router) + TypeScript, Tailwind CSS
- Talks only to the backend API over HTTPS/JSON
- Until the backend exists, `lib/api.ts` serves mock data. Pages and components must not know whether data is mocked.
- Hosting is not decided.
- `AGENTS.md` is the single agent instructions file (Codex, Cursor, etc.). `CLAUDE.md` only imports it for Claude Code; never put rules there. The `nextjs-agent-rules` block at the end is managed by `next dev`; don't edit it.

## Hard rules
- No secrets in this repo or in the browser bundle. Only `NEXT_PUBLIC_*` values that are safe to expose.
- No business data in components. Dates, menu items, add-ons and prices come from the API (mocked for now). All current prices are placeholders.
- Do not build future features or assume answers to the spec's open decisions (sections 9 and 10). Ask first if one has business impact.
- MVP has no customer accounts or login, no admin area, no capacity limits and no Telegram.
- Show only the brand **THE LITTLE BOWL** and the address **Block 269, Singapore 600269**, exactly as written. Never use the tagline "Homemade Japanese Rice Bowls" and never invent unit numbers or pickup instructions.
- Phone is required; name and email are optional. Normalize phone numbers to E.164 with `libphonenumber-js`, defaulting to Singapore (`+65`).
- Never send prices or totals to the API as the truth. The backend calculates them; frontend totals are for display only.
- Never mark an order as paid because a QR code was shown or emailed. Payment is verified manually.
- Order pages must not expose personal details through guessable URLs.
- A failed order submission keeps the cart. Guard against duplicate submits.
- Use integer cents for money, display in SGD, and present dates in `Asia/Singapore`.
- Mobile first and keyboard accessible. Never rely on colour alone to show state.

## Cart and add-ons
This replaces the spec's add-on data shape (sections 5 and 11), where add-ons are a plain list of IDs.

- Each selected add-on has its own quantity, per bowl: `{"menuItemId": "pork-rice-bowl", "quantity": 2, "addons": [{"id": "onsen-egg", "quantity": 2}]}` means two bowls, each with two onsen eggs.
- Add-ons with a quantity of 0 are not selected and are left out.
- Two cart configurations are the same only if they have the same menu item and exactly the same add-ons with exactly the same quantities. Add-on order does not matter.
- Build the merge key from add-ons sorted by ID, including each quantity. Identical configurations merge by adding their bowl quantities; anything else stays a separate line.
- Line total = (base price + sum of add-on price × add-on quantity) × bowl quantity.
- The cart lives in React state and `sessionStorage`. There is no server-side cart.

## Environment variables (`.env.example`)
```
NEXT_PUBLIC_API_URL=            # backend base URL
```

## Commands
Available once the app is scaffolded.
```
npm run dev        # local dev server
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # unit tests (Vitest)
npm run build      # production build
```
Run lint, typecheck and tests before every commit. Cart merging, pricing and checkout validation must have tests.

## Conventions
- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`.
- Small PRs into `main`; never push directly to `main`.
- Prettier + ESLint formatting; do not fight the formatter.
- Keep API types in `lib/api.ts` in sync with the spec's data contracts and API surface (sections 5 and 6), and with the backend once it exists.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
