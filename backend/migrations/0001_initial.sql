CREATE TABLE IF NOT EXISTS works (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('文字', '视觉', '设计', '实验')),
  work_date TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  description TEXT NOT NULL DEFAULT '',
  cover_url TEXT,
  share_url TEXT,
  extract_code TEXT,
  show_extract_code INTEGER NOT NULL DEFAULT 0 CHECK (show_extract_code IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_works_status_date
ON works(status, work_date DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_works_category_status
ON works(category, status);
