import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  Modal,
  Alert,
  Platform
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useAuth } from '../../contexts/AuthContext';
import { getChildrenByTeacher, getObservationVideos, getVideoModelingLibrary, getTeacherLessons } from '../../lib/supabase';
import { colors, radius, shadows, spacing } from '../../lib/colors';
import { typography } from '../../lib/typography';

const MOCK_VIDEOS = [
  { id: 'v1', child_id: 's1', childName: 'Minh Anh', context: 'Trường học', recorded_at: '2026-05-21T09:15:00Z', uploaded_by_role: 'teacher', video_status: 'ready', duration_seconds: 47, notes: 'Bé tập trung sâu vào xếp hình khối gỗ' },
  { id: 'v2', child_id: 's2', childName: 'Gia Khoa', context: 'Nhà riêng', recorded_at: '2026-05-20T14:30:00Z', uploaded_by_role: 'parent', video_status: 'ready', duration_seconds: 82, notes: 'Giờ chơi lắp ghép tại nhà' },
  { id: 'v3', child_id: 's3', childName: 'Thùy Linh', context: 'Trường học', recorded_at: '2026-05-18T17:45:00Z', uploaded_by_role: 'teacher', video_status: 'ready', duration_seconds: 63, notes: 'Giáo tiếp mắt khi cô chào hỏi đầu giờ' },
];

const MOCK_STUDENTS = [
  { id: 's1', nickname: 'Minh Anh', full_name: 'Nguyễn Minh Anh' },
  { id: 's2', nickname: 'Gia Khoa', full_name: 'Trần Gia Khoa' },
  { id: 's3', nickname: 'Thùy Linh', full_name: 'Phạm Thùy Linh' },
  { id: 's4', nickname: 'Minh Đức', full_name: 'Vũ Minh Đức' },
];

const MOCK_P2P = [
  { id: 'p1', title: 'Bé An học nói "con muốn uống sữa"', domain: 'communication', difficulty: 'Mức 1', video_duration_seconds: 124 },
  { id: 'p2', title: 'Kỹ năng xếp hàng và đợi lượt', domain: 'social', difficulty: 'Mức 2', video_duration_seconds: 91 },
  { id: 'p3', title: 'Tự xúc ăn cơm bằng thìa không đổ', domain: 'motor', difficulty: 'Mức 1', video_duration_seconds: 78 },
];

const VIDEO_FILTERS = ['Tất cả', 'Hôm nay', 'Tuần này'];
const DOMAIN_COLORS = {
  communication: colors.domain.communication,
  social: colors.domain.social,
  behavior: colors.domain.behavior,
  sensory: colors.domain.sensory,
  motor: colors.domain.motor,
  cognitive: colors.domain.cognitive,
};

const DOMAIN_LABELS = {
  communication: 'Giao tiếp',
  social: 'Xã hội',
  behavior: 'Hành vi',
  sensory: 'Cảm giác',
  motor: 'Vận động',
  cognitive: 'Nhận thức',
};

function VideoCard({ video, onViewAnalysis, onDeleteVideo }) {
  const d = new Date(video.recorded_at || video.created_at);
  const now = Date.now();
  const hoursSinceUpload = (now - d.getTime()) / (1000 * 60 * 60);
  const canDelete = hoursSinceUpload <= 48 && video.uploaded_by_role === 'teacher';

  const isProcessing = video.video_status === 'processing';
  const roleLabel = video.uploaded_by_role === 'teacher' ? 'Cô giáo' : 'Phụ huynh';
  const roleBg = video.uploaded_by_role === 'teacher' ? colors.secondaryBg : colors.primaryBg;
  const roleColor = video.uploaded_by_role === 'teacher' ? colors.secondaryDark : colors.primaryDark;
  const duration = video.duration_seconds ? `${Math.floor(video.duration_seconds / 60)}:${String(video.duration_seconds % 60).padStart(2, '0')}` : null;

  return (
    <View style={st.videoCard}>
      {/* Thumbnail placeholder */}
      <TouchableOpacity 
        style={st.videoThumb} 
        onPress={() => !isProcessing && video.playback_url && onViewAnalysis('play', video)}
        activeOpacity={isProcessing ? 1 : 0.8}
      >
        {isProcessing ? (
          <ActivityIndicator size="small" color={colors.secondary} />
        ) : video.thumbnail_url ? (
          <>
            <Image source={{ uri: video.thumbnail_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            <View style={{ position: 'absolute', backgroundColor: 'rgba(0,0,0,0.3)', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 24 }}>▶️</Text>
            </View>
          </>
        ) : (
          <Text style={{ fontSize: 28 }}>🎬</Text>
        )}
        {!isProcessing && duration && (
          <View style={st.videoDurationBadge}>
            <Text style={st.videoDurationText}>{duration}</Text>
          </View>
        )}
      </TouchableOpacity>
      <View style={st.videoInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <View style={[st.roleChip, { backgroundColor: roleBg }]}>
            <Text style={[st.roleChipText, { color: roleColor }]}>{roleLabel}</Text>
          </View>
          <Text style={[st.videoContext, { flex: 1 }]} numberOfLines={1}>📍 {video.context || 'Trường học'}</Text>
          {canDelete && (
            <TouchableOpacity onPress={() => onDeleteVideo(video)} style={{ padding: 4 }}>
              <Text style={{ fontSize: 16 }}>🗑️</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={st.videoNotes} numberOfLines={2}>
          <Text style={{ fontWeight: '700' }}>Bé {video.childName || 'đang học'}: </Text>
          {video.notes || 'Không có ghi chú'}
        </Text>
        <Text style={st.videoDate}>{d.getDate()}/{d.getMonth() + 1}/{d.getFullYear()} {String(d.getHours()).padStart(2,'0')}:{String(d.getMinutes()).padStart(2,'0')}</Text>
        {isProcessing
          ? <Text style={st.processingText}>⏳ Đang phân tích AI...</Text>
          : (
            <TouchableOpacity style={st.viewAnalysisBtn} onPress={() => onViewAnalysis('report', video)}>
              <Text style={st.viewAnalysisBtnText}>Xem phân tích →</Text>
            </TouchableOpacity>
          )
        }
      </View>
    </View>
  );
}

function P2PCard({ content }) {
  const col = DOMAIN_COLORS[content.domain] || colors.secondary;
  const duration = content.video_duration_seconds
    ? `${Math.floor(content.video_duration_seconds / 60)}:${String(content.video_duration_seconds % 60).padStart(2, '0')}`
    : '--';
  return (
    <TouchableOpacity style={st.p2pCard} activeOpacity={0.82}>
      <View style={[st.p2pThumb, { backgroundColor: col + '22' }]}>
        <Text style={{ fontSize: 24 }}>▶️</Text>
      </View>
      <View style={{ flex: 1, marginLeft: spacing.sm }}>
        <Text style={st.p2pTitle} numberOfLines={2}>{content.title}</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
          <View style={[st.chip, { backgroundColor: col + '22' }]}>
            <Text style={[st.chipText, { color: col }]}>{DOMAIN_LABELS[content.domain]}</Text>
          </View>
          <Text style={st.videoDate}>{duration} • {content.difficulty}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ComingSoonSection({ title, emoji, desc }) {
  return (
    <View style={st.comingSoonCard}>
      <Text style={st.comingSoonEmoji}>{emoji}</Text>
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={st.comingSoonTitle}>{title}</Text>
        <Text style={st.comingSoonSub}>{desc || 'Sắp ra mắt trong phiên bản tiếp theo'}</Text>
      </View>
      <View style={st.comingSoonBadge}>
        <Text style={st.comingSoonBadgeText}>Sắp có</Text>
      </View>
    </View>
  );
}

function LessonCard({ lesson, onPlay }) {
  const d = new Date(lesson.created_at);
  const col = DOMAIN_COLORS[lesson.domain] || colors.secondary;
  const duration = lesson.duration_seconds
    ? `${Math.floor(lesson.duration_seconds / 60)}:${String(lesson.duration_seconds % 60).padStart(2, '0')}`
    : '--';
  const typeLabel = lesson.content_type === 'lesson' ? 'Bài giảng' : lesson.content_type === 'demo' ? 'Video mẫu' : 'Bài tập';

  return (
    <TouchableOpacity style={st.lessonCard} onPress={() => onPlay(lesson)} activeOpacity={0.82}>
      <View style={[st.lessonThumb, { backgroundColor: col + '22' }]}>
        <Text style={{ fontSize: 26 }}>🎓</Text>
        <View style={st.videoDurationBadge}>
          <Text style={st.videoDurationText}>{duration}</Text>
        </View>
      </View>
      <View style={st.lessonInfo}>
        <Text style={st.lessonTitle} numberOfLines={2}>{lesson.title}</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          <View style={[st.chip, { backgroundColor: col + '22' }]}>
            <Text style={[st.chipText, { color: col }]}>{DOMAIN_LABELS[lesson.domain] || lesson.domain || '—'}</Text>
          </View>
          <View style={[st.chip, { backgroundColor: colors.primaryBg }]}>
            <Text style={[st.chipText, { color: colors.primaryDark }]}>{typeLabel}</Text>
          </View>
        </View>
        {lesson.description ? (
          <Text style={st.videoNotes} numberOfLines={1}>{lesson.description}</Text>
        ) : null}
        <Text style={st.videoDate}>{d.getDate()}/{d.getMonth() + 1}/{d.getFullYear()}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function TeacherLibraryScreen({ navigation }) {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('videos'); // 'videos' | 'lessons'
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('all');
  const [videos, setVideos] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [p2pContent, setP2pContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [videoFilter, setVideoFilter] = useState('Tất cả');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [playingVideo, setPlayingVideo] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const teacherId = profile?.id;
      if (!teacherId) {
        setStudents([]);
        setVideos([]);
        setP2pContent([]);
        return;
      }

      let childList = [];
      try {
        childList = await getChildrenByTeacher(teacherId);
      } catch {
        childList = [];
      }

      const activeStudents = childList;
      setStudents(activeStudents);

      let allVideos = [];
      try {
        const videoPromises = activeStudents.map(async (student) => {
          try {
            const vids = await getObservationVideos(student.id);
            return vids.map(v => ({
              ...v,
              child_id: student.id,
              childName: student.nickname || student.full_name.split(' ').pop(),
              duration_seconds: v.duration_seconds || 45,
            }));
          } catch {
            return [];
          }
        });

        const results = await Promise.all(videoPromises);
        allVideos = results.flat();

        allVideos.sort((a, b) => new Date(b.recorded_at || b.created_at) - new Date(a.recorded_at || a.created_at));
      } catch {
        allVideos = [];
      }

      setVideos(allVideos);

      // Fetch bài giảng của giáo viên
      let teacherLessons = [];
      try {
        teacherLessons = await getTeacherLessons(teacherId);
      } catch { teacherLessons = []; }
      setLessons(teacherLessons);

      let p2p = [];
      try {
        const firstChildId = activeStudents[0]?.id;
        if (firstChildId) {
          p2p = await getVideoModelingLibrary(firstChildId);
        }
      } catch {
        p2p = [];
      }
      setP2pContent(p2p);

    } catch (e) {
      console.warn('Teacher Library load error:', e.message);
      setStudents([]);
      setVideos([]);
      setP2pContent([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleDeleteVideo = (video) => {
    if (Platform.OS === 'web') {
      if (window.confirm('Bạn có chắc chắn muốn xóa video này không?')) {
        setVideos(prev => prev.filter(v => v.id !== video.id));
      }
    } else {
      Alert.alert(
        'Xóa video',
        'Bạn có chắc chắn muốn xóa video này không?',
        [
          { text: 'No', style: 'cancel' },
          { 
            text: 'Yes', 
            style: 'destructive',
            onPress: () => {
              setVideos(prev => prev.filter(v => v.id !== video.id));
            }
          }
        ]
      );
    }
  };

  const getChildVideoCount = useCallback((childId) => {
    return videos.filter(v => {
      const student = students.find(s => s.id === childId);
      if (!student) return false;
      return v.child_id === childId ||
             v.childName?.toLowerCase() === student.nickname?.toLowerCase() ||
             v.childName?.toLowerCase() === student.full_name?.toLowerCase();
    }).length;
  }, [videos, students]);

  const filteredStudents = students.filter(s => {
    if (!studentSearchQuery.trim()) return true;
    const q = studentSearchQuery.toLowerCase().trim();
    return (
      (s.nickname || '').toLowerCase().includes(q) ||
      (s.full_name || '').toLowerCase().includes(q)
    );
  });

  const filteredVideos = (() => {
    let result = videos;

    // Filter by Student chip
    if (selectedStudentId !== 'all') {
      result = result.filter(v => {
        const student = students.find(s => s.id === selectedStudentId);
        if (!student) return false;
        return v.child_id === selectedStudentId ||
               v.childName?.toLowerCase() === student.nickname?.toLowerCase() ||
               v.childName?.toLowerCase() === student.full_name?.toLowerCase();
      });
    }

    // Filter by Text Search (student name, notes or context)
    if (studentSearchQuery.trim()) {
      const q = studentSearchQuery.toLowerCase().trim();
      result = result.filter(v => {
        const student = students.find(s => s.id === v.child_id);
        const nameMatch = v.childName?.toLowerCase().includes(q) ||
                          student?.nickname?.toLowerCase().includes(q) ||
                          student?.full_name?.toLowerCase().includes(q);
        const notesMatch = v.notes?.toLowerCase().includes(q);
        const contextMatch = v.context?.toLowerCase().includes(q);
        return nameMatch || notesMatch || contextMatch;
      });
    }

    // Filter by Time
    if (videoFilter === 'Tất cả') return result;
    const now = new Date();
    return result.filter(v => {
      const vDate = new Date(v.recorded_at || v.created_at);
      if (videoFilter === 'Hôm nay') return vDate.toDateString() === now.toDateString();
      if (videoFilter === 'Tuần này') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return vDate >= weekAgo;
      }
      return true;
    });
  })();

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(filteredVideos.length / ITEMS_PER_PAGE);
  const paginatedVideos = filteredVideos.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    let pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages = [1, 2, 3, 4, '...', totalPages];
      } else if (currentPage >= totalPages - 2) {
        pages = [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
      } else {
        pages = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
      }
    }

    return (
      <View style={st.paginationContainer}>
        <TouchableOpacity 
          style={[st.pageBtn, currentPage === 1 && st.pageBtnDisabled]}
          onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
        >
          <Text style={st.pageBtnText}>{'<'}</Text>
        </TouchableOpacity>
        
        {pages.map((p, idx) => (
          <TouchableOpacity 
            key={idx} 
            style={[
              st.pageBtn, 
              currentPage === p && st.pageBtnActive, 
              p === '...' && { borderWidth: 0, backgroundColor: 'transparent' }
            ]}
            onPress={() => p !== '...' && setCurrentPage(p)}
            disabled={p === '...'}
          >
            <Text style={[st.pageBtnText, currentPage === p && st.pageBtnTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity 
          style={[st.pageBtn, currentPage === totalPages && st.pageBtnDisabled]}
          onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
        >
          <Text style={st.pageBtnText}>{'>'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const handleVideoAction = (action, video) => {
    if (action === 'play') {
      setPlayingVideo(video);
    } else if (action === 'report') {
      navigation?.navigate?.('AIReport', { 
        videoId: video.id, 
        childId: video.child_id,
        playbackUrl: video.playback_url
      });
    }
  };

  if (loading) return (
    <View style={st.loadingWrap}><ActivityIndicator size="large" color={colors.secondary} /></View>
  );

  return (
    <View style={st.root}>
      {/* ══ Header ══ */}
      <View style={st.header}>
        <Text style={st.headerTitle}>Thư viện</Text>
        <Text style={st.headerSub}>Kho video học tập và học liệu can thiệp dành cho giáo viên</Text>
      </View>

      {/* ══ Tab switcher ══ */}
      <View style={st.tabSwitcher}>
        <TouchableOpacity
          style={[st.tabBtn, activeTab === 'videos' && st.tabBtnActive]}
          onPress={() => setActiveTab('videos')}
        >
          <Text style={[st.tabBtnText, activeTab === 'videos' && st.tabBtnTextActive]}>📹 Video quan sát</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[st.tabBtn, activeTab === 'lessons' && st.tabBtnActive]}
          onPress={() => setActiveTab('lessons')}
        >
          <Text style={[st.tabBtnText, activeTab === 'lessons' && st.tabBtnTextActive]}>🎓 Bài giảng của tôi {lessons.length > 0 ? `(${lessons.length})` : ''}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.secondary} />}
      >
        {/* ══ Tab: Bài giảng của tôi ══ */}
        {activeTab === 'lessons' && (
          <>
            {lessons.length === 0 ? (
              <View style={st.emptyBox}>
                <Text style={{ fontSize: 32, marginBottom: spacing.sm }}>🎓</Text>
                <Text style={st.emptyText}>Chưa có bài giảng nào. Tải lên bài giảng đầu tiên trong mục Dạy học nhé!</Text>
              </View>
            ) : (
              lessons.map(l => (
                <LessonCard key={l.id} lesson={l} onPlay={(lesson) => setPlayingVideo(lesson)} />
              ))
            )}
            <View style={{ height: spacing.xl }} />
          </>
        )}

        {/* ══ Tab: Video quan sát học sinh ══ */}
        {activeTab === 'videos' && <>
        <View style={st.sectionHeader}>
          <Text style={st.sectionTitle}>Video quan sát của học sinh</Text>

          {/* Tìm kiếm nhanh học sinh hoặc từ khóa */}
          <View style={[st.searchBox, isSearchFocused && st.searchBoxFocused]}>
            <Text style={{ fontSize: 14, marginRight: 6 }}>🔍</Text>
            <TextInput
              style={st.searchInput}
              placeholder="Tìm nhanh tên bé hoặc từ khóa..."
              placeholderTextColor={colors.textLight}
              value={studentSearchQuery}
              onChangeText={setStudentSearchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
            />
            {studentSearchQuery ? (
              <TouchableOpacity onPress={() => setStudentSearchQuery('')} style={st.clearSearchBtn}>
                <Text style={{ fontSize: 14, color: colors.textLight, paddingHorizontal: 4 }}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Lọc theo Học sinh */}
          <Text style={st.filterLabel}>Học sinh:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.filterScroll}>
            <TouchableOpacity
              style={[st.studentFilterTab, selectedStudentId === 'all' && st.studentFilterTabActive]}
              onPress={() => { setSelectedStudentId('all'); setCurrentPage(1); }}
            >
              <Text style={{ fontSize: 14, marginRight: 4 }}>👥</Text>
              <Text style={[st.studentFilterTabText, selectedStudentId === 'all' && st.studentFilterTabTextActive]}>
                Tất cả bé ({videos.length})
              </Text>
            </TouchableOpacity>
            {filteredStudents.map(s => {
              const isSelected = selectedStudentId === s.id;
              const videoCount = getChildVideoCount(s.id);
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[st.studentFilterTab, isSelected && st.studentFilterTabActive]}
                  onPress={() => { setSelectedStudentId(s.id); setCurrentPage(1); }}
                >
                  <Text style={{ fontSize: 14, marginRight: 4 }}>👦</Text>
                  <Text style={[st.studentFilterTabText, isSelected && st.studentFilterTabTextActive]}>
                    {s.nickname || s.full_name.split(' ').pop()} ({videoCount})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Lọc theo Thời gian */}
          <Text style={[st.filterLabel, { marginTop: spacing.sm }]}>Thời gian:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.filterScroll}>
            {VIDEO_FILTERS.map(f => (
              <TouchableOpacity
                key={f}
                style={[st.filterTab, videoFilter === f && st.filterTabActive]}
                onPress={() => { setVideoFilter(f); setCurrentPage(1); }}
              >
                <Text style={[st.filterTabText, videoFilter === f && { color: colors.secondaryDark, fontWeight: '700' }]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {filteredVideos.length === 0 ? (
          <View style={st.emptyBox}>
            <Text style={{ fontSize: 32, marginBottom: spacing.sm }}>📹</Text>
            <Text style={st.emptyText}>Chưa có video nào của học sinh trong khoảng thời gian này</Text>
          </View>
        ) : (
          <>
            {paginatedVideos.map(v => (
              <VideoCard
                key={v.id}
                video={v}
                onViewAnalysis={handleVideoAction}
                onDeleteVideo={handleDeleteVideo}
              />
            ))}
            {renderPagination()}
          </>
        )}

        {/* ══ Peer Video Modeling (P2P) ══ */}
        <View style={[st.sectionHeader, { marginTop: spacing.md }]}>
          <Text style={st.sectionTitle}>Bạn đồng đẳng P2P</Text>
          <Text style={st.sectionSubText}>Video Modeling từ người bạn P2P</Text>
        </View>
        {p2pContent.map(c => (
          <P2PCard key={c.id} content={c} />
        ))}

        {/* ══ Professional resources ══ */}
        <View style={{ marginTop: spacing.md }}>
          <Text style={st.sectionTitle}>Tài liệu & Giáo án can thiệp</Text>
        </View>
        <ComingSoonSection title="Giáo trình Can thiệp Sớm" emoji="🎓" desc="Khung chương trình Denver ESDM và các giáo án mẫu chi tiết." />
        <ComingSoonSection title="Chuyên đề hỗ trợ rối loạn cảm giác" emoji="🎙️" desc="Cách thiết kế phòng điều hòa cảm giác và xử lý cơn bùng nổ." />
        <ComingSoonSection title="Video bài giảng từ chuyên gia" emoji="✨" desc="Các chuyên gia tâm lý hướng dẫn kỹ năng xử lý hành vi lệch chuẩn." />
        </>}
        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* Modal Video Player */}
      <Modal
        visible={!!playingVideo}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setPlayingVideo(null)}
      >
        <View style={st.modalOverlay}>
          <View style={st.videoPopupBox}>
            <View style={st.modalPopupHeader}>
              <Text style={st.modalPopupTitle} numberOfLines={1}>
                {playingVideo?.notes || 'Xem video'}
              </Text>
              <TouchableOpacity style={st.modalCloseBtnPopup} onPress={() => setPlayingVideo(null)}>
                <Text style={st.modalCloseText}>✕ Đóng</Text>
              </TouchableOpacity>
            </View>
            
            {playingVideo?.playback_url && (
              <Video
                source={{ uri: playingVideo.playback_url }}
                style={st.popupVideoPlayer}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                isLooping={false}
                shouldPlay={true}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },

  // Header
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: 56,
    paddingBottom: spacing.md,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.h2, color: colors.textDark, fontWeight: '700' },
  headerSub: { ...typography.caption, color: colors.textMid, marginTop: 2 },

  tabSwitcher: {
    flexDirection: 'row', backgroundColor: colors.bgCard,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tabBtn: {
    flex: 1, paddingVertical: spacing.sm + 2, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: colors.secondary },
  tabBtnText: { ...typography.caption, color: colors.textMid, fontWeight: '600', fontSize: 13 },
  tabBtnTextActive: { color: colors.secondaryDark, fontWeight: '700' },

  lessonCard: {
    flexDirection: 'row', backgroundColor: colors.bgCard,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    ...shadows.sm, marginBottom: spacing.sm, overflow: 'hidden',
  },
  lessonThumb: {
    width: 88, height: 80, alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  lessonInfo: { flex: 1, padding: spacing.sm },
  lessonTitle: { ...typography.label, color: colors.textDark, fontWeight: '700', fontSize: 13 },

  sectionHeader: { marginVertical: spacing.sm },
  sectionTitle: { ...typography.label, color: colors.textDark, fontWeight: '700', fontSize: 14, marginBottom: 2 },
  sectionSubText: { ...typography.caption, color: colors.textMid, marginBottom: spacing.xs },

  filterTab: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bgMuted,
  },
  filterTabActive: { borderColor: colors.secondary, backgroundColor: colors.secondaryBg },
  filterTabText: { ...typography.caption, color: colors.textMid, fontWeight: '600' },

  videoCard: {
    flexDirection: 'row', backgroundColor: colors.bgCard,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    ...shadows.sm, marginBottom: spacing.sm, overflow: 'hidden',
  },
  videoThumb: {
    width: 90, backgroundColor: colors.bgMuted,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  videoDurationBadge: {
    position: 'absolute', bottom: 6, right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
  },
  videoDurationText: { color: colors.white, fontSize: 9, fontWeight: '700' },
  videoInfo: { flex: 1, padding: spacing.sm },
  roleChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full },
  roleChipText: { fontSize: 10, fontWeight: '700' },
  videoContext: { ...typography.caption, color: colors.textMid, fontSize: 11 },
  videoNotes: { ...typography.body, color: colors.textDark, fontSize: 13, lineHeight: 18, marginBottom: 2 },
  videoDate: { ...typography.caption, color: colors.textLight, fontSize: 10 },
  processingText: { ...typography.caption, color: colors.warning, marginTop: 4 },
  viewAnalysisBtn: {
    alignSelf: 'flex-start', marginTop: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    backgroundColor: colors.secondaryBg, borderRadius: radius.sm,
  },
  viewAnalysisBtnText: { ...typography.caption, color: colors.secondaryDark, fontWeight: '700', fontSize: 11 },

  p2pCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    ...shadows.sm, marginBottom: spacing.sm, padding: spacing.sm,
  },
  p2pThumb: { width: 60, height: 60, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  p2pTitle: { ...typography.label, color: colors.textDark, fontSize: 13, lineHeight: 18, textTransform: 'none' },
  chip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full, alignSelf: 'flex-start' },
  chipText: { fontSize: 10, fontWeight: '600' },

  comingSoonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  comingSoonEmoji: { fontSize: 24 },
  comingSoonTitle: { ...typography.label, color: colors.textDark, fontWeight: '600', textTransform: 'none' },
  comingSoonSub: { ...typography.caption, color: colors.textLight, marginTop: 2 },
  comingSoonBadge: { backgroundColor: colors.bgSection, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.borderStrong },
  comingSoonBadgeText: { ...typography.caption, color: colors.textMid, fontSize: 10, fontWeight: '700' },

  emptyBox: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText: { ...typography.body, color: colors.textMid, textAlign: 'center' },

  // Search box styles
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgMuted,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    height: 40,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  searchBoxFocused: {
    borderColor: colors.secondary,
    backgroundColor: colors.bgCard,
    ...shadows.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.textDark,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: spacing.xs,
  },

  filterLabel: {
    ...typography.caption,
    color: colors.textLight,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterScroll: {
    gap: 8,
    paddingVertical: 4,
    marginBottom: spacing.xs,
  },
  studentFilterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgMuted,
  },
  studentFilterTabActive: {
    borderColor: colors.secondary,
    backgroundColor: colors.secondaryBg,
  },
  studentFilterTabText: {
    ...typography.caption,
    color: colors.textMid,
    fontWeight: '600',
  },
  studentFilterTabTextActive: {
    color: colors.secondaryDark,
    fontWeight: '700',
  },
  
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: spacing.sm,
    gap: 6,
  },
  pageBtn: {
    minWidth: 32,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  pageBtnActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  pageBtnDisabled: {
    opacity: 0.5,
  },
  pageBtnText: {
    ...typography.body,
    color: colors.textDark,
    fontSize: 14,
  },
  pageBtnTextActive: {
    color: colors.white,
    fontWeight: '700',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  videoPopupBox: {
    width: '100%',
    aspectRatio: 3/4,
    maxHeight: '80%',
    backgroundColor: '#000',
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadows.lg,
  },
  modalPopupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalPopupTitle: {
    ...typography.label,
    color: '#fff',
    flex: 1,
    marginRight: spacing.sm,
  },
  modalCloseBtnPopup: {
    padding: spacing.xs,
  },
  modalCloseText: {
    ...typography.bodySm,
    color: colors.secondaryLight,
    fontWeight: '700',
  },
  popupVideoPlayer: {
    width: '100%',
    flex: 1,
  },
});
