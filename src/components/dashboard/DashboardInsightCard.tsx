'use client'

import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { InsightExpander } from '@/components/dashboard/InsightExpander'

interface Props {
  insightId: string
  content: string
  isRead: boolean
}

export function DashboardInsightCard({ insightId, content, isRead }: Props) {
  const [dismissed, setDismissed] = useState(isRead)

  if (dismissed) return null

  async function handleDismiss() {
    setDismissed(true)
    await fetch('/api/ai-insights', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: insightId }),
    })
  }

  return (
    <Card className="border-[var(--color-accent)] bg-gradient-to-r from-[var(--color-accent)]/10 to-transparent">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)]">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium">AI Insight</p>
            <button
              onClick={handleDismiss}
              aria-label="Dismiss insight"
              className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <InsightExpander content={content} />
        </div>
      </div>
    </Card>
  )
}
