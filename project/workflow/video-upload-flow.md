# Video Upload Flow — AI4Autism
> Toàn bộ flow từ khi PH chọn video đến khi nhận AI report

---

## Tổng quan luồng

```
PH chọn video
    ↓
Validate (client-side)
    ↓
Check quota còn lại
    ↓
Upload lên Bunny.net
    ↓
Tạo record observation_videos (status: pending)
    ↓
Cloudflare Worker: Quality Check
    ↓ pass                    ↓ fail
Gemini 3.5 Flash          Báo lỗi PH
phân tích video           yêu cầu upload lại
    ↓
[Enterprise/Toàn Diện] Claude cross-validate
    ↓
Lưu ai_reports (status: done)
    ↓
Update hpdt_profiles
    ↓
Tạo/update exercise_assignments
    ↓
Push notification → PH
```

---

## Bước 1 — Client Validation (trước khi upload)

| Điều kiện | Giá trị | Hành động nếu fail |
|-----------|---------|-------------------|
| Kích thước file | ≤ 500 MB | Báo lỗi, không cho upload |
| Thời lượng | ≤ 10 phút | Báo lỗi |
| Có âm thanh | Bắt buộc | Cảnh báo (soft) |
| Định dạng | mp4, mov, avi | Báo lỗi |

---

## Bước 2 — Kiểm tra Quota

```
Cycle = 14 ngày (reset Thứ Hai đầu cycle)

Quota theo plan:
- Cơ Bản:    2 video / cycle
- Tiêu Chuẩn: 4 video / cycle  
- Toàn Diện: 8 video / cycle
- Enterprise: không giới hạn

Table: video_upload_quotas
Fields: child_id, cycle_start, videos_uploaded, quota_limit
```

**Nếu đã đủ quota** → Hiện: *"Bạn đã đạt giới hạn video trong chu kỳ này. Reset vào [ngày Thứ Hai tới]"*

---

## Bước 3 — Upload lên Bunny.net

```javascript
// Flow upload
1. Gọi Supabase Edge Function: /upload-token
2. Edge Function tạo Bunny.net upload URL (presigned)
3. Client upload trực tiếp lên Bunny.net (bypass server)
4. Nhận callback: video_id từ Bunny.net
5. Tạo record observation_videos:
   {
     child_id,
     video_url: bunny_cdn_url,
     bunny_video_id,
     status: 'pending',
     uploaded_by: user_id,
     upload_context: { activity, environment, notes }
   }
```

---

## Bước 4 — Quality Check (Cloudflare Worker)

Trigger: Bunny.net webhook sau khi video processed

### Hard Reject (tự động từ chối, yêu cầu upload lại)
- Quá tối (brightness < threshold)
- Quá nhiễu / blurry
- Không có trẻ trong frame
- Video bị cắt giữa chừng (< 30 giây)

### Soft Warn (vẫn xử lý, ghi chú trong report)
- Góc quay không tối ưu
- Âm thanh nền nhiều
- Ánh sáng không đều

Kết quả lưu vào: `observation_videos.quality_check_result` (JSONB) + `quality_status`

---

## Bước 5 — AI Analysis

### Plan Cơ Bản / Tiêu Chuẩn
```
Gemini 3.5 Flash phân tích video
→ Sinh report_json (7 phần)
→ Lưu ai_reports
```

### Plan Toàn Diện / Enterprise
```
Gemini 3.5 Flash scan video
→ Claude Sonnet cross-validate:
   - Kiểm tra domain scores
   - Verify exercise recommendations
   - Clinical decision accuracy +15-20%
→ Merge → lưu ai_reports
```

### Cấu trúc report_json (7 phần)
```json
{
  "summary": "Tóm tắt tổng thể",
  "domain_scores": {
    "fine_motor": 0-100,
    "gross_motor": 0-100,
    "social_interaction": 0-100,
    "language": 0-100,
    "imitation": 0-100,
    "cognition": 0-100
  },
  "observations": [...],
  "recommendations": [...],
  "exercise_suggestions": [...],
  "message_to_uploader": "Tin nhắn cho PH/GV",
  "clinical_notes": "Ghi chú chuyên môn (specialist only)"
}
```

> ⚠️ `message_to_uploader` được extract riêng ra field để query nhanh trên Dashboard widget mà không cần parse JSON

---

## Bước 6 — Cập nhật hpDT & Assignments

Sau khi AI report done, app gọi `updateHpdtRolling(childId)` **ngay lập tức**:

### Rolling Average (video)
```
Lấy tối đa 5 video gần nhất có report done/completed
→ Tính trung bình từng domain score
→ Tính overall_score (weighted: comm 28%, social 25%, behavior 20%, cognitive 15%, sensory 7%, motor 5%)
→ Upsert hpdt_profiles (update ngay, không đợi batch)
→ Insert hpdt_history (trigger_type = 'video_rolling')
```

> Rolling window = 5 video — tránh outlier từ 1 video xấu làm điểm tụt mạnh.

### Weekly Batch (bài tập)
```
Mỗi Chủ nhật 23:00 — gom dữ liệu exercise sessions trong tuần
→ Update hpdt_profiles (bổ sung/điều chỉnh từ exercise data)
→ Insert hpdt_history (trigger_type = 'weekly_batch')
→ Ghi log hpdt_weekly_batch_logs
```

### Sau đó (cả 2 luồng):
- Auto-generate `exercise_assignments` dựa trên recommendations từ report mới nhất

---

## Trạng thái video (observation_videos.status)

```
pending     → Vừa upload, chưa process
processing  → Đang quality check hoặc AI đang phân tích
done        → Có AI report
failed      → Lỗi (quality reject hoặc AI error)
```

---

## Hiển thị cho người dùng

| Trạng thái | Hiển thị trên app |
|------------|------------------|
| pending / processing | Spinner "Đang phân tích video của bé..." |
| done | "Báo cáo sẵn sàng!" + notification |
| failed (quality) | "Video chưa đạt yêu cầu: [lý do]. Vui lòng quay lại." |
| failed (AI error) | "Đã xảy ra lỗi. Chúng tôi sẽ thử lại." + auto-retry 1 lần |
