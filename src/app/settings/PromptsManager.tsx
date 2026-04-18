"use client";

import { useEffect, useState } from "react";
import { Loader2, RotateCcw, Save, ChevronDown } from "lucide-react";
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
      {/* Pill tabs skeleton */}
      <div className="flex flex-wrap gap-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-32 rounded-full" />
        ))}
      </div>
      {/* Editor area skeleton */}
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

  // ── Load all prompts on mount ────────────────────────────────────────────────

  useEffect(() => {
    async function fetchPrompts() {
      try {
        const res = await fetch("/api/prompts");
        if (!res.ok) throw new Error("Failed to load prompts");
        const data = await res.json();
        let fetched: PromptEntry[] = data.prompts ?? [];

        // Merge initialPrompts (SSR pre-load) to override content/version
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

  // ── Select a prompt card ─────────────────────────────────────────────────────

  async function handleSelectPrompt(key: string) {
    const prompt = prompts.find((p) => p.key === key);
    if (!prompt) return;

    setActiveKey(key);
    setEditorContent(prompt.content);
    setDirty(false);
    setSelectedVersionId(null);
    setEditorTab("edit");
    setVersions([]);
    setVersionsLoading(true);

    try {
      const res = await fetch(`/api/prompts/${key}`);
      if (!res.ok) throw new Error("Failed to load versions");
      const data = await res.json();
      setVersions(data.versions ?? []);
    } catch {
      // Non-critical — versions just won't show
    } finally {
      setVersionsLoading(false);
    }
  }

  // ── Version dropdown change ──────────────────────────────────────────────────

  function handleVersionChange(versionId: string) {
    if (versionId === "") {
      // "Current" option selected — restore current prompt content
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

    // We don't have per-version content in the list response — the user needs to
    // know they're loading an older version. We set dirty so Save is enabled.
    // In a real scenario the version content would come from GET /api/prompts/[key]
    // versions array. For now we load the editor with the current content as a
    // placeholder and mark dirty so the user can edit/save.
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

      // Update local prompts state
      setPrompts((prev) =>
        prev.map((p) =>
          p.key === activeKey
            ? { ...p, content: editorContent, version: data.version, isDefault: false }
            : p
        )
      );

      // Refresh version list
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
      const res = await fetch(`/api/prompts/${activeKey}/reset`, {
        method: "POST",
      });
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

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) return <PromptsManagerSkeleton />;

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
                background: isActive
                  ? "var(--color-accent)"
                  : "var(--color-bg-tertiary)",
                borderColor: isActive
                  ? "var(--color-accent)"
                  : "var(--color-border)",
                color: isActive ? "#fff" : "var(--color-text-primary)",
              }}
            >
              {prompt.label}
              {/* Badge: custom or default */}
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none"
                style={{
                  background: prompt.isDefault
                    ? "color-mix(in srgb, var(--color-text-muted) 20%, transparent)"
                    : isActive
                      ? "rgba(255,255,255,0.25)"
                      : "color-mix(in srgb, var(--color-accent) 20%, transparent)",
                  color: prompt.isDefault
                    ? "var(--color-text-muted)"
                    : isActive
                      ? "#fff"
                      : "var(--color-accent)",
                }}
              >
                {prompt.isDefault ? "default" : `v${prompt.version}`}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Editor panel ──────────────────────────────────────────────────── */}
      {activePrompt === null ? (
        <div
          className="rounded-xl border px-6 py-10 text-center"
          style={{ borderColor: "var(--color-border)" }}
        >
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Select a prompt above to view and edit it.
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl border"
          style={{ borderColor: "var(--color-border)", background: "var(--color-bg-tertiary)" }}
        >
          {/* ── Panel header ────────────────────────────────────────────── */}
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
            style={{ borderColor: "var(--color-border)" }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
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
                    <option key={v.id} value={v.id} style={{ background: "var(--color-bg-secondary)" }}>
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
          </div>

          {/* ── Description ───────────────────────────────────────────── */}
          <div className="px-4 py-2 border-b" style={{ borderColor: "var(--color-border)" }}>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {activePrompt.description}
            </p>
          </div>

          {/* ── Mobile tab toggle ─────────────────────────────────────── */}
          <div
            className="flex sm:hidden gap-0 border-b"
            style={{ borderColor: "var(--color-border)" }}
          >
            {(["edit", "preview"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setEditorTab(tab)}
                className="flex-1 py-2 text-xs font-medium capitalize transition-colors"
                style={{
                  color: editorTab === tab ? "var(--color-accent)" : "var(--color-text-muted)",
                  borderBottom: editorTab === tab ? "2px solid var(--color-accent)" : "2px solid transparent",
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* ── Editor + Preview ──────────────────────────────────────── */}
          <div className="p-4">
            {/* Desktop: side-by-side */}
            <div className="hidden sm:grid grid-cols-2 gap-4">
              {/* Edit pane */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                  Edit
                </span>
                <textarea
                  value={editorContent}
                  onChange={(e) => {
                    setEditorContent(e.target.value);
                    setDirty(true);
                  }}
                  rows={14}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm font-mono outline-none resize-y transition-colors focus:ring-1 focus:ring-[var(--color-accent)]"
                  style={{
                    background: "var(--color-bg-secondary)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text-primary)",
                    minHeight: "200px",
                  }}
                  placeholder="Enter prompt content…"
                  spellCheck={false}
                />
              </div>

              {/* Preview pane */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                  Preview
                </span>
                <div
                  className="flex-1 rounded-lg border px-3 py-2.5 text-sm overflow-auto"
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
              </div>
            </div>

            {/* Mobile: single pane based on active tab */}
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

          {/* ── Footer ────────────────────────────────────────────────── */}
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3"
            style={{ borderColor: "var(--color-border)" }}
          >
            {/* Mobile reset button */}
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
                <span
                  className="ml-1.5 h-1.5 w-1.5 rounded-full bg-white/70"
                  aria-hidden="true"
                />
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── Confirm reset dialog ───────────────────────────────────────────── */}
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
