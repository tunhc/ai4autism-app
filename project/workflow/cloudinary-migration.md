# Cloudinary → Bunny.net Migration Plan
> Video cũ trên Cloudinary cần được chuyển sang Bunny.net Stream

---

## Tại sao cần migrate?

| | Cloudinary | Bunny.net Stream |
|--|------------|-----------------|
| Mục đích | Image + video storage | Video streaming chuyên biệt |
| HLS Streaming | Không tối ưu | ✅ Native HLS |
| Chi phí | Cao với video | Rẻ hơn ~60% |
| Bandwidth VN | Trung bình | CDN edge gần VN |
| Webhook | Giới hạn | ✅ Đầy đủ |

---

## Danh sách video cần migrate

```
Nguồn: Cloudinary (tài khoản hiện tại)
Loại: 
  - Video modeling mẫu (content_library)
  - Observation videos cũ của trẻ
  - Training videos
```

**Bước đầu tiên: Liệt kê toàn bộ video trên Cloudinary**
```bash
# Dùng Cloudinary API để lấy danh sách
GET https://api.cloudinary.com/v1_1/{cloud_name}/resources/video
→ Export ra file JSON với: public_id, url, size, created_at, tags
```

---

## Migration Script

```javascript
// migrate-cloudinary-to-bunny.js
// Chạy một lần, không tự động lặp

const migrateVideo = async (cloudinaryVideo) => {
  // 1. Download từ Cloudinary
  const videoBuffer = await downloadFromCloudinary(cloudinaryVideo.url)
  
  // 2. Upload lên Bunny.net
  const bunnyVideoId = await uploadToBunny(videoBuffer, {
    title: cloudinaryVideo.public_id,
    tags: cloudinaryVideo.tags
  })
  
  // 3. Cập nhật DB
  await supabase
    .from('content_library')  // hoặc observation_videos
    .update({ 
      video_url: `https://vz-xxx.b-cdn.net/${bunnyVideoId}/playlist.m3u8`,
      bunny_video_id: bunnyVideoId,
      cloudinary_backup_url: cloudinaryVideo.url  // giữ backup
    })
    .eq('cloudinary_id', cloudinaryVideo.public_id)
}
```

---

## Thứ tự migrate

### Ưu tiên 1: Content Library (Video Modeling mẫu)
- Đây là video phụ huynh xem hàng ngày → cần CDN tốt nhất
- Khoảng ~50-100 videos
- Migrate trước khi launch

### Ưu tiên 2: Observation Videos (video trẻ đã upload)
- Có thể migrate song song với launch
- Giữ Cloudinary URL làm fallback trong 30 ngày
- Sau 30 ngày: xóa trên Cloudinary để tiết kiệm chi phí

### Ưu tiên 3: Training/Admin videos
- Không urgent, migrate sau

---

## Checklist trước khi chạy migration

- [ ] Backup toàn bộ danh sách video Cloudinary (export JSON)
- [ ] Test Bunny.net API với 1-2 video thử
- [ ] Đảm bảo DB có field `cloudinary_backup_url` để rollback
- [ ] Chạy vào giờ thấp điểm (12AM - 5AM)
- [ ] Monitor: so sánh file size trước/sau để verify
- [ ] Sau migrate: test play 5 video ngẫu nhiên trên app

---

## Rollback Plan

Nếu Bunny.net có vấn đề sau migrate:
1. App đọc `cloudinary_backup_url` thay vì `video_url`
2. Feature flag: `USE_CLOUDINARY_FALLBACK=true`
3. Xóa Cloudinary videos **chỉ sau khi** đã verify Bunny.net OK sau 30 ngày

---

## Ước tính thời gian

| Loại | Số lượng ước tính | Thời gian |
|------|------------------|-----------|
| Content Library | ~100 videos | 2-3 giờ |
| Observation Videos | ~200-500 videos | 1 ngày |
| Training videos | ~50 videos | 1 giờ |

> 💡 **Gợi ý**: Migrate content_library trước khi demo với BI Center. Observation videos migrate ngay sau buổi demo nếu được approve.
