# Release security checklist (minimal)

## Before shipping
- **Dependency audit**: run `npm audit` and address high/critical issues (or document why a finding is non-exploitable in our threat model).
- **Lockfile discipline**: ensure `package-lock.json` is committed and reflects what we tested.
- **Sanitizer upkeep**: if `dompurify` is used for any HTML rendering, keep it updated and treat major/minor updates as security-relevant.
- **XSS baseline**:
  - CSP present (meta in `index.html`; prefer moving to hosting response headers when deploying).
  - Any `dangerouslySetInnerHTML` path must sanitize with an allowlist.
  - URL schemes for `href`/`src` are allowlisted (no `javascript:` etc.).
- **Secrets posture**:
  - No plaintext API keys in persistent storage.
  - No secrets in logs or error messages.
  - `.env` / local credentials are not committed.

## Security assumptions (documented)
- App is **local-first** and should be safe against crafted manuscript content (XSS in preview/export).
- If/when BYOK is added, treat XSS as a key-compromise event; ship BYOK only after XSS baseline is in place.

