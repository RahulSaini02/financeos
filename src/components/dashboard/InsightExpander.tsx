'use client'

import { useState } from 'react'
import { MarkdownContent } from '@/components/ui/markdown-content'

export function InsightExpander({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <div className={expanded ? '' : 'line-clamp-2 sm:line-clamp-none'}>
        <MarkdownContent
          content={content}
          className="text-sm text-[var(--color-text-secondary)]"
        />
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-1 text-xs text-[var(--color-accent)] sm:hidden"
      >
        {expanded ? 'Show less' : 'Read more'}
      </button>
    </div>
  )
}
