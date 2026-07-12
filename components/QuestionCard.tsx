'use client'

import { useState } from 'react'
import type { Question } from '@/lib/types'
import { escapeHtml, highlight, renderMd } from '@/lib/utils'

interface QuestionState {
  revealed: boolean
  important: boolean
  note: string
  answered: boolean
  correct: boolean | null
  selected: string | null
}

interface Props {
  question: Question
  state: QuestionState
  mode: 'browse' | 'quiz'
  query: string
  focused: boolean
  onReveal: () => void
  onImportant: () => void
  onAnswer: (selected: string) => void
  onFocus: () => void
  onNoteUpdate: (text: string) => void
}

export default function QuestionCard({
  question: q,
  state,
  mode,
  query,
  focused,
  onReveal,
  onImportant,
  onAnswer,
  onFocus,
  onNoteUpdate,
}: Props) {
  const [showNote, setShowNote] = useState(false)
  const [noteText, setNoteText] = useState(state.note)

  const qid = q._qid || ''
  const isQuiz = mode === 'quiz'

  // Badges
  const badges: { cls: string; text: string }[] = []
  if (state.answered) {
    badges.push({
      cls: state.correct ? 'right' : 'wrong',
      text: state.correct ? '✓ 答对' : '✗ 答错',
    })
  }
  if (state.important) {
    badges.push({ cls: 'important', text: '⭐ 重点' })
  }

  // 答案 HTML
  const ansHtml = q.answer
    ? `<code>${escapeHtml(q.answer)}</code>`
    : '<em>原题无答案</em>'

  // 卡片 class
  const cardCls = ['q-card']
  if (state.answered) cardCls.push(state.correct ? 'right-card' : 'wrong-card')
  if (focused) cardCls.push('focus')

  return (
    <div
      className={cardCls.join(' ')}
      id={qid}
      onClick={onFocus}
    >
      {/* Header */}
      <div className="q-header">
        <span className="q-num">
          {escapeHtml(q.qtype.split('：')[0])} · {escapeHtml(q.num)}
        </span>
        {q.year && <span className="q-year">({q.year})</span>}
        {badges.length > 0 && (
          <span className="q-badges">
            {badges.map((b, i) => (
              <span key={i} className={`q-badge ${b.cls}`}>{b.text}</span>
            ))}
          </span>
        )}
      </div>

      {/* Stem */}
      <div
        className="q-stem"
        dangerouslySetInnerHTML={{ __html: highlight(q.stem, query) }}
      />

      {/* Image */}
      {q.image && (
        <div className="q-img">
          <img
            src={`/books/${q.book_id}/images/${q.image}`}
            alt="配图"
            loading="lazy"
            onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
          />
        </div>
      )}

      {/* Options */}
      <ul className="q-options">
        {q.options.map(o => {
          let cls = ''
          if (isQuiz && state.answered) {
            if (o.k === q.answer) cls = 'correct'
            else if (o.k === state.selected) cls = 'wrong-pick'
            else cls = 'muted'
          } else if (!isQuiz && state.revealed && o.k === q.answer) {
            cls = 'correct'
          }
          const clickable = isQuiz && !state.answered
          return (
            <li
              key={o.k}
              className={`${clickable ? 'clickable' : ''} ${cls}`}
              onClick={clickable ? () => onAnswer(o.k) : undefined}
            >
              <span className="k">{escapeHtml(o.k)}.</span>
              <span dangerouslySetInnerHTML={{ __html: highlight(o.v, query) }} />
            </li>
          )
        })}
      </ul>

      {/* Actions */}
      <div className="q-actions">
        <button
          className={`btn-reveal ${state.revealed ? 'shown' : ''}`}
          onClick={onReveal}
        >
          {state.revealed ? '隐藏答案' : '查看答案'}
        </button>
        <button
          className={`btn-toggle ${state.important ? 'on' : ''}`}
          onClick={onImportant}
          title="标记重点 (i)"
        >
          {state.important ? '已标记重点' : '标重点'}
        </button>
        <button
          className={`btn-toggle ${state.note ? 'has-note' : ''}`}
          onClick={() => setShowNote(!showNote)}
          title="编辑笔记 (m)"
        >
          {state.note ? '已写笔记' : '记笔记'}
        </button>
        <span className="btn-spacer" />
        <button
          className="btn-toggle"
          onClick={() => {
            const text = q.stem + '\n' + q.options.map(o => `${o.k}. ${o.v}`).join('\n')
            navigator.clipboard.writeText(text)
          }}
          title="复制题目"
        >
          复制题目
        </button>
      </div>

      {/* Answer Block */}
      <div className={`answer-block ${state.revealed ? 'shown' : ''}`}>
        <div className="ans-row">
          <span className="label">答案：</span>
          <span dangerouslySetInnerHTML={{ __html: ansHtml }} />
        </div>
        <div
          className="expl"
          dangerouslySetInnerHTML={{ __html: renderMd(q.explanation) }}
        />
        {state.note && (
          <div style={{
            marginTop: 8,
            padding: '8px 12px',
            background: 'var(--accent-bg)',
            borderRadius: 6,
            fontSize: 13,
            whiteSpace: 'pre-wrap',
          }}>
            📝 {state.note}
          </div>
        )}
      </div>

      {/* Note Area */}
      <div
        id={`note-${qid}`}
        className={`note-area ${showNote ? 'shown' : ''}`}
      >
        <textarea
          placeholder="写下你的理解、口诀或易错点（Ctrl+Enter 保存）"
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          onBlur={() => {
            onNoteUpdate(noteText)
            setShowNote(false)
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && e.ctrlKey) {
              onNoteUpdate(noteText)
              setShowNote(false)
            }
          }}
        />
        <div className="hint">输入即保存，关闭即生效</div>
      </div>
    </div>
  )
}
