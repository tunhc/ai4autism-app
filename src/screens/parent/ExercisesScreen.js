import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { completeHomeActivity, getChildrenByParent, getHomeActivities } from '../../lib/supabase';
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

export default function ExercisesScreen({ navigation, route }) {
  const { user, session } = useAuth();
  const [child, setChild] = useState(route?.params?.child || null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const userId = session?.user?.id || user?.id;
      let activeChild = child;
      if (!activeChild && userId) {
        const children = await getChildrenByParent(userId);
        activeChild = children?.[0] || null;
        setChild(activeChild);
      }
      if (!activeChild?.id) {
        setActivities([]);
        return;
      }
      setActivities(await getHomeActivities(activeChild.id));
    } catch (error) {
      console.warn('Exercises load error:', error.message);
      setActivities([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [child, session, user]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleComplete(activity) {
    try {
      setSavingId(activity.id);
      await completeHomeActivity(activity.id, child.id, session?.user?.id || user?.id);
      await loadData();
    } catch (error) {
      Alert.alert('Không lưu được', error.message);
    } finally {
      setSavingId(null);
    }
  }

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

      <Text style={styles.screenTitle}>Bài tập hôm nay</Text>
      {child && <Text style={styles.screenSub}>{child.full_name || child.nickname}</Text>}

      {activities.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyTitle}>Chưa có bài tập active</Text>
          <Text style={styles.emptySub}>Khi giáo viên hoặc AI giao bài, danh sách sẽ hiện ở đây.</Text>
        </View>
      ) : activities.map(activity => {
        const ex = activity.exercises || {};
        const done = (activity.completed_sessions || 0) >= (activity.required_sessions || 1);
        const color = colors.domain[ex.domain] || colors.primary;
        return (
          <View key={activity.id} style={styles.activityCard}>
            <View style={styles.activityHead}>
              <View style={[styles.domainChip, { backgroundColor: color + '22' }]}>
                <Text style={[styles.domainChipText, { color }]}>{DOMAIN_LABELS[ex.domain] || ex.domain || 'Bài tập'}</Text>
              </View>
              <Text style={styles.progressText}>{activity.completed_sessions || 0}/{activity.required_sessions || 1}</Text>
            </View>
            <Text style={styles.activityTitle}>{ex.name || 'Bài tập tại nhà'}</Text>
            {!!ex.description && <Text style={styles.activityDesc}>{ex.description}</Text>}
            {!!activity.notes && <Text style={styles.noteText}>{activity.notes}</Text>}
            <TouchableOpacity
              style={[styles.doneBtn, done && styles.doneBtnDisabled]}
              onPress={() => handleComplete(activity)}
              disabled={done || savingId === activity.id}
            >
              {savingId === activity.id
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Text style={styles.doneBtnText}>{done ? 'Đã hoàn thành' : 'Đánh dấu đã làm'}</Text>
              }
            </TouchableOpacity>
          </View>
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
  activityCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
    ...shadows.sm, marginBottom: spacing.md,
  },
  activityHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  domainChip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.full },
  domainChipText: { ...typography.caption, fontWeight: '700', fontSize: 11 },
  progressText: { ...typography.caption, color: colors.textMid, fontWeight: '700' },
  activityTitle: { ...typography.h4, color: colors.textDark, marginBottom: 6 },
  activityDesc: { ...typography.body, color: colors.textMid, lineHeight: 20 },
  noteText: { ...typography.caption, color: colors.textLight, marginTop: spacing.sm, lineHeight: 18 },
  doneBtn: {
    marginTop: spacing.md, height: 44, borderRadius: radius.md,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  doneBtnDisabled: { backgroundColor: colors.success },
  doneBtnText: { ...typography.btn, color: colors.white, fontWeight: '700' },
});
