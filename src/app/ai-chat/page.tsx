"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import type { AiInsight } from "@/lib/types";
import {
  Sparkles,
  Send,
  Loader2,
  Bot,
  User,
  BrainCircuit,
  Bell,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { HelpModal } from "@/components/ui/help-modal";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'loading'
  content: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  daily: { bg: 'bg-[var(--color-accent)]/10', text: 'text-[var(--color-accent)]' },
  monthly: { bg: 'bg-[var(--color-success)]/10', text: 'text-[var(--color-success)]' },
  alert: { bg: 'bg-[var(--color-danger)]/10', text: 'text-[var(--color-danger)]' },
}

function InsightBadge({ type }: { type: string }) {
  const style = BADGE_STYLES[type] ?? BADGE_STYLES.daily
  return (
    <span className={`inline-flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
      {type === 'alert' ? <Bell className="h-2.5 w-2.5" /> : <Sparkles className="h-2.5 w-2.5" />}
      {type}
    </span>
  )
}

const SUGGESTED_QUESTIONS = [
  "How much did I spend this month?",
  "What's my net worth?",
  "When will I pay off my loans?",
  "Am I over budget anywhere?",
  "What's my savings rate?",
]

function formatMessageContent(content: string) {
  // Render simple **bold** markdown and line breaks
  return content.split('\n').map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g)
    return (
      <span key={i}>
        {parts.map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j}>{part.slice(2, -2)}</strong>
          }
          return <span key={j}>{part}</span>
        })}
        {i < content.split('\n').length - 1 && <br />}
      </span>
    )
  })
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AiChatPage() {
  const { user } = useAuth();
  const supabase = createClient();

  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchInsights = useCallback(async () => {
    if (!user) return;
    setInsightsLoading(true);
    const { data } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setInsights(data ?? []);
    setInsightsLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  async function markAsRead(id: string) {
    await supabase.from('ai_insights').update({ is_read: true }).eq('id', id);
    setInsights((prev) =>
      prev.map((ins) => (ins.id === id ? { ...ins, is_read: true } : ins))
    );
  }

  async function sendMessage(question: string) {
    if (!question.trim() || isSending) return;

    const userMsgId = crypto.randomUUID();
    const loadingMsgId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', content: question },
      { id: loadingMsgId, role: 'loading', content: '' },
    ]);
    setInputValue('');
    setIsSending(true);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      const data = await res.json();
      const answer: string = res.ok
        ? data.answer
        : "Sorry, I couldn't process that. Please try again.";

      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsgId
            ? { id: loadingMsgId, role: 'assistant', content: answer }
            : m
        )
      );

      // Refresh insights panel after a successful answer
      if (res.ok) {
        fetchInsights();
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsgId
            ? {
                id: loadingMsgId,
                role: 'assistant',
                content: "Sorry, I couldn't process that. Please try again.",
              }
            : m
        )
      );
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  }

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <PageHeader
          title="AI Finance Assistant"
          subtitle="Ask questions about your finances"
          tooltip={
            <HelpModal
              title="AI Chat"
              description="Have a free-form conversation with an AI financial assistant that knows your data. Ask questions, get advice, run hypotheticals, or explore your spending patterns."
              sections={[
                {
                  heading: "How to use",
                  items: [
                    "Type any financial question in the chat box and press Enter",
                    "The AI has access to your transactions, budgets, and account balances",
                    "Ask things like 'How much did I spend on dining last month?' or 'Am I on track to save $10k this year?'",
                    "Start a new session with the clear button to reset context",
                  ],
                },
                {
                  heading: "Example questions",
                  items: [
                    "What are my top spending categories this month?",
                    "How does my spending compare to last month?",
                    "How long until I pay off my car loan at current payments?",
                    "What would happen to my savings rate if I cut dining by 20%?",
                  ],
                },
              ]}
            />
          }
        />
      </div>

      {/* Body: two panels */}
      <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
        {/* Left: Past Insights (1/3) */}
        <div className="hidden lg:flex lg:w-1/3 flex-col min-h-0">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
            <h2 className="text-sm font-semibold">Past Insights</h2>
            {insights.filter((i) => !i.is_read).length > 0 && (
              <span className="ml-auto text-[0.65rem] font-medium bg-[var(--color-accent)] text-white rounded-full px-1.5 py-0.5">
                {insights.filter((i) => !i.is_read).length} new
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {insightsLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--color-accent)]" />
              </div>
            ) : insights.length === 0 ? (
              <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">
                No insights yet. Ask a question!
              </div>
            ) : (
              insights.map((insight) => (
                <button
                  key={insight.id}
                  onClick={() => markAsRead(insight.id)}
                  className={`w-full text-left rounded-xl border p-3 transition-colors hover:bg-[var(--color-bg-tertiary)] ${
                    !insight.is_read
                      ? 'border-l-4 border-l-[var(--color-accent)] border-[var(--color-border)]'
                      : 'border-[var(--color-border)]'
                  } bg-[var(--color-bg-secondary)]`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <InsightBadge type={insight.type} />
                    <span className="text-[0.65rem] text-[var(--color-text-muted)]">
                      {new Date(insight.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed line-clamp-4 whitespace-pre-wrap">
                    {insight.content}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Chat (2/3) */}
        <div className="flex-1 flex flex-col min-h-0">
          <Card className="flex-1 flex flex-col min-h-0 p-0 overflow-hidden">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-6 py-10 gap-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-accent)]/10">
                    <BrainCircuit className="h-7 w-7 text-[var(--color-accent)]" />
                  </div>
                  <div>
                    <p className="text-base font-medium mb-1">Ask me anything about your finances</p>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      I can analyze your spending, net worth, loans, investments, and more.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 max-w-md">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className="text-xs border border-[var(--color-border)] rounded-full px-3 py-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  if (msg.role === 'loading') {
                    return (
                      <div key={msg.id} className="flex items-start gap-2">
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/10">
                          <Bot className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                        </div>
                        <div className="bg-[var(--color-bg-tertiary)] rounded-2xl rounded-tl-sm px-4 py-3">
                          <div className="flex items-center gap-1">
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce"
                              style={{ animationDelay: '0ms' }}
                            />
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce"
                              style={{ animationDelay: '150ms' }}
                            />
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce"
                              style={{ animationDelay: '300ms' }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  }

                  if (msg.role === 'user') {
                    return (
                      <div key={msg.id} className="flex items-start gap-2 justify-end">
                        <div className="bg-[var(--color-accent)] text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[75%]">
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                        </div>
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/20">
                          <User className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                        </div>
                      </div>
                    )
                  }

                  // assistant
                  return (
                    <div key={msg.id} className="flex items-start gap-2">
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/10">
                        <Bot className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                      </div>
                      <div className="bg-[var(--color-bg-tertiary)] rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[75%]">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {formatMessageContent(msg.content)}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-[var(--color-border)] p-3">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your finances…"
                  disabled={isSending}
                  className="flex-1 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg-secondary)] disabled:opacity-50"
                />
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => sendMessage(inputValue)}
                  disabled={!inputValue.trim() || isSending}
                  className="flex-shrink-0"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
