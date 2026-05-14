import {
  CLOUD_LIMIT_BASIC_DISPLAY,
  INKWELL_DISPLAY_PRICE_BASIC,
} from '../../pricingCopy'

export default function EpubKindleKdpChecklistBody() {
  return (
    <>
      <p>
        A clean EPUB is one of the simplest finish lines for digital self-publishing. The goal is not perfection on day
        one—it is a file that validates, reads well on a phone, and does not fight you in Kindle Previewer.
      </p>

      <h2>Before you export</h2>
      <ul>
        <li>Resolve obvious chapter titles and front matter so navigation is not a mystery.</li>
        <li>Spot-check dialogue punctuation and em dashes—some readers notice, stores rarely block on it.</li>
        <li>Pick one primary tense/voice for series metadata (title, subtitle) so storefront copy matches the file.</li>
      </ul>

      <h2>EPUB checklist (practical)</h2>
      <ul>
        <li>Open the EPUB in at least two readers (desktop + phone) and flip chapter boundaries.</li>
        <li>Confirm the table of contents matches your chapter list—no duplicate anchors, no missing entries.</li>
        <li>Skim front matter: copyright page, optional dedication, title page—keep it simple unless you have a reason.</li>
        <li>Run your storefront’s validator or preview tool; fix errors first, warnings second.</li>
        <li>Export again after substantive edits—small changes can shift layout in subtle ways.</li>
      </ul>

      <h2>Where Inkwell fits</h2>
      <p>
        Inkwell’s <strong>Basic</strong> tier is built around this digital path: cloud library sync/backup plus EPUB when
        you are ready to publish digitally (see{' '}
        <a href="/pricing">pricing</a>). If you are still drafting local-only, the free tier keeps everything on-device
        until you choose to upgrade.
      </p>
      <p>
        Cloud backup on Basic is designed for a packaged library backup up to <strong>{CLOUD_LIMIT_BASIC_DISPLAY}</strong>{' '}
        (compressed)—enough for many manuscripts with headroom if you keep large assets tidy.
      </p>

      <h2>Related guides</h2>
      <p>
        <a href="/guides/export-anxiety">When exports feel scary</a>,{' '}
        <a href="/guides/inkwell-free-vs-basic-vs-pro">Free vs Basic vs Pro</a>, and{' '}
        <a href="/guides/chapter-first-outlining">chapter-first structure</a> pair well with this checklist.
      </p>

      <p>
        Ready to try the workflow? <a href="/app#bookshelf">Open Inkwell free</a> or compare tiers on the{' '}
        <a href="/buy">buy page</a> ({INKWELL_DISPLAY_PRICE_BASIC} Basic today).
      </p>
    </>
  )
}
