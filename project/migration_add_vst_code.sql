-- TẠO CỘT vst_code CHO BẢNG vst_teacher_profiles
ALTER TABLE public.vst_teacher_profiles 
ADD COLUMN IF NOT EXISTS vst_code VARCHAR(50);

-- CẬP NHẬT vst_code TỪ legacy_id CỦA BẢNG users (vì vst_code chính là legacy_id của teacher)
UPDATE public.vst_teacher_profiles
SET vst_code = u.legacy_id
FROM public.users u
WHERE public.vst_teacher_profiles.teacher_id = u.id;

-- NẾU CẦN THIẾT: RÀNG BUỘC vst_code KHÔNG ĐƯỢC TRỐNG SAU KHI CẬP NHẬT
-- ALTER TABLE public.vst_teacher_profiles ALTER COLUMN vst_code SET NOT NULL;
