/**
 * 将 books/{id}.json 导入 Supabase
 *
 * 用法：npx tsx scripts/import-book.ts books/408-os.json
 *
 * 需要 .env.local 中配置 SUPABASE_URL 和 SUPABASE_SERVICE_KEY（service_role key）
 * 在 Supabase 控制台 Settings → API 中获取
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('请设置 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_KEY 环境变量')
  console.error('SUPABASE_SERVICE_KEY 在 Supabase 控制台 Settings → API → service_role key')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

interface BookJSON {
  id: string
  title: string
  subject: string
  category: string
  year: number
  total_questions: number
  qtypes_count: number
  chapters: Record<string, Record<string, Array<{
    num: string
    year: string | null
    stem: string
    options: { k: string; v: string }[]
    answer: string | null
    image: string | null
    _qid?: string
    _expl?: string
    qtype?: string
  }>>>
}

async function importBook(filePath: string) {
  const raw = fs.readFileSync(filePath, 'utf-8')
  const book: BookJSON = JSON.parse(raw)

  console.log(`[*] 导入《${book.title}》...`)

  // 1. 插入 books
  const { error: bookErr } = await supabase.from('books').upsert({
    id: book.id,
    title: book.title,
    subject: book.subject,
    category: book.category,
    year: book.year,
    total_questions: book.total_questions,
    qtypes_count: book.qtypes_count,
  }, { onConflict: 'id' })

  if (bookErr) {
    console.error('插入 books 失败:', bookErr)
    return
  }
  console.log(`  [✓] books 表已更新`)

  // 2. 删除旧题目（重新导入）
  await supabase.from('questions').delete().eq('book_id', book.id)

  // 3. 扁平化题目并插入
  const questions: Array<{
    book_id: string
    chapter: string
    qtype: string
    num: string
    year: string | null
    stem: string
    options: { k: string; v: string }[]
    answer: string | null
    image: string | null
    explanation: string | null
  }> = []

  for (const [chapterName, qtypes] of Object.entries(book.chapters)) {
    for (const [qtypeName, qs] of Object.entries(qtypes)) {
      for (const q of qs) {
        questions.push({
          book_id: book.id,
          chapter: chapterName,
          qtype: qtypeName,
          num: q.num,
          year: q.year,
          stem: q.stem,
          options: q.options,
          answer: q.answer,
          image: q.image,
          explanation: (q as any)._expl || null,
        })
      }
    }
  }

  // 批量插入（每次 500 条）
  const BATCH = 500
  for (let i = 0; i < questions.length; i += BATCH) {
    const batch = questions.slice(i, i + BATCH)
    const { error } = await supabase.from('questions').insert(batch)
    if (error) {
      console.error(`  [✗] 插入题目失败 (batch ${i}-${i + BATCH}):`, error)
      return
    }
    console.log(`  [✓] 已插入 ${Math.min(i + BATCH, questions.length)}/${questions.length} 题`)
  }

  console.log(`\n🎉 导入完成！《${book.title}》共 ${questions.length} 题`)
}

// 执行
const filePath = process.argv[2]
if (!filePath) {
  console.error('用法: npx tsx scripts/import-book.ts <book.json>')
  process.exit(1)
}

const absPath = path.resolve(filePath)
if (!fs.existsSync(absPath)) {
  console.error(`文件不存在: ${absPath}`)
  process.exit(1)
}

importBook(absPath)
