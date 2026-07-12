export interface BookMeta {
  id: string
  title: string
  subject: string
  category: string
  year: number
  total_questions: number
  qtypes_count: number
}

export interface QuestionOption {
  k: string
  v: string
}

export interface Question {
  id?: number
  book_id: string
  chapter: string
  qtype: string
  num: string
  year: string | null
  stem: string
  options: QuestionOption[]
  answer: string | null
  image: string | null
  explanation: string | null
  _qid?: string
  _chIdx?: number
  _qtIdx?: number
  _idx?: number
}

export interface BookData {
  id: string
  title: string
  subject: string
  category: string
  year: number
  source?: string
  total_questions: number
  qtypes_count: number
  chapters: Record<string, Record<string, Question[]>>
}

export interface AnswerRecord {
  selected: string
  correct: boolean
  ts: number
}

export interface UserProgress {
  answers: Record<string, AnswerRecord>
  important: Record<string, number>
  notes: Record<string, string>
  revealed: Record<string, number>
  ui_state: {
    mode?: 'browse' | 'quiz'
    filter?: string
  }
}

export type FilterType =
  | 'all'
  | 'unanswered'
  | 'wrong'
  | 'right'
  | 'important'
  | 'note'
  | 'random20'

export type ThemeType = 'default' | 'mint' | 'dark'
