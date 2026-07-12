'use client'

import type { BookMeta } from '@/lib/types'

interface BookCardProps {
  book: BookMeta
  progress: number // 0-100
  answered: number
  onClick: () => void
}

export default function BookCard({ book, progress, answered, onClick }: BookCardProps) {
  return (
    <div className="book-card" onClick={onClick}>
      <span className={`subject-tag ${book.category === '408' ? 'cat-408' : ''}`}>
        {book.subject}
      </span>
      <div className="title">{book.title}</div>
      <div className="info">
        {book.total_questions} 题 · {book.qtypes_count} 个题型 · {book.year}
      </div>
      <div className="progress-bar">
        <div className="fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="footer">
        <span className="stats">
          <span className="badge">{progress}%</span>
          <span>{answered}/{book.total_questions}</span>
        </span>
        <span>点击开始 →</span>
      </div>
    </div>
  )
}
