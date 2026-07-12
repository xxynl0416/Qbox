import { createClient } from './supabase/client'
import type { BookMeta, Question, UserProgress, AnswerRecord, BookData } from './types'

let _supabase: ReturnType<typeof createClient> | null = null
function supabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

// ============ 书库 ============

export async function fetchBooks(): Promise<BookMeta[]> {
  const client = supabase()
  console.log('[store] fetchBooks: URL =', process.env.NEXT_PUBLIC_SUPABASE_URL)
  const { data, error } = await client
    .from('books')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) {
    console.error('[store] fetchBooks error:', JSON.stringify(error))
    throw error
  }
  console.log('[store] fetchBooks: got', data?.length, 'books')
  return data || []
}

export async function fetchBookMeta(bookId: string): Promise<BookMeta | null> {
  const { data } = await supabase()
    .from('books')
    .select('*')
    .eq('id', bookId)
    .single()
  return data
}

// ============ 题目 ============

export async function fetchQuestions(bookId: string): Promise<Question[]> {
  const { data, error } = await supabase()
    .from('questions')
    .select('*')
    .eq('book_id', bookId)
    .order('id', { ascending: true })
  if (error) throw error
  return ((data || []) as Question[]).map(q => ({
    ...q,
    _qid: `q_${q.id}`,
  }))
}

// 将扁平题目列表重组为 chapters 结构（匹配原 JSON 格式）
export function buildChapterMap(questions: Question[]): {
  chapters: Record<string, Record<string, Question[]>>
  chapterNames: string[]
} {
  const chapters: Record<string, Record<string, Question[]>> = {}
  for (const q of questions) {
    if (!chapters[q.chapter]) chapters[q.chapter] = {}
    if (!chapters[q.chapter][q.qtype]) chapters[q.chapter][q.qtype] = []
    chapters[q.chapter][q.qtype].push(q)
  }
  return { chapters, chapterNames: Object.keys(chapters) }
}

// ============ 用户进度 ============

export async function fetchProgress(
  userId: string,
  bookId: string
): Promise<UserProgress> {
  const { data } = await supabase()
    .from('user_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .single()

  if (!data) {
    return { answers: {}, important: {}, notes: {}, revealed: {}, ui_state: {} }
  }
  const row = data as Record<string, unknown>
  return {
    answers: (row.answers as Record<string, AnswerRecord>) || {},
    important: (row.important as Record<string, number>) || {},
    notes: (row.notes as Record<string, string>) || {},
    revealed: (row.revealed as Record<string, number>) || {},
    ui_state: (row.ui_state as UserProgress['ui_state']) || {},
  }
}

export async function fetchAllProgress(
  userId: string
): Promise<Record<string, UserProgress>> {
  const { data } = await supabase()
    .from('user_progress')
    .select('*')
    .eq('user_id', userId)

  const result: Record<string, UserProgress> = {}
  for (const r of data || []) {
    const row = r as Record<string, unknown>
    result[row.book_id as string] = {
      answers: (row.answers as Record<string, AnswerRecord>) || {},
      important: (row.important as Record<string, number>) || {},
      notes: (row.notes as Record<string, string>) || {},
      revealed: (row.revealed as Record<string, number>) || {},
      ui_state: (row.ui_state as UserProgress['ui_state']) || {},
    }
  }
  return result
}

export async function upsertProgress(
  userId: string,
  bookId: string,
  progress: Partial<UserProgress>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase().from('user_progress') as any).upsert(
    {
      user_id: userId,
      book_id: bookId,
      ...progress,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,book_id' }
  )
  if (error) throw error
}

// ============ localStorage 降级（未登录时） ============

const LS_PREFIX = 'qbox-'

export function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const v = localStorage.getItem(LS_PREFIX + key)
    return v ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}

export function lsSet(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_PREFIX + key, JSON.stringify(value))
}

export function lsRemove(key: string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(LS_PREFIX + key)
}

// ============ 进度合并（本地 → 云端） ============

export function mergeProgress(
  local: UserProgress,
  remote: UserProgress
): UserProgress {
  return {
    answers: { ...remote.answers, ...local.answers },
    important: { ...remote.important, ...local.important },
    notes: { ...remote.notes, ...local.notes },
    revealed: { ...remote.revealed, ...local.revealed },
    ui_state: { ...remote.ui_state, ...local.ui_state },
  }
}
