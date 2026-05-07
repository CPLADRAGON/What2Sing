# KTV-Picker

Mobile-first Next.js App Router app for importing KTV songs, normalizing them, and preparing a swipe-friendly picking flow.

## Stack

- Next.js 14 App Router + TypeScript
- Tailwind CSS dark UI
- next-intl with `/en` and `/zh` routes
- Supabase client bootstrap for future Realtime rooms
- Cheerio-powered QQ Music import API
- Framer Motion landing-page transitions

## Getting started

1. Copy `.env.example` to `.env.local` and fill in Supabase values when ready.
2. Run `npm run dev`.
3. Open `http://localhost:3000/en` or `http://localhost:3000/zh`.

## API

`POST /api/import/qq`

```json
{
  "url": "https://y.qq.com/..."
}
```

Returns normalized songs:

```json
{
  "source": "qq",
  "count": 1,
  "songs": [
    {"title": "稻香", "artist": "周杰伦", "platform": "qq", "tags": []}
  ]
}
```

## Design direction

The landing page uses the Resend and Framer dark design-system cues from `VoltAgent/awesome-design-md`: near-black canvas, lifted dark surfaces, hairline borders, atmospheric glow, pill controls, and mobile-first dense input cards.

## Auth and per-user persistence

Login uses Supabase Auth magic links at `/en/login` and `/zh/login`. Guest mode still works without Supabase environment variables.

To enable per-user saved picker sessions, run the SQL migration in `supabase/migrations/001_auth_song_sessions.sql` in your Supabase project, then configure these Vercel environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
