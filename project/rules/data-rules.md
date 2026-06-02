# Data Rules & RLS — AI4Autism
> Row Level Security, data flow, và validation rules cho Supabase

---

## 1. Row Level Security (RLS) — Nguyên tắc cốt lõi

> ⚠️ **Tất cả tables đều BẬT RLS**. Không table nào public read/write.

### Role Matrix
```
auth.users.role:
  'parent'     → Chỉ xem data của con mình
  'teacher'    → Xem data của trẻ được phân công (teacher_child_assignments)
  'specialist' → Xem data của trẻ trong center được assign
  'admin'      → Full access trong center của mình
  'superadmin' → Full access toàn hệ thống
```

---

## 2. RLS Policies theo Table

### children
```sql
-- Parent: chỉ xem con của mình
CREATE POLICY "parent_own_child" ON children
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'parent' 
      AND child_id = children.id
    )
  );

-- Teacher: xem trẻ được assign
CREATE POLICY "teacher_assigned_child" ON children
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teacher_child_assignments tca
      JOIN users u ON u.id = auth.uid()
      WHERE u.role = 'teacher'
      AND tca.teacher_id = auth.uid()
      AND tca.child_id = children.id
      AND tca.is_active = true
    )
  );
```

### observation_videos
```sql
-- Parent: chỉ xem video của con mình
-- Teacher: xem video của trẻ được phân công
-- Specialist: xem tất cả video trong center của mình
-- Videos người khác upload không thấy (trừ specialist/admin)
```

### ai_reports
```sql
-- clinical_notes field: CHỈ specialist mới xem được
-- Khi query cho parent/teacher: select EXCLUDE clinical_notes
-- Hoặc dùng separate view: ai_reports_parent_view
```

### vst_chat_messages
```sql
-- Chỉ user (PH/GV) của phiên chat mới xem được
-- Không ai khác xem được, kể cả admin thông thường
-- Specialist có thể xem để hiểu context can thiệp
```

---

## 3. Supabase Client Setup — Quan trọng

```javascript
// lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// LUÔN dùng anon key từ client
// Service role key CHỈ dùng trong Edge Functions (server-side)
// KHÔNG bao giờ expose service role key ra frontend
```

---

## 4. Data Validation Rules

### children table
```
date_of_birth:
  - Không được ở tương lai
  - Không được > 18 tuổi (đây là app cho trẻ)
  - Format: YYYY-MM-DD

gender:
  - Enum: 'male' | 'female' | 'other'

vst_type:
  - Enum: 'type_1' | 'type_2' | 'type_3' | 'type_4'
  - Auto-calculate từ date_of_birth, không cho phép update thủ công từ client
  - Chỉ Specialist mới override được
```

### observation_videos table
```
duration_seconds:
  - Min: 30 (hard reject nếu < 30s)
  - Max: 600 (10 phút, hard reject nếu > 600s)

file_size_bytes:
  - Max: 524288000 (500 MB)

quality_status:
  - Enum: 'pending' | 'pass' | 'warn' | 'fail'
  - Chỉ Cloudflare Worker mới được update field này
```

### exercise_sessions table
```
completion_rate:
  - Range: 0-100 (integer, %)

duration_minutes:
  - Min: 1, Max: 120

child_response:
  - Enum: 'great' | 'good' | 'neutral' | 'difficult' | 'refused'
  - Bắt buộc điền khi log session
```

---

## 5. Enums (PostgreSQL)

```sql
-- Subscription plans
CREATE TYPE subscription_plan AS ENUM 
  ('co_ban', 'tieu_chuan', 'toan_dien', 'enterprise');

-- User roles
CREATE TYPE user_role AS ENUM 
  ('parent', 'teacher', 'specialist', 'admin', 'superadmin');

-- VST Types
CREATE TYPE vst_type AS ENUM 
  ('type_1', 'type_2', 'type_3', 'type_4');

-- Video status
CREATE TYPE video_status AS ENUM 
  ('pending', 'processing', 'done', 'failed', 'failed_permanent');

-- Exercise status
CREATE TYPE exercise_status AS ENUM 
  ('assigned', 'in_progress', 'completed', 'paused', 'expired');

-- AI Job status
CREATE TYPE ai_job_status AS ENUM 
  ('queued', 'running', 'done', 'failed', 'failed_permanent');
```

---

## 6. Audit Log Rules (PDPA Vietnam)

Tables được audit:
- `children`
- `child_daily_logs`
- `child_clinical_profiles`
- `hpdt_profiles`
- `iep_goals`
- `exercise_sessions`
- `observation_videos`

```sql
-- Mỗi khi có INSERT/UPDATE/DELETE trên các tables trên:
-- Tự động trigger ghi vào audit_logs:
{
  table_name: 'children',
  record_id: uuid,
  action: 'UPDATE',
  changed_by: user_id,
  changed_at: timestamp,
  old_values: JSONB,
  new_values: JSONB,
  ip_address: inet
}

-- Retention: Xóa tự động sau 2 năm (pg_cron job Thứ 7 02:00)
```

---

## 7. Real-time Subscriptions

```javascript
// Lắng nghe khi AI report mới hoàn thành
supabase
  .channel('ai-reports')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'ai_reports',
    filter: `child_id=eq.${childId}`
  }, (payload) => {
    // Show notification: "Báo cáo sẵn sàng!"
    handleNewReport(payload.new)
  })
  .subscribe()

// Lắng nghe notifications mới
supabase
  .channel('notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${userId}`
  }, handleNewNotification)
  .subscribe()
```

---

## 8. Soft Delete vs Hard Delete

| Table | Policy |
|-------|--------|
| users | Soft delete: `is_active = false` |
| children | Soft delete: `is_active = false` — KHÔNG xóa data |
| observation_videos | Không xóa — archive với `is_archived = true` |
| exercise_assignments | Soft delete: `status = 'expired'` |
| Hầu hết tables | Soft delete, giữ audit trail |
| audit_logs | Hard delete sau 2 năm (PDPA) |
