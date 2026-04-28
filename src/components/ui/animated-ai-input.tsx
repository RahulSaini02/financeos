"use client";

import { ArrowUp, BrainCircuit, Check, ChevronDown, Zap } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRef, useCallback, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// ── Anthropic SVG ──────────────────────────────────────────────────────────────

const AnthropicIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className="w-3.5 h-3.5 text-[var(--color-text-secondary)]"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z"
    />
  </svg>
);

// ── Auto-resize hook ───────────────────────────────────────────────────────────

interface UseAutoResizeTextareaProps {
  minHeight: number;
  maxHeight?: number;
}

export function useAutoResizeTextarea({ minHeight, maxHeight }: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }
      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight ?? Infinity));
      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight]
  );

  useEffect(() => {
    if (textareaRef.current) textareaRef.current.style.height = `${minHeight}px`;
  }, [minHeight]);

  useEffect(() => {
    const handleResize = () => adjustHeight();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

// ── Model config ───────────────────────────────────────────────────────────────

export const MODEL_OPTIONS = [
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku", description: "Fast & affordable", badge: "Fast" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet", description: "Balanced performance", badge: "Recommended" },
  { value: "claude-opus-4-6", label: "Claude Opus", description: "Most capable", badge: "Powerful" },
] as const;

export type ModelValue = (typeof MODEL_OPTIONS)[number]["value"];

function getModelShortLabel(value: string) {
  return MODEL_OPTIONS.find((m) => m.value === value)?.label.replace("Claude ", "") ?? "Sonnet";
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface AnimatedAiInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  isSending?: boolean;
  agentMode: boolean;
  onModeChange: (agent: boolean) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AnimatedAiInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
  isSending,
  agentMode,
  onModeChange,
  selectedModel,
  onModelChange,
}: AnimatedAiInputProps) {
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 72, maxHeight: 300 });

  // Reset height when value is cleared externally (e.g., after submit)
  useEffect(() => {
    if (!value) adjustHeight(true);
  }, [value, adjustHeight]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled && !isSending) onSubmit();
    }
  }

  const canSend = value.trim().length > 0 && !disabled && !isSending;

  return (
    <div
      className={cn(
        "rounded-2xl p-1.5 transition-colors duration-200",
        agentMode
          ? "bg-[color-mix(in_srgb,var(--color-warning)_8%,var(--color-bg-secondary))]"
          : "bg-[var(--color-bg-secondary)]"
      )}
      style={{
        boxShadow: agentMode
          ? "0 0 0 1px color-mix(in srgb, var(--color-warning) 30%, transparent), 0 8px 32px rgba(0,0,0,0.4)"
          : "0 0 0 1px var(--color-border), 0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      <div className="relative flex flex-col">
        {/* Textarea */}
        <div className="overflow-y-auto" style={{ maxHeight: "300px" }}>
          <Textarea
            ref={textareaRef}
            value={value}
            placeholder={placeholder ?? (agentMode ? "Ask the agent to analyze data or take action…" : "Ask about your finances…")}
            disabled={disabled}
            className={cn(
              "w-full rounded-xl rounded-b-none px-4 py-3.5",
              "bg-[var(--color-bg-tertiary)]/40 border-none",
              "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
              "resize-none focus-visible:ring-0 focus-visible:ring-offset-0",
              "min-h-[72px] text-sm leading-relaxed",
              "disabled:opacity-50"
            )}
            onKeyDown={handleKeyDown}
            onChange={(e) => {
              onChange(e.target.value);
              adjustHeight();
            }}
          />
        </div>

        {/* Toolbar */}
        <div
          className={cn(
            "h-14 rounded-b-xl flex items-center",
            "bg-[var(--color-bg-tertiary)]/40"
          )}
        >
          <div className="absolute left-3 right-3 bottom-3 flex items-center justify-between">
            {/* Left: mode toggle + model picker */}
            <div className="flex items-center gap-2">
              {/* Chat / Agent toggle */}
              <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--color-bg-primary)]/60">
                <button
                  onClick={() => onModeChange(false)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150",
                    !agentMode
                      ? "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] shadow-sm"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                  )}
                >
                  <BrainCircuit className="h-3 w-3" />
                  Chat
                </button>
                <button
                  onClick={() => onModeChange(true)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150",
                    agentMode
                      ? "bg-[var(--color-warning)]/20 text-[var(--color-warning)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                  )}
                >
                  <Zap className={cn("h-3 w-3", agentMode && "fill-[var(--color-warning)]")} />
                  Agent
                  {agentMode && <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-warning)] animate-pulse" />}
                </button>
              </div>

              <div className="h-4 w-px bg-[var(--color-border)]" />

              {/* Model picker */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-primary)]/60 hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-none">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={selectedModel}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.12 }}
                        className="flex items-center gap-1.5"
                      >
                        <AnthropicIcon />
                        {getModelShortLabel(selectedModel)}
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </motion.span>
                    </AnimatePresence>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuLabel>Claude Models</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {MODEL_OPTIONS.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onSelect={() => {
                        onModelChange(opt.value);
                        try { localStorage.setItem("pref_chat_model", opt.value); } catch { /* ignore */ }
                      }}
                      className="flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <AnthropicIcon />
                        <div>
                          <p className="text-sm font-medium">{opt.label}</p>
                          <p className="text-[0.65rem] text-[var(--color-text-muted)]">{opt.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[0.6rem] font-medium px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]">
                          {opt.badge}
                        </span>
                        {selectedModel === opt.value && <Check className="h-3.5 w-3.5 text-[var(--color-accent)]" />}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Right: Send button */}
            <button
              type="button"
              disabled={!canSend}
              onClick={() => { if (canSend) onSubmit(); }}
              aria-label="Send message"
              className={cn(
                "rounded-xl p-2 transition-all duration-200",
                canSend
                  ? agentMode
                    ? "bg-[var(--color-warning)] text-white hover:opacity-90 shadow-lg shadow-[var(--color-warning)]/20"
                    : "bg-[var(--color-accent)] text-white hover:opacity-90 shadow-lg shadow-[var(--color-accent)]/20"
                  : "bg-[var(--color-bg-primary)]/60 text-[var(--color-text-muted)] cursor-not-allowed"
              )}
            >
              <ArrowUp
                className={cn(
                  "h-4 w-4 transition-opacity duration-150",
                  canSend ? "opacity-100" : "opacity-40"
                )}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
