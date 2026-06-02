-- Migration: tạo teacher_content_library nếu chưa có + thêm child_id
-- Chạy trên Supabase SQL Editor

-- 1. Tạo bảng nếu chưa tồn tại
CREATE TABLE IF NOT EXISTS public.teacher_content_library (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vst_id               UUID REFERENCES public.vst_teacher_profiles(id),
  center_id            UUID REFERENCES public.centers(id),
  child_id             UUID REFERENCES public.children(id),
  title                TEXT NOT NULL,
  description          TEXT,
  content_type         TEXT DEFAULT 'lesson',   -- lesson | demo | exercise
  bunny_video_id       TEXT,
  bunny_collection_id  TEXT,
  video_url            TEXT,
  thumbnail_url        TEXT,
  duration_seconds     INTEGER,
  domain               TEXT,
  tags                 TEXT[],
  custom_tags          TEXT[],
  dsm_level            TEXT DEFAULT 'all',      -- level_1 | level_2 | level_3 | all
  age_group            TEXT DEFAULT 'all',      -- type_1 | type_2 | type_3 | type_4 | all
  status               TEXT DEFAULT 'published', -- draft | published | archived
  visibility           TEXT DEFAULT 'center',   -- center | assigned | public
  context_location     TEXT,
  activity_description TEXT,
  child_should_do      TEXT,
  is_encrypted         BOOLEAN DEFAULT FALSE,
  view_count           INTEGER DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Thêm child_id nếu bảng đã có nhưng thiếu cột (safe)
ALTER TABLE public.teacher_content_library
  ADD COLUMN IF NOT EXISTS child_id UUID REFERENCES public.children(id);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_teacher_content_child
  ON public.teacher_content_library(child_id)
  WHERE child_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_teacher_content_teacher
  ON public.teacher_content_library(teacher_id, status);

-- 4. Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'teacher_content_library'
ORDER BY ordinal_position;
