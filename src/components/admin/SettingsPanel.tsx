"use client";

import { useState, useEffect } from 'react'
import { BrainCircuit, Loader2, Plus, Trash2, Eye, Pencil } from 'lucide-react'
import { MarkdownContent } from '@/components/ui/markdown-content'
import { DEFAULT_PROMPTS } from '@/lib/default-prompts'

const MODEL_FEATURES = [
  { key: 'ai_model_daily_insight',   label: 'Daily Insight',       desc: 'Dashboard daily insight card' },
  { key: 'ai_model_monthly_summary', label: 'Monthly Summary',     desc: 'Monthly AI summary generation' },
  { key: 'ai_model_monthly_review',  label: 'AI Review',           desc: 'Monthly review analysis (cron)' },
  { key: 'ai_model_auto_categorize', label: 'Auto-Categorization', desc: 'Transaction categorization' },
  { key: 'ai_model_agent_default',   label: 'AI Agent Default',    desc: 'Agentic assistant (tool use) default' },
]

const BUILT_IN_MODELS = [
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 — Fast & cost-efficient' },
  { value: 'claude-sonnet-4-6',         label: 'Sonnet 4.6 — Balanced' },
  { value: 'claude-opus-4-6',           label: 'Opus 4.6 — Most capable' },
]

interface ModelEntry { value: string; label: string }

function InlineAlert({ kind, message }: { kind: 'success' | 'error'; message: string }) {
  return (
    <div
      className="rounded-lg px-4 py-2.5 text-sm font-medium mb-4"
      style={{
        background:
          kind === 'success'
            ? 'color-mix(in srgb, var(--color-success) 12%, transparent)'
            : 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
        color: kind === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
        border: `1px solid ${
          kind === 'success'
            ? 'color-mix(in srgb, var(--color-success) 30%, transparent)'
            : 'color-mix(in srgb, var(--color-danger) 30%, transparent)'
        }`,
      }}
    >
      {message}
    </div>
  )
}

interface PromptSectionProps {
  title: string
  description: string
  value: string
  original: string
  saving: boolean
  tab: 'edit' | 'preview'
  onTabChange: (t: 'edit' | 'preview') => void
  onChange: (v: string) => void
  onSave: () => void
  onDiscard: () => void
  placeholder?: string
}

function PromptSection({
  title, description, value, original, saving, tab,
  onTabChange, onChange, onSave, onDiscard, placeholder,
}: PromptSectionProps) {
  return (
    <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">{title}</h3>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <p className="text-xs text-[var(--color-text-muted)]">{description}</p>
        <div className="flex items-center rounded-lg border overflow-hidden shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          {(['edit', 'preview'] as const).map((t) => (
            <button
              key={t}
              onClick={() => onTabChange(t)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: tab === t ? 'var(--color-accent)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--color-text-muted)',
              }}
            >
              {t === 'edit' ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              <span className="capitalize">{t}</span>
            </button>
          ))}
        </div>
      </div>
      {tab === 'edit' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={10}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text-primary)] p-3 font-mono resize-y focus:outline-none focus:border-[var(--color-accent)]/60"
          placeholder={placeholder ?? 'Enter a system prompt…'}
        />
      ) : (
        <div
          className="w-full rounded-lg border p-3 text-sm overflow-auto"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-bg-tertiary)',
            color: 'var(--color-text-secondary)',
            minHeight: '240px',
          }}
        >
          {value.trim() ? (
            <MarkdownContent content={value} className="text-sm leading-relaxed" />
          ) : (
            <p className="text-xs italic" style={{ color: 'var(--color-text-muted)' }}>
              Nothing to preview yet.
            </p>
          )}
        </div>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-[var(--color-text-muted)]">{value.length.toLocaleString()} chars</span>
        <div className="flex gap-2">
          <button
            onClick={onDiscard}
            disabled={value === original || saving}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] disabled:opacity-40 transition-colors"
          >
            Discard
          </button>
          <button
            onClick={onSave}
            disabled={value === original || saving || value.trim().length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] text-white text-xs font-medium px-3 py-1.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Save Prompt
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SettingsPanel() {
  const [modelSettings, setModelSettings] = useState<Record<string, string>>({})
  const [modelSaving, setModelSaving] = useState<string | null>(null)
  const [alert, setAlert] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  // Agent prompt state
  const [agentPrompt, setAgentPrompt] = useState('')
  const [agentPromptSaving, setAgentPromptSaving] = useState(false)
  const [agentPromptOriginal, setAgentPromptOriginal] = useState('')
  const [agentPromptTab, setAgentPromptTab] = useState<'edit' | 'preview'>('edit')

  // Model registry state
  const [customModels, setCustomModels] = useState<ModelEntry[]>([])
  const [newModelLabel, setNewModelLabel] = useState('')
  const [newModelValue, setNewModelValue] = useState('')
  const [registrySaving, setRegistrySaving] = useState(false)

  const allModels: ModelEntry[] = [
    ...BUILT_IN_MODELS,
    ...customModels.filter((c) => !BUILT_IN_MODELS.some((b) => b.value === c.value)),
  ]

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { settings?: Array<{ key: string; value: string }> } | null) => {
        if (!data?.settings) return
        const map: Record<string, string> = {}
        for (const s of data.settings) map[s.key] = s.value
        setModelSettings(map)

        const agentVal = map['ai_agent_system_prompt'] ?? DEFAULT_PROMPTS.ai_agent.content
        setAgentPrompt(agentVal)
        setAgentPromptOriginal(agentVal)

        try {
          const registry = map['ai_models_registry']
          if (registry) setCustomModels(JSON.parse(registry) as ModelEntry[])
        } catch { /* ignore malformed JSON */ }
      })
      .catch(() => {})
  }, [])

  function showAlert(kind: 'success' | 'error', message: string) {
    setAlert({ kind, message })
    setTimeout(() => setAlert(null), 4000)
  }

  async function saveRegistry(next: ModelEntry[]) {
    setRegistrySaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'ai_models_registry', value: JSON.stringify(next) }),
      })
      if (res.ok) {
        setCustomModels(next)
        showAlert('success', 'Model registry saved.')
      } else {
        showAlert('error', 'Failed to save model registry.')
      }
    } finally {
      setRegistrySaving(false)
    }
  }

  function handleAddModel() {
    const label = newModelLabel.trim()
    const value = newModelValue.trim()
    if (!label || !value) return
    if (allModels.some((m) => m.value === value)) {
      showAlert('error', 'A model with that ID already exists.')
      return
    }
    const next = [...customModels, { value, label }]
    setNewModelLabel('')
    setNewModelValue('')
    saveRegistry(next)
  }

  function handleDeleteModel(value: string) {
    saveRegistry(customModels.filter((m) => m.value !== value))
  }

  async function saveModelSetting(key: string, value: string) {
    setModelSaving(key)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })
      if (res.ok) {
        setModelSettings((prev) => ({ ...prev, [key]: value }))
        showAlert('success', 'Model setting updated.')
      } else {
        showAlert('error', 'Failed to update model setting.')
      }
    } finally {
      setModelSaving(null)
    }
  }

  async function savePrompt(key: string, value: string, onDone: (saved: string) => void, setSaving: (b: boolean) => void) {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })
      if (!res.ok) throw new Error()
      onDone(value)
      showAlert('success', 'Prompt saved.')
    } catch {
      showAlert('error', 'Failed to save prompt.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 md:p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-accent)]/10">
          <BrainCircuit className="h-4 w-4 text-[var(--color-accent)]" />
        </div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">AI Model Configuration</h2>
      </div>

      {alert && <InlineAlert kind={alert.kind} message={alert.message} />}

      <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
        Default AI models configured per feature. Users can override their chat model preference from Settings.
      </p>

      <div className="divide-y divide-[var(--color-border)]">
        {MODEL_FEATURES.map((feat) => (
          <div key={feat.key} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 border-b border-[var(--color-border)] last:border-0">
            <div>
              <div className="text-sm font-medium text-[var(--color-text-primary)]">{feat.label}</div>
              <div className="text-xs text-[var(--color-text-muted)]">{feat.desc}</div>
            </div>
            <div className="flex items-center gap-2 sm:shrink-0">
              <select
                value={modelSettings[feat.key] ?? 'claude-haiku-4-5-20251001'}
                onChange={(e) => setModelSettings((prev) => ({ ...prev, [feat.key]: e.target.value }))}
                className="flex-1 sm:flex-none text-xs border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              >
                {allModels.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                onClick={() => saveModelSetting(feat.key, modelSettings[feat.key] ?? 'claude-haiku-4-5-20251001')}
                disabled={modelSaving === feat.key}
                className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1 shrink-0"
              >
                {modelSaving === feat.key ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Model Registry */}
      <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">Model Registry</h3>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          Add custom Anthropic model IDs here — they will appear in all model dropdowns above.
          Built-in models cannot be removed.
        </p>

        <div className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] mb-4 overflow-hidden">
          {allModels.map((m) => {
            const isBuiltIn = BUILT_IN_MODELS.some((b) => b.value === m.value)
            return (
              <div key={m.value} className="flex items-center justify-between px-3 py-2.5 bg-[var(--color-bg-tertiary)]">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{m.label}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)] font-mono truncate">{m.value}</p>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  {isBuiltIn ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: 'color-mix(in srgb, var(--color-text-muted) 15%, transparent)', color: 'var(--color-text-muted)' }}>
                      built-in
                    </span>
                  ) : (
                    <button
                      onClick={() => handleDeleteModel(m.value)}
                      disabled={registrySaving}
                      className="p-1 rounded hover:opacity-80 disabled:opacity-40 transition-opacity"
                      style={{ color: 'var(--color-danger)' }}
                      title="Remove model"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Display name (e.g. Claude 4 Opus)"
            value={newModelLabel}
            onChange={(e) => setNewModelLabel(e.target.value)}
            className="flex-1 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] placeholder:text-[var(--color-text-muted)]"
          />
          <input
            type="text"
            placeholder="Model ID (e.g. claude-opus-4-8)"
            value={newModelValue}
            onChange={(e) => setNewModelValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddModel() }}
            className="flex-1 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] placeholder:text-[var(--color-text-muted)]"
          />
          <button
            onClick={handleAddModel}
            disabled={!newModelLabel.trim() || !newModelValue.trim() || registrySaving}
            className="inline-flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0"
          >
            {registrySaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Add Model
          </button>
        </div>
      </div>

      {/* AI Agent System Prompt */}
      <PromptSection
        title="AI Agent System Prompt"
        description="Controls the agentic assistant (tool use, write actions) for all users. Per-user overrides take precedence."
        value={agentPrompt}
        original={agentPromptOriginal}
        saving={agentPromptSaving}
        tab={agentPromptTab}
        onTabChange={setAgentPromptTab}
        onChange={setAgentPrompt}
        onSave={() => savePrompt('ai_agent_system_prompt', agentPrompt, (v) => setAgentPromptOriginal(v), setAgentPromptSaving)}
        onDiscard={() => setAgentPrompt(agentPromptOriginal)}
        placeholder="Enter the global AI agent system prompt…"
      />
    </div>
  )
}
