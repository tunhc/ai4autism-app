# AI4Autism — Project Notes 
> Đây là nguồn sự thật cho Claude Code khi làm việc với dự án này.
> Đọc file này đầu tiên trước khi làm bất kỳ task nào.

---

## Dự án là gì?

**AI4Autism** — Nền tảng di động hỗ trợ can thiệp tự kỷ cho trẻ 0-10 tuổi.  
Kết nối: **Phụ huynh ↔ Giáo viên ↔ Chuyên gia ↔ AI**

MVP: 1 Center (BI Center HCM) · 40 trẻ · 40 phụ huynh · 14 giáo viên

---

## Files quan trọng cần đọc

### Trước khi code
| File | Đọc khi nào |
|------|------------|
| `workflow/mvp-build-plan.md` | Lên kế hoạch build, biết đã làm gì / chưa làm gì |
| `rules/business-rules.md` | Hiểu logic nghiệp vụ, quota, flows |
| `rules/vst-system.md` | **VST là gì, DB tables mới, flow upload bài giảng** |
| `rules/data-rules.md` | RLS policies, validation, Supabase patterns |
| `rules/ui-ux-rules.md` | Design rules, Vietnamese copy, error states |

### Khi làm tính năng cụ thể
| Tính năng | File tham khảo |
|-----------|---------------|
| VST chat / profile / upload bài giảng | `rules/vst-system.md` ← ĐỌC TRƯỚC |
| Video upload (quan sát trẻ) | `workflow/video-upload-flow.md` |
| Batch jobs / Cron | `workflow/batch-schedule.md` |
| Migrate Cloudinary | `workflow/cloudinary-migration.md` |
| Supabase queries | `skills/supabase-patterns.md` |
| Gemini / Claude API | `skills/ai-integration.md` |
| Tech stack / packages | `skills/tech-stack.md` |

---

## Tech Stack nhanh

```
Frontend:  React 18 + Vite + Tailwind (web demo)
Mobile:    React Native + Expo
DB:        Supabase (PostgreSQL, 33 tables, Full RLS)
Video:     Bunny.net Stream (HLS)
AI:        Gemini 3.5 Flash + Claude Sonnet (Enterprise)
Worker:    Cloudflare Workers (quality check)
Schedule:  pg_cron trong Supabase
```

---

## Folder Structure

```
App build/
├── project.md                    ← File này
├── rules/
│   ├── business-rules.md        ← Logic nghiệp vụ, quota, flows
│   ├── data-rules.md            ← RLS, validation, Supabase rules
│   └── ui-ux-rules.md           ← Design system, UX rules
├── workflow/
│   ├── mvp-build-plan.md        ← Lộ trình build phase by phase
│   ├── video-upload-flow.md     ← Flow upload video đầy đủ
│   ├── batch-schedule.md        ← Cron jobs, timing, schedules
│   └── cloudinary-migration.md  ← Plan migrate video cũ
├── skills/
│   ├── tech-stack.md            ← Packages, APIs, environment vars
│   ├── supabase-patterns.md     ← Queries, auth, real-time patterns
│   └── ai-integration.md        ← Gemini + Claude prompts & pipeline
├── AI4Autism_App_Overview.docx  ← Tổng quan app, tài khoản demo
├── AI4Autism_DB_Schema_v5.docx  ← Schema đầy đủ 33 tables
├── AI4Autism_Mobile_App_Design_v1.docx ← Thiết kế màn hình
├── supabase_migration_v5.sql    ← Chạy trước trong Supabase
└── supabase_seed_v5.sql         ← Chạy sau, 41 users + 23 children
```

---

## Cowork Skills có sẵn — Dùng khi cần

> Rachel đã cài **Antigravity Design Plugin** + các skill chuẩn. Gọi bằng lệnh `/skill-name` trong Cowork.

### Design Skills (Antigravity Plugin)
| Skill | Khi nào dùng |
|-------|-------------|
| `design:accessibility-review` | Audit WCAG 2.1 — kiểm tra a11y trước khi ship màn hình |
| `design:design-critique` | Review UI mockup, Figma frame, screenshot → feedback có cấu trúc |
| `design:ux-copy` | Viết / review copy tiếng Việt: error messages, CTAs, empty states |
| `design:design-handoff` | Sinh spec sheet cho developer từ design đã duyệt |
| `design:design-system` | Kiểm tra nhất quán color/token, document component mới |
| `design:user-research` | Lập kế hoạch user research, interview guide, usability test |
| `design:research-synthesis` | Tổng hợp kết quả phỏng vấn / usability test thành insights |

### Document Skills
| Skill | Khi nào dùng |
|-------|-------------|
| `docx` | Tạo / chỉnh Word document (.docx) — spec, báo cáo, memo |
| `pdf` | Xuất PDF, merge/split, điền form |
| `pptx` | Tạo / đọc slide deck (.pptx) |
| `xlsx` | Tạo / chỉnh Excel — budget, data table, chart |

### Utility Skills
| Skill | Khi nào dùng |
|-------|-------------|
| `schedule` | Đặt lịch task tự động chạy (daily briefing, reminder) |
| `skill-creator` | Tạo skill mới hoặc cải thiện skill hiện có |

### Gợi ý dùng skills cho AI4Autism
```
Sau khi build xong 1 màn hình:
  → design:accessibility-review  (check a11y, đặc biệt cho PH lớn tuổi / ít tech)
  → design:design-critique       (review layout, hierarchy)

Khi cần viết copy mới:
  → design:ux-copy  (đảm bảo tiếng Việt tự nhiên, đúng tone)

Khi chuẩn bị demo cho BI Center:
  → pptx  (tạo slide deck từ markdown này)
  → design:design-handoff  (spec sheet cho developer)
```

---

## ⚠️ Rules tuyệt đối KHÔNG vi phạm

1. **ProfileCompletion bắt buộc** — Khi `profile_complete = false`, không cho navigate sang màn hình nào khác
2. **Không expose SERVICE_ROLE_KEY** ra frontend — Chỉ dùng trong Edge Functions
3. **Video upload: không bypass quota** — Kiểm tra quota TRƯỚC khi cho upload
4. **AI tự quyết trong MVP** — Không có bước specialist review ở giữa
5. **Dữ liệu trẻ: Soft delete only** — Không hard delete observation_videos, children, logs
6. **VST upgrade: Không tự động** — Chỉ tạo đề xuất, Specialist phải confirm thủ công
7. **Text UI: Tiếng Việt 100%** — Kể cả error messages, loading states

---

## Trạng thái hiện tại (22/05/2026)

### ✅ Đã xong
- Database schema v5 (33 tables)
- Seed data: 41 users, 23 children
- Web app skeleton với routing
- Màn hình: Login, Dashboard (mock), VideoUpload (mock), Exercises, VideoModeling, AIReport, ProgressJournal, Messages

### 🔧 Đang cần làm (Phase 1)
- Kết nối Supabase thật (thay mock data)
- ProfileCompletion screen
- Auth flow hoàn chỉnh với RLS verify

### 📋 Tiếp theo (Phase 2)
- Video upload → Bunny.net thật
- AI report pipeline (Gemini)
- Exercise session logging

---

## Quick Commands

```bash
# Chạy web app
cd ai4autism-app && npm run dev

# Chạy mobile
cd ai4autism-mobile && npx expo start

# Deploy web
cd ai4autism-app && npm run build
```

---

## Câu hỏi đã xác nhận ✅ / Còn chờ ⏳

- [x] **Trọng số hpDT**: Communication 28% / Social 25% / Behavior 20% / Cognitive 15% / Sensory 7% / Motor 5% — xem `rules/business-rules.md` mục 3.2
- [x] **BI Center plan**: **Enterprise** → quota unlimited, AI tier Gemini 3.5 Flash + Claude Sonnet cross-validate
- [x] **VST Type timing**: Chuyển đúng ngày sinh nhật — không buffer, không delay.

---

## ⚠️ API Keys — KHÔNG gửi qua chat

> Không bao giờ paste API key vào chat với agent Tạo file `.env` trên máy theo hướng dẫn dưới.

### Setup file `.env` cho ai4autism-app

Tạo file `ai4autism-app/.env` (chưa có, tạo mới):
```
VITE_SUPABASE_URL=https://[your-project-id].supabase.co
VITE_SUPABASE_ANON_KEY=[lấy từ Supabase Dashboard → Settings → API]
```

Tạo file `ai4autism-app/.env.server` (chỉ dùng trong Edge Functions, không commit):
```
SUPABASE_SERVICE_ROLE_KEY=[Supabase → Settings → API → service_role]
GEMINI_API_KEY=[Google AI Studio → Get API Key]
BUNNY_API_KEY=[Bunny.net → Account → API Key]
BUNNY_LIBRARY_ID=[Bunny.net → Stream → Library ID]
CLOUDINARY_CLOUD_NAME=[Cloudinary → Dashboard]
CLOUDINARY_API_KEY=[Cloudinary → Settings → API Keys]
CLOUDINARY_API_SECRET=[Cloudinary → Settings → API Keys]
ANTHROPIC_API_KEY=[console.anthropic.com → API Keys]
```

Thêm vào `.gitignore` (đảm bảo không commit):
```
.env
.env.server
.env.local
.env.*.local
```

> Khi cần dùng key nào, tôi sẽ đọc từ `process.env` hoặc `import.meta.env` — không cần paste vào chat.
