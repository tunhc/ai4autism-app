-- Bảng lưu trữ Video Modeling (Khác với video quan sát)
CREATE TABLE IF NOT EXISTS public.video_modeling_library (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    child_id UUID REFERENCES public.children(id) ON DELETE CASCADE, -- Có thể NULL nếu là video dùng chung cho nhiều bé
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT,
    bunny_video_id TEXT,
    is_shared BOOLEAN DEFAULT false, -- True nếu cho phép các giáo viên khác xem/dùng chung
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Lưu vết giáo viên upload
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.video_modeling_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cho phép xem video_modeling_library" ON public.video_modeling_library
    FOR SELECT USING (true);

CREATE POLICY "Cho phép sửa video_modeling_library" ON public.video_modeling_library
    FOR ALL USING (true);

-- Index để tối ưu tìm kiếm theo giáo viên và trẻ
CREATE INDEX IF NOT EXISTS idx_video_modeling_child ON public.video_modeling_library(child_id);
CREATE INDEX IF NOT EXISTS idx_video_modeling_creator ON public.video_modeling_library(created_by);
