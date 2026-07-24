import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/legal-layout";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/legal";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalLayout title="Terms & Conditions" effectiveDate={LEGAL_EFFECTIVE_DATE}>
      <section>
        <p>
          These Terms &amp; Conditions ("Terms") govern access to and use of the Travancore Ayurveda
          Learning Portal (the "Platform"), an internal training and learning management system
          operated by Travancore Ayurveda for its employees, franchise staff, and affiliated
          partners ("you", "your"). By creating an account or signing in, you agree to these Terms.
        </p>
      </section>

      <h2>1. Who can use the Platform</h2>
      <p>
        The Platform is a closed system for authorized personnel only — it is not open to the
        public. Access is limited to individuals who are employed by, or formally affiliated with,
        Travancore Ayurveda or one of its partner organizations, and whose account has been created
        or approved by an administrator. Attempting to access the Platform without authorization is
        prohibited.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>You must provide accurate registration information and keep it up to date.</li>
        <li>
          You are responsible for all activity that occurs under your account. Sign-in requires
          either a one-time code sent to your registered email or Google sign-in followed by that
          same one-time code, and administrator accounts additionally require a password — do not
          share these credentials with anyone.
        </li>
        <li>
          Notify your administrator immediately if you suspect unauthorized access to your account.
        </li>
        <li>
          Administrators may suspend or disable an account at any time, including on termination of
          employment or affiliation.
        </li>
      </ul>

      <h2>3. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Share your login credentials or one-time codes with any other person.</li>
        <li>
          Attempt to download, copy, screen-record, redistribute, or otherwise extract training
          videos or course materials outside the Platform.
        </li>
        <li>Attempt to access another user's account, data, or course progress.</li>
        <li>
          Probe, scan, or attempt to bypass the Platform's security, authentication, or access
          controls.
        </li>
        <li>
          Upload or submit content that is unlawful, infringing, defamatory, or that you do not have
          the right to share.
        </li>
        <li>Use the Platform for any purpose unrelated to your role at Travancore Ayurveda.</li>
      </ul>

      <h2>4. Course content and confidentiality</h2>
      <p>
        Training videos, course materials, assessments, and other content made available on the
        Platform are confidential and proprietary to Travancore Ayurveda. They are provided solely
        for your own training and professional development and may not be copied, downloaded,
        recorded, shared, or distributed in any form. Video playback is provided through
        access-controlled, time-limited links specifically to prevent unauthorized redistribution —
        attempting to circumvent these controls is a violation of these Terms.
      </p>

      <h2>5. Assessments and certificates</h2>
      <p>
        Quiz and assessment results, and certificates issued on successful completion, reflect your
        own individual work. Certificates can be independently verified using the code printed on
        them. Misrepresenting who completed an assessment is a violation of these Terms.
      </p>

      <h2>6. Monitoring and audit</h2>
      <p>
        Because the Platform handles internal training records and access to confidential material,
        sign-ins, sign-outs, and platform activity (such as courses viewed, lessons completed, and
        quiz attempts) are logged for security and audit purposes. See our{" "}
        <a href="/privacy">Privacy Policy</a> for full detail on what is collected and why.
      </p>

      <h2>7. Availability</h2>
      <p>
        We aim to keep the Platform available and reliable but do not guarantee uninterrupted
        access. Features, courses, and functionality may change, and access may be suspended for
        maintenance, security, or operational reasons without prior notice.
      </p>

      <h2>8. Termination</h2>
      <p>
        Access to the Platform is tied to your employment or affiliation with Travancore Ayurveda.
        Your account and access may be suspended or terminated by an administrator at any time,
        including immediately upon end of employment or affiliation, or for violation of these
        Terms.
      </p>

      <h2>9. Disclaimer</h2>
      <p>
        The Platform and its content are provided "as is" for internal training purposes. While we
        take reasonable care to keep course content accurate and current, Travancore Ayurveda does
        not warrant that the Platform will be error-free or uninterrupted.
      </p>

      <h2>10. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time to reflect changes to the Platform or legal
        requirements. Material changes will be reflected by an updated effective date at the top of
        this page, and continued use of the Platform after changes take effect constitutes
        acceptance of the revised Terms.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about these Terms should be directed to your Travancore Ayurveda administrator or
        HR contact.
      </p>
    </LegalLayout>
  );
}
