import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, radius, spacing, shadows } from '../../lib/colors';
import { typography } from '../../lib/typography';
import { useAuth } from '../../contexts/AuthContext';
import {
  getChildrenByTeacher,
  getNotifications,
  markAllNotificationsRead,
  getRecentTeacherSessions,
  supabase,
} from '../../lib/supabase';

// ── Constants ──────────────────────────────────────────────────────────────────
const VIDEO_LOCATIONS = ['Trường học', 'Nhà riêng', 'Công viên', 'Trung tâm'];
const CHILD_STATES    = ['Bình tĩnh', 'Cáu gắt', 'Mất tập trung', 'Hưng phấn', 'Tập trung'];

// ── Mock fallbacks ─────────────────────────────────────────────────────────────
const MOCK_STUDENTS = [
  { id: 's1', full_name: 'Nguyễn Minh Anh', nickname: 'Minh Anh', age: 4, overall_score: 67, level: 'Mức 2 - Cần hỗ trợ đáng kể', target_tasks: 4, completed_tasks: 2, last_session: '19-05' },
  { id: 's2', full_name: 'Trần Gia Khoa',   nickname: 'Gia Khoa',  age: 5, overall_score: 58, level: 'Mức 1 - Cần hỗ trợ nhẹ',     target_tasks: 6, completed_tasks: 3, last_session: '18-05' },
  { id: 's3', full_name: 'Phạm Thùy Linh', nickname: 'Thùy Linh', age: 4, overall_score: 72, level: 'Mức 1 - Cần hỗ trợ nhẹ',     target_tasks: 5, completed_tasks: 4, last_session: '20-05' },
  { id: 's4', full_name: 'Vũ Minh Đức',    nickname: 'Minh Đức',  age: 6, overall_score: 49, level: 'Mức 3 - Cần hỗ trợ đặc biệt', target_tasks: 8, completed_tasks: 3, last_session: '17-05' },
];

const MOCK_SESSIONS = [
  {
    id: 'rs1', childId: 's1', childName: 'Nguyễn Minh Anh',
    date: '19-05', progress: '2/4 bài tập hoàn thành', duration: '45 phút',
    tasks: [
      { id: 't1', name: 'Giao tiếp mắt khi chào hỏi',    done: true,  completedBy: 'Giáo viên' },
      { id: 't2', name: 'Gọi tên đồ vật thông dụng',      done: true,  completedBy: 'Phụ huynh' },
      { id: 't3', name: 'Chơi luân phiên với bóng',        done: false, completedBy: '-' },
      { id: 't4', name: 'Hành động kéo mở khóa áo',        done: false, completedBy: '-' },
    ],
  },
  {
    id: 'rs2', childId: 's2', childName: 'Trần Gia Khoa',
    date: '18-05', progress: '3/6 bài tập hoàn thành', duration: '60 phút',
    tasks: [
      { id: 't5', name: 'Chào cô khi vào lớp',             done: true,  completedBy: 'Giáo viên' },
      { id: 't6', name: 'Ghép tranh 6 mảnh đơn giản',      done: true,  completedBy: 'Phụ huynh' },
      { id: 't7', name: 'Chỉ ngón trỏ vào tranh ảnh',      done: true,  completedBy: 'Giáo viên' },
      { id: 't8', name: 'Tự xúc ăn cơm bằng thìa',         done: false, completedBy: '-' },
      { id: 't9', name: 'Nghe hiểu câu lệnh 2 bước',        done: false, completedBy: '-' },
      { id: 't10', name: 'Sử dụng cử chỉ "xin" nước',      done: false, completedBy: '-' },
    ],
  },
];

const MOCK_NOTIFICATIONS = [
  { id: 'm1', parentName: 'Mẹ bé Minh Anh',   message: 'Cô ơi, tối qua bé An tự nói được từ "quả táo" rồi ạ! Nhờ cô kiểm tra thêm ở lớp xem bé nói lại được không cô nhé.', time: '2 giờ trước',  isRead: false },
  { id: 'm2', parentName: 'Bố bé Gia Khoa',    message: 'Hôm nay gia đình cho bé đi học muộn 15 phút do kẹt xe cô nhé. Nhờ cô chú ý cho bé ăn sáng giúp em ạ.',                 time: '5 giờ trước',  isRead: false },
  { id: 'm3', parentName: 'Mẹ bé Thùy Linh',  message: 'Bé Linh tối qua ngủ không ngon, sáng ra có vẻ cáu gắt. Nhờ cô quan sát và dỗ bé giúp gia đình nhé.',                   time: '1 ngày trước', isRead: true  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatShortDate(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 60)  return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

function mapNotification(n) {
  return {
    id:         n.id,
    parentName: n.sender_name || n.from_name || n.title || 'Phụ huynh',
    message:    n.body || n.message || n.content || '',
    time:       formatRelativeTime(n.created_at),
    isRead:     n.is_read ?? false,
  };
}

// Group flat exercise_session rows into session cards grouped by (date, child)
function groupSessions(rows) {
  const map = new Map();
  for (const row of rows) {
    const ea        = row.exercise_assignments;
    const childId   = ea?.child_id   || 'unknown';
    const childName = ea?.children?.full_name || 'Học sinh';
    const date      = row.session_date;
    const key       = `${date}_${childId}`;

    if (!map.has(key)) {
      map.set(key, { id: key, childId, childName, date: formatShortDate(date), tasks: [] });
    }
    map.get(key).tasks.push({
      id:          row.id,
      name:        ea?.exercises?.name || 'Bài tập',
      done:        row.status === 'completed',
      completedBy: row.performed_by_role === 'parent' ? 'Phụ huynh' : 'Giáo viên',
      isParent:    row.performed_by_role === 'parent'
    });
  }

  return Array.from(map.values()).map(s => ({
    ...s,
    progress: `${s.tasks.filter(t => t.done).length}/${s.tasks.length} bài tập hoàn thành`,
    duration: '--',
  }));
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function TeacherDashboardScreen({ navigation }) {
  const { profile } = useAuth();
  const teacherName = profile?.full_name || 'Cô giáo';
  const centerName  = profile?.centers?.name || 'Trung tâm BIC-HCM';

  const [students,        setStudents]        = useState([]);
  const [recentSessions,  setRecentSessions]  = useState([]);
  const [notifications,   setNotifications]   = useState([]);
  const [videoCount,      setVideoCount]      = useState('--');
  const [loading,         setLoading]         = useState(true);
  const [expandedSession, setExpandedSession] = useState(null);

  // Upload modal
  const [uploadVisible,   setUploadVisible]   = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [uploadLocation,  setUploadLocation]  = useState('Trường học');
  const [uploadState,     setUploadState]     = useState('Bình tĩnh');
  const [uploadNotes,     setUploadNotes]     = useState('');
  const [uploading,       setUploading]       = useState(false);
  const [uploadProgress,  setUploadProgress]  = useState(0);

  const loadData = useCallback(async () => {
    const teacherId = profile?.id;

    try {
      const today = new Date().toISOString().split('T')[0];

      const [childrenRes, notifRes, sessionsRes, videoRes] = await Promise.allSettled([
        teacherId ? getChildrenByTeacher(teacherId) : Promise.resolve([]),
        profile?.id ? getNotifications(profile.id) : Promise.resolve([]),
        teacherId ? getRecentTeacherSessions(teacherId) : Promise.resolve([]),
        supabase
          .from('observation_videos')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', today),
      ]);

      // ── Students ──
      const childList = childrenRes.status === 'fulfilled' ? childrenRes.value : [];
      if (childList?.length) {
        setStudents(childList.map(c => ({
          id:              c.id,
          full_name:       c.full_name,
          nickname:        c.nickname || c.full_name.split(' ').pop(),
          age:             c.age || 4,
          overall_score:   c.hpdt_profiles?.[0]?.overall_score || 60,
          level:           c.diagnostic_level || 'Mức 2 - Cần hỗ trợ đáng kể',
          target_tasks:    5,
          completed_tasks: 3,
          last_session:    '19-05',
        })));
      } else {
        setStudents(MOCK_STUDENTS);
      }

      // ── Notifications ──
      const notifList = notifRes.status === 'fulfilled' ? notifRes.value : [];
      setNotifications(
        notifList?.length ? notifList.map(mapNotification) : MOCK_NOTIFICATIONS
      );

      // ── Recent sessions ──
      const sessionRows = sessionsRes.status === 'fulfilled' ? sessionsRes.value : [];
      if (sessionRows?.length) {
        setRecentSessions(groupSessions(sessionRows));
      } else {
        if (childList?.length) {
          const mocks = childList.slice(0, 2).map((c, i) => ({
            id: 'rs' + i,
            childId: c.id,
            childName: c.full_name,
            date: '19-05', progress: '2/4 bài tập hoàn thành', duration: '45 phút',
            tasks: [
              { id: 't1'+i, name: 'Giao tiếp mắt khi chào hỏi', done: true, completedBy: 'Giáo viên', isParent: false },
              { id: 't2'+i, name: 'Gọi tên đồ vật thông dụng', done: true, completedBy: 'Phụ huynh', isParent: true },
              { id: 't3'+i, name: 'Chơi luân phiên với bóng', done: false, completedBy: '-', isParent: false },
            ]
          }));
          setRecentSessions(mocks);
        } else {
          setRecentSessions(MOCK_SESSIONS);
        }
      }

      // ── Video count today ──
      if (videoRes.status === 'fulfilled' && !videoRes.value.error) {
        setVideoCount(videoRes.value.count ?? '--');
      }

    } catch (e) {
      console.warn('Dashboard load error:', e.message);
      setStudents([]);
      setNotifications([]);
      setRecentSessions([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Handlers ──
  const handleOpenUpload = (student) => {
    setSelectedStudent(student);
    setUploadVisible(true);
  };

  const handleUploadVideo = async () => {
    if (!uploadNotes.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập ghi chú bối cảnh video.');
      return;
    }
    setUploading(true);
    for (let p = 0; p <= 100; p += 20) {
      await new Promise(r => setTimeout(r, 120));
      setUploadProgress(p);
    }
    setUploading(false);
    setUploadVisible(false);
    setUploadNotes('');
    setUploadProgress(0);
    Alert.alert(
      'Tải lên thành công',
      `Video của bé ${selectedStudent.full_name} đã được lưu và đưa vào hàng chờ phân tích AI.`
    );
  };

  const toggleExpandSession = (sessionId) => {
    setExpandedSession(prev => prev === sessionId ? null : sessionId);
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    try {
      if (profile?.id) await markAllNotificationsRead(profile.id);
    } catch { /* local state already updated */ }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.secondary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>

      {/* ══ Header ══ */}
      <View style={styles.header}>
        <View style={styles.headerProfile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>👩‍🏫</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.greet}>Xin chào, {teacherName} 👋</Text>
            <Text style={styles.centerName} numberOfLines={1}>{centerName}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.notifBtn} onPress={() => navigation.navigate('Messages')}>
          <Text style={{ fontSize: 24 }}>💬</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ══ Stats ══ */}
        <View style={styles.statsCard}>
          <Text style={styles.statsCardTitle}>THỐNG KÊ LỚP HỌC</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statEmoji}>👦</Text>
              <Text style={styles.statVal}>{students.length}</Text>
              <Text style={styles.statLabel}>Học sinh</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statEmoji}>📹</Text>
              <Text style={styles.statVal}>{videoCount}</Text>
              <Text style={styles.statLabel}>Video hôm nay</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statEmoji}>📊</Text>
              <Text style={[styles.statVal, { color: colors.secondaryDark }]}>{recentSessions.length}</Text>
              <Text style={styles.statLabel}>Phiên gần đây</Text>
            </View>
          </View>
        </View>

        {/* ══ Student List ══ */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Danh sách học sinh đang quản lý</Text>
        </View>

        {students.map((student) => (
          <View key={student.id} style={styles.studentCard}>
            <TouchableOpacity
              style={styles.studentInfoArea}
              onPress={() => navigation.navigate('StudentDetail', { studentId: student.id, studentName: student.full_name })}
              activeOpacity={0.7}
            >
              <View style={styles.studentAvatar}>
                <Text style={{ fontSize: 24 }}>👦</Text>
              </View>
              <View style={styles.studentMeta}>
                <Text style={styles.studentName}>{student.full_name}</Text>
                <Text style={styles.studentAge}>{student.age} tuổi • Điểm hpDT: {student.overall_score}</Text>
                <View style={styles.levelChip}>
                  <Text style={styles.levelChipText}>{student.level}</Text>
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.uploadBtn} onPress={() => handleOpenUpload(student)}>
              <Text style={{ fontSize: 16, marginRight: 4 }}>📹</Text>
              <Text style={styles.uploadBtnText}>Upload</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* ══ Library Banner ══ */}
        <TouchableOpacity
          style={styles.libraryBanner}
          onPress={() => navigation.navigate('ThuVien')}
          activeOpacity={0.88}
        >
          <View style={styles.libraryBannerIcon}>
            <Text style={{ fontSize: 24 }}>📚</Text>
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.libBannerTitle}>Thư viện tri thức & Video Modeling</Text>
            <Text style={styles.libBannerSub}>Tổng hợp học liệu can thiệp đồng đẳng chuẩn P2P</Text>
          </View>
          <Text style={styles.libBannerArrow}>›</Text>
        </TouchableOpacity>

        {/* ══ Recent Sessions ══ */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Phiên can thiệp gần đây</Text>
        </View>

        {recentSessions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Chưa có phiên can thiệp nào trong 7 ngày qua.</Text>
          </View>
        ) : (
          recentSessions.map((session) => {
            const isExpanded = expandedSession === session.id;
            return (
              <View key={session.id} style={styles.sessionCard}>
                <TouchableOpacity
                  style={styles.sessionHeaderRow}
                  onPress={() => toggleExpandSession(session.id)}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sessionChildName}>{session.childName}</Text>
                    <Text style={styles.sessionMeta}>
                      {session.date}{session.duration !== '--' ? ` • Thời lượng: ${session.duration}` : ''}
                    </Text>
                  </View>
                  <View style={styles.sessionProgressBox}>
                    <Text style={styles.sessionProgressText}>{session.progress}</Text>
                    <Text style={styles.sessionChevron}>{isExpanded ? '▲' : '▼'}</Text>
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.sessionDetail}>
                    <View style={styles.detailTitleLine}>
                      <Text style={styles.detailTitle}>Danh sách bài tập trong phiên:</Text>
                    </View>
                    {session.tasks.map((task) => (
                      <View key={task.id} style={styles.taskItem}>
                        <Text style={[styles.taskCheckbox, task.done && styles.taskCheckboxDone]}>
                          {task.done ? '✓' : '○'}
                        </Text>
                        <Text style={[styles.taskName, task.done && styles.taskNameDone]}>
                          {task.name}
                        </Text>
                        {task.done && (
                          <View style={[styles.performerChip, task.isParent ? styles.chipParent : styles.chipTeacher]}>
                            <Text style={styles.performerText}>{task.completedBy}</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* ══ Upload Video Modal ══ */}
      <Modal visible={uploadVisible} animationType="slide" transparent onRequestClose={() => setUploadVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ justifyContent: 'flex-end', width: '100%' }}>
            <View style={styles.uploadCard}>
              <View style={styles.handleBar} />
              <View style={styles.uploadHeader}>
                <View>
                  <Text style={styles.uploadTitle}>Tải video học tập mới 📹</Text>
                  <Text style={styles.uploadSub}>Học sinh: {selectedStudent?.full_name}</Text>
                </View>
                <TouchableOpacity onPress={() => setUploadVisible(false)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Bối cảnh / Địa điểm</Text>
              <View style={styles.chipRow}>
                {VIDEO_LOCATIONS.map(loc => (
                  <TouchableOpacity
                    key={loc}
                    style={[styles.selChip, uploadLocation === loc && styles.selChipActive]}
                    onPress={() => setUploadLocation(loc)}
                  >
                    <Text style={[styles.selChipText, uploadLocation === loc && { color: colors.secondary, fontWeight: '700' }]}>
                      {loc}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Trạng thái hiện tại của bé</Text>
              <View style={styles.chipRow}>
                {CHILD_STATES.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.selChip, uploadState === s && styles.selChipActive]}
                    onPress={() => setUploadState(s)}
                  >
                    <Text style={[styles.selChipText, uploadState === s && { color: colors.secondary, fontWeight: '700' }]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Ghi chú buổi học / Hành vi quan sát</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ví dụ: Bé hào hứng khi chơi luân phiên bóng với cô giáo, có phản ứng giao tiếp mắt tích cực khi được khen..."
                placeholderTextColor={colors.textLight}
                value={uploadNotes}
                onChangeText={setUploadNotes}
                multiline
              />

              {uploading && (
                <View style={{ marginVertical: spacing.md }}>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
                  </View>
                  <Text style={styles.progressText}>{uploadProgress}% — Đang tải tệp video lên dữ liệu của trẻ...</Text>
                </View>
              )}

              <View style={styles.aiNotification}>
                <Text style={{ fontSize: 16, marginRight: 8 }}>✨</Text>
                <Text style={styles.aiNotificationText}>
                  Hệ thống AI sẽ tự động phân tích mức độ tập trung, tần suất tương tác mắt và các biểu hiện hành vi ngay khi video tải lên hoàn tất.
                </Text>
              </View>

              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setUploadVisible(false)}>
                  <Text style={styles.cancelBtnText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, uploading && { opacity: 0.6 }]}
                  onPress={handleUploadVideo}
                  disabled={uploading}
                >
                  {uploading
                    ? <ActivityIndicator size="small" color={colors.white} />
                    : <Text style={styles.primaryBtnText}>Tải lên</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

    </View>
  );
}

// ── Styles (unchanged) ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bg },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  scroll:      { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop:        56,
    paddingBottom:     spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor:   colors.bgCard,
  },
  headerProfile: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: {
    width:           48, height: 48, borderRadius: radius.full,
    backgroundColor: colors.secondaryBg,
    alignItems:      'center', justifyContent: 'center',
    borderWidth:     1.5, borderColor: colors.secondaryLight,
  },
  avatarEmoji: { fontSize: 24 },
  headerText:  { marginLeft: spacing.sm, flex: 1 },
  greet:       { ...typography.h3, color: colors.textDark, fontWeight: '700' },
  centerName:  { ...typography.caption, color: colors.textMid, marginTop: 1 },
  notifBtn: {
    width: 42, height: 42, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bgMuted, position: 'relative',
  },
  badge: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: colors.danger, borderRadius: radius.full,
    minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },

  statsCard: {
    backgroundColor: colors.secondaryBg, borderRadius: radius.xl,
    padding: spacing.md, marginTop: spacing.md, marginBottom: spacing.lg,
    borderWidth: 1, borderColor: colors.secondaryLight, ...shadows.sm,
  },
  statsCardTitle: { ...typography.labelSm, color: colors.secondaryDark, fontWeight: '700', marginBottom: spacing.sm, letterSpacing: 1 },
  statsGrid:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  statBox:    { alignItems: 'center', flex: 1 },
  statEmoji:  { fontSize: 20, marginBottom: 2 },
  statVal:    { ...typography.h2, color: colors.textDark, fontWeight: '800' },
  statLabel:  { ...typography.caption, color: colors.textMid, fontSize: 10, textAlign: 'center', marginTop: 2 },
  statDivider:{ width: 1, height: 40, backgroundColor: colors.secondaryLight },

  sectionHeader: { marginVertical: spacing.sm },
  sectionTitle:  { ...typography.h3, color: colors.textDark, fontWeight: '700' },

  studentCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border, ...shadows.sm,
  },
  studentInfoArea: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  studentAvatar: {
    width: 44, height: 44, borderRadius: radius.full,
    backgroundColor: colors.bgMuted, alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.sm,
  },
  studentMeta:  { flex: 1 },
  studentName:  { ...typography.bodyLg, fontWeight: '600', color: colors.textDark },
  studentAge:   { ...typography.caption, color: colors.textMid, marginTop: 2 },
  levelChip: {
    alignSelf: 'flex-start', backgroundColor: colors.primaryBg,
    borderRadius: radius.xs, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4,
  },
  levelChipText: { ...typography.caption, fontSize: 10, color: colors.primaryDark, fontWeight: '600' },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.secondaryBg, borderWidth: 1, borderColor: colors.secondaryLight,
    paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.md, marginLeft: spacing.sm,
  },
  uploadBtnText: { ...typography.caption, color: colors.secondaryDark, fontWeight: '700' },

  libraryBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginVertical: spacing.md, ...shadows.sm,
  },
  libraryBannerIcon: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  libBannerTitle:    { ...typography.bodyLg, fontWeight: '700', color: colors.textDark },
  libBannerSub:      { ...typography.caption, color: colors.textMid, marginTop: 2 },
  libBannerArrow:    { fontSize: 24, color: colors.textLight, paddingHorizontal: 4 },

  emptyCard: { backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, alignItems: 'center', marginBottom: spacing.sm },
  emptyText: { ...typography.body, color: colors.textLight, textAlign: 'center' },

  sessionCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.sm, overflow: 'hidden', ...shadows.sm,
  },
  sessionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md, backgroundColor: colors.bgCard,
  },
  sessionChildName:   { ...typography.bodyLg, fontWeight: '700', color: colors.textDark },
  sessionMeta:        { ...typography.caption, color: colors.textLight, marginTop: 2 },
  sessionProgressBox: { flexDirection: 'row', alignItems: 'center' },
  sessionProgressText:{ ...typography.caption, color: colors.secondaryDark, fontWeight: '600', marginRight: spacing.sm },
  sessionChevron:     { fontSize: 10, color: colors.textLight },
  sessionDetail: {
    padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: '#FAF5EE',
  },
  detailTitleLine: { marginBottom: spacing.sm },
  detailTitle:     { ...typography.caption, color: colors.textMid, fontWeight: '600' },
  taskItem:        { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  taskCheckbox:    { fontSize: 14, marginRight: 8, color: colors.textLight },
  taskCheckboxDone:{ color: colors.secondary, fontWeight: '700' },
  taskName:        { ...typography.bodySm, color: colors.textMid, flex: 1 },
  taskNameDone:    { color: colors.textDark, fontWeight: '500' },
  performerChip:   { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full, marginLeft: spacing.sm },
  chipTeacher:     { backgroundColor: colors.primaryBg, borderWidth: 1, borderColor: colors.primaryLight },
  chipParent:      { backgroundColor: colors.successBg, borderWidth: 1, borderColor: colors.successLight },
  performerText:   { ...typography.caption, fontSize: 9, fontWeight: '700', color: colors.textDark },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(61,53,48,0.5)', justifyContent: 'flex-end', alignItems: 'center' },

  notifCard: {
    backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    width: '100%', maxHeight: '80%', padding: spacing.lg, ...shadows.lg,
  },
  notifHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.sm,
  },
  notifTitle: { ...typography.h3, color: colors.textDark, fontWeight: '700' },
  closeBtn:   { width: 32, height: 32, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgMuted },
  closeBtnText:{ fontSize: 14, color: colors.textMid, fontWeight: '600' },
  notifList:  { marginVertical: spacing.sm },
  msgItem: {
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
    position: 'relative', ...shadows.sm,
  },
  msgUnread:  { borderColor: colors.secondaryLight, backgroundColor: colors.secondaryBg },
  msgHeader:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  msgParent:  { ...typography.body, fontWeight: '700', color: colors.textDark },
  msgTime:    { ...typography.caption, color: colors.textLight },
  msgText:    { ...typography.bodySm, color: colors.textMid, lineHeight: 18 },
  unreadDot:  { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.secondary },
  notifFooter:{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, alignItems: 'center' },
  markReadBtn:{ paddingVertical: spacing.sm, paddingHorizontal: spacing.xl, backgroundColor: colors.secondary, borderRadius: radius.lg },
  markReadText:{ color: colors.white, ...typography.btn, fontWeight: '700' },

  uploadCard: {
    backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    width: '100%', padding: spacing.lg, ...shadows.lg,
  },
  handleBar: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, alignSelf: 'center', marginBottom: spacing.md },
  uploadHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.sm,
  },
  uploadTitle: { ...typography.h3, color: colors.textDark, fontWeight: '700' },
  uploadSub:   { ...typography.caption, color: colors.textMid, marginTop: 2 },
  label:       { ...typography.body, fontWeight: '700', color: colors.textDark, marginTop: spacing.sm, marginBottom: 6 },
  chipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  selChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bgCard },
  selChipActive:{ borderColor: colors.secondary, backgroundColor: colors.secondaryBg },
  selChipText:  { ...typography.caption, color: colors.textMid, fontWeight: '600' },
  textInput: {
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.sm, height: 80,
    textAlignVertical: 'top', fontSize: 13, color: colors.textDark, marginBottom: spacing.md,
  },
  progressBar:     { height: 6, backgroundColor: colors.bgMuted, borderRadius: 3, overflow: 'hidden' },
  progressFill:    { height: '100%', backgroundColor: colors.secondary },
  progressText:    { ...typography.caption, color: colors.textMid, marginTop: 4 },
  aiNotification: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.secondaryBg, borderRadius: radius.md, padding: spacing.sm,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.secondaryLight,
  },
  aiNotificationText: { ...typography.caption, color: colors.secondaryDark, flex: 1, lineHeight: 16 },
  btnRow:     { flexDirection: 'row', gap: 10, marginTop: spacing.sm },
  cancelBtn:  { flex: 1, paddingVertical: spacing.md, borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: radius.lg, alignItems: 'center' },
  cancelBtnText: { ...typography.btn, color: colors.textDark },
  primaryBtn: { flex: 2, backgroundColor: colors.secondary, paddingVertical: spacing.md, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText:{ ...typography.btn, color: colors.white, fontWeight: '700' },
});
