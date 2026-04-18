"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Maximize2, Minimize2, RotateCcw, Save, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PromptEntry {
  key: string;
  label: string;
  description: string;
  content: string;
  version: number;
  isDefault: boolean;
}

interface VersionEntry {
  id: string;
  version: number;
  version_label: string | null;
  created_at: string;
}

// ── Placeholder variable reference per prompt key ──────────────────────────────

const PROMPT_VARIABLES: Record<string, Array<{ name: string; hint: string }>> = {
  daily_insight: [
    { name: "net_worth", hint: "Current net worth in USD" },
    { name: "monthly_income", hint: "Month-to-date income" },
    { name: "monthly_expenses", hint: "Month-to-date expenses" },
    { name: "savings_rate", hint: "Savings rate as a % (0–100)" },
    { name: "flagged_count", hint: "Number of flagged transactions" },
    { name: "bills_count", hint: "Upcoming bills in the next 7 days" },
  ],
  monthly_summary: [
    { name: "month_label", hint: 'e.g. "April 2026"' },
    { name: "prev_income", hint: "Last month total income" },
    { name: "prev_expenses", hint: "Last month total expenses" },
    { name: "prev_savings_rate", hint: "Last month savings rate %" },
    { name: "top_categories", hint: "Top spending categories breakdown" },
  ],
  ai_review: [],
  ai_chat: [
    { name: "context", hint: "Full financial data snapshot injected at runtime" },
  ],
  auto_categorize: [
    { name: "description", hint: "Raw transaction description / merchant name" },
    { name: "category_list", hint: "List of available categories (ID + name)" },
  ],
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatVersionDate(dateStr: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateStr));
}

// ── Skeleton loader ────────────────────────────────────────────────────────────

function PromptsManagerSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-32 rounded-full" />
        ))}
      </div>
      <div
        className="rounded-xl border p-4 space-y-3"
        style={{ borderColor: "var(--color-border)" }}
      >
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-48 w-full" />
        <div className="flex justify-end">
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface PromptsManagerProps {
  initialPrompts?: Array<{
    prompt_key: string;
    content: string;
    version: number;
  }>;
}

export default function PromptsManager({ initialPrompts }: PromptsManagerProps) {
  const { success: toastSuccess, error: toastError } = useToast();

  const [prompts, setPrompts] = useState<PromptEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [editorTab, setEditorTab] = useState<"edit" | "preview">("edit");
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Escape key to exit fullscreen ────────────────────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && fullscreen) setFullscreen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [fullscreen]);

  // Focus textarea when entering fullscreen
  useEffect(() => {
    if (fullscreen) textareaRef.current?.focus();
  }, [fullscreen]);

  // ── Load all prompts on mount ────────────────────────────────────────────────

  useEffect(() => {
    async function fetchPrompts() {
      try {
        const res = await fetch("/api/prompts");
        if (!res.ok) throw new Error("Failed to load prompts");
        const data = await res.json();
        let fetched: PromptEntry[] = data.prompts ?? [];

        if (initialPrompts && initialPrompts.length > 0) {
          fetched = fetched.map((p) => {
            const override = initialPrompts.find((ip) => ip.prompt_key === p.key);
            if (override) {
              return { ...p, content: override.content, version: override.version, isDefault: false };
            }
            return p;
          });
        }

        setPrompts(fetched);
      } catch {
        toastError("Failed to load AI prompts.");
      } finally {
        setLoading(false);
      }
    }
    fetchPrompts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Select a prompt ──────────────────────────────────────────────────────────

  async function handleSelectPrompt(key: string) {
    const prompt = prompts.find((p) => p.key === key);
    if (!prompt) return;

    setActiveKey(key);
    setEditorContent(prompt.content);
    setDirty(false);
    setSelectedVersionId(null);
    setEditorTab("edit");
    setVersions([]);
    setFullscreen(false);
    setVersionsLoading(true);

    try {
      const res = await fetch(`/api/prompts/${key}`);
      if (!res.ok) throw new Error("Failed to load versions");
      const data = await res.json();
      setVersions(data.versions ?? []);
    } catch {
      // Non-critical
    } finally {
      setVersionsLoading(false);
    }
  }

  // ── Version dropdown change ──────────────────────────────────────────────────

  function handleVersionChange(versionId: string) {
    if (versionId === "") {
      const prompt = prompts.find((p) => p.key === activeKey);
      if (prompt) {
        setEditorContent(prompt.content);
        setSelectedVersionId(null);
        setDirty(false);
      }
      return;
    }
    const version = versions.find((v) => v.id === versionId);
    if (!version) return;
    setSelectedVersionId(versionId);
    setDirty(true);
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!activeKey || !dirty || saving) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/prompts/${activeKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editorContent }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();

      setPrompts((prev) =>
        prev.map((p) =>
          p.key === activeKey
            ? { ...p, content: editorContent, version: data.version, isDefault: false }
            : p
        )
      );

      const versRes = await fetch(`/api/prompts/${activeKey}`);
      if (versRes.ok) {
        const versData = await versRes.json();
        setVersions(versData.versions ?? []);
      }

      setDirty(false);
      setSelectedVersionId(null);
      toastSuccess(`Prompt saved (v${data.version})`);
    } catch {
      toastError("Failed to save prompt. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Reset to default ─────────────────────────────────────────────────────────

  async function handleReset() {
    if (!activeKey || resetting) return;

    setResetting(true);
    try {
      const res = await fetch(`/api/prompts/${activeKey}/reset`, { method: "POST" });
      if (!res.ok) throw new Error("Reset failed");
      const data = await res.json();

      setEditorContent(data.content);
      setPrompts((prev) =>
        prev.map((p) =>
          p.key === activeKey
            ? { ...p, content: data.content, version: data.version, isDefault: true }
            : p
        )
      );
      setDirty(false);
      setSelectedVersionId(null);
      setConfirmReset(false);
      toastSuccess("Reset to default");
    } catch {
      toastError("Failed to reset prompt. Please try again.");
    } finally {
      setResetting(false);
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────────

  const activePrompt = prompts.find((p) => p.key === activeKey) ?? null;
  const activeVars = activeKey ? (PROMPT_VARIABLES[activeKey] ?? []) : [];

  // ── Shared textarea ───────────────────────────────────────────────────────────

  function EditorTextarea({ rows, className }: { rows: number; className?: string }) {
    return (
      <textarea
        ref={textareaRef}
        value={editorContent}
        onChange={(e) => {
          setEditorContent(e.target.value);
          setDirty(true);
        }}
        rows={rows}
        className={`w-full rounded-lg border px-3 py-2.5 text-sm font-mono outline-none resize-y transition-colors focus:ring-1 focus:ring-[var(--color-accent)] ${className ?? ""}`}
        style={{
          background: "var(--color-bg-secondary)",
          borderColor: "var(--color-border)",
          color: "var(--color-text-primary)",
          minHeight: "200px",
        }}
        placeholder="Enter prompt content…"
        spellCheck={false}
      />
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) return <PromptsManagerSkeleton />;

  // The editor panel is shared between normal and fullscreen layouts
  const editorPanel = activePrompt !== null && (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex flex-col overflow-hidden"
          : "rounded-xl border"
      }
      style={{
        borderColor: "var(--color-border)",
        background: "var(--color-bg-tertiary)",
      }}
    >
      {/* ── Panel header ──────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 shrink-0"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="text-sm font-medium truncate"
            style={{ color: "var(--color-text-primary)" }}
          >
            {activePrompt.label}
          </span>
          {/* Version dropdown */}
          <div className="relative">
            <select
              value={selectedVersionId ?? ""}
              onChange={(e) => handleVersionChange(e.target.value)}
              disabled={versionsLoading || versions.length === 0}
              className="appearance-none rounded-lg border pl-2.5 pr-6 py-1 text-xs outline-none transition-colors focus:ring-1 focus:ring-[var(--color-accent)] disabled:opacity-50"
              style={{
                background: "var(--color-bg-secondary)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-secondary)",
              }}
            >
              <option value="">Current (v{activePrompt.version})</option>
              {versions.map((v) => (
                <option
                  key={v.id}
                  value={v.id}
                  style={{ background: "var(--color-bg-secondary)" }}
                >
                  v{v.version} — {v.version_label ?? formatVersionDate(v.created_at)}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3"
              style={{ color: "var(--color-text-muted)" }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Reset button — desktop */}
          <button
            onClick={() => setConfirmReset(true)}
            disabled={resetting || activePrompt.isDefault}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs transition-colors hover:opacity-80 disabled:opacity-40 disabled:pointer-events-none"
            style={{ color: "var(--color-text-muted)" }}
          >
            <RotateCcw className="h-3 w-3" />
            Reset to Default
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={() => setFullscreen((f) => !f)}
            className="inline-flex items-center justify-center rounded-lg p-1.5 transition-colors hover:opacity-80"
            style={{ color: "var(--color-text-muted)" }}
            title={fullscreen ? "Exit full screen (Esc)" : "Full screen"}
          >
            {fullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* ── Description + placeholder notes ────────────────────────────── */}
      <div className="px-4 py-2.5 border-b shrink-0" style={{ borderColor: "var(--color-border)" }}>
        <p className="text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>
          {activePrompt.description}
        </p>
        {activeVars.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="text-[10px] font-semibold uppercase tracking-wider mr-0.5"
              style={{ color: "var(--color-text-muted)" }}
            >
              Placeholders:
            </span>
            {activeVars.map((v) => (
              <span
                key={v.name}
                title={v.hint}
                className="inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] cursor-help"
                style={{
                  background: "color-mix(in srgb, var(--color-accent) 10%, transparent)",
                  borderColor: "color-mix(in srgb, var(--color-accent) 30%, transparent)",
                  color: "var(--color-accent)",
                }}
              >
                {`{{${v.name}}}`}
              </span>
            ))}
            <span
              className="text-[10px] ml-0.5"
              style={{ color: "var(--color-text-muted)" }}
            >
              — hover for details. Keep all placeholders present.
            </span>
          </div>
        )}
        {activeVars.length === 0 && (
          <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
            No required placeholders — write the full system prompt freely.
          </p>
        )}
      </div>

      {/* ── Mobile tab toggle ─────────────────────────────────────────── */}
      <div
        className="flex sm:hidden gap-0 border-b shrink-0"
        style={{ borderColor: "var(--color-border)" }}
      >
        {(["edit", "preview"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setEditorTab(tab)}
            className="flex-1 py-2 text-xs font-medium capitalize transition-colors"
            style={{
              color: editorTab === tab ? "var(--color-accent)" : "var(--color-text-muted)",
              borderBottom:
                editorTab === tab ? "2px solid var(--color-accent)" : "2px solid transparent",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Editor + Preview ──────────────────────────────────────────── */}
      <div className={`p-4 ${fullscreen ? "flex-1 overflow-auto min-h-0" : ""}`}>
        {/* Desktop: side-by-side */}
        <div
          className={`hidden sm:grid grid-cols-2 gap-4 ${fullscreen ? "h-full" : ""}`}
        >
          {/* Edit pane */}
          <div className={`flex flex-col gap-1 ${fullscreen ? "min-h-0" : ""}`}>
            <span
              className="text-[10px] font-semibold uppercase tracking-wider shrink-0"
              style={{ color: "var(--color-text-muted)" }}
            >
              Edit
            </span>
            <textarea
              ref={textareaRef}
              value={editorContent}
              onChange={(e) => {
                setEditorContent(e.target.value);
                setDirty(true);
              }}
              rows={fullscreen ? undefined : 14}
              className={`w-full rounded-lg border px-3 py-2.5 text-sm font-mono outline-none resize-y transition-colors focus:ring-1 focus:ring-[var(--color-accent)] ${fullscreen ? "flex-1 resize-none" : ""}`}
              style={{
                background: "var(--color-bg-secondary)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-primary)",
                minHeight: fullscreen ? undefined : "200px",
                height: fullscreen ? "100%" : undefined,
              }}
              placeholder="Enter prompt content…"
              spellCheck={false}
            />
          </div>

          {/* Preview pane */}
          <div className={`flex flex-col gap-1 ${fullscreen ? "min-h-0" : ""}`}>
            <span
              className="text-[10px] font-semibold uppercase tracking-wider shrink-0"
              style={{ color: "var(--color-text-muted)" }}
            >
              Preview
            </span>
            <div
              className={`rounded-lg border px-3 py-2.5 text-sm overflow-auto ${fullscreen ? "flex-1" : ""}`}
              style={{
                background: "var(--color-bg-secondary)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-secondary)",
                minHeight: fullscreen ? undefined : "200px",
              }}
            >
              {editorContent.trim() ? (
                <MarkdownContent content={editorContent} className="text-sm leading-relaxed" />
              ) : (
                <p className="text-xs italic" style={{ color: "var(--color-text-muted)" }}>
                  Nothing to preview yet.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Mobile: single pane */}
        <div className="sm:hidden">
          {editorTab === "edit" ? (
            <textarea
              value={editorContent}
              onChange={(e) => {
                setEditorContent(e.target.value);
                setDirty(true);
              }}
              rows={12}
              className="w-full rounded-lg border px-3 py-2.5 text-sm font-mono outline-none resize-y transition-colors focus:ring-1 focus:ring-[var(--color-accent)]"
              style={{
                background: "var(--color-bg-secondary)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-primary)",
              }}
              placeholder="Enter prompt content…"
              spellCheck={false}
            />
          ) : (
            <div
              className="rounded-lg border px-3 py-2.5 text-sm overflow-auto"
              style={{
                background: "var(--color-bg-secondary)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-secondary)",
                minHeight: "200px",
              }}
            >
              {editorContent.trim() ? (
                <MarkdownContent content={editorContent} className="text-sm leading-relaxed" />
              ) : (
                <p className="text-xs italic" style={{ color: "var(--color-text-muted)" }}>
                  Nothing to preview yet.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 shrink-0"
        style={{ borderColor: "var(--color-border)" }}
      >
        {/* Mobile reset */}
        <button
          onClick={() => setConfirmReset(true)}
          disabled={resetting || activePrompt.isDefault}
          className="sm:hidden inline-flex items-center gap-1.5 text-xs transition-colors hover:opacity-80 disabled:opacity-40 disabled:pointer-events-none"
          style={{ color: "var(--color-text-muted)" }}
        >
          <RotateCcw className="h-3 w-3" />
          Reset to Default
        </button>

        <div className="hidden sm:block" />

        {/* Save button */}
        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={!dirty || saving}
        >
          {saving ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-3.5 w-3.5" />
          )}
          Save Changes
          {dirty && !saving && (
            <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-white/70" aria-hidden="true" />
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">

      {/* ── Pill tab selector ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt) => {
          const isActive = activeKey === prompt.key;
          return (
            <button
              key={prompt.key}
              onClick={() => handleSelectPrompt(prompt.key)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: isActive ? "var(--color-accent)" : "var(--color-bg-tertiary)",
                borderColor: isActive ? "var(--color-accent)" : "var(--color-border)",
                color: isActive ? "#fff" : "var(--color-text-primary)",
              }}
            >
              {prompt.label}
              {/* Badge: always white text when active so it's readable on accent bg */}
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none"
                style={{
                  background: isActive
                    ? "rgba(255,255,255,0.25)"
                    : prompt.isDefault
                      ? "color-mix(in srgb, var(--color-text-muted) 20%, transparent)"
                      : "color-mix(in srgb, var(--color-accent) 20%, transparent)",
                  color: isActive
                    ? "#fff"
                    : prompt.isDefault
                      ? "var(--color-text-muted)"
                      : "var(--color-accent)",
                }}
              >
                {prompt.isDefault ? "default" : `v${prompt.version}`}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {activePrompt === null && (
        <div
          className="rounded-xl border px-6 py-10 text-center"
          style={{ borderColor: "var(--color-border)" }}
        >
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Select a prompt above to view and edit it.
          </p>
        </div>
      )}

      {/* ── Editor panel (normal layout) ──────────────────────────────────── */}
      {!fullscreen && editorPanel}

      {/* ── Fullscreen overlay ────────────────────────────────────────────── */}
      {fullscreen && editorPanel}

      {/* ── Confirm reset dialog ──────────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={handleReset}
        title="Reset to default prompt?"
        description="This will replace your custom prompt with the default. This action cannot be undone."
        confirmLabel="Reset"
        dangerous={false}
        loading={resetting}
      />
    </div>
  );
}
