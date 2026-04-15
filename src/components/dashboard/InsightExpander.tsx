'use client'

import { useState } from 'react'
import { MarkdownContent } from '@/components/ui/markdown-content'

// Show "Read more" only when content is long enough to actually be clamped on mobile
const CLAMP_THRESHOLD = 120

export function InsightExpander({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = content.length > CLAMP_THRESHOLD

  return (
    <div>
      <div className={!expanded && isLong ? 'line-clamp-2 sm:line-clamp-none' : ''}>
        <MarkdownContent
          content={content}
          className="text-sm text-[var(--color-text-secondary)]"
        />
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="mt-1 text-xs text-[var(--color-accent)] sm:hidden"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  )
}
