# Cloudinary-first Video Reanalysis Flow
> Cap nhat huong uu tien: app phai hoat dong truoc. Dung Cloudinary lam nguon video hien co, chi goi AI lai khi chua co ket qua cu.

---

## Muc tieu

1. App doc duoc video da co tren Cloudinary.
2. Video nao da co ket qua phan tich thi lien ket lai, khong chay AI lai.
3. Bai tap cu da sinh tu ket qua phan tich thi lien ket theo report/video/child de tiet kiem token.
4. Bunny.net de sau, khong chan MVP.

---

## Nguon du lieu uu tien

Khi load video trong app:

```
observation_videos
  -> uu tien video_url neu co
  -> neu khong co, dung cloudinary_url / cloudinary_secure_url / cloudinary_backup_url
  -> hien status dua tren viec co ai_report hay chua
```

Khi load ket qua AI:

```
video_id
  -> tim ai_reports.observation_video_id = video_id
  -> neu khong co, tim theo cloudinary_public_id neu DB co luu
  -> neu khong co, tim report moi nhat cua child_id gan ngay recorded_at
  -> van khong co thi moi dua vao hang cho phan tich lai
```

---

## Trang thai hien thi trong app

| Dieu kien | UI status | Hanh dong |
|-----------|-----------|-----------|
| Co video + co ai_report | Da phan tich | Mo report cu |
| Co video + co exercise_assignments tu report | Da co bai tap | Lien ket bai tap cu |
| Co video + chua co report | Cho phan tich lai | Cho phep enqueue AI |
| Video URL loi | Can kiem tra | Hien loi nhe, khong xoa record |

---

## Quy tac tiet kiem token

- Khong phan tich lai neu da co `ai_reports` hop le.
- Khong tao lai bai tap neu da co `exercise_assignments` lien quan den report/video do.
- Neu report cu thieu field moi, dung migration/backfill JSON nhe thay vi goi model lai.
- Chi goi AI lai khi:
  - Khong co report nao lien ket duoc.
  - Report JSON hong/khong parse duoc.
  - Specialist/Admin bam "Phan tich lai" thu cong.

---

## De xuat field DB can co

Neu schema hien tai chua co, them cac field nay se giup mapping an toan:

```sql
ALTER TABLE observation_videos
  ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT,
  ADD COLUMN IF NOT EXISTS cloudinary_url TEXT,
  ADD COLUMN IF NOT EXISTS cloudinary_secure_url TEXT,
  ADD COLUMN IF NOT EXISTS cloudinary_metadata JSONB DEFAULT '{}';

ALTER TABLE ai_reports
  ADD COLUMN IF NOT EXISTS source_video_provider TEXT DEFAULT 'cloudinary',
  ADD COLUMN IF NOT EXISTS source_video_public_id TEXT,
  ADD COLUMN IF NOT EXISTS reused_from_report_id UUID REFERENCES ai_reports(id);

ALTER TABLE exercise_assignments
  ADD COLUMN IF NOT EXISTS source_report_id UUID REFERENCES ai_reports(id),
  ADD COLUMN IF NOT EXISTS source_video_id UUID REFERENCES observation_videos(id);
```

---

## App implementation order

1. Sua helper Supabase de doc video Cloudinary fallback.
2. Sua AIReportScreen de load report theo `videoId` va render ket qua co san.
3. Sua Library screens de hien "Da phan tich" neu video co report.
4. Sua Exercises/Home Activities de doc bai tap cu theo `source_report_id`/`child_id`.
5. Tao nut "Phan tich lai" sau cung, chi cho admin/specialist hoac debug mode.

---

## Luu y

- Cloudinary key/secret khong dua vao mobile app.
- Mobile app chi can doc URL da luu trong DB.
- Neu can list Cloudinary resources truc tiep, lam bang script server/Edge Function, khong lam trong client.
- Soft delete only: khong xoa video cu, chi archive neu can.
