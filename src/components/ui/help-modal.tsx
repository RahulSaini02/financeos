"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Modal } from "@/components/ui/modal";

export interface HelpSection {
  heading: string;
  items: string[];
}

interface HelpModalProps {
  title: string;
  description: string;
  sections?: HelpSection[];
}

export function HelpModal({ title, description, sections }: HelpModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center h-6 w-6 rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
        aria-label={`Help: ${title}`}
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`About: ${title}`} size="md">
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{description}</p>
          {sections?.map((section) => (
            <div key={section.heading}>
              <h3 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-2">
                {section.heading}
              </h3>
              <ul className="space-y-1.5">
                {section.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
