import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/legal-layout";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/legal";

export const Route = createFileRoute("/cookies")({
  component: CookiesPage,
});

function CookiesPage() {
  return (
    <LegalLayout title="Cookie Policy" effectiveDate={LEGAL_EFFECTIVE_DATE}>
      <section>
        <p>
          This Cookie Policy explains how the Travancore Ayurveda Learning Portal (the "Platform")
          uses cookies and similar technologies such as browser local storage, and how you can
          manage them.
        </p>
      </section>

      <h2>1. What we use, and why</h2>
      <p>
        The Platform is intentionally light on cookies. We don't run third-party advertising or
        marketing trackers. What we do use:
      </p>

      <h3>Strictly necessary — sign-in session</h3>
      <p>
        When you sign in, the Platform stores your session (an encrypted authentication token) in
        your browser's local storage so you stay signed in as you move between pages, instead of
        signing in again on every request. This is essential to the Platform working at all and
        cannot be turned off while remaining signed in — it's automatically cleared when you sign
        out or after a period of inactivity.
      </p>

      <h3>Strictly necessary — security</h3>
      <p>
        Cloudflare, our hosting and security provider, may set a small number of technical cookies
        or use equivalent request-level signals to protect the Platform against abuse (for example,
        distinguishing genuine traffic from automated attacks). These are operational and not used
        to track you across other websites.
      </p>

      <h3>Functional — your preferences</h3>
      <p>
        We use local storage (not cookies) to remember a few small preferences on your device, such
        as:
      </p>
      <ul>
        <li>Whether you've already seen the first-time product walkthrough</li>
        <li>Your response to this cookie consent banner</li>
      </ul>

      <h3>What we don't use</h3>
      <ul>
        <li>No third-party advertising or marketing cookies</li>
        <li>No cross-site tracking pixels</li>
        <li>No third-party analytics services (e.g. Google Analytics)</li>
      </ul>

      <h2>2. Managing your preferences</h2>
      <p>
        When you first visit the Platform, a banner lets you accept or decline non-essential
        (functional) local storage use. Strictly necessary items — like your sign-in session — can't
        be declined individually since the Platform can't function without them; declining them
        means signing in again more often. You can also clear cookies and local storage at any time
        through your browser's settings, which will sign you out and reset any saved preferences.
      </p>

      <h2>3. Changes to this policy</h2>
      <p>
        We may update this Cookie Policy as the Platform evolves. Material changes will be reflected
        by an updated effective date at the top of this page.
      </p>

      <h2>4. Contact</h2>
      <p>
        Questions about this Cookie Policy should be directed to your Travancore Ayurveda
        administrator or HR contact.
      </p>
    </LegalLayout>
  );
}
