"use client";

import {
  ArrowLeftRight,
  PieChart,
  BrainCircuit,
  RefreshCw,
  Target,
  Calculator,
} from "lucide-react";
import { motion } from "motion/react";

const features = [
  {
    icon: ArrowLeftRight,
    title: "Transactions",
    description:
      "Log, categorize, and search every transaction with AI auto-tagging",
  },
  {
    icon: PieChart,
    title: "Budgets",
    description: "Set monthly limits, get alerts before you overspend",
  },
  {
    icon: BrainCircuit,
    title: "AI Agent",
    description:
      "Ask questions, run analyses, and let the agent take action on your behalf",
  },
  {
    icon: RefreshCw,
    title: "Subscriptions",
    description: "Track every recurring charge and never miss a renewal",
  },
  {
    icon: Target,
    title: "Savings Goals",
    description:
      "Set goals, watch progress, and get AI nudges when you're off track",
  },
  {
    icon: Calculator,
    title: "Tax Estimator",
    description: "Estimate your federal tax liability any time of year",
  },
];

export default function FeaturesGrid() {
  return (
    <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 py-24">
      {/* Heading */}
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-[var(--color-text-primary)]">
          Everything you need
        </h2>
        <p className="text-[var(--color-text-muted)] mt-2">
          One app for your entire financial life.
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6 hover:border-[var(--color-accent)]/40 transition-colors"
            >
              <div className="rounded-xl bg-[var(--color-accent)]/10 p-2.5 w-fit mb-4">
                <Icon className="h-5 w-5 text-[var(--color-accent)]" />
              </div>
              <h3 className="font-semibold text-[var(--color-text-primary)]">
                {feature.title}
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                {feature.description}
              </p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
