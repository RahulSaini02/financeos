"use client";

import Link from "next/link";
import { motion } from "motion/react";

export default function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Background orbs */}
      <div
        className="absolute top-[-100px] left-[-100px] w-[600px] h-[600px] rounded-full bg-[var(--color-accent)]/20 blur-3xl animate-pulse pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-[-80px] right-[-80px] w-[400px] h-[400px] rounded-full bg-[var(--color-warning)]/10 blur-3xl animate-pulse pointer-events-none"
        style={{ animationDelay: "1s", animationDuration: "3s" }}
        aria-hidden="true"
      />
      <div
        className="absolute top-[40%] right-[20%] w-[250px] h-[250px] rounded-full bg-[var(--color-accent)]/10 blur-2xl animate-pulse pointer-events-none"
        style={{ animationDelay: "2s", animationDuration: "4s" }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0 }}
          className="inline-flex items-center gap-1.5 border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] text-xs px-3 py-1 rounded-full mb-6"
        >
          <span>✦</span>
          <span>Powered by Claude AI</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="text-5xl sm:text-6xl font-bold leading-tight text-[var(--color-text-primary)]"
        >
          Your finances,{" "}
          <br className="hidden sm:block" />
          <span className="bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-warning)] bg-clip-text text-transparent">
            finally intelligent
          </span>
        </motion.h1>

        {/* Sub-copy */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
          className="text-lg text-[var(--color-text-secondary)] max-w-xl mx-auto mt-4"
        >
          Connect all your accounts, track every dollar, and let an AI agent
          handle the rest — budgets, subscriptions, savings goals, and beyond.
        </motion.p>

        {/* CTA row */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
          className="mt-8 flex gap-3 justify-center flex-wrap"
        >
          <Link
            href="/login?signup=true"
            className="bg-[var(--color-accent)] text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity"
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="border border-[var(--color-border)] text-[var(--color-text-secondary)] px-6 py-3 rounded-xl hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            Sign In
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
