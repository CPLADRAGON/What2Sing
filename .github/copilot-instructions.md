# KTV-Picker Copilot Instructions

KTV-Picker (package name `ktv-picker`) is a mobile-first Next.js App Router app for importing KTV songs from music platforms, normalizing them, and running a swipe-friendly picking flow.

## Stack

- Next.js 16 App Router + React 19 + TypeScript (strict). The README says "Next.js 14"; the actual dependency is `next@^16`.
- Tailwind CSS (dark UI), next-intl for i18n, Supabase (`@supabase/supabase-js`) for auth + persistence, Cheerio for HTML parsing, Framer Motion for animation, `html2canvas` for image export.
- Import path alias `@/*` → `src/*` (configured in both `tsconfig.json` and `vitest.config.ts`).

## Commands

- `npm run dev` — start dev server; open `http://localhost:3000/en` or `/zh` (locale prefix is always required).
- `npm run build` / `npm run start` — production build and serve.
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`).
- `npm run test` — run the full Vitest suite once (`vitest run`, node environment).
- Run a single test file: `npx vitest run tests/qq-importer.test.ts`.
- Run tests matching a name: `npx vitest run -t "parses songs"`.
- Watch mode while iterating: `npx vitest tests/qq-importer.test.ts`.

## Architecture

- **Locale routing**: all pages live under `src/app/[locale]/` with locales `['en', 'zh']` (`src/i18n/routing.ts`). The next-intl middleware lives in `src/proxy.ts` (not the conventional `middleware.ts`) with `localePrefix: 'always'`. Request-scoped messages come from `src/i18n/request.ts`, which loads `messages/{locale}.json`. Keep `messages/en.json` and `messages/zh.json` in sync when adding UI copy.
- **Server vs client**: pages/layouts are async server components that `await params` and call `setRequestLocale(locale)`. Browser interactivity (the picker) is isolated into client components under `src/components/` (e.g. `components/picker/picker-experience.tsx`), rendered by thin server pages.
- **Import pipeline**: parsing logic is pure and lives in `src/lib/importers/` (`qq.ts`, `netease.ts`, `spotify.ts`, `manual.ts`). Route handlers under `src/app/api/import/<platform>/route.ts` do only fetching + host validation, then delegate to the pure parser. Every importer produces the shared `ImportedSong` type (`{title, artist, platform, tags}`) and passes results through `normalizeSongs` (re-exported from `manual.ts`).
- **Picker domain**: `src/lib/picker/` holds framework-agnostic logic — `session.ts` (deck/like/skip state, ordered vs random), `queue.ts`, `library.ts`, `persistence.ts` (localStorage keys like `ktv-picker:songs`). These are plain TS modules covered directly by tests; keep them free of React/DOM dependencies.
- **Auth**: `src/lib/auth/` contains pure helpers (`otp.ts`, `callback.ts`, `redirect.ts`, `cooldown.ts`, `profile.ts`, `server-errors.ts`) with API routes under `src/app/api/auth/`. Supabase login is magic-link based at `/[locale]/login`; `src/lib/supabase.ts` exports `supabase` as `null` when env vars are missing, so guest mode must keep working without Supabase configured.
- **Persistence schema**: Supabase migrations live in `supabase/migrations/` (`001_auth_song_sessions.sql`, `002_song_libraries.sql`).

## Conventions

- Keep importer/picker/auth logic as pure functions in `src/lib/**` and add a matching test in `tests/` (flat directory, `*.test.ts`, imports via the `@/` alias). Route handlers stay thin.
- Platform importers must validate the host before fetching (see the `QQ_HOST_PATTERN` guard in `api/import/qq/route.ts`) and return normalized JSON `{source, count, songs}`, with structured error/diagnostics payloads and appropriate status codes (400/422/502) on failure.
- Design language is dark and mobile-first (see `docs/design-guide.md`): near-black canvas `#050507`, lifted dark surfaces, 1px white hairline borders, pink `#ff3d8b` + cyan `#55e6ff` accents reserved for status/glow/focus, white-on-dark primary CTAs, ≥48px thumb targets. Do not introduce white SaaS-style surfaces.
- Code style: 2-space indent, single quotes, no space inside object braces (`{title, artist}`) — match existing files.
