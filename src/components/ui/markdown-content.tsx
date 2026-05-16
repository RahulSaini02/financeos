'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownContentProps {
  content: string
  className?: string
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
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
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-lg border border-[var(--color-border)]">
              <table className="w-full text-xs border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[var(--color-bg-tertiary)]">{children}</thead>
          ),
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="border-b border-[var(--color-border)] last:border-0">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold text-[var(--color-text-primary)] whitespace-nowrap">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-[var(--color-text-secondary)]">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
