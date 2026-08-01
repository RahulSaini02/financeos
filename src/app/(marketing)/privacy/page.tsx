export const metadata = {
  title: "Privacy Policy — FinanceOS",
  description: "How FinanceOS collects, uses, and protects your personal financial data.",
};

const LAST_UPDATED = "August 1, 2026";
const CONTACT_EMAIL = "sainirahul0802+privacy@gmail.com";

export default function PrivacyPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
      <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-[var(--color-text-muted)] mb-12">Last updated: {LAST_UPDATED}</p>

      <div className="space-y-10 text-[var(--color-text-secondary)] leading-relaxed">

        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">1. Overview</h2>
          <p>
            FinanceOS (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is a personal finance management application. This Privacy
            Policy explains what information we collect, how we use it, and your rights regarding
            your data. By using FinanceOS, you agree to the practices described here.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">2. Information We Collect</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-[var(--color-text-primary)]">Account information:</strong> Email address and
              password (stored securely via Supabase Auth). If you sign in with Google, we receive
              your name and email from Google.
            </li>
            <li>
              <strong className="text-[var(--color-text-primary)]">Financial data you enter:</strong> Transactions,
              account balances, budgets, savings goals, loans, subscriptions, paycheck records, and
              investment information that you manually input into the app.
            </li>
            <li>
              <strong className="text-[var(--color-text-primary)]">Usage data:</strong> Basic analytics such as
              pages visited and features used, collected to improve the product.
            </li>
            <li>
              <strong className="text-[var(--color-text-primary)]">AI chat messages and actions:</strong> Messages
              you send to the AI assistant — which may include your financial data — are sent to
              Anthropic&apos;s Claude API for processing. When you authorize the AI to take actions
              (e.g., create or edit transactions, budgets, savings goals), those instructions and
              relevant account data are also sent to Anthropic for processing. These interactions are
              governed by{" "}
              <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer"
                className="text-[var(--color-accent)] hover:underline">
                Anthropic&apos;s Privacy Policy
              </a>.
            </li>
            <li>
              <strong className="text-[var(--color-text-primary)]">Automated AI processing:</strong> Background
              services (daily financial insights, bill reminders, proactive spending alerts, monthly
              reviews) automatically analyze your financial data using Anthropic&apos;s Claude API on a
              scheduled basis, even without an active chat session.
            </li>
            <li>
              <strong className="text-[var(--color-text-primary)]">Push notification subscription:</strong> If you
              enable push notifications, we store your browser&apos;s push endpoint and encryption keys to
              deliver alerts (daily insights, bill reminders, proactive financial alerts) to your
              device.
            </li>
            <li>
              <strong className="text-[var(--color-text-primary)]">Google Calendar data:</strong> If you connect
              Google Calendar (optional), we receive OAuth tokens and read your calendar event
              titles and times to surface payment reminders. We may also create calendar events on
              your behalf when requested. Access requires your explicit authorization and can be
              revoked at any time from Settings.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">3. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>To provide, operate, and improve the FinanceOS service.</li>
            <li>To authenticate your identity and secure your account.</li>
            <li>To process your queries via the AI assistant (Claude by Anthropic) and to execute AI-authorized write actions (create, edit, or delete financial records) that you approve.</li>
            <li>To run automated background analysis of your financial data for proactive insights, bill reminders, and monthly summaries delivered via push notification or in-app.</li>
            <li>To sync with Google Calendar (if connected) to surface payment reminders and create financial events.</li>
            <li>To send essential service communications (e.g., push notifications for budget alerts, bill reminders, security notices).</li>
            <li>We do <strong className="text-[var(--color-text-primary)]">not</strong> sell your data to third parties.</li>
            <li>We do <strong className="text-[var(--color-text-primary)]">not</strong> use your financial data for advertising.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">4. Third-Party Services</h2>
          <p className="mb-3">FinanceOS relies on the following third-party services:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-[var(--color-text-primary)]">Supabase</strong> — database and authentication
              infrastructure. Data is stored in Supabase&apos;s managed Postgres database. See{" "}
              <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer"
                className="text-[var(--color-accent)] hover:underline">
                Supabase Privacy Policy
              </a>.
            </li>
            <li>
              <strong className="text-[var(--color-text-primary)]">Anthropic (Claude API)</strong> — AI assistant
              responses. Your chat messages and any financial data within them are sent to
              Anthropic&apos;s API for processing. See{" "}
              <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer"
                className="text-[var(--color-accent)] hover:underline">
                Anthropic Privacy Policy
              </a>.
            </li>
            <li>
              <strong className="text-[var(--color-text-primary)]">Google OAuth</strong> — optional sign-in
              method. If used, Google shares your name and email with us per Google&apos;s OAuth policy.
            </li>
            <li>
              <strong className="text-[var(--color-text-primary)]">Google Calendar API</strong> — optional
              integration for payment reminders and calendar event creation. If connected, we store
              OAuth access and refresh tokens in our database and call Google&apos;s Calendar API on your
              behalf. We request read and write access to your calendar scopes. See{" "}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer"
                className="text-[var(--color-accent)] hover:underline">
                Google Privacy Policy
              </a>.
            </li>
            <li>
              <strong className="text-[var(--color-text-primary)]">Vercel</strong> — hosting and deployment
              infrastructure.
            </li>
            <li>
              <strong className="text-[var(--color-text-primary)]">Web Push (browser-native)</strong> — if you
              enable push notifications, your browser&apos;s push service (e.g., FCM for Chrome, APNs
              for Safari) delivers notifications. We store only the push endpoint and encryption
              keys; no personal data is sent to the browser push service beyond the notification
              payload itself.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">5. Data Retention</h2>
          <p>
            Your data is retained as long as your account is active. You may delete your account at
            any time from Settings → Danger Zone, which permanently removes all your data from our
            systems within 30 days.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">6. Security</h2>
          <p>
            We use industry-standard security measures including TLS encryption in transit,
            Row-Level Security (RLS) enforced at the database level, and secure session management
            via Supabase Auth. No method of transmission over the Internet is 100% secure; we
            cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">7. Your Rights</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Access your data directly within the app.</li>
            <li>Correct inaccurate data directly within the app.</li>
            <li>Delete your account and all associated data at any time from Settings → Danger Zone.</li>
            <li>Opt out of non-essential communications by contacting us.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">8. Children&apos;s Privacy</h2>
          <p>
            FinanceOS is not directed at children under 13. We do not knowingly collect personal
            information from children under 13. If we learn we have collected such information, we
            will delete it promptly.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of significant
            changes by posting the new policy on this page with an updated date and, where
            appropriate, via email.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">10. Contact</h2>
          <p>
            Questions about this Privacy Policy? Contact us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--color-accent)] hover:underline">
              {CONTACT_EMAIL}
            </a>.
          </p>
        </section>

      </div>
    </main>
  );
}
