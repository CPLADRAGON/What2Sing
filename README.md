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

`POST /api/import/spotify` is also available as an experimental public-page parser for Spotify playlist URLs. It does not require Spotify developer credentials, but it can fail when Spotify does not expose track metadata in the public HTML. If it returns no songs, paste the playlist text manually.

## Design direction

The landing page uses the Resend and Framer dark design-system cues from `VoltAgent/awesome-design-md`: near-black canvas, lifted dark surfaces, hairline borders, atmospheric glow, pill controls, and mobile-first dense input cards.

## Auth and per-user persistence

Login uses Supabase Auth magic links at `/en/login` and `/zh/login`. Guest mode still works without Supabase environment variables.

To enable per-user saved picker sessions, run the SQL migration in `supabase/migrations/001_auth_song_sessions.sql` in your Supabase project, then configure these Vercel environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL` — production URL used by Supabase magic links, e.g. `https://what2-sing.vercel.app`

In Supabase Auth settings, set the Site URL to your production domain and add these Redirect URLs:

- `https://what2-sing.vercel.app/en/login`
- `https://what2-sing.vercel.app/zh/login`
- `http://localhost:3000/en/login`
- `http://localhost:3000/zh/login`

### iPhone Home Screen login code

iOS opens email magic links in Safari, while a Home Screen web app keeps a separate Supabase session. To log in inside the installed Home Screen app, the auth email must show Supabase's one-time token so the user can copy it back into KTV-Picker.

In Supabase Dashboard, go to **Authentication → Email Templates → Magic Link** and include `{{ .Token }}` in the email body. If the Supabase Auth log shows `user_recovery_requested`, also add the same block to **Authentication → Email Templates → Recovery** because that event uses the Recovery template instead of Magic Link. Example:

```html
<p>Your KTV-Picker login code is:</p>
<p style="font-size: 28px; font-weight: 700; letter-spacing: 0.25em;">{{ .Token }}</p>
<p>Or open this magic link in your browser:</p>
<p><a href="{{ .ConfirmationURL }}">Log in to KTV-Picker</a></p>
```

Save the template, then request a new login email from the Home Screen app.
