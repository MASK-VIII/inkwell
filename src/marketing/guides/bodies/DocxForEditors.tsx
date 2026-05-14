import { INKWELL_DISPLAY_PRICE_PRO } from '../../pricingCopy'

export default function DocxForEditorsBody() {
  return (
    <>
      <p>
        Editors and beta readers often want a <strong>DOCX</strong> because comments, track changes, and offline review
        still run on that rail. Your job is to hand them a manuscript that is easy to mark up—not a layout experiment.
      </p>

      <h2>What “good enough” looks like</h2>
      <ul>
        <li>Stable chapter headings so navigation and comments stay anchored.</li>
        <li>Consistent paragraph styles instead of manual spacing hacks.</li>
        <li>Front matter that is separate from Chapter One so page one is not a surprise.</li>
      </ul>

      <h2>A simple handoff ritual</h2>
      <ol>
        <li>Export DOCX from your writing tool.</li>
        <li>Open in Word (or the editor’s preferred tool) and scan the first 10 pages for widows/stray breaks.</li>
        <li>Send a short note with intent: “Comments welcome on plot and clarity; line edits optional.”</li>
        <li>When feedback returns, merge in your drafting home—then re-export when you ship the next milestone.</li>
      </ol>

      <h2>Where Inkwell fits</h2>
      <p>
        Full DOCX export sits on <strong>Pro</strong> alongside the broader print/digital export suite (see{' '}
        <a href="/pricing">pricing</a>). If you only need EPUB for now, Basic may be the better stop—upgrade when you are
        ready for DOCX/PDF and deeper formatting work.
      </p>

      <h2>Related guides</h2>
      <p>
        <a href="/guides/print-pdf-self-publishing-basics">Print PDF basics</a>,{' '}
        <a href="/guides/inkwell-free-vs-basic-vs-pro">Free vs Basic vs Pro</a>, and{' '}
        <a href="/guides/export-anxiety">export anxiety</a>.
      </p>

      <p>
        <a href="/app#bookshelf">Start in Inkwell free</a>, or go straight to <a href="/buy">checkout</a> when you want
        Pro at intro pricing ({INKWELL_DISPLAY_PRICE_PRO} today).
      </p>
    </>
  )
}
