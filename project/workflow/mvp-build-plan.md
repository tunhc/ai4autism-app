# MVP Build Plan — AI4Autism
> Cập nhật: 22/05/2026 | Stack: React (web demo) + React Native (mobile) + Supabase + Bunny.net + Gemini 3.5 Flash

---

## Mục tiêu MVP
**1 Center (BI Center HCM) · 40 trẻ · 40 phụ huynh · 14 giáo viên**  
Chứng minh vòng lặp cốt lõi: Upload video → AI phân tích → Bài tập cá nhân hóa → Theo dõi tiến độ

---

## Phase 1 — Nền tảng & Auth (Tuần 1-2)

### Đã hoàn thành ✅
- [x] Database schema v5 (33 tables, Supabase)
- [x] Seed data: 41 users, 23 children, 1 center
- [x] SQL migration files (`supabase_migration_v5.sql`, `supabase_seed_v5.sql`)
- [x] Web app skeleton (React + Vite + Tailwind)
- [x] Routing cơ bản: Parent / Teacher / Admin / Specialist
- [x] Login screen + AuthContext

### Cần làm — Phase 1
- [ ] Kết nối Supabase thật (thay mock data)
- [ ] Login flow hoàn chỉnh: email/password → check `profile_complete`
- [ ] **ProfileCompletionScreen**: Lần đầu login → bắt buộc điền thông tin (không bypass)
  - Role = parent: thêm tên/ngày sinh/giới tính trẻ
  - Role = teacher/admin: xác nhận email + phone
- [ ] Session token, refresh token, logout
- [ ] RLS verify: mỗi role chỉ thấy data của mình

---

## Phase 2 — Core Features Phụ huynh (Tuần 3-5)

### Tính năng cần build theo thứ tự

1. **Dashboard Phụ huynh**
   - Thẻ tổng quan: tên trẻ, VST type, overall_score hpDT
   - AI Advice Widget: `message_to_uploader` từ report gần nhất
   - Nút nhanh: Upload video / Xem bài tập / Nhật ký
   - Notification bell (unread count)

2. **Video Upload Flow**
   - Chọn video từ camera roll
   - Hiện quota còn lại trong cycle hiện tại
   - Validate: size ≤ 500MB, duration ≤ 10 phút, có âm thanh
   - Upload lên Bunny.net → tạo record `observation_videos`
   - Trạng thái: `pending` → `processing` → `done` / `failed`
   - Thông báo khi AI report xong

3. **AI Report Viewer**
   - Đọc `ai_reports.report_json` (7 phần)
   - Hiển thị scores theo 6 lĩnh vực (radar chart)
   - Phần dành cho phụ huynh vs giáo viên khác nhau (role-aware)
   - Recommendations → link thẳng sang màn hình Exercises

4. **Exercises — Bài tập can thiệp**
   - Danh sách bài tập được assign (`exercise_assignments`)
   - Filter: lĩnh vực / mức độ / trạng thái
   - Chi tiết bài tập: hướng dẫn, video minh họa, thời gian
   - Log session: `exercise_sessions` (ghi kết quả, ghi chú)

5. **Video Modeling Player**
   - Phát video từ `content_library` (Bunny.net stream)
   - Danh sách VM được assign theo `vm_assignments`
   - Tracking: thời gian xem, hoàn thành hay chưa

6. **Nhật ký (Progress Journal)**
   - PH ghi chú hàng ngày (`child_daily_logs`)
   - Timeline theo ngày
   - Highlight: Mood / Ăn uống / Ngủ / Hành vi nổi bật

---

## Phase 3 — Giáo viên & Specialist (Tuần 6-7)

1. **Teacher Dashboard**
   - Danh sách trẻ được phân công
   - Xem hpDT overview từng trẻ
   - Session ghi chép (`exercise_sessions` từ phía trường)

2. **Weekly Review**
   - Tổng hợp cuối tuần: video + nhật ký + AI insights
   - Gửi notification "Tuần này của bé" mỗi Chủ nhật

3. **Specialist View**
   - Xem AI report đầy đủ
   - Điều chỉnh exercise assignment thủ công
   - VST upgrade: xem đề xuất → confirm

---

## Phase 4 — VST Chat & Notifications (Tuần 8-9)

1. **VST Chat**
   - PH chat với Giáo viên Bóng Ảo của con
   - AI respond trong vai VST, dùng toàn bộ child profile làm context
   - Lưu `vst_chat_sessions` + `vst_chat_messages`

2. **Push Notifications**
   - Report ready / Bài tập mới / Weekly review / Nhắc nhở upload

3. **Cloudinary → Bunny.net Migration** *(xem workflow/cloudinary-migration.md)*

---

## Phase 5 — Polish & Launch (Tuần 10-12)

- [ ] Intervention Plans (kế hoạch 12 tuần tự động)
- [ ] Intervention Checkpoints (3 tháng / 6 tháng)
- [ ] Admin panel: quản lý users, centers, content
- [ ] Performance: lazy loading, video caching
- [ ] Security audit: RLS, PDPA Vietnam compliance
- [ ] Deploy: Vercel (web) + Expo (mobile)

---

## Thứ tự ưu tiên tuyệt đối (build trước)

```
1. Supabase connect → Auth real
2. ProfileCompletion flow
3. Parent Dashboard (read-only, mock data OK)
4. Video Upload (Bunny.net)
5. AI Report Viewer
6. Exercises list + log session
```

> ⚠️ **Không build song song nhiều screen khi Supabase chưa connect thật** — dễ bị sai data flow.
