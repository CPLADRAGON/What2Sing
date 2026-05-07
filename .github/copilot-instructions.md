# KTV-Picker Copilot Instructions

- Project: KTV-Picker, a mobile-first Next.js App Router app for KTV song importing and picking.
- Stack: TypeScript, Next.js App Router, Tailwind CSS, next-intl, Supabase, Shadcn UI-compatible primitives, Framer Motion, Cheerio.
- Locales: English (`en`) and Simplified Chinese (`zh`) with routes under `/[locale]`.
- Prefer server components by default; use client components only for browser interactivity.
- Keep API parsing logic in focused utility modules and route handlers.
- Use mobile-first responsive Tailwind classes and dark atmospheric surfaces inspired by the Resend/Framer dark design systems from awesome-design-md.
