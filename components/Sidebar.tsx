'use client'

import type { Question, UserProgress, FilterType } from '@/lib/types'

interface Props {
  questions: Question[]
  progress: UserProgress
  filter: FilterType
  onFilterChange: (f: FilterType) => void
}

export default function Sidebar({ questions, progress, filter, onFilterChange }: Props) {
  const total = questions.length
  const wrongCount = questions.filter(q => progress.answers[q._qid!] && !progress.answers[q._qid!].correct).length
  const rightCount = questions.filter(q => progress.answers[q._qid!] && progress.answers[q._qid!].correct).length
  const impCount = questions.filter(q => progress.important[q._qid!]).length
  const unans = questions.filter(q => !progress.answers[q._qid!]).length
  const noteCount = questions.filter(q => progress.notes[q._qid!]).length

  const filters: { key: FilterType; icon: string; label: string; count: number | string }[] = [
    { key: 'all', icon: '●', label: '全部', count: total },
    { key: 'unanswered', icon: '○', label: '未作答', count: unans },
    { key: 'wrong', icon: '×', label: '错题', count: wrongCount },
    { key: 'right', icon: '✓', label: '已答对', count: rightCount },
    { key: 'important', icon: '★', label: '我的重点', count: impCount },
    { key: 'note', icon: '✎', label: '有笔记', count: noteCount },
    { key: 'random20', icon: '◇', label: '随机 20 题', count: '→' },
  ]

  // 按章节分组
  const chapters: { name: string; qtypes: { name: string; count: number }[] }[] = []
  let lastCh = ''
  for (const q of questions) {
    if (q.chapter !== lastCh) {
      chapters.push({ name: q.chapter, qtypes: [] })
      lastCh = q.chapter
    }
    const ch = chapters[chapters.length - 1]
    const existingQt = ch.qtypes.find(t => t.name === q.qtype)
    if (existingQt) existingQt.count++
    else ch.qtypes.push({ name: q.qtype, count: 1 })
  }

  function scrollToChapter(ci: number) {
    const el = document.getElementById(`ch_${ci}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <aside id="sidebar">
      <h2>筛选</h2>
      <div className="filter-list">
        {filters.map(f => (
          <div
            key={f.key}
            className={`filter-item ${filter === f.key ? 'active' : ''}`}
            onClick={() => onFilterChange(f.key)}
          >
            <span><span className="icon">{f.icon}</span>{f.label}</span>
            <span className="count">{f.count}</span>
          </div>
        ))}
      </div>

      <h2>章节</h2>
      <div className="nav-list">
        {chapters.map((ch, ci) => {
          const totalQ = ch.qtypes.reduce((s, t) => s + t.count, 0)
          return (
            <div key={ci} className="nav-chapter">
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); scrollToChapter(ci) }}
              >
                {ch.name} <span className="nav-chapter-meta">{ch.qtypes.length}/{totalQ}</span>
              </a>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
