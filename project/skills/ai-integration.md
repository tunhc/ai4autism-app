# AI Integration Guide — AI4Autism
> Cách tích hợp Gemini 3.5 Flash + Claude Sonnet đúng cách

---

## 1. AI Pipeline Tổng quan

```
Video upload (Bunny.net)
    ↓
Cloudflare Worker: Quality Check
    ↓ pass
Supabase Edge Function: trigger AI job
    ↓
ai_jobs table: status = 'running'
    ↓
Gemini 3.5 Flash: phân tích video
    ↓
[Enterprise ← BI Center dùng plan này] Claude Sonnet: cross-validate
    ↓
Merge → lưu ai_reports
    ↓
Update hpdt_profiles
    ↓
Auto-create exercise_assignments
    ↓
Push notification → user
```

---

## 2. Gemini 3.5 Flash — Video Analysis Prompt

```javascript
// Edge Function: process-ai-report
const SYSTEM_PROMPT = `
Bạn là chuyên gia can thiệp tự kỷ với 10 năm kinh nghiệm.
Phân tích video và đánh giá 6 lĩnh vực phát triển của trẻ.
Trả về JSON CHÍNH XÁC theo template. KHÔNG thêm field ngoài template.
Ngôn ngữ: Tiếng Việt.
`

const buildAnalysisPrompt = (child, hpDTHistory, videoContext) => `
THÔNG TIN TRẺ:
- Tên: ${child.name}
- Tuổi: ${calculateAge(child.date_of_birth)} tuổi ${calculateMonths(child.date_of_birth)} tháng
- VST Type: ${child.vst_type} (${vstTypeDescription[child.vst_type]})
- DSM-5 Level: ${child.dsm5_level}
- hpDT Score hiện tại: ${hpDTHistory.overall_score}%
- Điểm yếu nhất: ${getWeakestDomains(hpDTHistory)}

CONTEXT VIDEO:
- Hoạt động: ${videoContext.activity}
- Ghi chú của phụ huynh: ${videoContext.notes}

LỊCH SỬ 4 TUẦN GẦN NHẤT:
${JSON.stringify(hpDTHistory.last4Weeks)}

YÊU CẦU PHÂN TÍCH:
Đánh giá video và trả về JSON với đúng cấu trúc này:
{
  "summary": "Tóm tắt 2-3 câu về những gì quan sát được",
  "domain_scores": {
    "fine_motor": <0-100>,
    "gross_motor": <0-100>,
    "social_interaction": <0-100>,
    "language": <0-100>,
    "imitation": <0-100>,
    "cognition": <0-100>
  },
  "observations": [
    { "domain": "fine_motor", "note": "..." },
    ...
  ],
  "recommendations": [
    { "priority": 1, "action": "...", "frequency": "...", "domain": "..." },
    ...
  ],
  "exercise_suggestions": [
    { "exercise_name": "...", "domain": "...", "duration_minutes": 15, "frequency_per_week": 3 },
    ...
  ],
  "message_to_uploader": "Tin nhắn ấm áp, khuyến khích dành cho phụ huynh/giáo viên (2-3 câu)",
  "clinical_notes": "Ghi chú kỹ thuật cho chuyên gia (có thể để trống nếu không có)"
}
`
```

---

## 3. Claude Sonnet Cross-Validation (Enterprise Only)

```javascript
const crossValidate = async (geminiResult, childProfile) => {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `
Kiểm tra kết quả phân tích AI này cho chính xác lâm sàng:

KẾT QUẢ GEMINI:
${JSON.stringify(geminiResult, null, 2)}

HỒ SƠ TRẺ:
${JSON.stringify(childProfile, null, 2)}

Hãy:
1. Flag bất kỳ điểm số nào có vẻ không nhất quán với hồ sơ
2. Kiểm tra recommendations có phù hợp với VST type và DSM-5 level không
3. Đề xuất điều chỉnh nếu cần
4. Trả về merged_result với điểm số đã hiệu chỉnh

Format: JSON với fields: adjustments[], merged_result, confidence_score (0-1)
      `
    }]
  })
  
  return JSON.parse(response.content[0].text)
}
```

---

## 4. AI Job Queue Management

```javascript
// Tạo AI job khi video upload xong
const createAiJob = async (videoId, childId) => {
  const { data: job } = await supabase
    .from('ai_jobs')
    .insert({
      observation_video_id: videoId,
      child_id: childId,
      status: 'queued',
      retry_count: 0,
      model_primary: 'gemini-2.5-flash',
      model_secondary: isPremiumPlan ? 'claude-sonnet-4-6' : null
    })
    .select()
    .single()
  
  // Trigger Edge Function
  await supabase.functions.invoke('process-ai-report', {
    body: { jobId: job.id }
  })
}

// Retry logic (chạy mỗi 15 phút qua pg_cron)
const retryFailedJobs = async () => {
  const { data: failedJobs } = await supabase
    .from('ai_jobs')
    .select('*')
    .eq('status', 'failed')
    .lt('retry_count', 3)
    .lt('last_attempt_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())

  for (const job of failedJobs) {
    await supabase
      .from('ai_jobs')
      .update({ 
        status: 'queued',
        retry_count: job.retry_count + 1,
        last_attempt_at: new Date().toISOString()
      })
      .eq('id', job.id)
    
    await supabase.functions.invoke('process-ai-report', {
      body: { jobId: job.id }
    })
  }
}
```

---

## 5. AI Report → hpDT Update Logic

```javascript
// Sau khi lưu ai_reports, update hpDT
const updateHpDT = async (childId, newReport) => {
  const { data: currentHpDT } = await supabase
    .from('hpdt_profiles')
    .select('*')
    .eq('child_id', childId)
    .single()

  // Weighted merge: 70% historical + 30% new report
  const newScores = {
    fine_motor:         blend(currentHpDT.fine_motor,         newReport.domain_scores.fine_motor,         0.3),
    gross_motor:        blend(currentHpDT.gross_motor,        newReport.domain_scores.gross_motor,        0.3),
    social_interaction: blend(currentHpDT.social_interaction, newReport.domain_scores.social_interaction, 0.3),
    language:           blend(currentHpDT.language,           newReport.domain_scores.language,           0.3),
    imitation:          blend(currentHpDT.imitation,          newReport.domain_scores.imitation,          0.3),
    cognition:          blend(currentHpDT.cognition,          newReport.domain_scores.cognition,          0.3),
  }

  const overall = calculateOverall(newScores)  // Weighted average

  await supabase
    .from('hpdt_profiles')
    .update({ ...newScores, overall_score: overall, last_updated: new Date() })
    .eq('child_id', childId)

  // Snapshot history
  await supabase
    .from('hpdt_history')
    .insert({ child_id: childId, ...newScores, overall_score: overall, source: 'ai_report' })
}

const blend = (old, fresh, freshWeight) => 
  Math.round(old * (1 - freshWeight) + fresh * freshWeight)
```

---

## 6. Cost Estimation

```
Gemini 3.5 Flash:
  - Input: $1.50/1M tokens
  - Output: $9.00/1M tokens
  - Video analysis: ~2,000-5,000 input tokens + ~1,000 output tokens
  - Cost per analysis: ~$0.003-0.008 (~₫75-200 / video)

Claude Sonnet 4.6 (cross-validate):
  - ~1,000 input + ~500 output tokens
  - Cost per validation: ~$0.005 (~₫125 / video)

Estimate 40 children × 2 videos/month:
  - Basic (Gemini only): 80 × $0.008 = $0.64/month
  - Enterprise (+ Claude): 80 × $0.013 = $1.04/month
  → Chi phí AI rất thấp ở MVP scale
```

---

## 7. Error Codes & Handling

```javascript
const AI_ERRORS = {
  'GEMINI_QUOTA_EXCEEDED': 'Vượt quota API. Retry sau 1 phút.',
  'VIDEO_TOO_LONG': 'Video quá dài cho AI xử lý. Tối đa 10 phút.',
  'INVALID_JSON': 'AI trả về format không hợp lệ. Retry.',
  'CONTEXT_OVERFLOW': 'Quá nhiều context. Giảm lịch sử hpDT xuống 2 tuần.',
  'NETWORK_ERROR': 'Lỗi mạng. Retry sau 5 phút.',
}

// Rate limiting: Max 10 concurrent AI jobs
// Queue: FIFO, không preempt
// Timeout: 5 phút / job (Gemini thường < 30s với video 10 phút)
```
