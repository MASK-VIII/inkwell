import {
  CLOUD_LIMIT_BASIC_DISPLAY,
  CLOUD_LIMIT_PRO_DISPLAY,
  INKWELL_DISPLAY_PRICE_BASIC,
  INKWELL_DISPLAY_PRICE_PRO,
  INKWELL_DISPLAY_PRICE_PRO_LIST,
} from '../../pricingCopy'

export default function InkwellFreeVsBasicVsProBody() {
  return (
    <>
      <p>
        Inkwell splits cleanly into three decisions: <strong>draft locally for free</strong>, add{' '}
        <strong>digital publishing + backup</strong> on Basic, or add the <strong>full export suite + deeper formatting</strong>{' '}
        on Pro.
      </p>

      <h2>Free</h2>
      <ul>
        <li>Full writing workspace on your device—projects, chapters, notes, previews.</li>
        <li>No signup required to start in the browser story.</li>
        <li>Local-only library storage—no cloud backup path until you upgrade.</li>
      </ul>

      <h2>Basic ({INKWELL_DISPLAY_PRICE_BASIC} one-time)</h2>
      <ul>
        <li>Cloud library sync/backup across devices when you sign in.</li>
        <li>EPUB export for digital publishing.</li>
        <li>Compressed library backup up to {CLOUD_LIMIT_BASIC_DISPLAY}.</li>
      </ul>

      <h2>Pro ({INKWELL_DISPLAY_PRICE_PRO} intro pricing today; {INKWELL_DISPLAY_PRICE_PRO_LIST} list for new purchases later)</h2>
      <ul>
        <li>Full export suite (PDF, DOCX, Markdown, plain text) plus deeper formatting for print/submissions.</li>
        <li>Higher compressed library backup—{CLOUD_LIMIT_PRO_DISPLAY}.</li>
        <li>Intro purchases grandfather at the paid price; see <a href="/#faq">FAQ</a> on pricing changes.</li>
      </ul>

      <h2>Paid tier promises that matter</h2>
      <p>
        Both paid tiers include <strong>lifetime app updates</strong> and a <strong>30-day refund</strong> window—see{' '}
        <a href="/refund">refunds</a> and <a href="/pricing">pricing</a> for the full picture.
      </p>

      <h2>Related guides</h2>
      <p>
        <a href="/guides/one-time-vs-subscription-writing-tools">One-time vs subscription tools</a>,{' '}
        <a href="/guides/cloud-backup-for-manuscripts">cloud backup</a>,{' '}
        <a href="/guides/epub-kindle-kdp-checklist">EPUB checklist</a>.
      </p>

      <p>
        <a href="/app#bookshelf">Start free</a> · <a href="/buy">Buy</a> · <a href="/pricing">Compare plans</a>
      </p>
    </>
  )
}
