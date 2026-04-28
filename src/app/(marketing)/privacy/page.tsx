export const metadata = {
  title: "Privacy Policy — FinanceOS",
  description: "How FinanceOS collects, uses, and protects your personal financial data.",
};

const LAST_UPDATED = "April 28, 2026";
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
              <strong className="text-[var(--color-text-primary)]">AI chat messages:</strong> Messages you send to
              the AI assistant — which may include your financial data — are sent to Anthropic&apos;s
              Claude API for processing. These messages are governed by{" "}
              <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer"
                className="text-[var(--color-accent)] hover:underline">
                Anthropic&apos;s Privacy Policy
              </a>.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">3. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>To provide, operate, and improve the FinanceOS service.</li>
            <li>To authenticate your identity and secure your account.</li>
            <li>To process your queries via the AI assistant (Claude by Anthropic).</li>
            <li>To send essential service communications (e.g., budget alerts, security notices).</li>
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
              <strong className="text-[var(--color-text-primary)]">Vercel</strong> — hosting and deployment
              infrastructure.
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
