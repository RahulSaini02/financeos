"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import {
  BotMessageSquare,
  X,
  Send,
  Loader2,
  Bot,
  User,
  BrainCircuit,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "loading";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "How much did I spend this month?",
  "What's my net worth?",
  "Am I over budget anywhere?",
  "What's my savings rate?",
];

function formatMessageContent(content: string) {
  return content.split("\n").map((line, i, arr) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={i}>
        {parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={j}>{part.slice(2, -2)}</strong>
          ) : (
            <span key={j}>{part}</span>
          )
        )}
        {i < arr.length - 1 && <br />}
      </span>
    );
  });
}

export function FloatingAiChat() {
  const { user } = useAuth();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  async function sendMessage(question: string) {
    if (!question.trim() || isSending) return;

    const userMsgId = crypto.randomUUID();
    const loadingMsgId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: question },
      { id: loadingMsgId, role: "loading", content: "" },
    ]);
    setInputValue("");
    setIsSending(true);

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      const data = await res.json();
      const answer: string = res.ok
        ? data.answer
        : "Sorry, I couldn't process that. Please try again.";

      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsgId ? { ...m, role: "assistant", content: answer } : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsgId
            ? { ...m, role: "assistant", content: "Sorry, I couldn't process that. Please try again." }
            : m
        )
      );
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent)] text-white shadow-lg hover:opacity-90 transition-opacity"
          aria-label="Open AI Chat"
        >
          <BotMessageSquare className="h-6 w-6" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col w-[380px] h-[540px] rounded-2xl shadow-2xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)]/10">
              <BrainCircuit className="h-4 w-4 text-[var(--color-accent)]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold leading-tight">AI Finance Assistant</p>
              <p className="text-[0.65rem] text-[var(--color-text-muted)]">Ask about your finances</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4 px-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-accent)]/10">
                  <BrainCircuit className="h-6 w-6 text-[var(--color-accent)]" />
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Ask me anything</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Spending, net worth, loans, budgets & more.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-xs border border-[var(--color-border)] rounded-full px-2.5 py-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                if (msg.role === "loading") {
                  return (
                    <div key={msg.id} className="flex items-start gap-2">
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/10">
                        <Bot className="h-3 w-3 text-[var(--color-accent)]" />
                      </div>
                      <div className="bg-[var(--color-bg-tertiary)] rounded-2xl rounded-tl-sm px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          {[0, 150, 300].map((delay) => (
                            <span
                              key={delay}
                              className="h-1.5 w-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce"
                              style={{ animationDelay: `${delay}ms` }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                }

                if (msg.role === "user") {
                  return (
                    <div key={msg.id} className="flex items-start gap-2 justify-end">
                      <div className="bg-[var(--color-accent)] text-white rounded-2xl rounded-tr-sm px-3 py-2 max-w-[80%]">
                        <p className="text-xs leading-relaxed">{msg.content}</p>
                      </div>
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/20">
                        <User className="h-3 w-3 text-[var(--color-accent)]" />
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className="flex items-start gap-2">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/10">
                      <Bot className="h-3 w-3 text-[var(--color-accent)]" />
                    </div>
                    <div className="bg-[var(--color-bg-tertiary)] rounded-2xl rounded-tl-sm px-3 py-2 max-w-[80%]">
                      <p className="text-xs leading-relaxed whitespace-pre-wrap">
                        {formatMessageContent(msg.content)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-[var(--color-border)] p-3 bg-[var(--color-bg-secondary)]">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your finances…"
                disabled={isSending}
                className="flex-1 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] disabled:opacity-50"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={() => sendMessage(inputValue)}
                disabled={!inputValue.trim() || isSending}
                className="flex-shrink-0"
              >
                {isSending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
