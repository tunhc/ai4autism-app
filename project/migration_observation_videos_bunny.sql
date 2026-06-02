-- Migration: Thêm các cột lưu video URL (Bunny Stream) vào bảng observation_videos
-- Chạy trong Supabase Dashboard > SQL Editor

ALTER TABLE observation_videos
  ADD COLUMN IF NOT EXISTS video_url          TEXT,
  ADD COLUMN IF NOT EXISTS bunny_video_id     TEXT,
  ADD COLUMN IF NOT EXISTS bunny_collection_id TEXT,
  ADD COLUMN IF NOT EXISTS provider           TEXT DEFAULT 'bunny',
  ADD COLUMN IF NOT EXISTS title              TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url      TEXT;

-- Unique constraint để upsert không tạo duplicate
ALTER TABLE observation_videos
  DROP CONSTRAINT IF EXISTS observation_videos_bunny_video_id_key;

ALTER TABLE observation_videos
  ADD CONSTRAINT observation_videos_bunny_video_id_key
  UNIQUE (bunny_video_id);

-- Index để query nhanh theo child_id + provider
CREATE INDEX IF NOT EXISTS idx_observation_videos_child_provider
  ON observation_videos (child_id, provider);
