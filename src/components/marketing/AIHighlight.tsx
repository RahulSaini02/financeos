"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrainCircuit, Check } from "lucide-react";

const messages = [
  { role: "user", text: "How much did I spend on dining last month?" },
  {
    role: "ai",
    text: "You spent $342 on dining in November — 18% over your $290 budget. Want me to tighten it for December?",
  },
  { role: "user", text: "Yes, set it to $275." },
  {
    role: "ai",
    text: "Done ✓ Your Dining budget is now $275 for December. You're at $0/$275 so far.",
  },
];

const benefits = [
  "Answers questions in plain English",
  "Detects unusual charges before you do",
  "Sets and adjusts budgets on your behalf",
  "Generates a weekly spending review",
];

export default function AIHighlight() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    function runSequence() {
      // Show messages one by one, 1.8s apart
      for (let i = 1; i <= messages.length; i++) {
        const t = setTimeout(() => {
          setVisibleCount(i);
        }, i * 1800);
        timeouts.push(t);
      }

      // After all messages shown, wait 3s then fade out and restart
      const resetDelay = messages.length * 1800 + 3000;
      const fadeOut = setTimeout(() => {
        setFading(true);
        const clearAll = setTimeout(() => {
          setVisibleCount(0);
          setFading(false);
          runSequence();
        }, 600);
        timeouts.push(clearAll);
      }, resetDelay);
      timeouts.push(fadeOut);
    }

    runSequence();

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, []);

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#12102a] via-[#0f0f13] to-[#0f0f13] py-28">
      {/* Purple glow orb */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 right-0 w-[500px] h-[500px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(79,70,229,0.18) 0%, transparent 70%)",
          filter: "blur(100px)",
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Left — copy */}
        <div>
          <p className="text-xs tracking-widest uppercase text-[var(--color-text-muted)] mb-3">
            AI Agent
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-text-primary)] mb-4">
            Your finances have a voice now
          </h2>
          <p className="text-[var(--color-text-secondary)] leading-relaxed mb-8">
            Ask your AI agent anything — it reads your actual accounts,
            understands your spending patterns, and takes action on your behalf.
            Not just a chatbot. Actual intelligence.
          </p>

          <ul className="space-y-3 mb-8">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-accent)]/15 flex items-center justify-center">
                  <Check className="h-3 w-3 text-[var(--color-accent)]" />
                </span>
                {benefit}
              </li>
            ))}
          </ul>

          <Link
            href="/login?signup=true"
            className="inline-block bg-[var(--color-accent)] text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity"
          >
            Try the AI →
          </Link>
        </div>

        {/* Right — animated chat window */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-2xl">
          {/* Header bar */}
          <div className="bg-[var(--color-bg-tertiary)] px-4 py-3 flex items-center gap-2 border-b border-[var(--color-border)]">
            <BrainCircuit className="h-4 w-4 text-[var(--color-accent)]" />
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              MyFinOS AI
            </span>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-[var(--color-success)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] inline-block" />
              online
            </span>
          </div>

          {/* Chat body */}
          <div
            className="p-4 space-y-4 min-h-[280px] transition-opacity duration-500"
            style={{ opacity: fading ? 0 : 1 }}
          >
            {messages.slice(0, visibleCount).map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} chat-message-animate`}
              >
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm max-w-[85%] ${
                    msg.role === "user"
                      ? "bg-[var(--color-accent)]/20 text-[var(--color-text-primary)]"
                      : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {/* Empty state placeholder when no messages yet */}
            {visibleCount === 0 && (
              <div className="h-full flex items-center justify-center py-12">
                <p className="text-xs text-[var(--color-text-muted)]">
                  Starting conversation…
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
