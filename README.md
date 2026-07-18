# Inkwell

Free, local-first writing software for novels and long manuscripts.

**Draft. Format. Publish.** — chapter-first drafting, print/ebook layout previews, and exports (EPUB, print-ready PDF, DOCX, Markdown, plain text). No account, no subscription, no upsell. Your library stays on your device.

- **Web app:** open `/app` after starting the dev server (or use the production site).
- **Desktop:** Windows installer via GitHub Releases (see `docs/DESKTOP.md`).

## Develop

```bash
npm install
npm run dev
```

```bash
npm test
npm run build
```

Desktop (optional):

```bash
npm run dev:desktop
```

## Product posture

Inkwell is intentionally **local-only** in this repository:

- Manuscripts live in browser storage / the desktop app — not a cloud sync backend.
- There is no billing integration in the app.
- Backups are portable `.inkwell.zip` archives you export yourself.

## Docs

- [`docs/DESKTOP.md`](docs/DESKTOP.md) — building and publishing the Windows app
- [`docs/security/release-checklist.md`](docs/security/release-checklist.md) — release hygiene

## License

Private / unlicensed unless you add a license file. Add one before treating contributions as open source.
