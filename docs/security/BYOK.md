# BYOK (Bring Your Own Key) secret-handling policy

## Scope
This policy applies to any feature where a user supplies their own API key/token (AI models, cloud services, etc.).

## Non-negotiables
- **Never store secrets in plaintext persistent storage** on the web (no `localStorage`, `indexedDB`, `persisted Redux`, etc.).
- **Never log secrets** (console logs, telemetry, error reports).
- **Never echo secrets back to the UI** after initial entry (mask by default; require explicit reveal).
- **Default to user transparency**: AI features should be suggestion-only unless the user explicitly applies changes.

## Web (Vite / static hosting)
- **Default**: session-only storage (in-memory). A page refresh clears the key.
- **If “remember key” is added later**: only allow it when encrypted at rest using a user-provided passphrase.
  - Encrypt client-side before writing to persistent storage.
  - Use a modern KDF (e.g. PBKDF2/scrypt/Argon2) + authenticated encryption (e.g. AES-GCM).
  - Store only the ciphertext + salt + parameters; never store the passphrase.

## Desktop (future wrapper)
- Store secrets using the **OS credential store/keychain** (Windows Credential Manager, macOS Keychain, Linux Secret Service).
- Do not fall back to file storage unless it is encrypted and the encryption key is protected by the OS.

## Operational guidance
- **Secrets in transit**: only send keys to the intended API endpoint; do not proxy through third-party services.
- **Threat model**: treat XSS as a key-compromise event; keep XSS baseline low (CSP + sanitization) before BYOK features ship.

