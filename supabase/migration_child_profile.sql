-- ============================================================
-- MIGRATION: Child Profile — Hồ sơ bé (Screen 1.1 / 1.2 / 1.3)
-- Chạy an toàn nhiều lần (idempotent)
-- ============================================================

-- ── 1. children — thêm cột education & companion ─────────────

ALTER TABLE children
  ADD COLUMN IF NOT EXISTS education_setting      TEXT,
  ADD COLUMN IF NOT EXISTS intervention_companion TEXT;

COMMENT ON COLUMN children.education_setting      IS 'specialized | semi_inclusive | inclusive | preschool | not_enrolled';
COMMENT ON COLUMN children.intervention_companion IS 'mother | father | grandparent | helper | other';

-- ── 2. diagnoses ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS diagnoses (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id         UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    -- status: 'diagnosed' | 'pending' | 'not_diagnosed'
    status           TEXT NOT NULL,
    notes            TEXT,
    -- expert-level fields (filled by specialist, optional for parent)
    asd_level        TEXT,
    diagnosis_date   DATE,
    diagnosis_place  VARCHAR(200),
    created_by       UUID REFERENCES users(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagnoses_child ON diagnoses(child_id, created_at DESC);

COMMENT ON TABLE diagnoses IS 'Tình trạng chẩn đoán ASD — parent nhập qua Settings > Hồ sơ bé > Y tế';

-- ── 3. assessment_tools ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS assessment_tools (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diagnosis_id UUID NOT NULL REFERENCES diagnoses(id) ON DELETE CASCADE,
    -- tool_name: 'ADOS-2' | 'ADI-R' | 'CARS-2' | 'M-CHAT' | 'ASQ-3' | 'Khác'
    tool_name    VARCHAR(100) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessment_tools_diagnosis ON assessment_tools(diagnosis_id);

-- ── 4. comorbidities ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS comorbidities (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id       UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    condition_name VARCHAR(100) NOT NULL,
    severity       TEXT,
    notes          TEXT,
    -- reported_by: 'parent' | 'expert'
    reported_by    TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comorbidities_child ON comorbidities(child_id);

COMMENT ON TABLE comorbidities IS 'Bệnh đồng mắc — ADHD, Động kinh, Lo âu... parent hoặc expert nhập';

-- ── 5. medications ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS medications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id   UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    drug_name  VARCHAR(100) NOT NULL,
    dosage     VARCHAR(50),
    frequency  VARCHAR(100),
    purpose    TEXT,
    start_date DATE,
    -- end_date NULL = đang dùng; có giá trị = đã ngưng
    end_date   DATE,
    notes      TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medications_child ON medications(child_id, end_date);

COMMENT ON TABLE medications     IS 'Thuốc đang dùng — end_date IS NULL nghĩa là đang dùng';
COMMENT ON COLUMN medications.purpose IS 'Mục đích sử dụng thuốc — VD: Giảm tăng động, hỗ trợ tập trung';

-- ── 6. RLS (Row Level Security) ───────────────────────────────
-- Bỏ comment và chỉnh sửa phù hợp khi bật Supabase Auth đúng cách

-- ALTER TABLE diagnoses       ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE assessment_tools ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE comorbidities   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE medications     ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "parent_own_diagnoses" ON diagnoses
--   FOR ALL USING (
--     child_id IN (SELECT id FROM children WHERE parent_id = auth.uid())
--   );
