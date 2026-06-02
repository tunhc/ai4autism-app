# Tech Stack — AI4Autism
> Danh sách công nghệ, lý do chọn, và cách sử dụng đúng

---

## Stack Tổng quan

| Layer | Technology | Ghi chú |
|-------|-----------|---------|
| Frontend Web | React 18 + Vite + Tailwind CSS | Demo/admin portal |
| Mobile | React Native + Expo | App chính cho PH & GV |
| Database | Supabase (PostgreSQL) | 33 tables, full RLS |
| Auth | Supabase Auth | Email/password, JWT |
| Video Storage | Bunny.net Stream | HLS streaming, CDN VN |
| Image/Legacy | Cloudinary | Migration sang Bunny.net |
| AI Primary | Gemini 3.5 Flash | Video analysis |
| AI Validator | Claude Sonnet | Cross-validate (Enterprise) |
| Edge Functions | Supabase Edge Functions (Deno) | API logic, AI calls |
| Worker | Cloudflare Workers | Video quality check |
| Scheduler | pg_cron (Supabase) | Batch jobs |
| Avatar | HeyGen API | VST 3D avatar generation |

---

## Frontend Web (ai4autism-app)

```
Framework: React 18.3
Build: Vite 5.3
Styling: Tailwind CSS 3.4
Routing: React Router DOM 6.26
Charts: Recharts 2.12
Icons: Lucide React 0.408
Date: date-fns 3.6
Utils: clsx
```

### File structure
```
src/
├── pages/
│   ├── Landing.jsx
│   ├── auth/         (Login, Register)
│   ├── parent/       (Dashboard, VideoUpload, Exercises, ...)
│   ├── teacher/
│   ├── specialist/
│   └── admin/
├── components/       (Shared components)
├── context/          (AuthContext)
├── layouts/          (AppLayout)
└── lib/              (supabase client, utils)
```

---

## Mobile (ai4autism-mobile)

```
Framework: React Native + Expo
State: React Context + AsyncStorage
Navigation: React Navigation
Video: expo-av (playback) + expo-image-picker (upload)
```

---

## Supabase Setup

### Environment Variables (cần có trong .env)
```
VITE_SUPABASE_URL=https://[project-id].supabase.co
VITE_SUPABASE_ANON_KEY=[anon-key]
# Chỉ dùng trong Edge Functions — KHÔNG expose ra frontend:
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]
```

### Edge Functions cần build
```
/upload-video-token    → Tạo Bunny.net presigned URL
/process-ai-report     → Gọi Gemini API + lưu kết quả
/generate-vst-avatar   → Gọi HeyGen API
/send-notification     → Push notification
/weekly-batch          → hpDT weekly update
```

---

## Bunny.net Integration

```javascript
// Upload flow
const BUNNY_API_KEY = process.env.BUNNY_API_KEY  // Server only
const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID
const BUNNY_CDN_HOSTNAME = 'vz-xxx.b-cdn.net'

// Tạo video object
POST https://video.bunnycdn.com/library/{libraryId}/videos
Headers: { AccessKey: BUNNY_API_KEY }
Body: { title: 'child_123_2026-05-22' }
→ Response: { guid: 'video-guid' }

// Upload file
PUT https://video.bunnycdn.com/library/{libraryId}/videos/{guid}
Body: file binary

// Playback URL (HLS)
`https://${BUNNY_CDN_HOSTNAME}/${guid}/playlist.m3u8`

// Thumbnail
`https://${BUNNY_CDN_HOSTNAME}/${guid}/thumbnail.jpg`
```

---

## Gemini 3.5 Flash Integration

```javascript
// Specs: $1.50/1M input tokens, $9/1M output tokens
// 284 tokens/sec, context 1M tokens, multimodal

const { GoogleGenerativeAI } = require('@google/generative-ai')
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

// Video analysis prompt
const result = await model.generateContent([
  { fileData: { mimeType: 'video/mp4', fileUri: bunnyVideoUrl } },
  { text: AI_ANALYSIS_PROMPT }
])
```

### AI Prompt Template (role-aware)
```
System: Bạn là chuyên gia can thiệp tự kỷ. Phân tích video và trả về JSON theo template.
Context: [child profile, hpDT history, VST type, DSM-5 severity level]
Task: Đánh giá 6 lĩnh vực, đưa ra recommendations, viết message cho [parent|teacher|specialist]
Format: Trả về JSON với đúng 7 sections, KHÔNG thêm fields ngoài template
Language: Tiếng Việt
```

---

## Claude Sonnet Cross-Validation (Enterprise)

```javascript
// Chỉ chạy cho plan Enterprise/Toàn Diện
// Sau khi Gemini đã cho kết quả

const Anthropic = require('@anthropic-ai/sdk')
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const validation = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 2000,
  messages: [{
    role: 'user',
    content: `Review Gemini's analysis for clinical accuracy:
    [Gemini output]
    Child profile: [profile]
    Flag any inconsistencies. Return merged result.`
  }]
})
```

---

## HeyGen API (VST Avatar)

```javascript
// Tạo avatar 3D cho VST từ ảnh của trẻ
POST https://api.heygen.com/v2/photo_avatar

Body: {
  name: vst_name,  // "Cô An" / "Thầy An"
  image_url: child.avatar_url,  // Ảnh trẻ từ Cloudinary
  gender: child.gender
}

→ avatar_id → polling → avatar_3d_url
→ Lưu vào vst_profiles.avatar_3d_url
```

---

## Packages cần install (chưa có trong package.json hiện tại)

```bash
# Supabase
npm install @supabase/supabase-js

# Mobile
npm install @react-navigation/native
npm install expo-av expo-image-picker

# Forms
npm install react-hook-form

# Notifications  
npm install expo-notifications

# Image
npm install expo-image
```
