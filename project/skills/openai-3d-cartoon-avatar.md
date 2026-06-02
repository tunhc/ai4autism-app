# OpenAI 3D Cartoon Avatar Skill - AI4Autism
> Luồng tạo avatar 3D cartoon cho bé khi phụ huynh cập nhật hồ sơ trẻ

---

## 1. Mục tiêu

Khi phụ huynh cập nhật thông tin bé và thêm ảnh avatar, hệ thống tạo một ảnh đại diện mới theo phong cách **cute 3D cartoon**, không photorealistic, không deepfake, không dùng trực tiếp ảnh thật của trẻ làm avatar public.

Flow chính:

```text
Parent update child profile
    -> Upload child photo to Cloudinary
    -> Update children.avatar_url + children.avatar_thumb_url
    -> Create ai_jobs row with job_type = 'avatar_generation'
    -> OpenAI generates child-safe 3D cartoon avatar
    -> Upload generated avatar to Cloudinary
    -> Update children.avatar_3d_url + children.avatar_job_id
    -> Insert avatar generation log
    -> App displays children.avatar_3d_url
```

---

## 2. Schema thật đang có

Đã kiểm tra từ code và Supabase hiện tại. Bảng hồ sơ bé là `children`.

Các cột avatar hiện có trên `children`:

| Column | Ý nghĩa | Ghi chú |
|--------|---------|---------|
| `avatar_url` | Ảnh thật của bé trên Cloudinary | HD/source image, không dùng làm avatar public nếu đã có 3D |
| `avatar_thumb_url` | Thumbnail ảnh thật của bé | 100x100 hoặc Cloudinary transformed URL |
| `avatar_3d_url` | Avatar 3D cartoon generated | Đây là avatar chính để app hiển thị |
| `avatar_job_id` | FK tới `ai_jobs.id` | Job generate avatar gần nhất |

Không thêm các cột mới như `avatar_3d_public_id` hoặc `avatar_generated_at` vào `children` nếu chưa cần. Thông tin này nên nằm trong `ai_jobs.output_data` và bảng log avatar.

Schema liên quan đã có:

```sql
CREATE TYPE job_type AS ENUM (
  'ai_analysis',
  'avatar_generation',
  'vm_generation',
  'report_gen',
  'hpdt_batch',
  'weekly_review'
);

CREATE TYPE job_status AS ENUM (
  'queued',
  'processing',
  'completed',
  'failed',
  'cancelled'
);

CREATE TABLE ai_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type          job_type NOT NULL,
  status            job_status NOT NULL DEFAULT 'queued',
  priority          SMALLINT NOT NULL DEFAULT 1,
  subscription_plan subscription_plan NOT NULL DEFAULT 'enterprise',
  child_id          UUID REFERENCES children(id),
  triggered_by      UUID REFERENCES users(id),
  input_data        JSONB NOT NULL DEFAULT '{}',
  output_data       JSONB,
  error_message     TEXT,
  retry_count       SMALLINT NOT NULL DEFAULT 0,
  queued_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  processing_ms     INTEGER,
  worker_id         TEXT
);
```

---

## 3. Bảng log avatar nên thêm

Vì phụ huynh có thể update avatar thường xuyên, không nên chỉ dựa vào `children.avatar_3d_url`. Cần một bảng log riêng để lưu lịch sử các lần generate/regenerate.

Đề xuất tạo bảng:

```sql
CREATE TABLE child_avatar_generation_logs (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id                   UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  parent_id                  UUID NOT NULL REFERENCES users(id),
  ai_job_id                  UUID REFERENCES ai_jobs(id),

  source_avatar_url          TEXT,
  source_avatar_thumb_url    TEXT,
  generated_avatar_3d_url    TEXT,

  child_age_years            INTEGER NOT NULL,
  child_age_months           INTEGER NOT NULL,
  prompt_version             TEXT NOT NULL DEFAULT 'child_avatar_v1',
  prompt_snapshot            TEXT,
  model                      TEXT NOT NULL DEFAULT 'gpt-image-1.5',
  provider                   TEXT NOT NULL DEFAULT 'openai',
  style                      TEXT NOT NULL DEFAULT 'cute_3d_cartoon',

  cloudinary_public_id       TEXT,
  status                     job_status NOT NULL DEFAULT 'queued',
  error_message              TEXT,
  is_current                 BOOLEAN NOT NULL DEFAULT false,

  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at               TIMESTAMPTZ
);

CREATE INDEX idx_child_avatar_logs_child_created
  ON child_avatar_generation_logs(child_id, created_at DESC);

CREATE INDEX idx_child_avatar_logs_current
  ON child_avatar_generation_logs(child_id)
  WHERE is_current = true;
```

Khi một avatar mới completed:

1. Set các log cũ của bé: `is_current = false`.
2. Insert/update log mới: `is_current = true`.
3. Update `children.avatar_3d_url`.
4. Update `children.avatar_job_id`.

---

## 4. Avatar lớn dần theo thời gian

Avatar phải phản ánh tuổi hiện tại của bé, không giữ mãi dáng 3D của lần generate đầu tiên.

Rule:

- Luôn tính tuổi từ `children.date_of_birth` tại thời điểm generate.
- Không lưu tuổi cố định trong `children`.
- Lưu `child_age_years` và `child_age_months` vào `ai_jobs.input_data` và `child_avatar_generation_logs`.
- Khi parent update avatar hoặc đến sinh nhật/năm mới, prompt phải dùng tuổi hiện tại.

Hàm tính tuổi gợi ý:

```javascript
function calculateChildAge(dateOfBirth, atDate = new Date()) {
  const dob = new Date(dateOfBirth)
  let years = atDate.getFullYear() - dob.getFullYear()
  let months = atDate.getMonth() - dob.getMonth()

  if (atDate.getDate() < dob.getDate()) months -= 1
  if (months < 0) {
    years -= 1
    months += 12
  }

  return {
    years: Math.max(years, 0),
    months: Math.max(years * 12 + months, 0),
  }
}
```

Regeneration trigger:

```text
Parent uploads/changes child avatar
    -> regenerate immediately

Daily birthday job at 01:00
    -> if today matches date_of_birth month/day
    -> enqueue avatar_generation job
    -> output avatar with new age
```

Nếu muốn tiết kiệm cost, chỉ auto-regenerate mỗi năm một lần vào sinh nhật. Các lần parent đổi ảnh thì regenerate ngay.

---

## 5. Backend flow dùng đúng bảng/cột

Mobile không gọi OpenAI trực tiếp. Mobile chỉ upload ảnh và gọi Edge Function.

Request:

```text
POST /functions/v1/generate-child-avatar
Authorization: Bearer <parent_jwt>
Body:
{
  "child_id": "...",
  "source_avatar_url": "https://res.cloudinary.com/...",
  "source_avatar_thumb_url": "https://res.cloudinary.com/...",
  "preferences": {
    "favorite_theme": "space",
    "outfit_color": "blue"
  }
}
```

Edge Function cần làm:

1. Verify parent owns `children.id`.
2. Load child:

```javascript
const { data: child, error } = await supabase
  .from('children')
  .select(`
    id,
    parent_id,
    full_name,
    nickname,
    date_of_birth,
    gender,
    avatar_url,
    avatar_thumb_url,
    avatar_3d_url,
    avatar_job_id
  `)
  .eq('id', childId)
  .single()
```

3. Calculate current age from `date_of_birth`.
4. Insert `ai_jobs`:

```javascript
const { data: job, error: jobError } = await supabase
  .from('ai_jobs')
  .insert({
    job_type: 'avatar_generation',
    status: 'queued',
    priority: 2,
    subscription_plan: 'enterprise',
    child_id: child.id,
    triggered_by: parentId,
    input_data: {
      source_avatar_url: child.avatar_url,
      source_avatar_thumb_url: child.avatar_thumb_url,
      child_age_years: age.years,
      child_age_months: age.months,
      prompt_version: 'child_avatar_v1',
      preferences,
    },
  })
  .select('id')
  .single()
```

5. Update `children.avatar_job_id = job.id` early so UI can track latest job.
6. Generate image with OpenAI.
7. Upload generated image to Cloudinary.
8. Update `ai_jobs.status/output_data/completed_at`.
9. Update `children.avatar_3d_url/avatar_job_id`.
10. Insert `child_avatar_generation_logs`.

---

## 6. Prompt template

Không đưa họ tên đầy đủ, diagnosis, DSM-5, ASD level, VST type, trường học hoặc địa chỉ vào prompt.

Base prompt:

```text
Create a cute, child-safe, stylized 3D cartoon avatar of a {age_years}-year-old {gender_or_child}.

Use the uploaded photo only as loose visual inspiration for non-sensitive visual traits such as hairstyle, hair color, glasses, and a friendly expression. Do not recreate the exact face. Do not make the image photorealistic.

The child should look age-appropriate for {age_years} years old. If generating again in a later year, subtly reflect the older age while preserving a consistent friendly cartoon identity.

Avatar style:
- high quality 3D cartoon character
- soft rounded features
- warm and friendly expression
- age-appropriate child appearance
- bright clean studio lighting
- simple neutral background
- centered head-and-shoulders composition
- suitable as a mobile app profile avatar

Optional personalization:
- favorite theme: {favorite_theme}
- outfit color: {outfit_color}

Safety constraints:
- no photorealism
- no realistic skin pores
- no school uniform logos
- no text
- no medical symbols
- no diagnosis references
- no adult styling
- no scary or violent elements
```

---

## 7. OpenAI generation skeleton

Theo tài liệu OpenAI, Image API phù hợp khi backend chỉ cần tạo/chỉnh một ảnh từ một prompt. Responses API phù hợp hơn cho trải nghiệm hội thoại hoặc multi-step image editing.

Nguồn chính thức:

- [OpenAI Image generation guide](https://platform.openai.com/docs/guides/images/image-generation)
- [OpenAI Images API reference](https://platform.openai.com/docs/api-reference/images)

Prompt builder:

```javascript
const buildChildAvatarPrompt = ({ ageYears, gender, favoriteTheme, outfitColor }) => {
  const genderText = gender === 'male'
    ? 'boy'
    : gender === 'female'
      ? 'girl'
      : 'child'

  return `
Create a cute, child-safe, stylized 3D cartoon avatar of a ${ageYears}-year-old ${genderText}.

Use the uploaded photo only as loose visual inspiration for non-sensitive visual traits such as hairstyle, hair color, glasses, and a friendly expression. Do not recreate the exact face. Do not make the image photorealistic.

The child should look age-appropriate for ${ageYears} years old. If generating again in a later year, subtly reflect the older age while preserving a consistent friendly cartoon identity.

Avatar style:
- high quality 3D cartoon character
- soft rounded features
- warm and friendly expression
- age-appropriate child appearance
- bright clean studio lighting
- simple neutral background
- centered head-and-shoulders composition
- suitable as a mobile app profile avatar

Optional personalization:
- favorite theme: ${favoriteTheme || 'friendly learning'}
- outfit color: ${outfitColor || 'soft pastel'}

Safety constraints:
- no photorealism
- no realistic skin pores
- no school uniform logos
- no text
- no medical symbols
- no diagnosis references
- no adult styling
- no scary or violent elements
`.trim()
}
```

Image-guided edit from the parent-uploaded avatar:

```javascript
const result = await openai.images.edit({
  model: 'gpt-image-1.5',
  image: sourceImageFile,
  prompt,
  size: '1024x1024',
  quality: 'medium',
  n: 1,
})

const imageBase64 = result.data[0].b64_json
```

Fallback if no source image is available:

```javascript
const result = await openai.images.generate({
  model: 'gpt-image-1.5',
  prompt,
  size: '1024x1024',
  quality: 'medium',
  n: 1,
})

const imageBase64 = result.data[0].b64_json
```

---

## 8. Cloudinary output

Upload generated avatar:

```javascript
const uploadResult = await cloudinary.uploader.upload(
  `data:image/png;base64,${imageBase64}`,
  {
    folder: `children/${child.id}/avatars/3d`,
    public_id: `avatar_3d_${job.id}`,
    overwrite: true,
    resource_type: 'image',
    tags: ['child-avatar', 'generated', 'openai', '3d-cartoon'],
    context: {
      child_id: child.id,
      ai_job_id: job.id,
      source: 'openai',
      prompt_version: 'child_avatar_v1',
      child_age_years: String(age.years),
      child_age_months: String(age.months),
    },
  }
)
```

Update đúng cột trong đúng bảng:

```javascript
await supabase
  .from('children')
  .update({
    avatar_3d_url: uploadResult.secure_url,
    avatar_job_id: job.id,
    updated_at: new Date().toISOString(),
  })
  .eq('id', child.id)
```

Update `ai_jobs`:

```javascript
await supabase
  .from('ai_jobs')
  .update({
    status: 'completed',
    output_data: {
      avatar_3d_url: uploadResult.secure_url,
      cloudinary_public_id: uploadResult.public_id,
      child_age_years: age.years,
      child_age_months: age.months,
      model: 'gpt-image-1.5',
      prompt_version: 'child_avatar_v1',
    },
    completed_at: new Date().toISOString(),
  })
  .eq('id', job.id)
```

Insert log:

```javascript
await supabase
  .from('child_avatar_generation_logs')
  .update({ is_current: false })
  .eq('child_id', child.id)

await supabase
  .from('child_avatar_generation_logs')
  .insert({
    child_id: child.id,
    parent_id: parentId,
    ai_job_id: job.id,
    source_avatar_url: child.avatar_url,
    source_avatar_thumb_url: child.avatar_thumb_url,
    generated_avatar_3d_url: uploadResult.secure_url,
    child_age_years: age.years,
    child_age_months: age.months,
    prompt_snapshot: prompt,
    cloudinary_public_id: uploadResult.public_id,
    status: 'completed',
    is_current: true,
    completed_at: new Date().toISOString(),
  })
```

---

## 9. Frontend behavior

Màn hình Parent update child profile:

- Khi parent chọn ảnh mới, upload ảnh thật vào Cloudinary.
- Update `children.avatar_url` và `children.avatar_thumb_url`.
- Gọi `generate-child-avatar`.
- Hiển thị trạng thái dựa trên `children.avatar_job_id` và `ai_jobs.status`.
- Khi `ai_jobs.status = completed`, reload child và hiển thị `children.avatar_3d_url`.
- Nếu failed, giữ avatar cũ và hiển thị nút `Thử tạo lại`.

Display priority:

```javascript
const displayAvatar =
  child.avatar_3d_url ||
  child.avatar_thumb_url ||
  child.avatar_url ||
  null
```

Không block toàn bộ profile update chỉ vì avatar generation failed. Profile update và avatar generation là 2 bước độc lập.

---

## 10. Error handling

| Lỗi | Cách xử lý |
|-----|------------|
| Parent không sở hữu child | Trả 403 |
| Ảnh upload không hợp lệ | Trả 400 |
| OpenAI timeout/rate limit | `ai_jobs.status = failed`, cho retry |
| Cloudinary upload failed | Không update `children.avatar_3d_url`, mark failed |
| Content moderation blocked | Báo parent chọn ảnh khác |

Message cho parent:

```text
Chưa tạo được avatar từ ảnh này. Bạn thử chọn ảnh rõ mặt hơn hoặc bấm tạo lại nhé.
```

---

## 11. Acceptance criteria

Flow đạt khi:

- Parent update thông tin bé không phụ thuộc vào avatar generation.
- Ảnh thật lưu ở `children.avatar_url` và `children.avatar_thumb_url`.
- Avatar generated lưu ở `children.avatar_3d_url`.
- Job gần nhất lưu ở `children.avatar_job_id`.
- Job tracking dùng `ai_jobs` với `job_type = 'avatar_generation'`.
- Lịch sử regenerate lưu ở `child_avatar_generation_logs`.
- Avatar mới mỗi năm dùng tuổi tính từ `children.date_of_birth`.
- Prompt không chứa tên đầy đủ, chẩn đoán, DSM-5, ASD level, VST type hoặc dữ liệu y tế của bé.
- App ưu tiên hiển thị `children.avatar_3d_url`.

