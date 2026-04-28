"use client";

import {
  useState, useEffect, useRef, useCallback,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import type { AiInsight } from "@/lib/types";
import {
  Sparkles, Loader2, Bot, User, BrainCircuit,
  Bell, Zap, Trash2, PanelRightOpen, PanelRightClose, X,
} from "lucide-react";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { AgentToolStep } from "@/components/ui/agent-tool-step";
import { AgentConfirmCard } from "@/components/ui/agent-confirm-card";
import { AnimatedAiInput } from "@/components/ui/animated-ai-input";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const CHAT_MODEL_KEY = "pref_chat_model";
const DEFAULT_CHAT_MODEL = "claude-sonnet-4-6";
const AGENT_SESSION_KEY = "agent_session_v1";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ToolStep {
  id: string;
  toolName: string;
  status: "running" | "done" | "error";
  summary?: string;
}

interface PendingAction {
  actionId: string;
  toolName: string;
  preview: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "loading" | "tool_steps" | "pending_action";
  content: string;
  toolSteps?: ToolStep[];
  pendingAction?: PendingAction;
  timestamp?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  daily: { bg: "bg-[var(--color-accent)]/10", text: "text-[var(--color-accent)]" },
  monthly: { bg: "bg-[var(--color-success)]/10", text: "text-[var(--color-success)]" },
  alert: { bg: "bg-[var(--color-danger)]/10", text: "text-[var(--color-danger)]" },
  agent_action: { bg: "bg-[var(--color-warning)]/10", text: "text-[var(--color-warning)]" },
};

function InsightBadge ( { type }: { type: string } ) {
  const style = BADGE_STYLES[type] ?? BADGE_STYLES.daily;
  return (
    <span className={cn( "inline-flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded", style.bg, style.text )}>
      {type === "alert" ? <Bell className="h-2.5 w-2.5" /> : <Sparkles className="h-2.5 w-2.5" />}
      {type === "agent_action" ? "agent" : type}
    </span>
  );
}

const SUGGESTED_QUESTIONS = [
  "How much did I spend this month?",
  "What's my net worth?",
  "When will I pay off my loans?",
  "Am I over budget anywhere?",
  "What's my savings rate?",
];

const AGENT_SUGGESTED_QUESTIONS = [
  "Analyze my spending and check if I'm over budget",
  "What subscriptions should I consider cancelling?",
  "Show me my loan payoff timeline",
  "Help me create a savings goal for an emergency fund",
  "Am I on track with my savings goals?",
];

// ── Main Component ────────────────────────────────────────────────────────────

export default function AiChatClient ( { initialInsights }: { initialInsights: AiInsight[] } ) {
  const { user } = useAuth();
  const supabase = createClient();

  const [insights, setInsights] = useState<AiInsight[]>( initialInsights );
  const [insightsLoading, setInsightsLoading] = useState( false );
  const [showInsights, setShowInsights] = useState( false );
  const [messages, setMessages] = useState<ChatMessage[]>( [] );
  const [inputValue, setInputValue] = useState( "" );
  const [isSending, setIsSending] = useState( false );
  const [selectedModel, setSelectedModel] = useState<string>( () => {
    try { return ( typeof window !== "undefined" && localStorage.getItem( CHAT_MODEL_KEY ) ) || DEFAULT_CHAT_MODEL; }
    catch { return DEFAULT_CHAT_MODEL; }
  } );
  const [agentMode, setAgentMode] = useState( false );
  const [agentHistory, setAgentHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>( [] );
  const [confirmingActionId, setConfirmingActionId] = useState<string | null>( null );

  const chatEndRef = useRef<HTMLDivElement>( null );

  useEffect( () => {
    chatEndRef.current?.scrollIntoView( { behavior: "smooth" } );
  }, [messages] );

  useEffect( () => {
    if ( !user || !agentMode ) return;
    try {
      localStorage.setItem( `${ AGENT_SESSION_KEY }_${ user.id }`, JSON.stringify( { history: agentHistory, savedAt: Date.now() } ) );
    } catch { /* ignore */ }
  }, [agentHistory, user, agentMode] );

  useEffect( () => {
    if ( !user || !agentMode ) return;
    try {
      const raw = localStorage.getItem( `${ AGENT_SESSION_KEY }_${ user.id }` );
      if ( !raw ) return;
      const session = JSON.parse( raw ) as { history: typeof agentHistory; savedAt: number };
      if ( Date.now() - session.savedAt < 24 * 60 * 60 * 1000 ) setAgentHistory( session.history );
    } catch { /* ignore */ }
  }, [user, agentMode] );

  const fetchInsights = useCallback( async () => {
    if ( !user ) return;
    setInsightsLoading( true );
    const { data } = await supabase.from( "ai_insights" ).select( "*" ).eq( "user_id", user.id ).order( "created_at", { ascending: false } ).limit( 20 );
    setInsights( data ?? [] );
    setInsightsLoading( false );
  }, [user, supabase] );

  async function markAsRead ( id: string ) {
    await supabase.from( "ai_insights" ).update( { is_read: true } ).eq( "id", id ).eq( "user_id", user?.id ?? "" );
    setInsights( ( prev ) => prev.map( ( ins ) => ( ins.id === id ? { ...ins, is_read: true } : ins ) ) );
  }

  // ── Send (standard chat) ──────────────────────────────────────────────────

  async function sendMessage ( question: string ) {
    if ( !question.trim() || isSending ) return;
    const userMsgId = crypto.randomUUID();
    const loadingMsgId = crypto.randomUUID();
    setMessages( ( prev ) => [
      ...prev,
      { id: userMsgId, role: "user", content: question, timestamp: Date.now() },
      { id: loadingMsgId, role: "loading", content: "" },
    ] );
    setInputValue( "" );
    setIsSending( true );
    try {
      const res = await fetch( "/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify( { question, model: selectedModel, timezone: localStorage.getItem( "pref_timezone" ) ?? "America/Los_Angeles" } ),
      } );
      const data = await res.json();
      const answer: string = res.ok ? data.answer : "Sorry, I couldn't process that. Please try again.";
      setMessages( ( prev ) => prev.map( ( m ) => m.id === loadingMsgId ? { id: loadingMsgId, role: "assistant", content: answer, timestamp: Date.now() } : m ) );
      if ( res.ok ) fetchInsights();
    } catch {
      setMessages( ( prev ) => prev.map( ( m ) => m.id === loadingMsgId ? { id: loadingMsgId, role: "assistant", content: "Sorry, I couldn't process that. Please try again." } : m ) );
    } finally {
      setIsSending( false );
    }
  }

  // ── Send (agent mode) ─────────────────────────────────────────────────────

  async function sendAgentMessage ( question: string ) {
    if ( !question.trim() || isSending ) return;
    const userMsgId = crypto.randomUUID();
    const toolStepsMsgId = crypto.randomUUID();
    setMessages( ( prev ) => [
      ...prev,
      { id: userMsgId, role: "user", content: question, timestamp: Date.now() },
      { id: toolStepsMsgId, role: "tool_steps", content: "", toolSteps: [] },
    ] );
    setInputValue( "" );
    setIsSending( true );
    const newHistory: typeof agentHistory = [...agentHistory, { role: "user", content: question }];
    try {
      const res = await fetch( "/api/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify( { messages: newHistory, model: selectedModel, timezone: localStorage.getItem( "pref_timezone" ) ?? "America/Los_Angeles" } ),
      } );
      if ( !res.ok || !res.body ) throw new Error( "Agent request failed" );
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      let buffer = "";
      while ( true ) {
        const { done, value } = await reader.read();
        if ( done ) break;
        buffer += decoder.decode( value, { stream: true } );
        const lines = buffer.split( "\n\n" );
        buffer = lines.pop() ?? "";
        for ( const line of lines ) {
          if ( !line.startsWith( "data: " ) ) continue;
          try {
            const event = JSON.parse( line.slice( 6 ) ) as {
              event: string; toolName?: string; toolUseId?: string;
              summary?: string; actionId?: string; preview?: string;
              text?: string; reason?: string;
            };
            if ( event.event === "tool_start" && event.toolName && event.toolUseId ) {
              setMessages( ( prev ) => prev.map( ( m ) => m.id === toolStepsMsgId
                ? { ...m, toolSteps: [...( m.toolSteps ?? [] ), { id: event.toolUseId!, toolName: event.toolName!, status: "running" as const }] }
                : m ) );
            }
            if ( event.event === "tool_result" && event.toolUseId ) {
              setMessages( ( prev ) => prev.map( ( m ) => m.id === toolStepsMsgId
                ? { ...m, toolSteps: ( m.toolSteps ?? [] ).map( ( s ) => s.id === event.toolUseId ? { ...s, status: "done" as const, summary: event.summary } : s ) }
                : m ) );
            }
            if ( event.event === "pending_action" && event.actionId ) {
              setMessages( ( prev ) => [...prev, {
                id: crypto.randomUUID(), role: "pending_action", content: "",
                pendingAction: { actionId: event.actionId!, toolName: event.toolName ?? "", preview: event.preview ?? "" },
              }] );
            }
            if ( event.event === "text_delta" && event.text ) {
              assistantText += event.text;
              setMessages( ( prev ) => {
                const hasAssistant = prev.some( ( m ) => m.id === toolStepsMsgId + "_text" );
                if ( hasAssistant ) return prev.map( ( m ) => m.id === toolStepsMsgId + "_text" ? { ...m, content: assistantText } : m );
                return [...prev, { id: toolStepsMsgId + "_text", role: "assistant" as const, content: assistantText }];
              } );
            }
          } catch { /* ignore */ }
        }
      }
      if ( assistantText ) setAgentHistory( [...newHistory, { role: "assistant", content: assistantText }] );
      if ( res.ok ) fetchInsights();
    } catch {
      setMessages( ( prev ) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: "Sorry, I couldn't process that. Please try again." }] );
    } finally {
      setIsSending( false );
    }
  }

  // ── Confirm / Cancel agent actions ────────────────────────────────────────

  async function handleConfirmAction ( actionId: string ) {
    setConfirmingActionId( actionId );
    try {
      const res = await fetch( "/api/ai-agent/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify( { action_id: actionId, confirmed: true } ),
      } );
      const data = await res.json() as { success: boolean; result?: string };
      setMessages( ( prev ) => prev.map( ( m ) =>
        m.role === "pending_action" && m.pendingAction?.actionId === actionId
          ? { id: m.id, role: "assistant", content: data.result ?? "Action completed successfully." }
          : m
      ) );
      setAgentHistory( ( prev ) => [...prev, { role: "assistant", content: data.result ?? "Action completed." }] );
      fetchInsights();
    } catch {
      setMessages( ( prev ) => prev.map( ( m ) =>
        m.role === "pending_action" && m.pendingAction?.actionId === actionId
          ? { id: m.id, role: "assistant", content: "Failed to execute action. Please try again." }
          : m
      ) );
    } finally {
      setConfirmingActionId( null );
    }
  }

  function handleCancelAction ( actionId: string ) {
    fetch( "/api/ai-agent/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify( { action_id: actionId, confirmed: false } ),
    } ).catch( () => { } );
    setMessages( ( prev ) => prev.map( ( m ) =>
      m.role === "pending_action" && m.pendingAction?.actionId === actionId
        ? { id: m.id, role: "assistant", content: "Action cancelled." }
        : m
    ) );
  }

  function handleSubmit () {
    if ( !inputValue.trim() || isSending ) return;
    if ( agentMode ) sendAgentMessage( inputValue );
    else sendMessage( inputValue );
  }

  function clearChat () {
    setMessages( [] );
    setAgentHistory( [] );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const unreadCount = insights.filter( ( i ) => !i.is_read ).length;

  return (
    <div className="fixed inset-0 z-30 flex flex-col overflow-hidden bg-[var(--color-bg-primary)] lg:relative lg:inset-auto lg:z-auto">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-200",
            agentMode ? "bg-[var(--color-warning)]/15" : "bg-[var(--color-accent)]/10"
          )}>
            {agentMode
              ? <Zap className="h-4 w-4 text-[var(--color-warning)]" />
              : <BrainCircuit className="h-4 w-4 text-[var(--color-accent)]" />}
          </div>
          <div>
            <h1 className="text-sm font-semibold text-[var(--color-text-primary)] leading-tight">AI Finance Assistant</h1>
            <p className="text-[0.65rem] text-[var(--color-text-muted)] leading-tight mt-0.5">
              {agentMode ? "Agent mode — queries data and takes actions" : "Ask anything about your finances"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors px-2.5 py-1.5 rounded-lg hover:bg-[var(--color-bg-tertiary)]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
          <button
            onClick={() => setShowInsights( ( v ) => !v )}
            className={cn(
              "relative flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors mr-4",
              showInsights
                ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
            )}
          >
            {showInsights ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
            Insights
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center text-[0.55rem] font-bold bg-[var(--color-accent)] text-white rounded-full">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-h-0">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-20 gap-6">
                  {/* Icon with glow */}
                  <div
                    className={cn(
                      "flex h-20 w-20 items-center justify-center rounded-2xl transition-colors duration-300",
                      agentMode ? "bg-[var(--color-warning)]/10" : "bg-[var(--color-accent)]/10"
                    )}
                    style={{
                      boxShadow: agentMode
                        ? "0 0 48px color-mix(in srgb, var(--color-warning) 18%, transparent)"
                        : "0 0 48px color-mix(in srgb, var(--color-accent) 18%, transparent)",
                    }}
                  >
                    {agentMode
                      ? <Zap className="h-10 w-10 text-[var(--color-warning)]" />
                      : <BrainCircuit className="h-10 w-10 text-[var(--color-accent)]" />}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xl font-semibold">
                      {agentMode ? "Agent Mode Active" : "Ask me anything"}
                    </p>
                    <p className="text-sm text-[var(--color-text-muted)] max-w-sm mx-auto">
                      {agentMode
                        ? "I'll use tools to fetch real data and can update budgets, create goals, and more — with your confirmation."
                        : "I have full context on your transactions, budgets, accounts, loans, and investments."}
                    </p>
                  </div>
                  {/* Suggestion pills */}
                  <div className="flex flex-wrap justify-center gap-2 max-w-md">
                    {( agentMode ? AGENT_SUGGESTED_QUESTIONS : SUGGESTED_QUESTIONS ).map( ( q ) => (
                      <button
                        key={q}
                        onClick={() => agentMode ? sendAgentMessage( q ) : sendMessage( q )}
                        className="text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-full px-4 py-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-all"
                      >
                        {q}
                      </button>
                    ) )}
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <AnimatePresence initial={false}>
                    {messages.map( ( msg ) => {

                      // Tool steps card
                      if ( msg.role === "tool_steps" ) {
                        const steps = msg.toolSteps ?? [];
                        return (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-start gap-3"
                          >
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-warning)]/10 mt-0.5">
                              <Zap className="h-4 w-4 text-[var(--color-warning)]" />
                            </div>
                            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl rounded-tl-sm px-4 py-3 min-w-[200px]">
                              {steps.length === 0 ? (
                                <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Agent is thinking…
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  {steps.map( ( step ) => (
                                    <AgentToolStep key={step.id} toolName={step.toolName} status={step.status} summary={step.summary} />
                                  ) )}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      }

                      // Pending action
                      if ( msg.role === "pending_action" && msg.pendingAction ) {
                        return (
                          <motion.div key={msg.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                            <AgentConfirmCard
                              actionId={msg.pendingAction.actionId}
                              toolName={msg.pendingAction.toolName}
                              preview={msg.pendingAction.preview}
                              onConfirm={handleConfirmAction}
                              onCancel={handleCancelAction}
                              isConfirming={confirmingActionId === msg.pendingAction.actionId}
                            />
                          </motion.div>
                        );
                      }

                      // Loading indicator
                      if ( msg.role === "loading" ) {
                        return (
                          <motion.div key={msg.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/10 mt-0.5">
                              <Bot className="h-4 w-4 text-[var(--color-accent)]" />
                            </div>
                            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl rounded-tl-sm px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                {[0, 150, 300].map( ( delay ) => (
                                  <span
                                    key={delay}
                                    className="h-1.5 w-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce"
                                    style={{ animationDelay: `${ delay }ms` }}
                                  />
                                ) )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      }

                      // User message
                      if ( msg.role === "user" ) {
                        return (
                          <motion.div key={msg.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 justify-end">
                            <div className="bg-[var(--color-accent)] text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[78%]">
                              <p className="text-sm leading-relaxed">{msg.content}</p>
                            </div>
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/15 mt-0.5">
                              <User className="h-4 w-4 text-[var(--color-accent)]" />
                            </div>
                          </motion.div>
                        );
                      }

                      // Assistant message
                      return (
                        <motion.div key={msg.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/10 mt-0.5">
                            <Bot className="h-4 w-4 text-[var(--color-accent)]" />
                          </div>
                          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl rounded-tl-sm px-4 py-3 max-w-[78%] select-text">
                            <MarkdownContent content={msg.content} className="text-sm leading-relaxed" />
                          </div>
                        </motion.div>
                      );
                    } )}
                  </AnimatePresence>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="shrink-0 px-4 sm:px-6 pb-6 pt-2">
            <div className="max-w-3xl mx-auto">
              <AnimatedAiInput
                value={inputValue}
                onChange={setInputValue}
                onSubmit={handleSubmit}
                disabled={isSending}
                isSending={isSending}
                agentMode={agentMode}
                onModeChange={( agent ) => { setAgentMode( agent ); setMessages( [] ); setAgentHistory( [] ); }}
                selectedModel={selectedModel}
                onModelChange={( m ) => {
                  setSelectedModel( m );
                  try { localStorage.setItem( CHAT_MODEL_KEY, m ); } catch { /* ignore */ }
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Insights panel (collapsible slide-in) ─────────────────────── */}
        <AnimatePresence>
          {showInsights && (
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] lg:relative lg:inset-auto lg:z-auto lg:w-72 lg:flex-shrink-0 lg:border-l lg:border-[var(--color-border)] lg:bg-transparent"
            >
              <div className="h-full flex flex-col p-4">
                <div className="flex items-center gap-2 mb-3 shrink-0">
                  <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
                  <h2 className="text-sm font-semibold">Past Insights</h2>
                  {unreadCount > 0 && (
                    <span className="ml-auto text-[0.65rem] font-medium bg-[var(--color-accent)] text-white rounded-full px-1.5 py-0.5">
                      {unreadCount} new
                    </span>
                  )}
                  <button
                    onClick={() => setShowInsights( false )}
                    className="lg:hidden ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                    aria-label="Close insights"
                  >
                    <X className="h-4 w-4" />
                  </button>
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
                    insights.map( ( insight ) => (
                      <button
                        key={insight.id}
                        onClick={() => markAsRead( insight.id )}
                        className={cn(
                          "w-full text-left rounded-xl border p-3 transition-colors hover:bg-[var(--color-bg-tertiary)] bg-[var(--color-bg-secondary)]",
                          !insight.is_read
                            ? "border-l-4 border-l-[var(--color-accent)] border-[var(--color-border)]"
                            : "border-[var(--color-border)]"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <InsightBadge type={insight.type} />
                          <span className="text-[0.65rem] text-[var(--color-text-muted)]">
                            {new Date( insight.created_at ).toLocaleDateString( "en-US", { month: "short", day: "numeric" } )}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed line-clamp-4">
                          {insight.content}
                        </p>
                      </button>
                    ) )
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
