import Link from "next/link";

export const metadata = {
  title: "Terms of Service — MyFinOS",
  description: "Terms and conditions for using MyFinOS.",
};

const LAST_UPDATED = "August 1, 2026";
const CONTACT_EMAIL = "sainirahul0802+terms@gmail.com";

export default function TermsPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
      <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
      <p className="text-[var(--color-text-muted)] mb-12">Last updated: {LAST_UPDATED}</p>

      <div className="space-y-10 text-[var(--color-text-secondary)] leading-relaxed">

        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">1. Acceptance of Terms</h2>
          <p>
            By accessing or using MyFinOS (&quot;the Service&quot;), you agree to be bound by these Terms of
            Service (&quot;Terms&quot;). If you do not agree, do not use the Service. These Terms apply to all
            users of the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">2. Description of Service</h2>
          <p>
            MyFinOS is a personal finance management web application that allows users to track
            transactions, budgets, savings goals, subscriptions, loans, investments, and receive
            AI-powered financial insights. The Service optionally integrates with Google Calendar
            and supports push notifications for proactive financial alerts. The Service is provided
            &quot;as is&quot; for personal, non-commercial use.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">3. Account Registration</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>You must provide accurate and complete information when creating an account.</li>
            <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
            <li>You must be at least 13 years old to use the Service.</li>
            <li>You are responsible for all activity that occurs under your account.</li>
            <li>Notify us immediately of any unauthorized use of your account.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">4. Acceptable Use</h2>
          <p className="mb-3">You agree not to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Use the Service for any unlawful purpose.</li>
            <li>Attempt to gain unauthorized access to any part of the Service or its infrastructure.</li>
            <li>Transmit malicious code, viruses, or disruptive data.</li>
            <li>Scrape, crawl, or systematically extract data from the Service.</li>
            <li>Use the Service on behalf of others without their explicit consent.</li>
            <li>Attempt to reverse engineer, decompile, or disassemble the Service.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">5. AI Features Disclaimer</h2>
          <p className="mb-3">
            MyFinOS includes AI-powered features (the &quot;AI Agent&quot;) powered by Anthropic&apos;s Claude.
            AI-generated insights and recommendations are for informational purposes only and do
            not constitute financial, investment, tax, or legal advice. You should consult a
            qualified professional before making financial decisions. We are not responsible for
            any decisions made based on AI output.
          </p>
          <p className="mb-3">
            The AI Agent can take <strong className="text-[var(--color-text-primary)]">write actions</strong> on
            your behalf — including creating, editing, and deleting transactions, budgets, savings
            goals, investments, subscriptions, recurring rules, and other financial records — when
            you explicitly authorize such actions during a chat session. You are solely responsible
            for reviewing and approving any AI-proposed changes before they are applied. We are not
            liable for errors, unintended modifications, or data loss resulting from AI-executed
            actions you authorized.
          </p>
          <p>
            Automated background services (daily insights, proactive spending alerts, bill reminders,
            monthly reviews) analyze your financial data using the Claude API on a scheduled basis.
            These services are informational only and do not execute write actions without your
            explicit in-session authorization.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">6. Third-Party Integrations</h2>
          <p className="mb-3">
            The Service offers optional integrations with third-party platforms:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-[var(--color-text-primary)]">Google Calendar:</strong> Connecting Google
              Calendar grants MyFinOS read and write access to your calendar. We use this access
              only to surface payment reminders and create financial events on your behalf. You can
              revoke access at any time from Settings. Your use of this integration is also subject
              to{" "}
              <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer"
                className="text-[var(--color-accent)] hover:underline">
                Google&apos;s Terms of Service
              </a>.
            </li>
            <li>
              <strong className="text-[var(--color-text-primary)]">Push Notifications:</strong> If you opt in,
              the Service will send push notifications to your device via your browser&apos;s push
              service. You can disable notifications at any time from your browser or device
              settings.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">7. Data and Privacy</h2>
          <p>
            Your use of the Service is also governed by our{" "}
            <Link href="/privacy" className="text-[var(--color-accent)] hover:underline">
              Privacy Policy
            </Link>
            , which is incorporated into these Terms by reference. By using the Service, you
            consent to the collection and use of your data as described therein.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">8. Intellectual Property</h2>
          <p>
            All content, features, and functionality of the Service — including but not limited to
            text, graphics, logos, and software — are the exclusive property of MyFinOS and are
            protected by applicable intellectual property laws. You may not copy, modify, or
            distribute any part of the Service without our written permission.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">9. Disclaimers</h2>
          <p>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND,
            EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
            FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE
            SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">10. Limitation of Liability</h2>
          <p>
            TO THE FULLEST EXTENT PERMITTED BY LAW, FINANCEOS SHALL NOT BE LIABLE FOR ANY
            INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF
            PROFITS OR DATA, ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE, EVEN IF
            WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY SHALL
            NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">11. Termination</h2>
          <p>
            We reserve the right to suspend or terminate your account at any time for violation of
            these Terms, without notice. You may terminate your account at any time from Settings →
            Danger Zone. Upon termination, your right to use the Service ceases immediately.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">12. Changes to Terms</h2>
          <p>
            We may modify these Terms at any time. Continued use of the Service after changes
            are posted constitutes acceptance of the new Terms. We will provide notice of
            material changes via the app or email.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">13. Governing Law</h2>
          <p>
            These Terms are governed by the laws of the State of California, without regard to
            conflict of law principles. Any disputes shall be resolved in the courts located in
            California.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">14. Contact</h2>
          <p>
            Questions about these Terms? Contact us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--color-accent)] hover:underline">
              {CONTACT_EMAIL}
            </a>.
          </p>
        </section>

      </div>
    </main>
  );
}
