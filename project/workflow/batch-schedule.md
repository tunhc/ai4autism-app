# Batch Jobs & Schedule — AI4Autism
> Tất cả các tác vụ chạy tự động theo lịch

---

## Tổng quan các Batch Jobs

| Job | Lịch chạy | Mô tả |
|-----|-----------|-------|
| hpDT Weekly Batch | Chủ nhật 23:00 | Cập nhật Digital Twin toàn bộ trẻ |
| Weekly Review Generator | Chủ nhật 23:30 | Tạo weekly_reviews sau hpDT batch |
| Exercise Assignment Refresh | Thứ Hai 06:00 | Cập nhật bài tập đầu tuần |
| Video Quota Reset | Thứ Hai 00:00 | Reset quota cho cycle mới |
| VST Age Check | Hàng ngày 01:00 | Check trẻ đủ tuổi chuyển VST type |
| Notification Digest | Hàng ngày 07:00 | Gửi push notification buổi sáng |
| AI Report Retry | Mỗi 15 phút | Retry các AI job bị lỗi |
| Audit Log Cleanup | Thứ Bảy 02:00 | Xóa audit logs > 2 năm (PDPA) |

---

## Chi tiết từng Job

### 1. hpDT Weekly Batch — Chủ nhật 23:00

```
Mục đích: Cập nhật hpdt_profiles cho toàn bộ trẻ trong center

Input:
  - child_daily_logs trong 7 ngày qua
  - exercise_sessions trong 7 ngày qua
  - observation_videos + ai_reports trong 7 ngày qua
  - caregiver_stress_logs

Xử lý:
  1. Tính weighted average từ các nguồn dữ liệu
  2. Cập nhật từng domain score (6 lĩnh vực)
  3. Tính overall_score mới
  4. Xác định milestone_level
  5. Ghi vào hpdt_history (snapshot hàng tuần)
  6. Ghi log vào hpdt_weekly_batch_logs

Output:
  - hpdt_profiles.overall_score (updated)
  - hpdt_history (new row)
  - hpdt_weekly_batch_logs (status: done)

Thời gian chạy ước tính: ~5-10 phút cho 40 trẻ
```

> ⚠️ Nếu trẻ không có dữ liệu trong tuần → giữ nguyên score cũ, ghi note `no_data_this_week`

---

### 2. Weekly Review Generator — Chủ nhật 23:30

```
Chạy SAU khi hpDT batch xong

Mỗi trẻ tạo 1 weekly_review record:
  - Tổng hợp: số video upload, số session hoàn thành
  - hpDT score tuần này vs tuần trước (delta)
  - Highlights từ nhật ký (PH)
  - AI insights (top 3 điểm nổi bật)

Sau khi tạo xong:
  → Push notification: "Tuần này của bé [tên] sẵn sàng xem rồi! 📊"
  → Gửi cho cả PH và GV của trẻ
```

---

### 3. Exercise Assignment Refresh — Thứ Hai 06:00

```
Căn cứ vào:
  - hpDT scores mới (từ batch Chủ nhật)
  - Các bài tập đã hoàn thành / chưa hoàn thành
  - Intervention plan hiện tại (12 tuần)

Hành động:
  - Đánh dấu bài tập cũ là 'expired'
  - Tạo exercise_assignments mới cho tuần tới
  - Assign content_library (video modeling) phù hợp
```

---

### 4. Video Quota Reset — Thứ Hai 00:00

```
Cycle = 14 ngày
Reset xảy ra vào Thứ Hai đầu mỗi cycle (không phải mỗi tuần)

Cách tính cycle:
  cycle_start = ngày Thứ Hai gần nhất ≤ today
  cycle_end = cycle_start + 13 ngày
  
Hành động:
  - Tạo record mới trong video_upload_quotas
  - videos_uploaded = 0
  - quota_limit theo subscription plan của center
```

---

### 5. VST Age Check — Hàng ngày 01:00

```
So sánh date_of_birth với today → tìm trẻ có sinh nhật HÔM NAY

VST Types theo tuổi (chuyển đúng ngày sinh nhật, không buffer):
  Type 1 → Type 2: tròn 2 tuổi
  Type 2 → Type 3: tròn 4 tuổi
  Type 3 → Type 4: tròn 6 tuổi

Nếu phát hiện trẻ sinh nhật hôm nay và đủ mốc tuổi:
  1. Auto-update children.vst_type ngay lập tức
  2. KHÔNG tự động upgrade can thiệp
  3. Tạo notification cho Specialist:
     "🎂 Bé [tên] vừa tròn [X] tuổi — đủ điều kiện chuyển VST Type [X]. Xác nhận?"
  4. Specialist confirm → apply intervention plan mới

SQL check:
  WHERE EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(DAY   FROM date_of_birth) = EXTRACT(DAY   FROM CURRENT_DATE)
```

---

### 6. Morning Notification Digest — Hàng ngày 07:00

```
Gửi push notifications nhắc nhở:
  - PH: Bài tập hôm nay của bé
  - PH: Nhắc nhở upload video nếu chưa upload trong 5 ngày
  - GV: Trẻ chưa có session trong tuần
  - Specialist: Có checkpoint cần review
```

---

### 7. AI Report Retry — Mỗi 15 phút

```
Tìm các ai_jobs có:
  status = 'failed'
  retry_count < 3
  last_attempt > 15 phút trước

→ Retry job
→ Nếu retry_count = 3: gửi alert admin, đổi status = 'failed_permanent'
```

---

## Triển khai Batch Jobs

**Môi trường production:**
- Supabase Edge Functions (Deno) — cho jobs nhẹ
- Supabase Cron (pg_cron extension) — trigger từ DB
- Cloudflare Workers — quality check video (trigger bởi Bunny webhook)

**Cấu hình pg_cron trong Supabase:**
```sql
-- hpDT Weekly Batch
SELECT cron.schedule('hpdt-weekly-batch', '0 23 * * 0', 
  'SELECT trigger_hpdt_batch()');

-- Weekly Review  
SELECT cron.schedule('weekly-review-gen', '30 23 * * 0',
  'SELECT generate_weekly_reviews()');

-- Exercise Refresh
SELECT cron.schedule('exercise-refresh', '0 6 * * 1',
  'SELECT refresh_exercise_assignments()');

-- Morning notifications
SELECT cron.schedule('morning-notif', '0 7 * * *',
  'SELECT send_morning_notifications()');
```

---

## Monitoring

- Mọi batch job đều ghi vào `hpdt_weekly_batch_logs`
- Alert khi job chạy > 30 phút (stuck)
- Dashboard admin: xem lịch sử batch runs
- Retry tự động 3 lần trước khi escalate
