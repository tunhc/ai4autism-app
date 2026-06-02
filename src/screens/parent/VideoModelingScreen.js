import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Linking, RefreshControl, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { getChildrenByParent, getVideoModelingLibrary } from '../../lib/supabase';
import { colors, radius, spacing, shadows } from '../../lib/colors';
import { typography } from '../../lib/typography';

const DOMAIN_LABELS = {
  communication: 'Giao tiếp',
  social: 'Xã hội',
  behavior: 'Hành vi',
  sensory: 'Cảm giác',
  motor: 'Vận động',
  cognitive: 'Nhận thức',
};

export default function VideoModelingScreen({ navigation, route }) {
  const { user, session } = useAuth();
  const [child, setChild] = useState(route?.params?.child || null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const userId = session?.user?.id || user?.id;
      let activeChild = child;
      if (!activeChild && userId) {
        const children = await getChildrenByParent(userId);
        activeChild = children?.[0] || null;
        setChild(activeChild);
      }
      setVideos(activeChild?.id ? await getVideoModelingLibrary(activeChild.id) : []);
    } catch (error) {
      console.warn('Video modeling load error:', error.message);
      setVideos([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [child, session, user]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return <View style={styles.loadingWrap}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
    >
      {navigation?.goBack && (
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Quay lại</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.screenTitle}>Video mẫu</Text>
      {child && <Text style={styles.screenSub}>{child.full_name || child.nickname}</Text>}

      {videos.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyTitle}>Chưa có video mẫu</Text>
          <Text style={styles.emptySub}>Video hướng dẫn được gán cho bé hoặc chia sẻ chung sẽ hiện ở đây.</Text>
        </View>
      ) : videos.map(video => {
        const color = colors.domain[video.domain] || colors.primary;
        const url = video.video_url || video.url || video.playback_url;
        return (
          <TouchableOpacity
            key={video.id}
            style={styles.videoCard}
            activeOpacity={0.85}
            onPress={() => url && Linking.openURL(url)}
          >
            <View style={[styles.thumb, { backgroundColor: color + '22' }]}>
              <Text style={styles.playIcon}>▶</Text>
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.videoTitle}>{video.title || video.name || 'Video mẫu'}</Text>
              <View style={styles.metaRow}>
                {!!video.domain && (
                  <View style={[styles.chip, { backgroundColor: color + '22' }]}>
                    <Text style={[styles.chipText, { color }]}>{DOMAIN_LABELS[video.domain] || video.domain}</Text>
                  </View>
                )}
                {!!video.difficulty && <Text style={styles.metaText}>{video.difficulty}</Text>}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  backBtn: { alignSelf: 'flex-start', marginBottom: spacing.md },
  backText: { ...typography.bodySm, color: colors.primary, fontWeight: '600' },
  screenTitle: { ...typography.h2, color: colors.textDark },
  screenSub: { ...typography.bodySm, color: colors.textMid, marginTop: 2, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    padding: spacing.xl, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, ...shadows.sm,
  },
  emptyTitle: { ...typography.h4, color: colors.textDark, marginBottom: spacing.sm },
  emptySub: { ...typography.body, color: colors.textLight, textAlign: 'center', lineHeight: 20 },
  videoCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
    ...shadows.sm, marginBottom: spacing.md,
  },
  thumb: { width: 68, height: 68, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  playIcon: { fontSize: 24, color: colors.textDark, fontWeight: '800' },
  videoTitle: { ...typography.label, color: colors.textDark, fontWeight: '700', lineHeight: 19 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  chip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full },
  chipText: { fontSize: 10, fontWeight: '700' },
  metaText: { ...typography.caption, color: colors.textLight, fontSize: 10 },
});
