"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";

const screens = [
  {
    label: "Dashboard",
    src: "/demo-dashboard.png",
    description: "See your full financial picture at a glance",
  },
  {
    label: "AI Agent",
    src: "/demo-ai-chat.png",
    description: "Ask your AI anything about your finances",
  },
  {
    label: "Budgets",
    src: "/demo-budgets.png",
    description: "Stay on top of every spending category",
  },
];

export default function DemoPreview() {
  const [activeScreen, setActiveScreen] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveScreen((prev) => (prev + 1) % screens.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="demo" className="max-w-5xl mx-auto px-4 sm:px-6 py-24">
      {/* Heading */}
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-[var(--color-text-primary)]">
          See it in action
        </h2>
        <p className="text-[var(--color-text-muted)] mt-2">
          A real look at the tools that keep your finances on track.
        </p>
      </div>

      {/* Browser chrome mockup */}
      <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-2xl bg-[var(--color-bg-secondary)]">
        {/* Top bar */}
        <div className="h-9 bg-[var(--color-bg-tertiary)] flex items-center px-3 gap-1.5 border-b border-[var(--color-border)]">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
          <div className="mx-auto w-48 h-4 rounded bg-[var(--color-bg-primary)]/60" />
        </div>

        {/* Content area */}
        <div className="aspect-[16/9] relative overflow-hidden bg-[var(--color-bg-primary)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeScreen}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="absolute inset-0"
            >
              <Image
                src={screens[activeScreen].src}
                alt={screens[activeScreen].label}
                fill
                className="object-cover object-top"
                priority={activeScreen === 0}
                sizes="(max-width: 1024px) 100vw, 900px"
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-2 mt-4">
        {screens.map((_, index) => (
          <button
            key={index}
            onClick={() => setActiveScreen(index)}
            aria-label={`Go to screen ${index + 1}`}
            className={`h-2 rounded-full transition-all duration-300 ${
              activeScreen === index
                ? "w-6 bg-[var(--color-accent)]"
                : "w-2 bg-[var(--color-border)]"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
