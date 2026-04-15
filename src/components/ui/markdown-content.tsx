'use client'

import ReactMarkdown from 'react-markdown'

interface MarkdownContentProps {
  content: string
  className?: string
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-[var(--color-text-primary)]">{children}</strong>,
          ul: ({ children }) => <ul className="mt-1 space-y-0.5 list-none pl-0">{children}</ul>,
          li: ({ children }) => (
            <li className="flex items-start gap-1.5">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
              <span>{children}</span>
            </li>
          ),
          h2: ({ children }) => <h2 className="mt-2 mb-1 text-sm font-semibold text-[var(--color-text-primary)]">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-1.5 mb-0.5 text-sm font-medium text-[var(--color-text-primary)]">{children}</h3>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
