"use client";

import { useState, useEffect } from "react";
import { BotMessageSquare, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import AiChatClient from "@/app/(app)/ai-chat/AiChatClient";

export function FloatingAiChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Prevent body scroll when overlay is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Don't render on the AI chat page — it's redundant there
  if (pathname === "/ai-chat") return null;

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent)] text-white shadow-lg hover:opacity-90 active:scale-95 transition-all lg:bottom-6 lg:right-6"
        aria-label="Open AI Chat"
      >
        <BotMessageSquare className="h-6 w-6" />
      </button>

      {/* Full-screen overlay */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />

            {/* Panel — slides up from bottom on mobile, slides in from right on desktop */}
            <motion.div
              key="panel"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed z-50 bg-[var(--color-bg-primary)] border border-[var(--color-border)] shadow-2xl overflow-hidden flex flex-col
                inset-x-0 bottom-0 top-[5vh] rounded-t-2xl
                sm:inset-auto sm:bottom-6 sm:right-6 sm:top-6 sm:left-auto sm:w-[520px] sm:rounded-2xl
                lg:w-[50vw] lg:max-w-[900px]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button — floats top-right inside panel */}
              <button
                onClick={() => setOpen(false)}
                className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                aria-label="Close AI Chat"
              >
                <X className="h-4 w-4" />
              </button>

              {/* The full AI chat client — same component as /ai-chat page */}
              <AiChatClient initialInsights={[]} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
