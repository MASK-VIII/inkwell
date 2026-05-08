# Limelight Umbrella

The marketing/studio site for [`enterthelimelight.com`](https://enterthelimelight.com).

The Inkwell app itself lives at `inkwell.enterthelimelight.com` and is built
from the rest of this repository (Vite + React). This `umbrella/` directory is
a separate **Astro** project that is deployed independently to the **apex
domain**.

## Stack

- [Astro 5](https://astro.build) — static site, zero client JS by default
- `@astrojs/mdx` — Markdown/MDX-driven journal posts
- `@astrojs/rss` — RSS feed at `/journal/rss.xml`
- `@astrojs/sitemap` — generates `/sitemap-index.xml`
- `@fontsource/playfair-display`, `@fontsource/eb-garamond`, `@fontsource/inter` — self-hosted fonts (no Google Fonts dependency)

## Local development

```bash
cd umbrella
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
npm run preview  # preview the built site
```

## Environment variables

Copy `.env.example` to `.env` and fill in:

```bash
PUBLIC_SUBSTACK_PUB=your-publication-slug
```

The slug is the subdomain part of your Substack URL — for example, if your
newsletter lives at `https://limelightjournal.substack.com`, set
`PUBLIC_SUBSTACK_PUB=limelightjournal`. When the var is unset, the
`SubscribeCard` component falls back to a "newsletter coming soon" message and
the footer hides its Substack link, so the site is shippable without it.

## Adding a journal post

Drop a new MDX file into `src/content/journal/` with frontmatter:

```mdx
---
title: 'Your post title'
description: 'One-sentence dek for cards and meta.'
pubDate: 2026-05-20
tags: ['craft', 'inkwell']
draft: false
---

# Your post title

Body...
```

The schema is defined in [`src/content/config.ts`](src/content/config.ts).
Posts marked `draft: true` are excluded from the index, RSS, and sitemap.

## Deploying to Vercel

The umbrella is its own Vercel project (separate from the Inkwell app):

1. In the Vercel dashboard, **Add New… → Project**.
2. Import this repository.
3. Set the **Root Directory** to `umbrella`.
4. Framework Preset: **Astro** (auto-detected).
5. Build command: `npm run build`. Output directory: `dist`.
6. Add `PUBLIC_SUBSTACK_PUB` to the project's environment variables (Production + Preview).
7. **Domains:** assign the apex `enterthelimelight.com` (and `www.enterthelimelight.com`) to this project.

The Inkwell app remains on its own Vercel project, bound to
`inkwell.enterthelimelight.com`. The two projects are independent.

## Brand notes

The umbrella owns a dark, theatrical identity — stage-black background, deep
crimson accents, antique gold hairlines, cream serif type. The Inkwell *app*
keeps its own warm parchment/walnut palette. When the umbrella links to
Inkwell, the `InkwellPlaybill` component uses a "Limelight Presents" frame
that lets Inkwell's parchment world peek through the dark Limelight chrome.

Design tokens live in [`src/styles/global.css`](src/styles/global.css).
