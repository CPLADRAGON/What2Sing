# KTV-Picker Design Guide

Source researched: `VoltAgent/awesome-design-md`.

## Best-fit references

- Resend inspired design system: strongest fit for dark developer-product surfaces, hairline borders, elevated cards, dark form inputs, and atmospheric glow.
- Framer inspired design system: strongest fit for near-black marketing canvas, layered dark surfaces, selected pill states, and high-contrast product storytelling.

## Installed direction

KTV-Picker uses a karaoke-night variant of those systems:

- Canvas: near-black `#050507`.
- Cards: lifted dark surfaces `#0a0a0c` and `#101012`.
- Borders: subtle 1px white hairlines through `rgba(255,255,255,0.12)`.
- Accent glow: karaoke pink `#ff3d8b` plus cyan `#55e6ff`.
- Shape: rounded mobile panels and pill actions.
- Layout: mobile-first input card first, product preview second, desktop two-column hero.
- Motion: restrained Framer Motion entrance animation; no heavy swipe UI yet.

## Component guidance

- Inputs should remain dark, high-contrast, and thumb-friendly at 48px minimum height.
- Feature cards should use glassy dark cards, not white SaaS blocks.
- Primary CTA should be white-on-dark for legibility; pink/cyan are reserved for status, glow, and focus states.
- Future swipe cards should continue the dark card stack language, with pink for “pick” and cyan for “room resonance.”
