import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/legal-layout";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/legal";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" effectiveDate={LEGAL_EFFECTIVE_DATE}>
      <section>
        <p>
          This Privacy Policy explains what information the Travancore Ayurveda Learning Portal (the
          "Platform") collects about you, why it's collected, how it's stored and protected, how
          it's used, and the rights you have over it. The Platform is an internal system for
          Travancore Ayurveda employees and affiliated staff — it is not open to the public, and we
          do not sell or rent personal data to anyone.
        </p>
      </section>

      <h2>1. What information we collect</h2>

      <h3>a. Registration and profile information</h3>
      <p>
        Collected when your account is created (either by you during self-registration, or by an
        administrator) and afterward:
      </p>
      <ul>
        <li>Full name, work email address, and phone number</li>
        <li>Job designation, role, employee code, organization, and center/branch</li>
        <li>Learning interests you select during onboarding</li>
      </ul>

      <h3>b. Authentication information</h3>
      <ul>
        <li>
          Your email address, used to send one-time sign-in codes and, for administrator accounts, a
          securely hashed password (we never store passwords in plain text)
        </li>
        <li>If you choose Google sign-in, the name and email address provided by Google</li>
        <li>Timestamps and outcomes of sign-in attempts (successful and failed)</li>
      </ul>

      <h3>c. Security and session information</h3>
      <p>Collected automatically every time you sign in or sign out:</p>
      <ul>
        <li>IP address</li>
        <li>Approximate location (city, region, country) derived from your IP address</li>
        <li>Device, browser, and operating system (from your browser's user-agent string)</li>
        <li>Sign-in and sign-out timestamps, and the resulting session duration</li>
        <li>The authentication method used (e.g. password, one-time code, Google)</li>
      </ul>

      <h3>d. Activity and usage information</h3>
      <p>Collected as you use the Platform:</p>
      <ul>
        <li>Courses and lessons you view or complete</li>
        <li>Quiz attempts, answers, and scores</li>
        <li>Certificates issued to you</li>
        <li>Files or resources you download</li>
        <li>
          For faculty/admin users: course, lesson, and content changes you make (created, edited,
          published, deleted)
        </li>
      </ul>

      <h2>2. Why we collect it</h2>
      <ul>
        <li>
          <strong>To provide the service</strong> — your registration and profile data lets us
          assign you the right training, track your progress, and issue certificates.
        </li>
        <li>
          <strong>To authenticate you</strong> — verifying it's really you signing in, via one-time
          codes, Google sign-in, or password.
        </li>
        <li>
          <strong>For security</strong> — IP address, device, and location data help us detect
          unusual sign-in activity, enforce rate limits against abuse, and investigate incidents if
          they occur.
        </li>
        <li>
          <strong>For audit and accountability</strong> — because the Platform hosts confidential
          training material, we keep a record of sign-ins, sign-outs, and significant actions
          (course changes, role changes, downloads) so that access and changes can always be traced
          back to a specific account.
        </li>
        <li>
          <strong>For internal analytics</strong> — aggregate, internal-only reporting (e.g. course
          completion rates, active users) that helps administrators understand training engagement.
          We do not use third-party advertising or marketing analytics services.
        </li>
      </ul>

      <h2>3. How it's stored and protected</h2>
      <ul>
        <li>
          Data is stored in a managed PostgreSQL database provided by Supabase, protected by
          row-level security policies that restrict each table so that, by default, you can only
          read your own data — broader access (e.g. an administrator viewing employee records) is
          only possible for accounts explicitly granted an administrator role.
        </li>
        <li>
          All traffic between your browser and the Platform is encrypted in transit (HTTPS/TLS).
        </li>
        <li>
          The Platform runs on Cloudflare's network, which also provides the approximate geolocation
          and security infrastructure used to protect against abuse.
        </li>
        <li>
          Training videos are hosted on access-controlled infrastructure and served only through
          short-lived, signed links generated per request — the underlying video storage location is
          never exposed to your browser.
        </li>
        <li>
          Administrative credentials that can bypass normal access restrictions are held only by
          backend systems and are never exposed to the browser or any user account.
        </li>
        <li>
          Access to activity and audit logs is restricted to accounts with an administrator role.
        </li>
      </ul>

      <h2>4. Who else can see it</h2>
      <p>
        We use a small number of infrastructure providers to run the Platform, each acting as a data
        processor under our instructions — none of them are permitted to use your data for their own
        purposes:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — database, authentication, and file storage
        </li>
        <li>
          <strong>Cloudflare</strong> — hosting, content delivery, and security
        </li>
        <li>
          <strong>Hostinger</strong> — training video file hosting
        </li>
        <li>
          <strong>Google</strong> — only if you choose "Continue with Google" to sign in
        </li>
      </ul>
      <p>
        Within Travancore Ayurveda, your data is visible to administrators and HR as needed to
        manage your account, and to faculty/trainers where relevant to grading or course
        administration. We do not sell, rent, or share your personal data with any external third
        party for marketing purposes.
      </p>

      <h2>5. How long we keep it</h2>
      <p>
        We retain your account and profile data for as long as your account remains active with
        Travancore Ayurveda. Security, session, and audit log data is retained for a longer period
        after that where reasonably necessary for security investigations, dispute resolution, or
        compliance purposes. When your account is disabled, your profile remains associated with
        your historical training records (completions, certificates) for record-keeping purposes,
        but your access to the Platform is removed.
      </p>

      <h2>6. Your rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li>
          <strong>Access</strong> the personal data we hold about you — your profile is visible
          under My Profile, and you can request a full export from your administrator.
        </li>
        <li>
          <strong>Correct</strong> inaccurate profile information by contacting HR or your
          administrator (profile fields are managed centrally to keep training records consistent).
        </li>
        <li>
          <strong>Request deletion</strong> of your account, subject to our need to retain certain
          records (e.g. audit logs, completed training/certification history) for legal, security,
          or compliance reasons.
        </li>
        <li>
          <strong>Object to or restrict</strong> certain processing, and ask questions about how
          your data is used.
        </li>
        <li>
          <strong>Request a copy</strong> of your data in a portable format.
        </li>
      </ul>
      <p>
        To exercise any of these rights, contact your Travancore Ayurveda administrator or HR
        contact. We'll respond within a reasonable time.
      </p>

      <h2>7. Cookies and similar technologies</h2>
      <p>
        The Platform uses your browser's local storage (not third-party tracking cookies) to keep
        you signed in and remember a small number of preferences. See our{" "}
        <a href="/cookies">Cookie Policy</a> for full detail.
      </p>

      <h2>8. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy as the Platform evolves or legal requirements change.
        Material changes will be reflected by an updated effective date at the top of this page.
      </p>

      <h2>9. Contact</h2>
      <p>
        Questions about this Privacy Policy, or requests relating to your personal data, should be
        directed to your Travancore Ayurveda administrator or HR contact.
      </p>
    </LegalLayout>
  );
}
