import type { ReactNode } from "react";
import { SiteFooter } from "./SiteFooter";
import { contactEmail, routePaths } from "./routes";

// Plain-language policies describing what this codebase actually does.
// Have them reviewed by counsel before launch and update LAST_UPDATED on every change.
const LAST_UPDATED = "November 13, 2026";

function ContactLine() {
  return contactEmail ? (
    <p>
      Questions? Email <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
    </p>
  ) : null;
}

function PageShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="wordmark" href={routePaths.home}>
          <span>SNKR</span>
          <i>signal</i>
        </a>
        <a className="back-link" href={routePaths.home}>
          ← Back to releases
        </a>
      </header>
      <article className="static-page">
        <p className="kicker">SNEAKER SIGNAL</p>
        <h1>{title}</h1>
        {children}
      </article>
      <SiteFooter />
    </main>
  );
}

export function PrivacyPage() {
  return (
    <PageShell title="Privacy policy">
      <p className="static-updated">Last updated {LAST_UPDATED}</p>
      <p>
        Sneaker Signal is a US sneaker release catalog. You can browse it without an account. This
        page explains what we collect when you create one and how it is used.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Your email address</strong>, when you sign in. We use it to send sign-in links
          and, if you turn them on, release reminders.
        </li>
        <li>
          <strong>Releases you save</strong> and their status (saved, bought, missed, passed).
        </li>
        <li>
          <strong>Notification preferences</strong>: which emails you want, reminder timing and your
          timezone.
        </li>
        <li>
          <strong>Delivery records</strong> for reminder emails (which reminder was sent, when, and
          whether delivery failed) so we never send the same reminder twice.
        </li>
      </ul>
      <p>
        We do not run advertising trackers or sell your personal information. We do not collect
        payment details.
      </p>
      <h2>Service providers</h2>
      <p>We rely on these providers to run the service:</p>
      <ul>
        <li>Supabase: database and sign-in.</li>
        <li>Resend: sending email.</li>
        <li>Vercel: hosting the website.</li>
        <li>
          Google Fonts and Unsplash: fonts and some images are loaded from their servers, which
          receive your IP address as part of a normal web request.
        </li>
      </ul>
      <h2>Retailer links</h2>
      <p>
        Links to brands and retailers take you to their websites, which have their own privacy
        policies. Some retailer links may be affiliate links; see our{" "}
        <a href={routePaths.terms}>terms</a>.
      </p>
      <h2>Your choices</h2>
      <ul>
        <li>
          Turn off any email at any time in{" "}
          <a href={routePaths.notifications}>notification settings</a>.
        </li>
        <li>Remove saved releases at any time from the catalog.</li>
        <li>Ask us to delete your account and data by contacting us.</li>
      </ul>
      <h2>Retention</h2>
      <p>
        We keep your account data while your account exists. When you delete your account, your
        saved releases, preferences and delivery records are deleted with it.
      </p>
      <ContactLine />
    </PageShell>
  );
}

export function TermsPage() {
  return (
    <PageShell title="Terms of use">
      <p className="static-updated">Last updated {LAST_UPDATED}</p>
      <h2>What Sneaker Signal is</h2>
      <p>
        Sneaker Signal publishes information about US sneaker releases, including dates, prices and
        where to buy. We verify release details against brand and retailer sources and show when
        each record was last checked.
      </p>
      <h2>No guarantees</h2>
      <p>
        Release dates, prices and availability are set by brands and retailers and can change
        without notice. We do not sell sneakers and do not guarantee inventory, a successful
        checkout, raffle results, or the authenticity of products sold by third parties. Always
        confirm details on the retailer's site before you buy.
      </p>
      <h2 id="affiliate-disclosure">Affiliate disclosure</h2>
      <p>
        Some links to retailers may be affiliate links. If you buy through one, we may earn a
        commission at no extra cost to you. Affiliate relationships never decide which releases we
        list or how we describe them.
      </p>
      <h2>Your account</h2>
      <p>
        You are responsible for access to the email address you sign in with. We may suspend
        accounts that abuse the service.
      </p>
      <h2>Trademarks</h2>
      <p>
        Brand names and product names belong to their owners. Sneaker Signal is not affiliated with
        or endorsed by Nike, adidas, New Balance, Saucony or any retailer unless we say so.
      </p>
      <ContactLine />
    </PageShell>
  );
}

export function NotFoundPage() {
  return (
    <PageShell title="Page not found">
      <p>That page doesn't exist. It may have moved, or the link may be mistyped.</p>
      <p>
        <a href={routePaths.home}>Browse upcoming releases →</a>
      </p>
    </PageShell>
  );
}
