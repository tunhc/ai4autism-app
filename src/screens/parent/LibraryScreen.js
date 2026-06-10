import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View, Image, Modal, SafeAreaView, Alert, Platform
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useAuth } from '../../contexts/AuthContext';
import { getChildrenByParent, getObservationVideos, getVideoModelingLibrary, getChildLessons, supabase } from '../../lib/supabase';
import { colors, radius, shadows, spacing } from '../../lib/colors';
import { typography } from '../../lib/typography';

const VIDEO_FILTERS = ['Tất cả', 'Hôm nay', 'Tuần này'];
const DOMAIN_COLORS = {
  communication: colors.domain.communication, social: colors.domain.social,
  behavior: colors.domain.behavior, sensory: colors.domain.sensory,
  motor: colors.domain.motor, cognitive: colors.domain.cognitive,
};
const DOMAIN_LABELS = {
  communication: 'Giao tiếp', social: 'Xã hội', behavior: 'Hành vi',
  sensory: 'Cảm giác', motor: 'Vận động', cognitive: 'Nhận thức',
};

function VideoCard({ video, onViewAnalysis, onPlayVideo, onDeleteVideo }) {
  const d = new Date(video.recorded_at || video.created_at);
  const now = Date.now();
  const hoursSinceUpload = (now - d.getTime()) / (1000 * 60 * 60);
  const canDelete = hoursSinceUpload <= 48 && video.uploaded_by_role === 'parent';

  const isProcessing = video.video_status === 'processing';
  const roleLabel = video.uploaded_by_role === 'teacher' ? 'Giáo viên' : 'Phụ huynh';
  const roleBg = video.uploaded_by_role === 'teacher' ? colors.secondaryBg : colors.primaryBg;
  const roleColor = video.uploaded_by_role === 'teacher' ? colors.secondaryDark : colors.primaryDark;
  const duration = video.duration_seconds ? `${Math.floor(video.duration_seconds / 60)}:${String(video.duration_seconds % 60).padStart(2, '0')}` : null;
  return (
    <View style={st.videoCard}>
      <TouchableOpacity 
        style={st.videoThumb} 
        onPress={() => !isProcessing && onPlayVideo(video)}
        activeOpacity={isProcessing ? 1 : 0.8}
      >
        {isProcessing ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : video.thumbnail_url ? (
          <>
            <Image source={{ uri: video.thumbnail_url }} style={st.thumbImage} resizeMode="cover" />
            <View style={st.playOverlay}>
              <Text style={{ fontSize: 20 }}>▶️</Text>
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
          <Text style={[st.videoContext, { flex: 1 }]} numberOfLines={1}>📍 {video.context || 'Nhà'}</Text>
          {canDelete && (
            <TouchableOpacity onPress={() => onDeleteVideo(video)} style={{ padding: 4 }}>
              <Text style={{ fontSize: 16 }}>🗑️</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={st.videoNotes} numberOfLines={2}>{video.notes || 'Không có ghi chú'}</Text>
        <Text style={st.videoDate}>{d.getDate()}/{d.getMonth() + 1}/{d.getFullYear()} {String(d.getHours()).padStart(2,'0')}:{String(d.getMinutes()).padStart(2,'0')}</Text>
        {isProcessing
          ? <Text style={st.processingText}>⏳ Đang phân tích AI...</Text>
          : (
            <TouchableOpacity style={st.viewAnalysisBtn} onPress={onViewAnalysis}>
              <Text style={st.viewAnalysisBtnText}>Xem phân tích →</Text>
            </TouchableOpacity>
          )
        }
      </View>
    </View>
  );
}

function P2PCard({ content }) {
  const col = DOMAIN_COLORS[content.domain] || colors.primary;
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
          <Text style={st.videoDate}>{duration}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ComingSoonSection({ title, emoji }) {
  return (
    <View style={st.comingSoonCard}>
      <Text style={st.comingSoonEmoji}>{emoji}</Text>
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={st.comingSoonTitle}>{title}</Text>
        <Text style={st.comingSoonSub}>Sắp ra mắt trong phiên bản tiếp theo</Text>
      </View>
      <View style={st.comingSoonBadge}>
        <Text style={st.comingSoonBadgeText}>Sắp có</Text>
      </View>
    </View>
  );
}

export default function LibraryScreen({ navigation }) {
  const { user, session } = useAuth();

  const [videos, setVideos] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [p2pContent, setP2pContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [videoFilter, setVideoFilter] = useState('Tất cả');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeChildId, setActiveChildId] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const userId = session?.user?.id || user?.id;
      if (!userId) return;

      let childList = [];
      try {
        childList = await getChildrenByParent(userId);
      } catch { childList = []; }

      const childId = childList?.[0]?.id;
      setActiveChildId(childId || null);

      let vids = [];
      if (childId) {
        try { vids = await getObservationVideos(childId); } catch { vids = []; }
      }
      setVideos(vids);

      // Bài giảng của GV gắn với bé này
      let childLessons = [];
      if (childId) {
        try { childLessons = await getChildLessons(childId); } catch { childLessons = []; }
      }
      setLessons(childLessons);

      let p2p = [];
      if (childId) {
        try { p2p = await getVideoModelingLibrary(childId); } catch { p2p = []; }
      }
      setP2pContent(p2p);

    } catch (e) {
      console.warn('Library load error:', e.message);
      setVideos([]);
      setP2pContent([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session, user]);

  useEffect(() => { loadData(); }, [loadData]);
  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);

  const handleDeleteVideo = (video) => {
    const doDelete = async () => {
      try {
        // Xóa các report liên quan trước để tránh lỗi foreign key (do DB không có ON DELETE CASCADE)
        await supabase.from('ai_reports').delete().eq('video_id', video.id);
        
        const { error } = await supabase.from('observation_videos').delete().eq('id', video.id);
        if (error) throw error;
        setVideos(prev => prev.filter(v => v.id !== video.id));
      } catch (err) {
        console.error('Lỗi khi xóa video:', err);
        const errMsg = err?.message || JSON.stringify(err) || 'Lỗi không xác định';
        if (Platform.OS === 'web') {
          window.alert(`Lỗi: Không thể xóa video. Chi tiết: ${errMsg}`);
        } else {
          Alert.alert('Lỗi', `Không thể xóa video. Chi tiết: ${errMsg}`);
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Bạn có chắc chắn muốn xóa video này không?')) {
        doDelete();
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
            onPress: doDelete
          }
        ]
      );
    }
  };

  const filteredVideos = (() => {
    if (videoFilter === 'Tất cả') return videos;
    const now = new Date();
    return videos.filter(v => {
      const vDate = new Date(v.recorded_at || v.created_at);
      if (videoFilter === 'Hôm nay') return vDate.toDateString() === now.toDateString();
      if (videoFilter === 'Tuần này') {
        const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
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

  if (loading) return (
    <View style={st.loadingWrap}><ActivityIndicator size="large" color={colors.primary} /></View>
  );

  return (
    <ScrollView
      style={st.root}
      contentContainerStyle={st.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Text style={st.screenTitle}>Thư viện</Text>

      {/* ══ Video của bé ══ */}
      <View style={st.sectionHeader}>
        <Text style={st.sectionTitle}>Video của bé</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {VIDEO_FILTERS.map(f => (
              <TouchableOpacity
                key={f}
                style={[st.filterTab, videoFilter === f && st.filterTabActive]}
                onPress={() => { setVideoFilter(f); setCurrentPage(1); }}
              >
                <Text style={[st.filterTabText, videoFilter === f && { color: colors.primary, fontWeight: '700' }]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {filteredVideos.length === 0
        ? (
          <View style={st.emptyBox}>
            <Text style={{ fontSize: 32, marginBottom: spacing.sm }}>📹</Text>
            <Text style={st.emptyText}>Chưa có video nào trong khoảng thời gian này</Text>
          </View>
        )
        : (
          <>
            {paginatedVideos.map(v => (
              <VideoCard
                key={v.id}
                video={v}
                onPlayVideo={(vid) => setPlayingVideo(vid)}
                onDeleteVideo={handleDeleteVideo}
                onViewAnalysis={() => navigation?.navigate?.('AIReport', { 
                  videoId: v.id, 
                  childId: v.child_id || activeChildId,
                  playbackUrl: v.playback_url
                })}
              />
            ))}
            {renderPagination()}
          </>
        )
      }

      {/* ══ Bạn đồng đẳng P2P ══ */}
      <View style={[st.sectionHeader, { marginTop: spacing.md }]}>
        <Text style={st.sectionTitle}>Bạn đồng đẳng P2P</Text>
        <Text style={st.sectionSub}>Video mẫu từ bé khác cùng độ tuổi</Text>
      </View>
      {p2pContent.map(c => <P2PCard key={c.id} content={c} />)}

      {/* ══ Bài giảng của giáo viên cho bé ══ */}
      <View style={{ marginTop: spacing.md }}>
        <Text style={st.sectionTitle}>Bài giảng của giáo viên</Text>
        <Text style={st.sectionSub}>Video bài giảng giáo viên dành riêng cho bé</Text>
      </View>
      {lessons.length === 0 ? (
        <View style={[st.emptyBox, { marginBottom: spacing.sm }]}>
          <Text style={{ fontSize: 24, marginBottom: 4 }}>🎓</Text>
          <Text style={st.emptyText}>Giáo viên chưa đăng bài giảng nào cho bé</Text>
        </View>
      ) : (
        lessons.map(l => {
          const col = DOMAIN_COLORS[l.domain] || colors.primary;
          const dur = l.duration_seconds
            ? `${Math.floor(l.duration_seconds / 60)}:${String(l.duration_seconds % 60).padStart(2, '0')}`
            : '--';
          const d = new Date(l.created_at);
          return (
            <TouchableOpacity key={l.id} style={st.p2pCard} activeOpacity={0.82}>
              <View style={[st.p2pThumb, { backgroundColor: col + '22' }]}>
                <Text style={{ fontSize: 24 }}>🎓</Text>
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={st.p2pTitle} numberOfLines={2}>{l.title}</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  {l.domain && (
                    <View style={[st.chip, { backgroundColor: col + '22' }]}>
                      <Text style={[st.chipText, { color: col }]}>{DOMAIN_LABELS[l.domain] || l.domain}</Text>
                    </View>
                  )}
                  <Text style={st.videoDate}>{dur} • {d.getDate()}/{d.getMonth() + 1}/{d.getFullYear()}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      )}

      {/* ══ Nội dung học tập — Coming Soon ══ */}
      <View style={{ marginTop: spacing.md }}>
        <Text style={st.sectionTitle}>Nội dung học tập</Text>
      </View>
      <ComingSoonSection title="Podcast mới" emoji="🎙️" />
      <ComingSoonSection title="Gợi ý cho bé" emoji="✨" />

      <View style={{ height: spacing.xl }} />

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

    </ScrollView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },

  screenTitle: { ...typography.h2, color: colors.textDark, marginBottom: spacing.md },

  sectionHeader: { marginBottom: spacing.sm },
  sectionTitle: { ...typography.label, color: colors.textDark, fontWeight: '700', fontSize: 16, marginBottom: 4 },
  sectionSub: { ...typography.caption, color: colors.textMid },

  filterTab: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bgMuted,
  },
  filterTabActive: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  filterTabText: { ...typography.caption, color: colors.textMid, fontWeight: '600' },

  videoCard: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  videoThumb: {
    width: 100, height: 75,
    borderRadius: radius.md,
    backgroundColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
    marginRight: spacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  playOverlay: {
    position: 'absolute',
    width: 32, height: 32,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  videoDurationBadge: {
    position: 'absolute', bottom: 6, right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
  },
  videoDurationText: { color: colors.white, fontSize: 9, fontWeight: '700' },
  videoInfo: { flex: 1, justifyContent: 'center' },
  roleChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full, alignSelf: 'flex-start', marginBottom: 4 },
  roleChipText: { fontSize: 10, fontWeight: '700' },
  videoContext: { ...typography.caption, color: colors.textMid, fontSize: 11 },
  videoNotes: { ...typography.body, color: colors.textDark, fontSize: 13, lineHeight: 18, marginBottom: 2 },
  videoDate: { ...typography.caption, color: colors.textLight, fontSize: 10 },
  processingText: { ...typography.caption, color: colors.warning, marginTop: 4 },
  viewAnalysisBtn: {
    alignSelf: 'flex-start', marginTop: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    backgroundColor: colors.primaryBg, borderRadius: radius.sm,
  },
  viewAnalysisBtnText: { ...typography.caption, color: colors.primary, fontWeight: '700', fontSize: 11 },

  p2pCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    ...shadows.sm, marginBottom: spacing.sm, padding: spacing.sm,
  },
  p2pThumb: { width: 60, height: 60, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  p2pTitle: { ...typography.label, color: colors.textDark, fontSize: 13, lineHeight: 18 },
  chip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full, alignSelf: 'flex-start' },
  chipText: { fontSize: 10, fontWeight: '600' },

  comingSoonCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgMuted, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  comingSoonEmoji: { fontSize: 24 },
  comingSoonTitle: { ...typography.label, color: colors.textDark, fontWeight: '600' },
  comingSoonSub: { ...typography.caption, color: colors.textLight, marginTop: 2 },
  comingSoonBadge: { backgroundColor: colors.warningBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  comingSoonBadgeText: { ...typography.caption, color: colors.warningDark, fontWeight: '700' },
  
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
    color: colors.primaryLight,
    fontWeight: '700',
  },
  popupVideoPlayer: {
    width: '100%',
    flex: 1,
  },
  emptyBox: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText: { ...typography.body, color: colors.textMid, textAlign: 'center' },

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
    backgroundColor: colors.primary,
    borderColor: colors.primary,
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
});
