# UI/UX Rules — AI4Autism
> Cập nhật: 22/05/2026 | Dựa trên scan code thực tế + specs từ Rachel

---

## ⚠️ QUAN TRỌNG — Môi trường Test vs Final Output

| | Môi trường | Stack |
|--|-----------|-------|
| **Test / Demo** | Web browser (Expo Web / React web) | Dùng để xem nhanh, review UI |
| **Final Output** | **Mobile App — Android & iOS** | React Native + Expo |

### Nguyên tắc viết code vì điều này:

- **KHÔNG dùng CSS / HTML / web-only APIs** — Không có `div`, `className`, `style` kiểu web
- **Dùng React Native primitives**: `View`, `Text`, `TouchableOpacity`, `ScrollView`, `FlatList`
- **Styling**: `StyleSheet.create({})` — không phải Tailwind hay inline CSS string
- **Navigation**: `@react-navigation/native` — không phải React Router DOM
- **Fonts & icons**: Expo-compatible (`@expo/vector-icons`, không phải Lucide web)
- **Storage**: `AsyncStorage` — không phải `localStorage`
- **Camera / File picker**: `expo-image-picker` — không phải `<input type="file">`
- **Video playback**: `expo-av` — không phải `<video>` HTML tag
- **Platform check khi cần**: `Platform.OS === 'ios'` / `'android'`
- **Safe area**: Luôn wrap màn hình với `SafeAreaView` từ `react-native-safe-area-context`
- **Keyboard**: Dùng `KeyboardAvoidingView` với `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`

### Ngoại lệ — Specialist App chạy trên Web
Specialist dùng web app (`ai4autism-app` React + Vite) → được phép dùng HTML/CSS/Tailwind bình thường.  
Tất cả các role khác (Parent, Teacher) → **React Native only**.

---

## 1. Design Principles

- **Đơn giản cho phụ huynh**: Tránh quá nhiều options trên 1 màn hình
- **Tiếng Việt 100%**: Mọi text UI, error message, label đều bằng tiếng Việt
- **Tone ấm áp**: App cho trẻ đặc biệt → không lạnh lùng kiểu clinical
- **Mobile-first**: Thiết kế cho 375px trước, sau đó scale lên tablet
- **Màu domain nhất quán**: 6 lĩnh vực → 6 màu cố định (xem mục 6)

---

## 2. App Structure — Tổng quan

```
RootNavigator
├── LoginScreen                  (auth/LoginScreen.js)
├── ProfileCompletionScreen      (auth/ProfileCompletionScreen.js) ← bắt buộc khi profile_complete=false
├── ParentNavigator              (role: parent)
├── TeacherNavigator             (role: teacher)
└── SpecialistNavigator [CẦN BUILD]  (role: specialist)
```

---

## 3. PARENT — Navigation (5 tabs)

### Tab Bar (đã build — ParentNavigator.js)
```
Tab 1: 🏠 Trang chủ    → HomeStack (Dashboard + nested screens)
Tab 2: 🎬 Thư viện     → LibraryScreen
Tab 3: 💬 [FAB chat]   → ChatScreen   ← Center Floating Action Button, nổi lên trên tab bar
Tab 4: 📈 Tiến trình   → ProgressScreen
Tab 5: ⚙️ Cài đặt     → SettingsScreen
```

> **Chat FAB**: Nổi lên trên tab bar (marginTop: -16), background `colors.primary`, border 3px white, shadow. Khi active → `colors.primaryDark`. Tab bar ẩn khi đang trong ChatScreen.

### HomeStack (nested trong Tab 1)
```
DashboardScreen     ← màn hình chính
SOSScreen           ← navigate từ SOS banner trên Dashboard
AIReportScreen      ← navigate từ AI advice card
ProfileScreen       ← navigate từ header avatar
```

---

## 4. PARENT — DashboardScreen (đã build)

File: `screens/parent/DashboardScreen.js`

### Layout từ trên xuống

**1. Greeting Header**
```
"Xin chào, [Tên PH]! 👋"
Sub: "Chăm sóc [tên bé] hôm nay"
Avatar icon (→ navigate ProfileScreen)
Bell notification badge
```

**2. Multi-child Selector Strip** *(nếu PH có >1 con)*
```
Horizontal scroll, chip buttons mỗi tên bé
Active chip: màu primary, bold
Tap chip → switch active child → reload toàn bộ data
```

**3. hpDT Score Card**
```
Left: Circle gauge → overall_score %
      Màu theo milestone: <50% đỏ, <70% cam, ≥70% xanh
Right: 6 mini horizontal bars (mỗi domain 1 màu)
       Labels: Giao tiếp / Xã hội / Hành vi / Cảm giác / Vận động / Nhận thức

Bottom: SVG line chart (trend)
  - Toggle: [Tuần] [Tháng]
  - Data: hpdt_history.overall_score
  - X-axis: dates, Y-axis: 0-100
  - Gradient fill dưới đường (LinearGradient)
```

**4. Radar Chart (6 axes)**
```
Axes (theo DOMAIN_AXES order):
  communication → "Giao tiếp"
  social        → "Xã hội"
  behavior      → "Hành vi"
  sensory       → "Cảm giác"
  motor         → "Vận động"
  cognitive     → "Nhận thức"

Dùng react-native-svg (Svg, Polygon, Line, Text, Circle)
Polygon score: màu primary với opacity 0.3
Polygon max: stroke dashed
```

**5. AI Advice Card**
```
Source: ai_daily_advice table (field: advice_title, advice_text, domain)
Icon domain (màu domain), tiêu đề đậm, text body
Nút "Đã đọc ✓" → mark read trong DB, card collapse
Fallback: "Upload video để nhận lời khuyên cá nhân hóa"
```

**6. CTA Buttons (3 nút)**
```
[📹 Upload Video]   → Mở Modal VideoUpload (không navigate)
[🎬 Thư viện]       → Navigate Tab LibraryScreen
[📓 Nhật ký]        → Mở Modal Journal (không navigate)
```

**Modal Upload Video:**
```
Chọn bối cảnh: [Nhà / Trường / Công viên / Khác]
Trạng thái bé: [Bình tĩnh / Hưng phấn / Khó chịu / Tập trung / Mất tập trung]
Progress bar upload (real %)
Quota display: "Còn X/Y video trong chu kỳ này"
```

**Modal Nhật ký:**
```
Shortcuts chips: [Bé đi ngủ / Bé ăn tối / Bé tắm / Bé chơi / Bé đi học]
Thời gian: [Sáng / Trưa / Chiều / Tối]
Loại hoạt động: [Học tập / Vui chơi / Sinh hoạt / Trị liệu / Ngoài trời]
Free text input (optional)
```

**7. SOS Banner**
```
Màu đỏ nhạt (warning bg), icon 🆘
Text: "Bé đang khó chịu? Nhấn để được hỗ trợ ngay"
Tap → navigate SOSScreen
```

**8. IEP Goals**
```
List goals từ iep_goals table
Mỗi goal: tên mục tiêu + progress bar (current_progress_pct%)
Màu bar: theo domain
Deadline badge
```

**9. Home Activities Checklist**
```
Source: exercise_assignments với role=parent
Mỗi bài tập:
  ☐ / ☑  checkbox → log exercise_session nhanh
  Tên bài + domain chip + duration
  📹 quick upload button → mở Modal Upload với context pre-filled
```

---

## 5. PARENT — Các screens khác (đã build)

### SOSScreen (`screens/parent/SOSScreen.js`)
```
3 Calming Tools (expandable accordion):
  🫁 Nhịp thở   → Kỹ thuật 4-4-4 (4 bước)
  👁️ Thị giác   → Kỹ thuật 5-4-3-2-1 (5 bước)
  🎵 Âm thanh   → Âm nhạc xoa dịu (4 bước)

Tap tool card → expand với steps + tip
Chỉ 1 tool mở cùng lúc (accordion behavior)

AI Support Section (dưới cùng):
  "Hỏi VST để được hỗ trợ thêm"
  CTA button → navigate ChatScreen
```

### LibraryScreen (`screens/parent/LibraryScreen.js`)
```
Section 1: Video quan sát của bé
  Filter: [Tất cả / Hôm nay / Tuần này]
  VideoCard: thumbnail placeholder, context badge (Nhà/Trường),
             role badge (Phụ huynh/Giáo viên), duration, status chip
  Status processing → spinner, status ready → play icon
  Tap ready video → navigate/modal AIReportScreen

Section 2: Thư viện P2P (Parent-to-Parent)
  Card: tiêu đề, domain chip màu, difficulty badge, duration
  Status: "Sắp ra mắt 🔒" stub cho các videos chưa có

Section 3: Video Modeling mẫu
  Source: content_library table (Bunny.net HLS)
  Filter theo domain
```

### ProgressScreen (`screens/parent/ProgressScreen.js`)
```
Trend bars: so sánh tuần này vs tuần trước (mỗi domain)
Domain breakdown: từng domain score + delta arrow (↑↓)
Milestones timeline: các cột mốc đã đạt
Milestone level badge: 1-6 với mô tả
```

### ChatScreen (`screens/parent/ChatScreen.js`)
```
VST AI Chat — PH chat với bản sao số của GIÁO VIÊN:

Header:
  Avatar 3D của GV (vst_teacher_profiles.avatar_3d_url)
  Tên VST: "Cô Lan" / "Thầy Minh" (tên giáo viên thật)
  VST code: "VST-BIC-001" (hiện nhỏ, optional)
  Status: 🟢 Online 24/7

Message list: bubble chat style
Quick Prompts chips:
  ["Bé ăn không ngon", "Bé mất ngủ", "Bé khó chịu hôm nay",
   "Hỏi về bài tập", "Bé có tiến bộ không?"]
Voice button 🎤 → speech-to-text (expo-speech)
Input: text + send button

AI system prompt (ẩn, gửi lên mỗi lần chat):
  "Bạn là [vst_name] — phiên bản AI của giáo viên [tên thật].
   Phong cách: [teaching_style_json]
   Hồ sơ trẻ: [child profile + hpDT đầy đủ]
   Lịch sử học: [exercise_sessions gần nhất]"

Lưu vào: vst_chat_sessions + vst_chat_messages
Ghi vào: vst_activity_logs (activity_type: 'chat_message') → AI học thêm

⚠️ Load VST đúng cách:
  child_id của PH → teacher_child_assignments (is_primary = true)
  → teacher_id → vst_teacher_profiles
  Không hardcode vst_name, phải lấy từ DB
```

### SettingsScreen (`screens/parent/SettingsScreen.js`)
```
Account: Thông tin phụ huynh, đổi mật khẩu
Thông báo: toggle từng loại notification
Ngôn ngữ: [Tiếng Việt / English]
Gói dịch vụ: hiện plan hiện tại + nút "Nâng cấp"
Hỗ trợ: FAQ, liên hệ
Đăng xuất: màu đỏ, confirm dialog
```

---

## 6. TEACHER — Navigation (5 tabs)

### Tab Bar (đã build — TeacherNavigator.js)
```
Tab 1: 🏠 Trang chủ   → StudentStack (Dashboard + StudentDetail + LogSession)
Tab 2: 🏫 Dạy học     → TeacherTeachingScreen
Tab 3: 🎬 Thư viện    → TeacherLibraryScreen
Tab 4: 📊 Báo cáo     → TeacherReportScreen
Tab 5: ⚙️ Cài đặt    → TeacherProfileScreen (cũng dùng cho Settings)
```

### StudentStack (nested trong Tab 1)
```
TeacherDashboardScreen   ← list học sinh
StudentDetailScreen      ← chi tiết từng trẻ
LogSessionScreen         ← ghi phiên can thiệp
```

---

## 7. TEACHER — Screens (đã build)

### TeacherDashboardScreen (`screens/teacher/TeacherDashboardScreen.js`)
```
Thông tin học sinh quản lý:
  Danh sách trẻ được assign (teacher_child_assignments)
  Mỗi thẻ: tên trẻ, tuổi, hpDT overall_score (%), mức độ can thiệp DSM-5
  DSM-5 badge màu: Level 1 (xanh) / Level 2 (cam) / Level 3 (đỏ)
  Tap → navigate StudentDetailScreen

Phiên can thiệp gần đây:
  Các bài tập đã hoàn thành trong phiên của từng trẻ
  Badge phân biệt: [Giáo viên 🏫] vs [Phụ huynh 🏠]
  (source: exercise_sessions.completed_by_role)

Kênh trao đổi với Phụ huynh:
  Tin nhắn nhanh từ PH: báo ăn ngủ, cập nhật ở nhà
  Unread badge
  Tap → navigate Messages
```

### TeacherTeachingScreen (`screens/teacher/TeacherTeachingScreen.js`)
```
2 loại upload khác nhau — phân biệt rõ:

─── [📹 Upload video quan sát] ───────────────────────────
  Mục đích: Quay trẻ → AI phân tích → sinh báo cáo hpDT
  Form:
    • Chọn trẻ (dropdown danh sách được assign)
    • Bối cảnh: [Lớp học / Ngoài trời / Giờ ăn / Giờ chơi / Khác]
    • Trạng thái hành vi hiện tại: [Bình tĩnh / Hưng phấn / Khó chịu / Tập trung / Mất tập trung]
    • Ghi chú cho AI (optional)
  → Upload → AI phân tích → ai_reports → update hpDT

─── [🎓 Upload bài giảng / bài tập] ──────────────────────
  Mục đích: GV tạo content → vào thư viện → PH/trẻ dùng
  Form:
    • Tiêu đề bài giảng *
    • Loại nội dung:
        [Bài tập] → trẻ thực hành
        [Bài giảng] → PH xem, học theo
        [Video mẫu] → GV demo kỹ năng
    • Trẻ nên làm ở đâu:
        [🏫 Tại lớp] [🏠 Tại nhà] [🌳 Ngoài trời]
        [🏥 Phòng trị liệu] [📍 Khác]
    • Bài tập này là gì: [TextInput tự do — GV mô tả]
    • Lĩnh vực:
        [Giao tiếp] [Xã hội] [Hành vi]
        [Cảm giác] [Vận động] [Nhận thức]
    • Phù hợp DSM: [Mức 1] [Mức 2] [Mức 3] [Tất cả]
    • Tags:
        Chips gợi ý sẵn: ABA, PECS, Floortime, Luân phiên,
        Giao tiếp mắt, Vận động tinh, Bữa ăn, Giờ chơi...
        + TextInput nhập tag tự do → Enter → hiện chip
        ※ Label AI tự động sẽ bổ sung sau (Phase 2)
  → Upload + mã hóa AES-256 → Bunny.net
  → Lưu vào teacher_content_library (status: published)
  → Tự động xuất hiện trong:
      TeacherLibraryScreen (tab "Của tôi")
      ParentLibraryScreen (section "Video Modeling")

─── [🎬 Xem thư viện Video Modeling] ─────────────────────
  → navigate TeacherLibraryScreen

─── [👤 Thông tin học sinh] ──────────────────────────────
  → navigate StudentDetailScreen
```

### StudentDetailScreen (`screens/teacher/StudentDetailScreen.js`)
```
Header: tên bé, tuổi, avatar, hpDT score + radar mini
Tabs: [Hồ sơ] [Bài tập] [Phiên gần đây] [Báo cáo AI]
Chuyển hướng đến chi tiết bài tập → log session
```

---

## 8. SPECIALIST — Navigation (5 screens, web app)

> ⚠️ **Specialist chạy trên Web** (`ai4autism-app` React), không phải mobile.  
> Route prefix: `/specialist/`

### Routes (cần build mới)
```
/specialist/dashboard     → MonitorScreen    (đã có skeleton, cần redesign)
/specialist/orchestrator  → OrchestratorScreen  [MỚI — chưa có]
/specialist/deep-dive     → DeepDiveScreen       [MỚI — chưa có]
/specialist/simulation    → SimulationScreen     [MỚI — chưa có]
/specialist/wildcard      → WildcardScreen       [MỚI — placeholder]
```

---

## 9. SPECIALIST — Screen Details

### Screen 1: Monitor / Dashboard (`/specialist/dashboard`)

**Hệ thống cảnh báo (Alert Feed)**
```
Real-time alerts từ hpdt_history (thay đổi đột ngột)
Ví dụ: "⚠️ Bé Minh An: Hành vi lặp lại tăng 40% trong 3 ngày"
Severity: 🔴 Khẩn / 🟡 Chú ý / 🟢 Bình thường
Click alert → navigate DeepDive với child pre-selected
```

**Multi-Twin Monitor (bảng tổng quan)**
```
Table/Grid: tất cả trẻ đang quản lý cùng lúc
Columns: Tên | Tuổi | DSM-5 | hpDT % | Trend ↑↓ | Flexibility | HRV | Team Status
DSM-5 filter buttons: [Tất cả] [Level 1] [Level 2] [Level 3]
Sort: theo score, theo tên, theo ngày cập nhật
```

**Chỉ số chuyên sâu (mỗi thẻ trẻ)**
```
Flexibility Score: khả năng thích nghi / chuyển đổi hoạt động (0-100)
HRV Status: Heart Rate Variability — Ổn định / Căng thẳng / Không có data
Hybrid Team Status: 
  [PH] last active: X ngày trước
  [GV] last session: X ngày trước
  [AI] last report: X ngày trước
```

---

### Screen 2: Orchestrator (`/specialist/orchestrator`)

**Hybrid Team Hub**
```
Mỗi trẻ: Panel phối hợp nhóm can thiệp
  👨‍👩‍👦 Phụ huynh: last contact, messages unread, compliance rate
  👩‍🏫 Giáo viên: last session, sessions this week, notes
  🤖 AI VST: last advice, chat frequency, child engagement

Action buttons:
  [📨 Gửi tin nhắn cho PH]
  [📝 Giao thêm nhiệm vụ cho GV]
  [🔄 Cập nhật hướng dẫn cho AI VST]
```

**Reverse Prompting Tool (AI nâng cao)**
```
Input field: "Mục tiêu cuối cùng muốn đạt"
Ví dụ: "Bé có thể tự xúc ăn trong 2 tuần tới"

AI xử lý:
  → Phân tích hpDT hiện tại
  → Xây dựng lộ trình ngược (backward chaining)
  → Output: danh sách micro-tasks theo thứ tự
  → Assign tự động cho PH / GV / VST

Hiển thị: timeline dạng bước với assignee tags
```

**Nhật ký can thiệp (Auto-summary)**
```
AI tự tổng hợp hàng tuần từ:
  - exercise_sessions (GV + PH)
  - child_daily_logs (PH)
  - ai_reports (AI)
  - vst_chat_sessions (AI)

Output: "Tóm tắt tuần của [tên bé]" — Specialist xem + thêm ghi chú
Export: PDF / copy to clipboard
```

**Hộ chiếu năng lực (Competency Milestones)**
```
Timeline dọc: các milestone đã đạt
Mỗi milestone: tên kỹ năng, ngày đạt, nguồn xác nhận (AI / GV / Specialist)
Nút [✅ Verify] cho milestone pending
Nút [🏅 Chia sẻ với PH] → push notification cho phụ huynh
```

---

### Screen 3: Deep Dive (`/specialist/deep-dive`)

```
Child selector: dropdown hoặc search
Sau khi chọn trẻ → load toàn bộ:

Panel 1: Hồ sơ y khoa
  - child_clinical_profiles (3 sessions đầu intake)
  - sensory_profiles (8 kênh × 4 mức độ)
  - Comorbidities, medications

Panel 2: Phân tích AI reports (timeline)
  - Tất cả ai_reports theo thứ tự thời gian
  - So sánh domain scores qua các tuần
  - clinical_notes (full — chỉ specialist thấy)
  - Recommendations history

Panel 3: Dữ liệu hành vi
  - child_daily_logs heatmap (35+ fields)
  - Behavior pattern analysis
  - Correlation: sleep/food → behavior

Panel 4: IEP tracking
  - iep_goals với progress timeline
  - intervention_checkpoints
  - 12-week intervention plan progress
```

---

### Screen 4: Sim Lab — Simulation (`/specialist/simulation`)

```
[Phòng thí nghiệm — thử nghiệm kịch bản can thiệp]

Child selector + Load Digital Twin data

Simulation Scenarios:
  Chọn kịch bản: [Thay đổi bài tập / Tăng cường độ / Thêm therapy / Giảm stimuli]
  Input parameters: duration, frequency, modality
  
AI chạy simulation dựa trên hpDT:
  → Dự báo phản ứng của trẻ (% cải thiện từng domain)
  → Confidence interval (high/medium/low)
  → Risk flags nếu kịch bản có thể gây overload

Output:
  Comparison chart: Baseline vs Predicted (4-week / 8-week / 12-week)
  Recommendation: "Kịch bản này phù hợp" / "Cân nhắc điều chỉnh..."

Nút [Áp dụng kịch bản này] → tạo intervention_plan mới
Nút [Lưu kết quả simulation]
```

---

### Screen 5: Wildcard (`/specialist/wildcard`)

```
[Màn hình linh hoạt — placeholder có cấu trúc]

Header: "Tính năng đặc biệt / Beta"
Status badge: 🔒 Bảo mật cao / 🧪 Beta / ⭐ Đặc quyền

Section: Beta Features (stub cards)
  - [🔒 Phân tích gene & sinh học] — Sắp ra mắt
  - [🧪 Protocol thử nghiệm mới] — Beta tester only
  - [⚡ Quyền can thiệp khẩn cấp] — Yêu cầu xác thực 2FA

Section: Advanced Tools
  Nơi để thêm features mới trong tương lai mà không cần restructure nav

Cấu trúc: Grid 2 cột, cards với icon + title + description + status badge
```

---

## 10. Color System

```javascript
// 6 Domain colors (nhất quán toàn app)
domain: {
  communication: '#6366F1',  // Giao tiếp — Tím
  social:        '#10B981',  // Xã hội — Xanh lá
  behavior:      '#F59E0B',  // Hành vi — Vàng cam
  sensory:       '#EC4899',  // Cảm giác — Hồng
  motor:         '#3B82F6',  // Vận động — Xanh dương
  cognitive:     '#8B5CF6',  // Nhận thức — Tím đậm
}

// App colors (từ lib/colors.js)
primary:       '#6366F1'
primaryDark:   '#4F46E5'
secondary:     '#10B981'   // Teacher app accent
secondaryDark: '#059669'
lavender:      '#A78BFA'

bg:            '#F8FAFC'
bgCard:        '#FFFFFF'
border:        '#E2E8F0'
textPrimary:   '#1E293B'
textSecondary: '#64748B'
textLight:     '#94A3B8'
```

---

## 11. Empty States & Error Messages (tiếng Việt)

### Empty States
```
Dashboard — chưa có báo cáo:
  "Hãy upload video đầu tiên của bé để bắt đầu hành trình 📹"
  CTA: "Upload video ngay"

Exercises — chưa có bài tập:
  "Bài tập sẽ được tạo sau khi AI phân tích video của bé 🎯"

Library — chưa có video:
  "Chưa có video nào. Bắt đầu ghi lại khoảnh khắc của bé! 🎬"

Progress — chưa có data:
  "Cần ít nhất 2 tuần dữ liệu để xem xu hướng tiến trình 📊"

Chat — chưa có tin nhắn:
  "Bắt đầu trò chuyện với [Cô An / Thầy An] — Giáo viên bóng ảo của bé 💬"
```

### Error Messages
```
Upload failed:        "Không thể tải lên video. Kiểm tra kết nối và thử lại."
Video too large:      "Video quá lớn (tối đa 500MB). Hãy nén hoặc cắt bớt."
Quota exceeded:       "Đã dùng hết video trong chu kỳ này. Reset vào [ngày]."
Session expired:      "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại."
Network error:        "Không có kết nối mạng. Vui lòng thử lại."
Permission denied:    "Bạn không có quyền xem thông tin này."
Report not ready:     "Báo cáo đang được xử lý. Chúng tôi sẽ thông báo khi xong."
```

---

## 12. Loading States

```
Page load:        Skeleton loader (KHÔNG dùng spinner quay)
Button submit:    Spinner trong nút + disabled
Upload:           Progress bar thật (%) — không fake
AI processing:    "Đang phân tích video của bé..." + animation nhẹ
Timeout > 30s:    "Đang mất nhiều thời gian hơn bình thường..." + "Tiếp tục chờ"
Real-time data:   Shimmer effect trên cards
```

---

## 13. Navigation Notes cho Developer

### Specialist Web App — Router setup cần thêm
```jsx
// App.jsx — Thêm routes specialist mới
<Route path="/specialist/dashboard"    element={<MonitorScreen />} />
<Route path="/specialist/orchestrator" element={<OrchestratorScreen />} />
<Route path="/specialist/deep-dive"    element={<DeepDiveScreen />} />
<Route path="/specialist/simulation"   element={<SimulationScreen />} />
<Route path="/specialist/wildcard"     element={<WildcardScreen />} />
```

### Mobile — RootNavigator cần thêm SpecialistNavigator
```javascript
// RootNavigator.js — Hiện tại specialist bị redirect về TeacherNavigator
// Cần tách riêng:
} : profile?.role === 'specialist' ? (
  <Stack.Screen name="SpecialistApp" component={SpecialistNavigator} />
) : profile?.role === 'teacher' ? (
  <Stack.Screen name="TeacherApp" component={TeacherNavigator} />
) : (
  <Stack.Screen name="ParentApp" component={ParentNavigator} />
)}
```

### Domain Labels (nhất quán — dùng DOMAIN_LABELS constant)
```javascript
// ĐÃ ĐỊNH NGHĨA trong DashboardScreen.js — copy sang mọi screen cần dùng
const DOMAIN_LABELS = {
  communication: 'Giao tiếp',
  social:        'Xã hội',
  behavior:      'Hành vi',
  sensory:       'Cảm giác',
  motor:         'Vận động',
  cognitive:     'Nhận thức',
}
```
