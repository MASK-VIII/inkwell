import { INKWELL_DISPLAY_PRICE_BASIC, INKWELL_DISPLAY_PRICE_PRO, INKWELL_DISPLAY_PRICE_PRO_LIST } from '../../pricingCopy'

export default function OneTimeVsSubscriptionWritingToolsBody() {
  return (
    <>
      <p>
        Subscriptions can be a great deal when the product is always online, always updating, and always in your tab.
        They are a worse fit when you want a calm manuscript home that does not bill you during a six-month revision
        tunnel.
      </p>

      <h2>When subscriptions make sense</h2>
      <ul>
        <li>You want a bundled ecosystem (storage + editing + collaboration) with steady vendor investment.</li>
        <li>You churn projects quickly and like paying for continuous novelty.</li>
        <li>You value managed services over owning export files locally.</li>
      </ul>

      <h2>When one-time tiers make sense</h2>
      <ul>
        <li>You prefer predictable costs for a long novel cycle.</li>
        <li>You want local-first drafting with exports as a purchase, not a meter.</li>
        <li>You dislike the feeling of “renting access” to your own finish line.</li>
      </ul>

      <h2>How Inkwell prices</h2>
      <p>
        Inkwell’s paid tiers are <strong>one-time purchases</strong> with lifetime app updates on Basic and Pro. Pro is
        at intro pricing today ({INKWELL_DISPLAY_PRICE_PRO}); new purchases move to list price ({INKWELL_DISPLAY_PRICE_PRO_LIST}
        ) later—buyers during intro keep their tier (
        <a href="/pricing">pricing</a>, <a href="/#faq">FAQ</a>). Basic is {INKWELL_DISPLAY_PRICE_BASIC} for new buyers.
      </p>

      <h2>Related guides</h2>
      <p>
        <a href="/guides/inkwell-free-vs-basic-vs-pro">Free vs Basic vs Pro</a>,{' '}
        <a href="/guides/local-first-writing-workflow">local-first workflow</a>,{' '}
        <a href="/guides/scrivener-alternative-novel-drafting">Scrivener-class drafting</a>.
      </p>

      <p>
        Try <a href="/app#bookshelf">Inkwell free</a>, then <a href="/buy">buy</a> when exports belong in your budget.
      </p>
    </>
  )
}
