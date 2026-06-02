-- Migration: tạo vst_teacher_profiles nếu chưa có + thêm center_code
-- Chạy trên Supabase SQL Editor

-- 1. Tạo bảng nếu chưa tồn tại
CREATE TABLE IF NOT EXISTS public.vst_teacher_profiles (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id              UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  center_id               UUID REFERENCES public.centers(id),
  center_code             VARCHAR(20),
  vst_code                VARCHAR(50),
  vst_name                TEXT,
  display_title           TEXT,
  avatar_url              TEXT,
  avatar_3d_url           TEXT,
  teaching_style_json     JSONB,
  vocabulary_profile      JSONB,
  method_tags             TEXT[],
  expertise_domains       TEXT[],
  total_chat_messages     INTEGER DEFAULT 0,
  total_videos_uploaded   INTEGER DEFAULT 0,
  last_activity_at        TIMESTAMPTZ,
  is_active               BOOLEAN DEFAULT TRUE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Thêm cột center_code nếu bảng đã có nhưng thiếu cột
ALTER TABLE public.vst_teacher_profiles
  ADD COLUMN IF NOT EXISTS center_code VARCHAR(20);

-- 3. Backfill center_code + vst_code từ users/centers cho các row đã có
UPDATE public.vst_teacher_profiles vp
SET
  center_code = c.center_code,
  vst_code    = COALESCE(vp.vst_code, u.legacy_id)
FROM public.users u
JOIN public.centers c ON c.id = u.center_id
WHERE vp.teacher_id = u.id;

-- 4. Auto-tạo vst_teacher_profiles cho tất cả teacher/specialist chưa có row
INSERT INTO public.vst_teacher_profiles (teacher_id, center_id, center_code, vst_code, vst_name, is_active)
SELECT
  u.id,
  u.center_id,
  c.center_code,
  u.legacy_id,
  u.full_name,
  TRUE
FROM public.users u
LEFT JOIN public.centers c ON c.id = u.center_id
WHERE u.role IN ('teacher', 'specialist')
  AND u.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM public.vst_teacher_profiles vp WHERE vp.teacher_id = u.id
  );

-- 5. Verify
SELECT
  vp.id,
  u.full_name,
  u.role,
  vp.vst_code,
  vp.center_code,
  vp.is_active
FROM public.vst_teacher_profiles vp
JOIN public.users u ON u.id = vp.teacher_id
ORDER BY u.full_name;
