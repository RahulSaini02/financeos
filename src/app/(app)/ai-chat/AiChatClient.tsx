"use client";

import {
  useState, useEffect, useRef, useCallback,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import type { AiInsight } from "@/lib/types";
import {
  Sparkles, Loader2, Bot, User, BrainCircuit,
  Bell, Trash2, X, History, ChevronLeft,
} from "lucide-react";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { AgentToolStep } from "@/components/ui/agent-tool-step";
import { AgentConfirmCard } from "@/components/ui/agent-confirm-card";
import { AnimatedAiInput } from "@/components/ui/animated-ai-input";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const CHAT_MODEL_KEY = "pref_chat_model";
const DEFAULT_CHAT_MODEL = "claude-sonnet-4-6";
const SESSION_KEY = "ai_session_v1";
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

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

interface SessionSummary {
  session_id: string;
  first_message: string;
  message_count: number;
  created_at: string;
  last_message_at: string;
}

interface StoredMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  mode: string;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  daily: { bg: "bg-[var(--color-accent)]/10", text: "text-[var(--color-accent)]" },
  monthly: { bg: "bg-[var(--color-success)]/10", text: "text-[var(--color-success)]" },
  alert: { bg: "bg-[var(--color-danger)]/10", text: "text-[var(--color-danger)]" },
  agent_action: { bg: "bg-[var(--color-warning)]/10", text: "text-[var(--color-warning)]" },
};

function relativeTime ( iso: string ): string {
  const diff = Date.now() - new Date( iso ).getTime();
  const mins = Math.floor( diff / 60_000 );
  if ( mins < 1 ) return "Just now";
  if ( mins < 60 ) return `${ mins }m ago`;
  const hrs = Math.floor( mins / 60 );
  if ( hrs < 24 ) return `${ hrs }h ago`;
  const days = Math.floor( hrs / 24 );
  if ( days === 1 ) return "Yesterday";
  if ( days < 7 ) return `${ days } days ago`;
  return new Date( iso ).toLocaleDateString( "en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" } );
}

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
  "Am I over budget anywhere?",
  "What subscriptions should I review?",
  "When will I pay off my loans?",
  "Help me set a savings goal",
];

// ── Main Component ────────────────────────────────────────────────────────────

export default function AiChatClient ( { initialInsights, onClose }: { initialInsights: AiInsight[]; onClose?: () => void } ) {
  const { user } = useAuth();
  const router = useRouter();
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
  const [agentHistory, setAgentHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>( [] );
  const [confirmingActionId, setConfirmingActionId] = useState<string | null>( null );
  const [sessionId, setSessionId] = useState<string>( "" );
  const [showSessions, setShowSessions] = useState( false );
  const [sessions, setSessions] = useState<SessionSummary[]>( [] );
  const [sessionsLoading, setSessionsLoading] = useState( false );

  useEffect( () => {
    if ( !user ) return;
    try {
      const key = `session_id_${ user.id }`;
      const stored = localStorage.getItem( key );
      if ( stored ) { setSessionId( stored ); return; }
      const newId = crypto.randomUUID();
      localStorage.setItem( key, newId );
      setSessionId( newId );
    } catch { setSessionId( crypto.randomUUID() ); }
  }, [user] );

  const chatEndRef = useRef<HTMLDivElement>( null );

  // ── Typewriter refs (shared across sendMessage calls) ─────────────────────
  const twBuffer = useRef( "" );   // full text received from stream
  const twShown = useRef( "" );    // text currently displayed
  const twFrame = useRef<number | null>( null );

  useEffect( () => {
    chatEndRef.current?.scrollIntoView( { behavior: "smooth" } );
  }, [messages] );

  // Save agent history to localStorage
  useEffect( () => {
    if ( !user ) return;
    try {
      localStorage.setItem( `${ SESSION_KEY }_${ user.id }`, JSON.stringify( { history: agentHistory, savedAt: Date.now() } ) );
    } catch { /* ignore */ }
  }, [agentHistory, user] );

  // Restore agent history on mount
  useEffect( () => {
    if ( !user ) return;
    try {
      const raw = localStorage.getItem( `${ SESSION_KEY }_${ user.id }` );
      if ( !raw ) return;
      const session = JSON.parse( raw ) as { history: typeof agentHistory; savedAt: number };
      if ( Date.now() - session.savedAt < SESSION_TTL ) setAgentHistory( session.history );
    } catch { /* ignore */ }
  }, [user] );

  const fetchInsights = useCallback( async () => {
    if ( !user ) return;
    setInsightsLoading( true );
    const { data } = await supabase.from( "ai_insights" ).select( "*" ).eq( "user_id", user.id ).order( "created_at", { ascending: false } ).limit( 20 );
    setInsights( data ?? [] );
    setInsightsLoading( false );
  }, [user, supabase] );

  const fetchSessions = useCallback( async () => {
    setSessionsLoading( true );
    try {
      const res = await fetch( `/api/ai-chat/sessions?mode=agent` );
      if ( res.ok ) {
        const json = await res.json() as { sessions: SessionSummary[] };
        setSessions( json.sessions ?? [] );
      }
    } catch { /* ignore */ } finally {
      setSessionsLoading( false );
    }
  }, [] );

  async function loadSession ( sessionSummary: SessionSummary ) {
    try {
      const res = await fetch( `/api/ai-chat/sessions/${ sessionSummary.session_id }` );
      if ( !res.ok ) return;
      const json = await res.json() as { messages: StoredMessage[] };
      const restored: ChatMessage[] = json.messages.map( ( m ) => ( {
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: new Date( m.created_at ).getTime(),
      } ) );
      const history = json.messages
        .filter( ( m ) => m.role === "user" || m.role === "assistant" )
        .map( ( m ) => ( { role: m.role as "user" | "assistant", content: m.content } ) );
      setMessages( restored );
      setAgentHistory( history );
      setShowSessions( false );
    } catch { /* ignore */ }
  }

  async function markAsRead ( id: string ) {
    await supabase.from( "ai_insights" ).update( { is_read: true } ).eq( "id", id ).eq( "user_id", user?.id ?? "" );
    setInsights( ( prev ) => prev.map( ( ins ) => ( ins.id === id ? { ...ins, is_read: true } : ins ) ) );
  }

  async function markAllAsRead () {
    if ( !user ) return
    const unreadIds = insights.filter( ( i ) => !i.is_read ).map( ( i ) => i.id )
    if ( unreadIds.length === 0 ) return
    await supabase
      .from( 'ai_insights' )
      .update( { is_read: true } )
      .in( 'id', unreadIds )
      .eq( 'user_id', user.id )
    setInsights( ( prev ) => prev.map( ( i ) => ( { ...i, is_read: true } ) ) )
  }

  // ── Send (unified agent message) ──────────────────────────────────────────

  async function sendMessage ( question: string ) {
    if ( !question.trim() || isSending ) return;
    const userMsgId = crypto.randomUUID();
    const toolStepsMsgId = crypto.randomUUID();
    const textMsgId = toolStepsMsgId + "_text";

    // Reset typewriter state
    twBuffer.current = "";
    twShown.current = "";
    if ( twFrame.current !== null ) { cancelAnimationFrame( twFrame.current ); twFrame.current = null; }

    setMessages( ( prev ) => [
      ...prev,
      { id: userMsgId, role: "user", content: question, timestamp: Date.now() },
      { id: toolStepsMsgId, role: "tool_steps", content: "", toolSteps: [] },
    ] );
    setInputValue( "" );
    setIsSending( true );
    const newHistory: typeof agentHistory = [...agentHistory, { role: "user", content: question }];

    // rAF drain loop — 2 chars/frame
    const startTypewriter = () => {
      const tick = () => {
        const target = twBuffer.current;
        const shown = twShown.current;
        if ( shown.length < target.length ) {
          const next = target.slice( 0, shown.length + 2 );
          twShown.current = next;
          setMessages( ( prev ) => prev.map( ( m ) => m.id === textMsgId ? { ...m, content: next } : m ) );
        }
        twFrame.current = requestAnimationFrame( tick );
      };
      twFrame.current = requestAnimationFrame( tick );
    };

    const stopTypewriter = ( flush = false ) => {
      if ( twFrame.current !== null ) { cancelAnimationFrame( twFrame.current ); twFrame.current = null; }
      if ( flush && twShown.current !== twBuffer.current ) {
        const full = twBuffer.current;
        twShown.current = full;
        setMessages( ( prev ) => prev.map( ( m ) => m.id === textMsgId ? { ...m, content: full } : m ) );
      }
    };

    try {
      const res = await fetch( "/api/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify( { messages: newHistory, model: selectedModel, timezone: localStorage.getItem( "pref_timezone" ) ?? "America/Los_Angeles", sessionId } ),
      } );
      if ( !res.ok || !res.body ) throw new Error( "Agent request failed" );
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";
      let textStarted = false;
      while ( true ) {
        const { done, value } = await reader.read();
        if ( done ) break;
        sseBuffer += decoder.decode( value, { stream: true } );
        const lines = sseBuffer.split( "\n\n" );
        sseBuffer = lines.pop() ?? "";
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
              if ( !textStarted ) {
                textStarted = true;
                setMessages( ( prev ) => [...prev, { id: textMsgId, role: "assistant" as const, content: "" }] );
                startTypewriter();
              }
              twBuffer.current += event.text;
            }
          } catch { /* ignore */ }
        }
      }
      stopTypewriter( true );
      if ( twBuffer.current ) setAgentHistory( [...newHistory, { role: "assistant", content: twBuffer.current }] );
      if ( res.ok ) fetchInsights();
    } catch {
      stopTypewriter();
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
    sendMessage( inputValue );
  }

  function clearChat () {
    setMessages( [] );
    setAgentHistory( [] );
    if ( user ) {
      try {
        localStorage.removeItem( `${ SESSION_KEY }_${ user.id }` );
        const newId = crypto.randomUUID();
        localStorage.setItem( `session_id_${ user.id }`, newId );
        setSessionId( newId );
      } catch { /* ignore */ }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const unreadCount = insights.filter( ( i ) => !i.is_read ).length;

  return (
    <div className={cn(
      "flex flex-col overflow-hidden bg-[var(--color-bg-primary)]",
      onClose
        ? "h-full"
        : "fixed inset-0 z-30 lg:relative lg:inset-auto lg:z-auto lg:h-full"
    )}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-[var(--color-border)]">
        {/* Row 1: identity */}
        <div className="flex items-center gap-3 px-3 sm:px-4 py-3">
          {!onClose && (
            <button
              onClick={() => router.push( '/dashboard' )}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors lg:hidden"
              aria-label="Back to dashboard"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]/10">
            <BrainCircuit className="h-4 w-4 text-[var(--color-accent)]" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold text-[var(--color-text-primary)] leading-tight">AI Finance Assistant</h1>
            <p className="text-[0.65rem] text-[var(--color-text-muted)] leading-tight mt-0.5 truncate">
              Ask anything • I&apos;ll use tools when needed
            </p>
          </div>
        </div>

        {/* Row 2: actions toolbar */}
        <div className="flex items-center gap-1 px-3 sm:px-4 pb-2">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors px-2.5 py-1.5 rounded-lg hover:bg-[var(--color-bg-tertiary)]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear</span>
            </button>
          )}
          <button
            onClick={() => {
              const next = !showInsights;
              setShowInsights( next );
              if ( next ) fetchInsights();
            }}
            className={cn(
              "relative flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors",
              showInsights
                ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
            )}
          >
            <Bell className="h-3.5 w-3.5" />
            <span>Alerts</span>
            {unreadCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              const next = !showSessions;
              setShowSessions( next );
              if ( next && sessions.length === 0 ) fetchSessions();
            }}
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors",
              showSessions
                ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
            )}
          >
            <History className="h-3.5 w-3.5" />
            <span>Sessions</span>
          </button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-h-0">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-8 sm:py-16 gap-6">
                  {/* Icon with glow */}
                  <div
                    className="flex h-14 w-14 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-[var(--color-accent)]/10"
                    style={{
                      boxShadow: "0 0 48px color-mix(in srgb, var(--color-accent) 18%, transparent)",
                    }}
                  >
                    <BrainCircuit className="h-7 w-7 sm:h-10 sm:w-10 text-[var(--color-accent)]" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-base sm:text-xl font-semibold">Ask me anything</p>
                    <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mx-auto">
                      I can answer questions about your finances and use tools to fetch real data, check budgets, analyze trends, and more.
                    </p>
                  </div>
                  {/* Suggestion pills */}
                  <div className="flex flex-wrap justify-center gap-2 max-w-md">
                    {SUGGESTED_QUESTIONS.map( ( q ) => (
                      <button
                        key={q}
                        onClick={() => sendMessage( q )}
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
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/10 mt-0.5">
                              <BrainCircuit className="h-4 w-4 text-[var(--color-accent)]" />
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
                selectedModel={selectedModel}
                onModelChange={( m ) => {
                  setSelectedModel( m );
                  try { localStorage.setItem( CHAT_MODEL_KEY, m ); } catch { /* ignore */ }
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Sessions panel overlay ────────────────────────────────────── */}
        <AnimatePresence>
          {showSessions && (
            <>
              {/* Backdrop */}
              <div
                className="absolute inset-0 z-40"
                onClick={() => setShowSessions( false )}
              />
              <motion.div
                initial={{ x: "100%", opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "100%", opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="absolute top-0 right-0 bottom-0 z-50 w-72 border-l border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-xl flex flex-col"
              >
                <div className="h-full flex flex-col p-4">
                  <div className="flex items-center gap-2 mb-3 shrink-0">
                    <History className="h-4 w-4 text-[var(--color-accent)]" />
                    <h2 className="text-sm font-semibold">Past Sessions</h2>
                    <button
                      onClick={() => setShowSessions( false )}
                      className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                      aria-label="Close sessions"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {sessionsLoading ? (
                      <div className="flex justify-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin text-[var(--color-accent)]" />
                      </div>
                    ) : sessions.length === 0 ? (
                      <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">
                        No past sessions yet.
                      </div>
                    ) : (
                      sessions.map( ( session ) => (
                        <button
                          key={session.session_id}
                          onClick={() => loadSession( session )}
                          className="w-full text-left rounded-xl border border-[var(--color-border)] p-3 transition-colors hover:bg-[var(--color-bg-tertiary)] bg-[var(--color-bg-secondary)]"
                        >
                          <p className="text-xs font-medium text-[var(--color-text-primary)] line-clamp-2 mb-1.5">
                            {session.first_message.slice( 0, 60 )}{session.first_message.length > 60 ? "…" : ""}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-[0.65rem] text-[var(--color-text-muted)]">
                              {relativeTime( session.last_message_at )}
                            </span>
                            <span className="text-[0.65rem] font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] rounded-full px-2 py-0.5">
                              {session.message_count} {session.message_count === 1 ? "msg" : "msgs"}
                            </span>
                          </div>
                        </button>
                      ) )
                    )}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Insights / Alerts panel overlay ──────────────────────────── */}
        <AnimatePresence>
          {showInsights && (
            <>
              <div
                className="absolute inset-0 z-40"
                onClick={() => setShowInsights( false )}
              />
              <motion.div
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="absolute top-0 right-0 bottom-0 z-50 w-80 border-l border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-xl flex flex-col"
              >
                <div className="flex flex-col h-full p-4">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-3 shrink-0">
                    <Bell className="h-4 w-4 text-[var(--color-accent)]" />
                    <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Alerts & Insights
                    </h2>
                    {unreadCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500 text-[9px] font-bold text-white">
                        {unreadCount}
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-1">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-[0.65rem] text-[var(--color-accent)] hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                      <button
                        onClick={() => setShowInsights( false )}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
                    {insightsLoading ? (
                      <div className="flex justify-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin text-[var(--color-accent)]" />
                      </div>
                    ) : insights.length === 0 ? (
                      <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">
                        No insights yet.
                      </div>
                    ) : (
                      insights.map( ( insight ) => (
                        <div
                          key={insight.id}
                          onClick={() => !insight.is_read && markAsRead( insight.id )}
                          className={cn(
                            'rounded-xl border p-3 cursor-pointer transition-colors',
                            insight.is_read
                              ? 'border-[var(--color-border)] opacity-60'
                              : 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5'
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <InsightBadge type={insight.type} />
                            <span className="text-[0.6rem] text-[var(--color-text-muted)]">
                              {new Date( insight.created_at ).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--color-text-secondary)] line-clamp-3">
                            {insight.content}
                          </p>
                        </div>
                      ) )
                    )}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
