import { INKWELL_DISPLAY_PRICE_PRO } from '../../pricingCopy'

export default function PrintPdfSelfPublishingBasicsBody() {
  return (
    <>
      <p>
        Print PDF is where small layout decisions become expensive surprises—trim, bleed, margins, and embedded fonts
        all matter once you leave the draft. You do not need a print shop’s vocabulary on day one; you need a short
        preflight habit.
      </p>

      <h2>Common pitfalls</h2>
      <ul>
        <li>
          <strong>Wrong trim assumption</strong>—pick a trim size early and keep previews tied to it.
        </li>
        <li>
          <strong>Images under resolution</strong>—cover art is the usual culprit; interiors rarely need print-shop DPI
          everywhere, but covers do.
        </li>
        <li>
          <strong>Bleed toggles</strong>—if your printer expects bleed, backgrounds and chapter ornaments must extend
          past the trim line.
        </li>
        <li>
          <strong>Fonts</strong>—embedding/licensing varies by toolchain; when in doubt, simplify type choices for print.
        </li>
      </ul>

      <h2>A grounded expectation</h2>
      <p>
        Tools differ in how much “reflow shop” polish you get out of the box. Inkwell focuses on the author arc—draft,
        format, publish—with serious export paths on Pro. If you need boutique print refinement for every edge case,
        pair Inkwell with a specialist workflow where it makes sense—honesty keeps refunds low and readers happy.
      </p>

      <h2>Where Inkwell fits</h2>
      <p>
        Pro unlocks the full export suite, including print-oriented PDF workflows alongside DOCX/Markdown/plain text (
        <a href="/pricing">see pricing</a>). Start free locally, then upgrade when print is in scope.
      </p>

      <h2>Related guides</h2>
      <p>
        <a href="/guides/docx-for-editors">DOCX for editors</a>,{' '}
        <a href="/guides/epub-kindle-kdp-checklist">EPUB checklist</a>,{' '}
        <a href="/guides/export-anxiety">export anxiety</a>.
      </p>

      <p>
        <a href="/buy">Buy Pro</a> when you are ready ({INKWELL_DISPLAY_PRICE_PRO} intro pricing today), or{' '}
        <a href="/app#bookshelf">open the app free</a> and draft until exports deserve the upgrade.
      </p>
    </>
  )
}
