# VST System — Virtual Shadow Teacher
> Cập nhật: 22/05/2026 | ⚠️ Đọc kỹ — khái niệm cốt lõi, dễ hiểu sai

---

## ⚠️ Định nghĩa đúng — VST là gì?

> **VST (Virtual Shadow Teacher) = Bản sao số của một GIÁO VIÊN cụ thể — không phải của trẻ.**

Mỗi giáo viên có 1 VST riêng. VST là "phiên bản AI" của giáo viên đó — học từ cách giáo viên nói chuyện, cách giáo viên dạy, video giáo viên quay — để hoạt động 24/7 thay mặt giáo viên với phụ huynh và trẻ.

```
Giáo viên Nguyễn Thị Lan
    ↓ (tạo VST)
VST-BIC-001 "Cô Lan" (AI clone của cô Lan)
    ↓ (phục vụ)
Phụ huynh chat với "Cô Lan" lúc 11pm → thực ra đang chat với AI
AI trả lời đúng phong cách, kiến thức, phương pháp của cô Lan thật
```

---

## Phân biệt VST vs hpDT

| | VST | hpDT |
|--|-----|------|
| Là bản sao của | **Giáo viên** | **Trẻ** |
| Dữ liệu đầu vào | Chat của GV, video GV upload, session notes | Video của trẻ, nhật ký PH, bài tập đã làm |
| Mục đích | AI thay thế GV giao tiếp với PH 24/7 | Theo dõi tiến độ phát triển của trẻ |
| Tiến hóa theo | Hoạt động của giáo viên | Dữ liệu hành vi của trẻ |

---

## 1. VST Profile — Mỗi giáo viên 1 VST

### Table: `vst_teacher_profiles`
```sql
CREATE TABLE vst_teacher_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vst_code      TEXT UNIQUE NOT NULL,   -- VD: "VST-BIC-001"
  teacher_id    UUID NOT NULL REFERENCES users(id),
  center_id     UUID NOT NULL REFERENCES centers(id),

  -- Identity
  vst_name      TEXT NOT NULL,          -- VD: "Cô Lan", "Thầy Minh"
  display_title TEXT,                   -- VD: "Giáo viên can thiệp sớm"
  avatar_url    TEXT,                   -- Ảnh thật của GV
  avatar_3d_url TEXT,                   -- HeyGen avatar 3D

  -- AI Knowledge Base (tích lũy theo thời gian)
  teaching_style_json  JSONB DEFAULT '{}',  -- Phong cách dạy học (AI học từ chat/video)
  vocabulary_profile   JSONB DEFAULT '{}',  -- Từ vựng hay dùng, cách diễn đạt
  method_tags          TEXT[],              -- Phương pháp: ABA, PECS, Floortime...
  expertise_domains    TEXT[],              -- Lĩnh vực giỏi: communication, sensory...

  -- Stats
  total_chat_messages  INT DEFAULT 0,       -- Tổng số chat đã record
  total_videos_uploaded INT DEFAULT 0,      -- Tổng video đã upload
  last_activity_at     TIMESTAMPTZ,

  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- VD: vst_code tự động generate
-- Format: VST-[center_code]-[sequence 3 chữ số]
-- VD: VST-BIC-001, VST-BIC-002, VST-TTSM-001
```

---

## 2. VST Activity Log — Ghi lại mọi hoạt động của giáo viên

> Đây là nguồn dữ liệu để AI "học" phong cách của giáo viên.

### Table: `vst_activity_logs`
```sql
CREATE TABLE vst_activity_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vst_id       UUID NOT NULL REFERENCES vst_teacher_profiles(id),
  teacher_id   UUID NOT NULL REFERENCES users(id),

  activity_type TEXT NOT NULL,
  -- Các loại activity:
  -- 'chat_message'     → GV chat với PH, ghi lại để AI học
  -- 'video_upload'     → GV upload video bài giảng/bài tập
  -- 'session_note'     → GV ghi chú sau phiên can thiệp
  -- 'exercise_create'  → GV tạo bài tập mới
  -- 'feedback_given'   → GV feedback trên báo cáo AI

  content_json JSONB NOT NULL,
  -- Với chat_message: { "text": "...", "child_id": "...", "context": "..." }
  -- Với video_upload: { "video_id": "...", "title": "...", "tags": [...] }
  -- Với session_note: { "child_id": "...", "note": "...", "domains": [...] }

  child_id     UUID REFERENCES children(id),  -- Liên quan đến trẻ nào (nếu có)
  is_encrypted BOOLEAN DEFAULT true,           -- Mã hóa AES-256

  created_at   TIMESTAMPTZ DEFAULT now()
);
```

### AI học từ activity log như thế nào?
```
Edge Function: update-vst-knowledge (chạy async sau mỗi activity)

Input: vst_activity_logs mới nhất
Processing:
  1. Gemini phân tích patterns trong chat history
  2. Extract: từ vựng đặc trưng, cách giải thích, tone
  3. Update vst_teacher_profiles.teaching_style_json
  4. Update vst_teacher_profiles.vocabulary_profile

→ Khi PH chat với VST:
  AI prompt: "Trả lời như giáo viên [tên], phong cách: [teaching_style_json]"
  → Phụ huynh cảm giác đang chat với chính cô/thầy đó
```

---

## 3. Teacher Content Library — Video bài giảng của giáo viên

> Giáo viên upload video → mã hóa → gắn tag → publish vào thư viện.

### Table: `teacher_content_library`
```sql
CREATE TABLE teacher_content_library (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vst_id          UUID NOT NULL REFERENCES vst_teacher_profiles(id),
  teacher_id      UUID NOT NULL REFERENCES users(id),
  center_id       UUID NOT NULL REFERENCES centers(id),

  -- Content info
  title           TEXT NOT NULL,          -- Tiêu đề bài giảng
  description     TEXT,                   -- Mô tả bài tập/bài giảng
  content_type    TEXT NOT NULL,
  -- 'exercise'  → Bài tập thực hành cho trẻ
  -- 'lesson'    → Bài giảng/hướng dẫn cho PH
  -- 'demo'      → Video mẫu (GV demo kỹ năng)

  -- Video
  bunny_video_id  TEXT,
  video_url       TEXT,                   -- HLS playback URL
  thumbnail_url   TEXT,
  duration_seconds INT,
  is_encrypted    BOOLEAN DEFAULT true,   -- AES-256

  -- Context (GV điền khi upload)
  context_location TEXT,
  -- 'classroom'      → Tại lớp học
  -- 'home'           → Tại nhà (hướng dẫn PH tái hiện)
  -- 'outdoor'        → Ngoài trời
  -- 'therapy_room'   → Phòng trị liệu
  -- 'other'          → Khác

  activity_description TEXT,             -- "Bài tập này là..." (GV mô tả tự do)
  child_should_do TEXT,                  -- "Trẻ nên..." (mục tiêu hành động)

  -- Classification
  domain          TEXT,                  -- 1 trong 6 lĩnh vực chính
  tags            TEXT[],                -- Tags nhập tay (sẽ label AI sau)
  custom_tags     TEXT[],                -- Tags tự do thêm vào
  dsm_level       TEXT,                  -- 'level_1' | 'level_2' | 'level_3' | 'all'
  age_group       TEXT,                  -- 'type_1' | 'type_2' | 'type_3' | 'type_4' | 'all'

  -- Publishing
  status          TEXT DEFAULT 'draft',
  -- 'draft'      → Chưa publish
  -- 'published'  → Có trong thư viện
  -- 'archived'   → Ẩn

  visibility      TEXT DEFAULT 'center',
  -- 'center'     → Chỉ trẻ trong center
  -- 'assigned'   → Chỉ trẻ được assign cụ thể
  -- 'public'     → Toàn bộ hệ thống (tương lai)

  view_count      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

---

## 4. Flow Upload Bài giảng (Teacher)

```
Giáo viên tap [📹 Upload bài giảng] trong TeacherTeachingScreen
    ↓
Chọn video từ camera roll (expo-image-picker)
    ↓
Form điền thông tin:
  - Tiêu đề bài giảng *
  - Loại nội dung: [Bài tập / Bài giảng / Video mẫu]
  - Trẻ nên làm ở đâu: [Lớp học / Tại nhà / Ngoài trời / Phòng trị liệu / Khác]
  - Bài tập này là gì: [TextInput tự do]
  - Lĩnh vực: [Giao tiếp / Xã hội / Hành vi / Cảm giác / Vận động / Nhận thức]
  - DSM Level phù hợp: [Mức 1 / Mức 2 / Mức 3 / Tất cả]
  - Tags: [TextInput → nhấn Enter thêm tag, hiện chips]
    ※ Tags nhập tay hiện tại, AI auto-label sau (sẽ implement sau)
    ※ Gợi ý tags có sẵn: [ABA, PECS, Floortime, Vận động tinh, Ngôn ngữ, ...]
    ※ Custom tag: nhập tự do
    ↓
[Đăng bài]
    ↓
Upload lên Bunny.net → mã hóa AES-256
    ↓
Tạo record teacher_content_library (status: published)
    ↓
Log vào vst_activity_logs (activity_type: 'video_upload')
    ↓
Ghi lên content_library (để PH/GV khác xem qua thư viện chung)
    ↓
Hiện trong TeacherLibraryScreen + ParentLibraryScreen (Video Modeling)
```

---

## 5. VST Chat — PH chat với AI clone của giáo viên

```
PH mở ChatScreen → thấy avatar VST + tên "Cô Lan"
PH hỏi: "Hôm nay bé có vẻ không tập trung, cô có gợi ý gì không?"

System prompt gửi lên AI:
  "Bạn là VST-BIC-001 — phiên bản AI của giáo viên Nguyễn Thị Lan.
   Phong cách dạy học: [teaching_style_json]
   Từ vựng đặc trưng: [vocabulary_profile]
   Hồ sơ trẻ: [full child profile + hpDT]
   Lịch sử phiên học gần đây: [exercise_sessions]
   Trả lời bằng tiếng Việt, đúng phong cách cô Lan."

AI response → PH nhận câu trả lời đúng phong cách cô Lan
    ↓
Lưu vào vst_chat_sessions + vst_chat_messages
Lưu vào vst_activity_logs (activity_type: 'chat_message') → AI học tiếp
```

---

## 6. VST Code — Quy tắc đặt tên

```
Format: VST-[CENTER_CODE]-[3 digits]
VD:
  VST-BIC-001   → GV thứ nhất tại BI Center HCM
  VST-BIC-002   → GV thứ hai tại BI Center HCM
  VST-TTSM-001  → GV thứ nhất tại Trung Tâm Sao Mai HN

Đặt lúc tạo VST profile, KHÔNG thay đổi dù GV đổi tên.
Dùng vst_code để reference trong logs, reports, assignments.
```

---

## 7. Mối quan hệ VST ↔ Trẻ

```
Một GV (VST) có thể phụ trách nhiều trẻ
Một trẻ được assign 1 GV chính → tức 1 VST chính

Table: teacher_child_assignments (đã có)
  teacher_id → users.id (GV)
  child_id   → children.id (Trẻ)
  is_primary → BOOLEAN (GV chính hay GV hỗ trợ)

Khi PH mở ChatScreen:
  → Lấy teacher_child_assignments WHERE child_id = [con PH] AND is_primary = true
  → Load vst_teacher_profiles WHERE teacher_id = [GV đó]
  → Chat với VST đó
```

---

## 8. Tags hệ thống (preset) cho teacher_content_library

> Hiện tại GV nhập tay. AI auto-label sau (Phase 2).

```javascript
// Preset tags gợi ý (gợi ý khi GV nhập)
const PRESET_TAGS = [
  // Phương pháp
  'ABA', 'PECS', 'Floortime', 'RDI', 'Social Stories',
  'Video Modeling', 'DTT', 'PRT', 'Naturalistic',

  // Kỹ năng
  'Giao tiếp mắt', 'Luân phiên', 'Chờ đợi', 'Yêu cầu',
  'Nhận diện cảm xúc', 'Tự chăm sóc', 'Vận động tinh',
  'Cảm giác xúc giác', 'Âm thanh', 'Chuyển tiếp',

  // Bối cảnh
  'Bữa ăn', 'Giờ chơi', 'Giờ học', 'Vệ sinh',
  'Tắm', 'Mặc quần áo', 'Ngoài trời',

  // Level
  'Người mới bắt đầu', 'Trung cấp', 'Nâng cao',
]
```

---

## 9. Sự khác biệt cần sửa trong DB Schema v5

> Schema hiện tại (v5) có `vst_profiles` liên kết với **children** — đây là **SAI** với thiết kế mới.

| Schema v5 cũ (sai) | Thiết kế mới (đúng) |
|--------------------|---------------------|
| `vst_profiles.child_id` | `vst_teacher_profiles.teacher_id` |
| VST linked to child | VST linked to teacher |
| vst_name từ tên trẻ | vst_name từ tên giáo viên |
| 1 trẻ → 1 VST | 1 GV → 1 VST, phục vụ nhiều trẻ |

**Migration cần làm:**
```sql
-- Drop old table (sau khi migrate data nếu có)
DROP TABLE IF EXISTS vst_profiles;

-- Create new tables
CREATE TABLE vst_teacher_profiles (...);  -- xem mục 1
CREATE TABLE vst_activity_logs (...);     -- xem mục 2
CREATE TABLE teacher_content_library (...); -- xem mục 3
```
