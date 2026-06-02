# Business Rules — AI4Autism
> Rules cốt lõi cần tuân thủ khi build. Đây là nguồn sự thật duy nhất.

---

## 1. Authentication & Profile Rules

### 1.1 Login Flow
```
Email/Password → Supabase Auth
  → profile_complete = false? → REDIRECT ProfileCompletionScreen (BẮTBUỘC, không bypass)
  → profile_complete = true?  → REDIRECT theo role:
      parent    → /parent/dashboard
      teacher   → /teacher/dashboard
      admin     → /admin/dashboard
      specialist → /specialist/dashboard
```

### 1.2 ProfileCompletion — Bắt buộc
| Role | Fields bắt buộc điền |
|------|---------------------|
| parent | Tên đầy đủ, phone, tên trẻ, ngày sinh trẻ, giới tính trẻ |
| teacher / admin | Xác nhận tên, email, phone |
| specialist | Tên, chứng chỉ hành nghề, phone |

> ⚠️ **Không được cho phép navigate sang màn hình khác khi profile_complete = false**

---

## 2. Video Upload Rules

### 2.1 Quota
- **Cycle = 14 ngày** (không phải 7 ngày)
- Reset: Thứ Hai đầu mỗi cycle lúc **00:00**
- Quota theo plan:
  - Cơ Bản: 2 video/cycle
  - Tiêu Chuẩn: 4 video/cycle
  - Toàn Diện: 8 video/cycle
  - **Enterprise: unlimited** ← BI Center đang dùng plan này
- Khi đủ quota → hiện thông báo, **không cho upload thêm**, không ẩn nút

> ✅ **BI Center = Enterprise**: Không cần check quota, AI tier = Gemini 3.5 Flash + Claude Sonnet cross-validate cho mọi video.

### 2.2 Validation
- Max size: **500 MB**
- Max duration: **10 phút**
- Min duration: **30 giây** (quá ngắn → hard reject)
- Formats: mp4, mov, avi, mkv
- Có âm thanh: bắt buộc (soft warn nếu không có)

### 2.3 AI Processing — Không cần specialist review
> ⚠️ MVP Rule: AI tự quyết định toàn bộ. Specialist chỉ xem report và điều chỉnh thủ công SAU KHI hệ thống đã auto-assign. Không có bước approval ở giữa.

---

## 3. hpDT Update Rules

### 3.1 Khi nào update hpDT?
- **Batch chính**: Mỗi Chủ nhật 23:00 (weekly batch)
- **Real-time update**: Sau mỗi AI report mới (partial update)
- **Không update** nếu tuần không có dữ liệu → giữ nguyên score cũ

### 3.2 Weighted Average — ĐÃ XÁC NHẬN

```
overall_score = weighted average của 6 domain scores:

  communication_score : 28%  ← Cao nhất: ngôn ngữ là predictor #1 kết quả dài hạn
  social_score        : 25%  ← Core deficit ASD, barrier chính khi vào lớp hòa nhập
  behavior_score      : 20%  ← Challenging behaviors = lý do #1 bị loại khỏi lớp học
  cognitive_score     : 15%  ← Cần để follow instructions, attention, xử lý thông tin
  sensory_score       :  7%  ← Tác động gián tiếp qua hành vi
  motor_score         :  5%  ← Ít liên quan nhất đến hòa nhập xã hội
                       ───
                       100%
```

```javascript
// Code implementation
const DOMAIN_WEIGHTS = {
  communication: 0.28,
  social:        0.25,
  behavior:      0.20,
  cognitive:     0.15,
  sensory:       0.07,
  motor:         0.05,
}

const calculateOverallScore = (scores) =>
  Math.round(
    Object.entries(DOMAIN_WEIGHTS).reduce(
      (sum, [domain, weight]) => sum + (scores[`${domain}_score`] ?? 0) * weight,
      0
    )
  )
```

> ✅ Cơ sở khoa học: Howlin et al. (2004), Venter et al. (1992) — communication là predictor mạnh nhất về long-term outcomes trong ASD. Social + Behavior là 2 barrier chính trong nghiên cứu hòa nhập học đường DSM-5.

### 3.3 Milestone Levels
```
overall_score 0-20%   → Milestone 1
overall_score 21-40%  → Milestone 2
overall_score 41-60%  → Milestone 3
overall_score 61-75%  → Milestone 4
overall_score 76-89%  → Milestone 5
overall_score 90-100% → Milestone 6 (hòa nhập thành công)
```

---

## 4. VST Rules

> ⚠️ **VST = Bản sao số của GIÁO VIÊN — không phải của trẻ.**
> Chi tiết đầy đủ: xem `rules/vst-system.md`

### 4.1 VST là gì
- Mỗi **giáo viên** có 1 VST riêng (không phải mỗi trẻ)
- VST là "AI clone" của giáo viên đó — học từ cách GV nói, dạy, upload video
- Phụ huynh chat với VST = đang chat với AI phiên bản của giáo viên thật
- VST code: `VST-[CENTER]-[3 digits]` — ví dụ `VST-BIC-001`

### 4.2 VST Type — Phân loại can thiệp theo tuổi TRẺ (khác với VST profile của GV)

> ⚠️ "VST Type" trong DB (`children.vst_type`) là **loại can thiệp phù hợp với tuổi trẻ** — đây là trường dữ liệu của trẻ, không phải của VST giáo viên. Tên gọi dễ nhầm, cần phân biệt rõ.

| VST Type (của trẻ) | Độ tuổi | Phương pháp chính |
|----------|---------|------------------|
| Type 1 | 0–2 tuổi | Can thiệp sớm, cảm giác vận động |
| Type 2 | 2–4 tuổi | Phát triển nền, ABA cơ bản |
| Type 3 | 4–6 tuổi | Tiền học đường, video modeling |
| Type 4 | 6+ tuổi | Hòa nhập, kỹ năng xã hội |

```
DB trigger: chạy đúng ngày sinh nhật (so sánh date_of_birth với today)
  → Auto-update children.vst_type ngay trong ngày sinh nhật
  → ⚠️ KHÔNG tự động upgrade can thiệp — chỉ tạo đề xuất cho Specialist confirm
  → Timing: batch job hàng ngày 01:00 check birthday của ngày hôm đó
```

### 4.3 VST hoạt động như thế nào
```
GV dạy / chat / upload video
  → Ghi vào vst_activity_logs
  → Edge Function update-vst-knowledge chạy async
  → Cập nhật vst_teacher_profiles.teaching_style_json

PH mở ChatScreen
  → Load VST của GV phụ trách con
  → AI chat với system prompt: "Bạn là [VST của GV X], phong cách: [teaching_style_json]"
  → PH nhận được câu trả lời đúng phong cách GV thật

GV upload video bài giảng
  → Điền form (location, mô tả, tags, domain)
  → Mã hóa AES-256 → Bunny.net
  → Tự động vào teacher_content_library + content_library
  → Hiện trong LibraryScreen của PH (phần Video Modeling)
```

### 4.4 Tables mới cần tạo (DB Schema v6)
```
vst_teacher_profiles    ← VST profile của GV (thay vst_profiles cũ)
vst_activity_logs       ← Ghi mọi hoạt động GV để AI học
teacher_content_library ← Video bài giảng GV upload
```
> ⚠️ `vst_profiles` trong schema v5 link với `children` là **sai** — cần migrate sang `vst_teacher_profiles` link với `users` (teacher).

---

## 5. Exercise Rules

### 5.1 Assignment Logic
```
Nguồn: recommendations từ ai_reports
  → AI đề xuất bài tập theo domain score thấp nhất
  → Auto-create exercise_assignments

Override: Specialist có thể:
  - Thêm bài tập thủ công
  - Xóa bài tập không phù hợp
  - Thay đổi frequency / duration
```

### 5.2 Exercise Status
```
assigned   → Mới được giao, chưa bắt đầu
in_progress → Đang làm (có ít nhất 1 session)
completed   → Đã hoàn thành theo mục tiêu
paused      → Tạm dừng theo yêu cầu
expired     → Đã qua ngày hết hạn, chưa hoàn thành
```

### 5.3 Session Logging
- PH ghi `exercise_sessions` sau mỗi lần tập
- Fields bắt buộc: duration, completion_rate, child_response
- Fields optional: notes, video_id (nếu quay lại)
- Specialist và GV cũng có thể ghi session riêng

---

## 6. Video Visibility Rules

### 6.1 Ai xem được video nào?
| Video type | Parent | Teacher | Specialist | Admin |
|-----------|--------|---------|------------|-------|
| Observation video của con | ✅ | ✅ (nếu assigned) | ✅ | ✅ |
| Observation video của trẻ khác | ❌ | ❌ | ✅ (assigned cases) | ✅ |
| Content library (VM) | ✅ | ✅ | ✅ | ✅ |

### 6.2 AI Report Visibility
| Section | Parent | Teacher | Specialist |
|---------|--------|---------|------------|
| domain_scores | ✅ | ✅ | ✅ |
| message_to_uploader | ✅ | ✅ | ✅ |
| recommendations | ✅ (simplified) | ✅ | ✅ (full) |
| clinical_notes | ❌ | ❌ | ✅ |

---

## 7. PDPA Vietnam Compliance Rules

- Dữ liệu trẻ em: mã hóa **AES-256 end-to-end**
- Video: lưu trữ trong VN (data sovereignty) — Bunny.net edge VN
- Consent: PH ký đồng ý điện tử khi đăng ký, có thể rút lại trong **72 giờ**
- Audit log: mọi truy cập dữ liệu trẻ đều được log (Nghị định 13/2023)
- Federated Learning: AI train không lấy raw data ra ngoài
- Retention: Audit logs xóa sau **2 năm**

---

## 8. Naming Conventions

### Center Code
```
Format: [Viết tắt chữ cái đầu]-[Mã tỉnh thành]
Ví dụ:
  Kim Binh Center HCM → KBC-HCM
  Trung Tâm Sao Mai Hà Nội → TTSM-HN
  BI Center HCM → BIC-HCM

Quy tắc: Đặt một lần khi tạo, KHÔNG thay đổi sau đó
```

### VST Name (auto-generated)
```
Pattern: Lấy tên đệm/tên cuối của trẻ
  "Minh An" → "Cô An" (nữ) hoặc "Thầy An" (nam)
  Source: vst_profiles.vst_name
  Avatar: HeyGen API từ children.avatar_url
```
