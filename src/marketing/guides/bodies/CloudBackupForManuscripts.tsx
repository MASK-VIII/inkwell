import { CLOUD_LIMIT_BASIC_DISPLAY, CLOUD_LIMIT_PRO_DISPLAY } from '../../pricingCopy'

export default function CloudBackupForManuscriptsBody() {
  return (
    <>
      <p>
        <strong>Backup</strong> for a novel is not glamorous—it is the difference between losing a month of revisions
        and grumbling through a restore. Cloud backup is one good answer when it is private, scoped to your account, and
        sized honestly for real libraries.
      </p>

      <h2>What Inkwell means by “library backup”</h2>
      <p>
        On paid tiers with sync, Inkwell can package your library and sync it to private cloud storage tied to your
        account so work can outlive a single browser profile or machine. Limits are expressed as compressed backup size:
        <strong> {CLOUD_LIMIT_BASIC_DISPLAY}</strong> on Basic and <strong>{CLOUD_LIMIT_PRO_DISPLAY}</strong> on Pro (
        <a href="/pricing">pricing</a>).
      </p>

      <h2>Habits that keep backups boring (in a good way)</h2>
      <ul>
        <li>Let sync finish on Wi‑Fi before closing the laptop on heavy writing days.</li>
        <li>Keep huge assets intentional—covers and research PDFs add up faster than text.</li>
        <li>Remember local-first still works offline; backup is a safety net, not a leash.</li>
      </ul>

      <h2>Related guides</h2>
      <p>
        <a href="/guides/local-first-writing-workflow">Local-first workflow</a>,{' '}
        <a href="/guides/inkwell-free-vs-basic-vs-pro">Free vs Basic vs Pro</a>,{' '}
        <a href="/guides/export-anxiety">export anxiety</a>.
      </p>

      <p>
        Draft free locally in <a href="/app#bookshelf">Inkwell</a>, then add Basic when EPUB + backup belong in your
        loop.
      </p>
    </>
  )
}
