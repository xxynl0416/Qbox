'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import ThemeSwitch from '@/components/ThemeSwitch'
import BookCard from '@/components/BookCard'
import { fetchBooks, fetchAllProgress } from '@/lib/store'
import type { BookMeta, UserProgress } from '@/lib/types'

export default function LibraryPage() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [books, setBooks] = useState<BookMeta[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, UserProgress>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const bookList = await fetchBooks()
        setBooks(bookList)

        if (user) {
          const progress = await fetchAllProgress(user.id)
          setProgressMap(progress)
        }
      } catch (err: any) {
        console.error('Failed to load books:', err?.message || err, JSON.stringify(err, Object.getOwnPropertyNames(err)))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  function getProgress(bookId: string) {
    const p = progressMap[bookId]
    if (!p) return { answered: 0, percent: 0 }
    const answered = Object.keys(p.answers).length
    const book = books.find(b => b.id === bookId)
    const total = book?.total_questions || 1
    return { answered, percent: Math.round((answered / total) * 100) }
  }

  const totalQuestions = books.reduce((s, b) => s + b.total_questions, 0)
  const totalAnswered = books.reduce((s, b) => s + getProgress(b.id).answered, 0)
  const totalPercent = totalQuestions > 0 ? Math.round((totalAnswered / totalQuestions) * 100) : 0

  if (loading) {
    return (
      <div className="lib-wrap">
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-soft)' }}>
          加载中...
        </div>
      </div>
    )
  }

  return (
    <div className="lib-wrap">
      {/* Header */}
      <div className="lib-header">
        <h1>我的题库</h1>
        <span className="meta">共 {books.length} 本 / {totalQuestions} 题</span>
        <span className="spacer" />
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-soft)' }}>
              {user.email}
            </span>
            <button className="icon-btn" onClick={signOut}>退出</button>
          </div>
        ) : (
          <button className="icon-btn" onClick={() => router.push('/login')}>
            登录
          </button>
        )}
        <ThemeSwitch />
      </div>

      {/* Stats */}
      <div className="lib-stats">
        <div className="lib-stat">
          <div className="label">题册</div>
          <div className="value">{books.length}</div>
        </div>
        <div className="lib-stat">
          <div className="label">学科</div>
          <div className="value">{new Set(books.map(b => b.subject)).size}</div>
        </div>
        <div className="lib-stat">
          <div className="label">总题数</div>
          <div className="value">{totalQuestions}</div>
        </div>
        <div className="lib-stat">
          <div className="label">已完成</div>
          <div className="value">
            {totalAnswered} <small>/ {totalPercent}%</small>
          </div>
        </div>
      </div>

      {/* Book Grid */}
      {books.length > 0 ? (
        <div className="lib-grid">
          {books.map(book => {
            const { answered, percent } = getProgress(book.id)
            return (
              <BookCard
                key={book.id}
                book={book}
                progress={percent}
                answered={answered}
                onClick={() => router.push(`/book/${book.id}`)}
              />
            )
          })}
        </div>
      ) : (
        <div className="lib-empty">
          <h2>📭 还没有题册</h2>
          <p>
            用 <code>scripts/migrate-books.ts</code> 把题册数据导入 Supabase
          </p>
        </div>
      )}

      {/* Help */}
      <div className="lib-help">
        <h3>怎么加新书？</h3>
        <pre>
          <code>{`# 1. 准备 docx 题册
# 2. 用转换工具生成 JSON：
python tools/docx2book.py 你的题册.docx --id 408-cn

# 3. 运行导入脚本：
npx tsx scripts/import-book.ts books/408-cn.json`}</code>
        </pre>
        <p style={{ fontSize: '13px', color: 'var(--text-soft)', margin: '8px 0 0' }}>
          <strong>同步</strong>：登录后进度自动同步到云端。<br />
          <strong>分享</strong>：同学注册后即可看到同样的题库。
        </p>
      </div>
    </div>
  )
}
