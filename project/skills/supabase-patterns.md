# Supabase Patterns — AI4Autism
> Các pattern hay dùng, anti-patterns cần tránh, và gotchas trong project này

---

## 1. Auth Pattern

```javascript
// context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) fetchProfile(session.user.id)
        else setProfile(null)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId) => {
    const { data } = await supabase
      .from('users')
      .select('*, children(*)')  // Join children cho parent
      .eq('id', userId)
      .single()
    setProfile(data)
    setLoading(false)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
```

---

## 2. Protected Route Pattern

```javascript
// Redirect nếu profile_complete = false
function ProtectedRoute({ children, requiredRole }) {
  const { user, profile, loading } = useAuth()
  
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" />
  
  // ⚠️ Kiểm tra profile_complete TRƯỚC role
  if (profile && !profile.profile_complete) {
    return <Navigate to="/complete-profile" />
  }
  
  if (requiredRole && profile?.role !== requiredRole) {
    return <Navigate to="/unauthorized" />
  }
  
  return children
}
```

---

## 3. Data Fetching Patterns

### Fetch với RLS (đúng cách)
```javascript
// ✅ ĐÚNG — RLS tự lọc theo user
const { data: children } = await supabase
  .from('children')
  .select(`
    id, name, date_of_birth, vst_type,
    hpdt_profiles(overall_score, milestone_level),
    vst_profiles(vst_name, avatar_3d_url)
  `)
  .order('name')

// ❌ SAI — Không filter thủ công khi RLS đã làm việc đó
const { data } = await supabase
  .from('children')
  .select('*')
  .eq('parent_id', userId)  // RLS đã làm điều này rồi
```

### Pagination
```javascript
const PAGE_SIZE = 20

const { data, count } = await supabase
  .from('observation_videos')
  .select('*', { count: 'exact' })
  .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
  .order('created_at', { ascending: false })
```

### Real-time subscription (cleanup đúng cách)
```javascript
useEffect(() => {
  const channel = supabase
    .channel('ai-report-' + childId)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'ai_reports',
      filter: `child_id=eq.${childId}`
    }, (payload) => {
      setLatestReport(payload.new)
      showNotification('Báo cáo mới sẵn sàng!')
    })
    .subscribe()

  // ⚠️ Phải cleanup để tránh memory leak
  return () => {
    supabase.removeChannel(channel)
  }
}, [childId])
```

---

## 4. Upload Pattern (Bunny.net via Edge Function)

```javascript
// pages/parent/VideoUpload.jsx
const uploadVideo = async (file) => {
  setUploading(true)
  setProgress(0)
  
  try {
    // 1. Xin upload token từ Edge Function
    const { data: { uploadUrl, videoId } } = await supabase.functions.invoke(
      'upload-video-token',
      { body: { childId, fileName: file.name, fileSize: file.size } }
    )
    
    // 2. Upload trực tiếp lên Bunny.net với progress tracking
    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100))
      }
    })
    
    await new Promise((resolve, reject) => {
      xhr.onload = () => xhr.status === 200 ? resolve() : reject()
      xhr.onerror = reject
      xhr.open('PUT', uploadUrl)
      xhr.send(file)
    })
    
    // 3. Thông báo backend: video đã upload xong
    await supabase.from('observation_videos').insert({
      child_id: childId,
      bunny_video_id: videoId,
      status: 'pending',
      upload_context: context
    })
    
    setSuccess(true)
  } catch (err) {
    setError('Không thể tải lên video. Vui lòng thử lại.')
  } finally {
    setUploading(false)
  }
}
```

---

## 5. Error Handling Pattern

```javascript
// lib/supabase-helpers.js
export async function safeQuery(queryFn) {
  try {
    const { data, error } = await queryFn()
    if (error) {
      console.error('Supabase error:', error)
      // Map lỗi Supabase → tiếng Việt
      if (error.code === 'PGRST116') {
        throw new Error('Không tìm thấy dữ liệu')
      }
      if (error.code === '42501') {
        throw new Error('Bạn không có quyền thực hiện thao tác này')
      }
      throw new Error(error.message)
    }
    return data
  } catch (err) {
    throw err
  }
}

// Dùng:
const children = await safeQuery(() => 
  supabase.from('children').select('*')
)
```

---

## 6. Anti-patterns cần tránh

```javascript
// ❌ KHÔNG làm thế này — expose service role key ra client
const supabase = createClient(url, SERVICE_ROLE_KEY)

// ❌ KHÔNG query không có limit — sẽ fetch toàn bộ table
supabase.from('audit_logs').select('*')  // audit_logs có thể có triệu rows

// ❌ KHÔNG hardcode user_id — dùng auth.uid() trong RLS
supabase.from('children').select('*').eq('parent_id', 'abc123')

// ❌ KHÔNG dùng select('*') cho tables có sensitive data
// Luôn chỉ định columns cần thiết
supabase.from('ai_reports').select('id, report_json, created_at')

// ❌ KHÔNG quên cleanup real-time subscriptions
// Luôn return cleanup function trong useEffect
```

---

## 7. Common Queries trong Project

```javascript
// Lấy quota còn lại của parent
const getVideoQuota = async (childId) => {
  const { data } = await supabase
    .from('video_upload_quotas')
    .select('videos_uploaded, quota_limit, cycle_start')
    .eq('child_id', childId)
    .gte('cycle_start', getCurrentCycleStart())
    .single()
  
  return {
    used: data?.videos_uploaded ?? 0,
    limit: data?.quota_limit ?? 2,
    remaining: (data?.quota_limit ?? 2) - (data?.videos_uploaded ?? 0)
  }
}

// Lấy AI report mới nhất
const getLatestReport = async (childId) => {
  const { data } = await supabase
    .from('ai_reports')
    .select('id, report_json, created_at, observation_videos(video_url)')
    .eq('child_id', childId)
    .eq('status', 'done')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  return data
}

// Lấy bài tập đang active
const getActiveExercises = async (childId) => {
  const { data } = await supabase
    .from('exercise_assignments')
    .select(`
      id, due_date, frequency_per_week,
      exercises(name, description, domain, duration_minutes, difficulty),
      exercise_sessions(id, completed_at, completion_rate)
    `)
    .eq('child_id', childId)
    .in('status', ['assigned', 'in_progress'])
    .order('due_date', { ascending: true })
  return data
}
```
