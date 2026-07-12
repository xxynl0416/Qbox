'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import ThemeSwitch from '@/components/ThemeSwitch'
import QuestionCard from '@/components/QuestionCard'
import Sidebar from '@/components/Sidebar'
import QuizBar from '@/components/QuizBar'
import {
  fetchBookMeta,
  fetchQuestions,
  fetchProgress,
  upsertProgress,
  lsGet,
  lsSet,
} from '@/lib/store'
import type { BookMeta, Question, UserProgress, FilterType, AnswerRecord } from '@/lib/types'

export default function ReaderPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()

  const [book, setBook] = useState<BookMeta | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [progress, setProgress] = useState<UserProgress>({
    answers: {}, important: {}, notes: {}, revealed: {}, ui_state: {},
  })
  const [mode, setMode] = useState<'browse' | 'quiz'>('browse')
  const [filter, setFilter] = useState<FilterType>('all')
  const [query, setQuery] = useState('')
  const [focusedQid, setFocusedQid] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const mainRef = useRef<HTMLDivElement>(null)

  // 加载数据
  useEffect(() => {
    async function load() {
      try {
        const [meta, qs] = await Promise.all([
          fetchBookMeta(id),
          fetchQuestions(id),
        ])
        setBook(meta)
        setQuestions(qs)

        // 加载进度
        if (user) {
          const p = await fetchProgress(user.id, id)
          setProgress(p)
          setMode(p.ui_state?.mode || 'browse')
          setFilter((p.ui_state?.filter as FilterType) || 'all')
        } else {
          // 未登录：localStorage 降级
          const p = lsGet<UserProgress>(`progress-${id}`, {
            answers: {}, important: {}, notes: {}, revealed: {}, ui_state: {},
          })
          setProgress(p)
          setMode(p.ui_state?.mode || 'browse')
          setFilter((p.ui_state?.filter as FilterType) || 'all')
        }
      } catch (err) {
        console.error('Failed to load book:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, user])

  // 保存进度
  const saveProgress = useCallback(async (newProgress: UserProgress) => {
    setProgress(newProgress)
    if (user) {
      await upsertProgress(user.id, id, newProgress)
    } else {
      lsSet(`progress-${id}`, newProgress)
    }
  }, [user, id])

  // 切换答案展开
  const toggleReveal = useCallback((qid: string) => {
    const newRevealed = { ...progress.revealed }
    if (newRevealed[qid]) delete newRevealed[qid]
    else newRevealed[qid] = 1
    saveProgress({ ...progress, revealed: newRevealed })
  }, [progress, saveProgress])

  // 切换重点
  const toggleImportant = useCallback((qid: string) => {
    const newImportant = { ...progress.important }
    if (newImportant[qid]) delete newImportant[qid]
    else newImportant[qid] = 1
    saveProgress({ ...progress, important: newImportant })
  }, [progress, saveProgress])

  // 更新笔记
  const updateNote = useCallback((qid: string, text: string) => {
    const newNotes = { ...progress.notes }
    if (text) newNotes[qid] = text
    else delete newNotes[qid]
    saveProgress({ ...progress, notes: newNotes })
  }, [progress, saveProgress])

  // 答题
  const answerQuestion = useCallback((qid: string, selected: string) => {
    const q = questions.find(q => q._qid === qid)
    if (!q || !q.answer) return
    const correct = selected === q.answer
    const newAnswers = {
      ...progress.answers,
      [qid]: { selected, correct, ts: Date.now() },
    }
    const newRevealed = { ...progress.revealed, [qid]: 1 }
    saveProgress({
      ...progress,
      answers: newAnswers,
      revealed: newRevealed,
    })
    // 自测模式自动跳下一题
    if (mode === 'quiz') {
      setTimeout(() => moveQuestion(1, qid), 1500)
    }
  }, [questions, progress, saveProgress, mode])

  // 切换模式
  const toggleMode = useCallback((m: 'browse' | 'quiz') => {
    setMode(m)
    saveProgress({
      ...progress,
      ui_state: { ...progress.ui_state, mode: m },
    })
  }, [progress, saveProgress])

  // 切换筛选
  const changeFilter = useCallback((f: FilterType) => {
    setFilter(f)
    saveProgress({
      ...progress,
      ui_state: { ...progress.ui_state, filter: f },
    })
  }, [progress, saveProgress])

  // 展开/折叠全部
  const expandAll = useCallback(() => {
    const newRevealed: Record<string, number> = {}
    questions.forEach(q => { if (q._qid) newRevealed[q._qid] = 1 })
    saveProgress({ ...progress, revealed: newRevealed })
  }, [questions, progress, saveProgress])

  const collapseAll = useCallback(() => {
    saveProgress({ ...progress, revealed: {} })
  }, [progress, saveProgress])

  // 重置自测
  const resetQuiz = useCallback(() => {
    if (!confirm('确认重置本书的自测答案？')) return
    saveProgress({ ...progress, answers: {} })
  }, [progress, saveProgress])

  // 筛选题目
  const filteredQuestions = questions.filter(q => {
    if (!q._qid) return false
    switch (filter) {
      case 'unanswered': return !progress.answers[q._qid]
      case 'wrong': return progress.answers[q._qid] && !progress.answers[q._qid].correct
      case 'right': return progress.answers[q._qid] && progress.answers[q._qid].correct
      case 'important': return !!progress.important[q._qid]
      case 'note': return !!progress.notes[q._qid]
      case 'random20': return true // 随机筛选在后面处理
      default: return true
    }
  })

  const displayQuestions = filter === 'random20'
    ? [...filteredQuestions].sort(() => Math.random() - 0.5).slice(0, 20)
    : filteredQuestions

  // 搜索过滤
  const searchedQuestions = query
    ? displayQuestions.filter(q => {
        const hay = [q.stem, q.qtype, q.num, q.year || '', ...q.options.map(o => o.v), q.answer || '', q.explanation || ''].join(' ').toLowerCase()
        return hay.includes(query.toLowerCase())
      })
    : displayQuestions

  // 移动题目焦点
  const moveQuestion = useCallback((dir: number, fromQid?: string) => {
    const cards = Array.from(document.querySelectorAll('.q-card'))
    if (!cards.length) return
    let idx = -1
    if (fromQid) {
      idx = cards.findIndex(c => c.id === fromQid)
    }
    if (idx === -1 && focusedQid) {
      idx = cards.findIndex(c => c.id === focusedQid)
    }
    let target
    if (idx === -1) {
      target = dir > 0 ? cards[0] : cards[cards.length - 1]
    } else {
      target = cards[idx + dir] || (dir > 0 ? cards[0] : cards[cards.length - 1])
    }
    if (target) {
      setFocusedQid(target.id)
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [focusedQid])

  // 键盘快捷键
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.matches('input, textarea')) {
        if (e.key === 'Escape') target.blur()
        return
      }
      if (e.key === '?' || (e.key === '/' && !e.ctrlKey)) {
        e.preventDefault()
        if (e.key === '/') {
          const searchInput = document.getElementById('search-input')
          searchInput?.focus()
        }
        return
      }
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault()
        moveQuestion(1)
        return
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        moveQuestion(-1)
        return
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (focusedQid) toggleReveal(focusedQid)
        return
      }
      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault()
        if (focusedQid) toggleImportant(focusedQid)
        return
      }
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        // 触发笔记编辑（由 QuestionCard 处理）
        const noteArea = document.getElementById(`note-${focusedQid}`)
        if (noteArea) {
          noteArea.classList.toggle('hidden')
          const ta = noteArea.querySelector('textarea')
          if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length) }
        }
        return
      }
      if (mode === 'quiz' && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault()
        if (focusedQid) {
          answerQuestion(focusedQid, ['A', 'B', 'C', 'D'][parseInt(e.key) - 1])
        }
        return
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [focusedQid, mode, toggleReveal, toggleImportant, answerQuestion, moveQuestion])

  // 统计
  const answered = Object.keys(progress.answers).length
  const right = Object.values(progress.answers).filter(a => a.correct).length
  const wrong = answered - right
  const rate = answered > 0 ? Math.round((right / answered) * 100) : 0

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-soft)' }}>
        加载中...
      </div>
    )
  }

  if (!book) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-soft)' }}>
        题册不存在
      </div>
    )
  }

  return (
    <>
      {/* Topbar */}
      <div className="topbar">
        <button className="btn-back" onClick={() => router.push('/')}>← 书库</button>
        <h1>📖 {book.title}</h1>
        <span className="stats"><strong>{questions.length}</strong> 题</span>
        <span className="spacer" />
        <div className="search">
          <input
            id="search-input"
            placeholder="搜索题号、题干、选项、解析"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <kbd>/</kbd>
        </div>
        <button
          className={`mode-btn ${mode === 'browse' ? 'active' : ''}`}
          onClick={() => toggleMode('browse')}
        >
          浏览
        </button>
        <button
          className={`mode-btn ${mode === 'quiz' ? 'active' : ''}`}
          onClick={() => toggleMode('quiz')}
        >
          自测
        </button>
        <ThemeSwitch />
        <button className="icon-btn" onClick={expandAll}>展开</button>
        <button className="icon-btn" onClick={collapseAll}>折叠</button>
      </div>

      {/* Layout */}
      <div className="layout">
        <Sidebar
          questions={questions}
          progress={progress}
          filter={filter}
          onFilterChange={changeFilter}
        />
        <main ref={mainRef}>
          {searchedQuestions.length > 0 ? (
            <QuestionList
              questions={searchedQuestions}
              progress={progress}
              mode={mode}
              query={query}
              focusedQid={focusedQid}
              onReveal={toggleReveal}
              onImportant={toggleImportant}
              onAnswer={answerQuestion}
              onFocus={setFocusedQid}
              onNoteUpdate={updateNote}
            />
          ) : (
            <div className="empty">没有匹配的题目</div>
          )}
        </main>
      </div>

      {/* Quiz Bar */}
      {mode === 'quiz' && (
        <QuizBar
          answered={answered}
          right={right}
          wrong={wrong}
          rate={rate}
          onReset={resetQuiz}
        />
      )}

      {/* FAB */}
      <div className="fab">
        <button onClick={() => moveQuestion(-1)} title="上一题 (k)">↑</button>
        <button onClick={() => moveQuestion(1)} title="下一题 (j)">↓</button>
      </div>
    </>
  )
}

// 题目列表组件
function QuestionList({
  questions,
  progress,
  mode,
  query,
  focusedQid,
  onReveal,
  onImportant,
  onAnswer,
  onFocus,
  onNoteUpdate,
}: {
  questions: Question[]
  progress: UserProgress
  mode: 'browse' | 'quiz'
  query: string
  focusedQid: string | null
  onReveal: (qid: string) => void
  onImportant: (qid: string) => void
  onAnswer: (qid: string, selected: string) => void
  onFocus: (qid: string) => void
  onNoteUpdate: (qid: string, text: string) => void
}) {
  // 按章节和题型分组
  const groups: { chapter: string; qtype: string; questions: Question[] }[] = []
  let lastChapter = ''
  let lastQtype = ''

  for (const q of questions) {
    if (q.chapter !== lastChapter || q.qtype !== lastQtype) {
      groups.push({ chapter: q.chapter, qtype: q.qtype, questions: [] })
      lastChapter = q.chapter
      lastQtype = q.qtype
    }
    groups[groups.length - 1].questions.push(q)
  }

  return (
    <>
      {groups.map((group, gi) => (
        <section key={gi} className="chapter-section">
          {gi === 0 || groups[gi - 1].chapter !== group.chapter ? (
            <h2 className="chapter-title">
              {group.chapter}
              <span className="chapter-meta">
                {questions.filter(q => q.chapter === group.chapter).length} 题
              </span>
            </h2>
          ) : null}
          <h3 className="qtype-title">
            {group.qtype}
            <span className="qtype-meta">{group.questions.length} 题</span>
          </h3>
          {group.questions.map(q => (
            <QuestionCard
              key={q._qid}
              question={q}
              state={{
                revealed: !!progress.revealed[q._qid!],
                important: !!progress.important[q._qid!],
                note: progress.notes[q._qid!] || '',
                answered: !!progress.answers[q._qid!],
                correct: progress.answers[q._qid!]?.correct ?? null,
                selected: progress.answers[q._qid!]?.selected ?? null,
              }}
              mode={mode}
              query={query}
              focused={focusedQid === q._qid}
              onReveal={() => onReveal(q._qid!)}
              onImportant={() => onImportant(q._qid!)}
              onAnswer={(selected) => onAnswer(q._qid!, selected)}
              onFocus={() => onFocus(q._qid!)}
              onNoteUpdate={(text) => onNoteUpdate(q._qid!, text)}
            />
          ))}
        </section>
      ))}
    </>
  )
}
