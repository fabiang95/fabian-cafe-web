# Development practices

Applies to both `fabian-cafe-web` and `fabian-cafe-backend`.

## Branches and releases
- `main` is protected: no direct pushes, PR required, checks must pass.
- Short-lived branches: `feat/<topic>`, `fix/<topic>`, `chore/<topic>`.
- Merge to `main` → auto-deploy to **dev**.
- Release tag `vX.Y.Z` on `main` → deploy to **prod**. Only two environments exist: dev and prod.

## Pull requests
- Small and focused; one concern per PR.
- CI runs on every PR: lint, type check, unit tests, build.
- Squash-merge with a Conventional Commit title.

## Commits
Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.

## Code style
- TypeScript `strict` mode.
- Prettier + ESLint; formatting is never debated in review.
- Validate all external input with Zod (backend) and form schemas (frontend).

## Config and secrets
- Non-secret settings live in the config map (`config/dev.yaml`, `config/prod.yaml` in the backend) and change through PRs.
- Secrets live only in Google Secret Manager. Never commit them.
- `.env.example` lists every variable; real `.env*` files are git-ignored.
- The frontend only uses `NEXT_PUBLIC_*` values that are safe to expose.

## Database
- Every schema change is a migration file in `fabian-cafe-backend/supabase/migrations/`.
- No manual edits in the Supabase dashboard on prod.
- Migrations are applied by CI, dev first, then prod on release.

## Testing priorities
1. Unit limit per date (including two orders racing for the last unit).
2. Order flow: place, track, status changes.
3. Admin allowlist: a valid Google login that is not on the list gets 403.
4. Telegram linking: phone mismatch links nothing.

## Working with Claude Code
- Each repo has an `AGENTS.md` with its stack, rules and commands; keep it current when conventions change. `CLAUDE.md` just imports it (`@AGENTS.md`) for Claude Code.
- Ask Claude Code to run lint, typecheck and tests before committing.
- Keep `docs/architecture.md` updated when the API, schema or config map changes.
