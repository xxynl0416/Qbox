-- Qbox 数据库 Schema
-- 在 Supabase 控制台的 SQL Editor 中执行

-- 书库
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '其他',
  year INT,
  total_questions INT DEFAULT 0,
  qtypes_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 题目
CREATE TABLE IF NOT EXISTS questions (
  id BIGSERIAL PRIMARY KEY,
  book_id TEXT REFERENCES books(id) ON DELETE CASCADE,
  chapter TEXT NOT NULL,
  qtype TEXT NOT NULL,
  num TEXT NOT NULL,
  year TEXT,
  stem TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  answer TEXT,
  image TEXT,
  explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(book_id, chapter, qtype, num)
);

-- 用户进度
CREATE TABLE IF NOT EXISTS user_progress (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id TEXT REFERENCES books(id) ON DELETE CASCADE,
  answers JSONB DEFAULT '{}',
  important JSONB DEFAULT '{}',
  notes JSONB DEFAULT '{}',
  revealed JSONB DEFAULT '{}',
  ui_state JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_questions_book ON questions(book_id);
CREATE INDEX IF NOT EXISTS idx_questions_chapter ON questions(book_id, chapter);
CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_user_book ON user_progress(user_id, book_id);

-- RLS 策略
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own progress"
  ON user_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON user_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON user_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- books 和 questions 对所有人可读（公开数据）
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Books are readable by everyone"
  ON books FOR SELECT
  USING (true);

CREATE POLICY "Questions are readable by everyone"
  ON questions FOR SELECT
  USING (true);
