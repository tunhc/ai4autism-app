import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
}

// ── Dùng service_role key nếu có (bypass RLS — chỉ dành cho pilot/dev) ──
// Khi Supabase Auth hoạt động lại, đổi về SUPABASE_ANON_KEY
const EFFECTIVE_KEY = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, EFFECTIVE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ── Auth helpers ──────────────────────────────────────────────────────────────

/**
 * Đăng nhập bằng legacy_id — truy vấn trực tiếp bảng public.users.
 * Không phụ thuộc auth.signInWithPassword (đang bị lỗi 500).
 */
export async function signInByLegacyId(legacyId) {
  const { data, error } = await supabase
    .from('users')
    .select('*, centers(center_code, name, address)')
    .eq('legacy_id', legacyId.trim())
    .maybeSingle();
  if (error) throw new Error('Lỗi truy vấn: ' + error.message);
  if (!data) throw new Error('Không tìm thấy tài khoản với mã: ' + legacyId);
  return data;
}

export async function signIn(identifier, password, centerCode = 'BIC-HCM') {
  // Legacy auth flow — giữ lại để tương thích, nhưng sẽ thất bại khi auth schema bị lỗi
  const normalizedIdentifier = identifier.trim();
  const loginEmail = normalizedIdentifier.includes('@')
    ? normalizedIdentifier
    : await resolveLoginEmail(centerCode, normalizedIdentifier);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: loginEmail,
    password,
  });
  if (error) throw error;
  return data;
}

export async function resolveLoginEmail(centerCode, legacyId) {
  const { data, error } = await supabase.rpc('resolve_login_email', {
    center_code: centerCode,
    legacy_id: legacyId,
  });

  if (error) {
    throw new Error('Chua cau hinh bo phan giai legacy_id tren database. Vui long tao RPC resolve_login_email.');
  }

  const resolvedRow = Array.isArray(data) ? data[0] : data;
  const resolvedEmail = typeof resolvedRow === 'string'
    ? resolvedRow
    : resolvedRow?.email || resolvedRow?.login_email || resolvedRow?.auth_email;

  if (!resolvedEmail) {
    throw new Error('Khong tim thay tai khoan voi ma nguoi dung nay.');
  }

  return resolvedEmail;
}

export async function signOut() {
  // Best-effort — auth session có thể không tồn tại khi dùng legacy login
  try {
    const { error } = await supabase.auth.signOut();
    if (error) console.warn('signOut warning:', error.message);
  } catch { /* ignore */ }
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

// ── Profile helpers ───────────────────────────────────────────────────────────

export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*, centers(center_code, name, address)')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

// ── Children helpers ──────────────────────────────────────────────────────────

export async function getChildInfo(childId) {
  const { data, error } = await supabase
    .from('children')
    .select('id, child_code, centers(center_code)')
    .eq('id', childId)
    .single();
  if (error) throw error;
  return {
    childId: data.id,
    childCode: data.child_code || null,
    centerCode: data.centers?.center_code || null,
  };
}

export async function getChildrenByParent(parentId) {
  const { data, error } = await supabase
    .from('children')
    .select(`
      *,
      hpdt_profiles(
        communication_score, social_score, behavior_score,
        sensory_score, motor_score, cognitive_score,
        overall_score, last_updated
      )
    `)
    .eq('parent_id', parentId)
    .eq('is_active', true);
  if (error) throw error;
  // Normalize: hpdt_profiles có thể trả về object (1-1) hoặc array
  return (data || []).map(child => ({
    ...child,
    hpdt_profiles: Array.isArray(child.hpdt_profiles)
      ? child.hpdt_profiles
      : child.hpdt_profiles ? [child.hpdt_profiles] : [],
  }));
}

export async function getChildrenByTeacher(teacherId) {
  const { data, error } = await supabase
    .from('teacher_child_assignments')
    .select(`
      children(
        *,
        hpdt_profiles(*)
      )
    `)
    .eq('teacher_id', teacherId)
    .eq('is_active', true);
  if (error) throw error;
  return data?.map(r => r.children) || [];
}

// ── Exercises helpers ─────────────────────────────────────────────────────────

export async function getExerciseAssignments(childId, assignedToRole) {
  const { data, error } = await supabase
    .from('exercise_assignments')
    .select(`
      *,
      exercises(name, description, domain, difficulty, exercise_type),
      exercise_sessions(status, score, completed_at)
    `)
    .eq('child_id', childId)
    .eq('assigned_to_role', assignedToRole)
    .in('status', ['active', 'assigned', 'in_progress'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// ── Video helpers ─────────────────────────────────────────────────────────────

/**
 * Lưu một video record vào bảng observation_videos sau khi upload lên Bunny.
 * Dùng upsert theo bunny_video_id để tránh duplicate.
 */
export async function saveObservationVideo(childId, videoData) {
  const record = {
    child_id: childId,
    video_url: videoData.video_url || videoData.playUrl || null,
    bunny_video_id: videoData.videoGuid || videoData.bunny_video_id || null,
    bunny_collection_id: videoData.collectionId || videoData.bunny_collection_id || null,
    provider: 'bunny',
    video_status: videoData.video_status || 'ready',
    title: videoData.title || null,
    thumbnail_url: videoData.thumbnail_url || null,
    duration_seconds: videoData.duration_seconds || null,
    recorded_at: videoData.recorded_at || new Date().toISOString(),
    notes: videoData.notes || null,
    context: videoData.context || null,
    uploaded_by_role: videoData.uploaded_by_role || 'parent',
  };

  // Upsert theo bunny_video_id nếu có, tránh tạo trùng record
  if (record.bunny_video_id) {
    const { data, error } = await supabase
      .from('observation_videos')
      .upsert(record, { onConflict: 'bunny_video_id', ignoreDuplicates: false })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('observation_videos')
    .insert(record)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getObservationVideos(childId) {
  const { data, error } = await supabase
    .from('observation_videos')
    .select('*')
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;

  const dbVideos = (data || []).map(normalizeVideoRecord);

  // Nếu DB chưa có video nào với Bunny URL, thử fetch từ Bunny collection của bé
  const hasBunnyVideos = dbVideos.some(v => v.provider === 'bunny' && v.playback_url);
  if (!hasBunnyVideos) {
    try {
      const { listBunnyChildVideos } = await import('./bunny');
      const bunnyVideos = await listBunnyChildVideos(childId);

      // Sync các video Bunny chưa có trong DB
      if (bunnyVideos.length) {
        const dbBunnyIds = new Set(dbVideos.map(v => v.bunny_video_id).filter(Boolean));
        const newVideos = bunnyVideos.filter(v => !dbBunnyIds.has(v.bunny_video_id));

        for (const v of newVideos) {
          try { await saveObservationVideo(childId, v); } catch { /* best-effort */ }
        }

        // Merge: ưu tiên DB records, bổ sung Bunny records chưa có
        const merged = [...dbVideos];
        for (const bv of bunnyVideos) {
          if (!dbBunnyIds.has(bv.bunny_video_id)) {
            merged.push(normalizeVideoRecord(bv));
          }
        }
        return merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }
    } catch (bunnyErr) {
      console.warn('Bunny fallback error:', bunnyErr.message);
    }
  }

  return dbVideos;
}

export function getVideoPlaybackUrl(video) {
  return (
    video?.video_url ||
    video?.bunny_video_url ||
    video?.cloudinary_secure_url ||
    video?.secure_url ||
    video?.cloudinary_url ||
    video?.cloudinary_backup_url ||
    video?.url ||
    null
  );
}

export function normalizeVideoRecord(video) {
  const playbackUrl = getVideoPlaybackUrl(video);
  const status = video?.status || video?.video_status || video?.processing_status;
  const hasReport = Boolean(video?.ai_reports?.length || video?.latest_report_id || video?.report_id || video?.ai_report_id);

  // Nếu có URL playback hợp lệ → coi như ready (nhiều video bị kẹt "processing" trong DB)
  const hasValidUrl = playbackUrl && playbackUrl !== 'undefined' && playbackUrl.startsWith('http');

  let thumbnailUrl = video?.thumbnail_url || null;
  if (!thumbnailUrl && playbackUrl && playbackUrl.includes('.b-cdn.net')) {
    // Bunny Stream typically has /play_....mp4 or /playlist.m3u8
    thumbnailUrl = playbackUrl.replace(/(play_.*?\.mp4|playlist\.m3u8).*$/, 'thumbnail.jpg');
  }

  return {
    ...video,
    playback_url: playbackUrl,
    thumbnail_url: thumbnailUrl,
    video_status: hasReport || hasValidUrl
      ? 'ready'
      : status === 'done' || status === 'completed' || status === 'ready'
        ? 'ready'
        : status || 'pending',
    provider: video?.provider || video?.source_provider || (video?.cloudinary_public_id ? 'cloudinary' : null),
  };
}

export async function getVideoModelingLibrary(childId) {
  const { data, error } = await supabase
    .from('video_modeling_library')
    .select('*')
    .or(`child_id.eq.${childId},is_shared.eq.true`)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// ── Journal helpers ───────────────────────────────────────────────────────────

export async function getJournalEntries(childId, limit = 20) {
  const { data, error } = await supabase
    .from('journals')
    .select('*')
    .eq('child_id', childId)
    .order('entry_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function getChildDailyLogs(childId, limit = 20) {
  const { data, error } = await supabase
    .from('child_daily_logs')
    .select('*')
    .eq('child_id', childId)
    .order('log_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getParentJournalEntries(childId, limit = 20) {
  try {
    const logs = await getChildDailyLogs(childId, limit);
    if (logs.length) {
      return logs.map(log => ({
        id: log.id,
        child_id: log.child_id,
        entry_date: log.log_date || log.created_at,
        content: log.notes || log.content || log.summary || '',
        mood_tags: log.mood ? [log.mood] : log.mood_tags,
        activity_tags: log.activity_type ? [log.activity_type] : log.activity_tags,
        created_at: log.created_at,
        source_table: 'child_daily_logs',
      }));
    }
  } catch (error) {
    if (error?.code !== '42P01' && error?.code !== 'PGRST205') throw error;
  }

  return getJournalEntries(childId, limit);
}

export async function createJournalEntry(entry) {
  const { data, error } = await supabase
    .from('journals')
    .insert(entry)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createParentJournalEntry(entry) {
  try {
    const { data, error } = await supabase
      .from('child_daily_logs')
      .insert({
        child_id: entry.child_id,
        user_id: entry.created_by,
        log_date: entry.entry_date,
        notes: entry.content,
        mood: entry.mood_tags?.[0] || entry.mood || null,
        activity_type: entry.activity_tags?.[0] || null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    if (error?.code !== '42P01' && error?.code !== 'PGRST205' && error?.code !== '42703') throw error;
  }

  return createJournalEntry(entry);
}

// ── AI Reports ────────────────────────────────────────────────────────────────

export async function getLatestAIReport(childId) {
  const { data, error } = await supabase
    .from('ai_reports')
    .select('*')
    .eq('child_id', childId)
    .in('status', ['done', 'completed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getAIReportForVideo(videoId, childId) {
  if (!videoId && !childId) return null;

  const queries = [];

  // Tìm theo video_id (cột thực tế trong DB)
  if (videoId) {
    queries.push(() => supabase
      .from('ai_reports')
      .select('*')
      .eq('video_id', videoId)
      .in('status', ['done', 'completed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle());
  }

  // Fallback: tìm report mới nhất theo child_id
  if (childId) {
    queries.push(() => supabase
      .from('ai_reports')
      .select('*')
      .eq('child_id', childId)
      .in('status', ['done', 'completed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle());
  }

  for (const runQuery of queries) {
    const { data, error } = await runQuery();
    if (!error && data) return data;
  }

  return null;
}

export async function getExercisesForReport(reportId, childId) {
  if (!reportId && !childId) return [];

  const baseSelect = `
    id, due_date, status, completed_sessions, required_sessions, priority, notes,
    exercises(name, description, domain, difficulty_level, exercise_type, duration_minutes)
  `;

  if (reportId) {
    const { data, error } = await supabase
      .from('exercise_assignments')
      .select(baseSelect)
      .eq('source_report_id', reportId)
      .order('priority', { ascending: true });

    if (!error && data?.length) return data;
  }

  if (!childId) return [];

  const { data, error } = await supabase
    .from('exercise_assignments')
    .select(baseSelect)
    .eq('child_id', childId)
    .in('status', ['assigned', 'in_progress', 'active'])
    .order('priority', { ascending: true })
    .limit(10);

  if (error) return [];
  return data || [];
}

// ── Notifications ─────────────────────────────────────────────────────────────

export async function getNotifications(userId, limit = 20) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function markNotificationRead(notifId) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', notifId);
  if (error) throw error;
}

// ── hpDT History ──────────────────────────────────────────────────

export async function getHpdtHistory(childId, limit = 8) {
  const { data, error } = await supabase
    .from('hpdt_history')
    .select('recorded_at, overall_score, communication_score, social_score, behavior_score, sensory_score, motor_score, cognitive_score')
    .eq('child_id', childId)
    .order('recorded_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).reverse();
}

// ── AI Daily Advice ───────────────────────────────────────────────

export async function getAIDailyAdvice(childId) {
  const today = new Date().toISOString().split('T')[0];
  // Try today's advice first, fallback to most recent
  const { data, error } = await supabase
    .from('ai_daily_advice')
    .select('*')
    .eq('child_id', childId)
    .order('generated_date', { ascending: false })
    .limit(1)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

export async function markAdviceRead(adviceId) {
  const { error } = await supabase
    .from('ai_daily_advice')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', adviceId);
  if (error) throw error;
}

// ── IEP Goals ─────────────────────────────────────────────────────

export async function getIEPGoals(childId) {
  const { data, error } = await supabase
    .from('iep_goals')
    .select('id, domain, goal_title, target_behavior, current_progress_pct, deadline, status, priority_rank')
    .eq('child_id', childId)
    .eq('status', 'active')
    .order('priority_rank', { ascending: true })
    .limit(5);
  if (error) throw error;
  return data || [];
}

// ── Home Activities (exercise_assignments for parent/both) ────────

export async function getHomeActivities(childId) {
  const { data, error } = await supabase
    .from('exercise_assignments')
    .select(`
      id, due_date, status, completed_sessions, required_sessions, priority, notes,
      exercises(name, description, domain, difficulty, exercise_type, duration_minutes)
    `)
    .eq('child_id', childId)
    .in('assigned_to_role', ['parent', 'both'])
    .in('status', ['active', 'assigned', 'in_progress'])
    .order('priority', { ascending: true })
    .limit(10);
  if (error) throw error;
  if (error) throw error;
  return data || [];
}

export async function getSchoolActivities(childId) {
  const { data, error } = await supabase
    .from('exercise_assignments')
    .select(`
      id, due_date, status, completed_sessions, required_sessions, priority, notes,
      exercises(name, description, domain, difficulty, exercise_type, duration_minutes)
    `)
    .eq('child_id', childId)
    .in('assigned_to_role', ['teacher', 'both'])
    .in('status', ['active', 'assigned', 'in_progress'])
    .order('priority', { ascending: true })
    .limit(10);
  if (error) throw error;
  return data || [];
}

export async function completeHomeActivity(assignmentId, childId, performedById) {
  const { data: assignment } = await supabase
    .from('exercise_assignments')
    .select('completed_sessions')
    .eq('id', assignmentId)
    .maybeSingle();

  const { data, error } = await supabase
    .from('exercise_sessions')
    .insert({
      assignment_id: assignmentId,
      child_id: childId,
      performed_by: performedById,
      performed_by_role: 'parent',
      status: 'completed',
      session_date: new Date().toISOString().split('T')[0],
    })
    .select()
    .single();
  if (error) throw error;

  await supabase
    .from('exercise_assignments')
    .update({ completed_sessions: (assignment?.completed_sessions || 0) + 1 })
    .eq('id', assignmentId);
  return data;
}

export async function completeSchoolActivity(assignmentId, childId, performedById, note) {
  const { data: assignment } = await supabase
    .from('exercise_assignments')
    .select('completed_sessions')
    .eq('id', assignmentId)
    .maybeSingle();

  const { data, error } = await supabase
    .from('exercise_sessions')
    .insert({
      assignment_id: assignmentId,
      child_id: childId,
      performed_by: performedById,
      performed_by_role: 'teacher',
      status: 'completed',
      session_date: new Date().toISOString().split('T')[0],
      notes: note || null
    })
    .select()
    .single();
  if (error) throw error;

  await supabase
    .from('exercise_assignments')
    .update({ completed_sessions: (assignment?.completed_sessions || 0) + 1 })
    .eq('id', assignmentId);
  return data;
}

export async function getParentExerciseSessions(childId, limit = 20) {
  const { data, error } = await supabase
    .from('exercise_sessions')
    .select(`
      id, session_date, status, score, notes, performed_by_role, completed_at,
      exercise_assignments!assignment_id(
        exercises(name, domain, duration_minutes)
      )
    `)
    .eq('child_id', childId)
    .order('session_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

// ── Recent Teacher Sessions (Dashboard) ──────────────────────────────────────

export async function getRecentTeacherSessions(teacherId, daysBack = 7, limit = 30) {
  // Lấy danh sách học sinh của giáo viên
  const children = await getChildrenByTeacher(teacherId);
  const childIds = children.map(c => c.id);
  if (!childIds.length) return [];

  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('exercise_sessions')
    .select(`
      id, session_date, status, score, performed_by_role,
      exercise_assignments!assignment_id(
        child_id,
        children(full_name, nickname),
        exercises(name, domain)
      )
    `)
    .in('child_id', childIds)
    .gte('session_date', since)
    .order('session_date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// ── Child Intervention Timeline (Teacher Report) ──────────────────────────────

export async function getChildInterventionTimeline(childId, limit = 20) {
  const { data, error } = await supabase
    .from('exercise_sessions')
    .select(`
      id, session_date, status, score, notes, performed_by_role,
      exercise_assignments!assignment_id(
        exercises(name, duration_minutes)
      ),
      users!performed_by(full_name)
    `)
    .eq('child_id', childId)
    .order('session_date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// ── Bulk mark notifications read ──────────────────────────────────────────────

export async function markAllNotificationsRead(userId) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw error;
}

// ── Teacher Session Logging ───────────────────────────────────────────────────

export async function logTeacherSession({ childId, performedById, sessionDate, completedExercises, sessionNotes }) {
  // completedExercises = [{ assignmentId, score, notes }]
  if (!completedExercises.length) return [];

  const records = completedExercises.map(ex => ({
    assignment_id:     ex.assignmentId,
    child_id:          childId,
    performed_by:      performedById,
    performed_by_role: 'teacher',
    status:            'completed',
    score:             ex.score != null ? Number(ex.score) : null,
    notes:             ex.notes?.trim() || sessionNotes?.trim() || null,
    session_date:      sessionDate,
    completed_at:      new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from('exercise_sessions')
    .insert(records)
    .select();
  if (error) throw error;
  return data;
}

// ── Teacher Exercises ──────────────────────────────────────────────────────────

export async function getTeacherExercisesForChild(childId) {
  const { data, error } = await supabase
    .from('exercise_assignments')
    .select(`
      id, priority, status, completed_sessions, required_sessions, due_date, notes,
      source_report_id,
      exercises(
        id, name, description, domain, difficulty, exercise_type,
        duration_minutes, instructions_teacher
      )
    `)
    .eq('child_id', childId)
    .eq('assigned_to_role', 'teacher')
    .in('status', ['active', 'assigned', 'in_progress'])
    .order('priority', { ascending: true })
    .limit(20);
  if (error) throw error;
  return data || [];
}

// ── Teacher Content Library ───────────────────────────────────────────────────

/** Lấy tất cả bài giảng của giáo viên (TeacherLibraryScreen — tab Bài giảng) */
export async function getTeacherLessons(teacherId) {
  if (!teacherId) return [];
  const { data, error } = await supabase
    .from('teacher_content_library')
    .select('id, title, description, content_type, domain, tags, video_url, bunny_video_id, thumbnail_url, duration_seconds, status, visibility, child_id, created_at')
    .eq('teacher_id', teacherId)
    .eq('status', 'published')
    .order('created_at', { ascending: false });
  if (error) { console.warn('getTeacherLessons error:', error.message); return []; }
  return data || [];
}

/** Lấy bài giảng của GV liên quan đến bé (LibraryScreen phụ huynh) */
export async function getChildLessons(childId) {
  if (!childId) return [];
  const { data, error } = await supabase
    .from('teacher_content_library')
    .select('id, title, description, content_type, domain, tags, video_url, bunny_video_id, thumbnail_url, duration_seconds, created_at')
    .eq('child_id', childId)
    .eq('status', 'published')
    .order('created_at', { ascending: false });
  if (error) { console.warn('getChildLessons error:', error.message); return []; }
  return data || [];
}

// ── HPDT Rolling Average Update (triggered after video AI analysis) ──────────

const HPDT_ROLLING_WINDOW = 5;

const HPDT_DOMAIN_WEIGHTS = {
  communication: 0.28,
  social:        0.25,
  behavior:      0.20,
  cognitive:     0.15,
  sensory:       0.07,
  motor:         0.05,
};

/**
 * Tính rolling average từ N video gần nhất và update hpdt_profiles ngay lập tức.
 * Gọi sau khi AI report của video mới có status = done/completed.
 */
export async function updateHpdtRolling(childId) {
  if (!childId) return null;

  const { data: reports, error } = await supabase
    .from('ai_reports')
    .select('communication_score, social_score, behavior_score, sensory_score, motor_score, cognitive_score')
    .eq('child_id', childId)
    .in('status', ['done', 'completed'])
    .order('created_at', { ascending: false })
    .limit(HPDT_ROLLING_WINDOW);

  if (error || !reports?.length) return null;

  const avg = (key) => {
    const vals = reports.map(r => r[key]).filter(v => v != null && v > 0);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  };

  const scores = {
    communication_score: avg('communication_score'),
    social_score:        avg('social_score'),
    behavior_score:      avg('behavior_score'),
    sensory_score:       avg('sensory_score'),
    motor_score:         avg('motor_score'),
    cognitive_score:     avg('cognitive_score'),
  };

  const overall_score = Math.round(
    scores.communication_score * HPDT_DOMAIN_WEIGHTS.communication +
    scores.social_score        * HPDT_DOMAIN_WEIGHTS.social +
    scores.behavior_score      * HPDT_DOMAIN_WEIGHTS.behavior +
    scores.cognitive_score     * HPDT_DOMAIN_WEIGHTS.cognitive +
    scores.sensory_score       * HPDT_DOMAIN_WEIGHTS.sensory +
    scores.motor_score         * HPDT_DOMAIN_WEIGHTS.motor,
  );

  const now = new Date().toISOString();

  await supabase.from('hpdt_profiles').upsert(
    { child_id: childId, ...scores, overall_score, last_updated: now },
    { onConflict: 'child_id' },
  );

  await supabase.from('hpdt_history').insert({
    child_id: childId,
    recorded_at: now,
    trigger_type: 'video_rolling',
    ...scores,
    overall_score,
    videos_count_this_week: reports.length,
  });

  return { ...scores, overall_score };
}

// ── VST helpers ──────────────────────────────────────────────────────────────

/**
 * Lấy vst_teacher_profiles của teacher hiện tại.
 * Nếu chưa có → tự tạo row mới với vst_code = legacy_id và center_code từ users.
 */
export async function getOrCreateVstProfile(teacherId) {
  if (!teacherId) return null;

  // 1. Thử lấy profile hiện có
  const { data: existing } = await supabase
    .from('vst_teacher_profiles')
    .select('*')
    .eq('teacher_id', teacherId)
    .eq('is_active', true)
    .maybeSingle();

  if (existing) return existing;

  // 2. Chưa có → lấy thông tin từ users để tạo mới
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('full_name, legacy_id, center_id, centers(center_code)')
    .eq('id', teacherId)
    .maybeSingle();

  if (userErr || !user) return null;

  const centerCode = user.centers?.center_code || null;
  const vstCode    = user.legacy_id || null;
  // Format: VST-VN-{legacy_id}-{center_code}
  const vstName    = user.full_name || 'GV';

  const { data: created, error: createErr } = await supabase
    .from('vst_teacher_profiles')
    .insert({
      teacher_id:  teacherId,
      center_id:   user.center_id,
      center_code: centerCode,
      vst_code:    vstCode,
      vst_name:    vstName,
      is_active:   true,
    })
    .select()
    .single();

  if (createErr) {
    console.warn('getOrCreateVstProfile insert error:', createErr.message);
    return null;
  }
  return created;
}

export async function getPrimaryVstProfile(childId) {
  const { data: assignment, error: assignError } = await supabase
    .from('teacher_child_assignments')
    .select('teacher_id')
    .eq('child_id', childId)
    .eq('is_primary', true)
    .eq('is_active', true)
    .maybeSingle();

  if (assignError) {
    console.error('Error fetching teacher assignment:', assignError.message);
    throw assignError;
  }
  if (!assignment) return null;

  const { data: vstProfile, error: vstError } = await supabase
    .from('vst_teacher_profiles')
    .select('*')
    .eq('teacher_id', assignment.teacher_id)
    .eq('is_active', true)
    .maybeSingle();

  if (vstError) {
    console.error('Error fetching VST profile:', vstError.message);
    throw vstError;
  }
  return vstProfile;
}
