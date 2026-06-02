import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { getChildrenByParent, getHpdtHistory, getIEPGoals } from '../../lib/supabase';
import { colors, radius, shadows, spacing } from '../../lib/colors';
import { typography } from '../../lib/typography';

const DOMAINS = [
  { key: 'communication_score', domain: 'communication', label: 'Giao tiếp' },
  { key: 'social_score', domain: 'social', label: 'Xã hội' },
  { key: 'behavior_score', domain: 'behavior', label: 'Hành vi' },
  { key: 'sensory_score', domain: 'sensory', label: 'Cảm giác' },
  { key: 'motor_score', domain: 'motor', label: 'Vận động' },
  { key: 'cognitive_score', domain: 'cognitive', label: 'Nhận thức' },
];

export default function ProgressScreen() {
  const { user, session } = useAuth();
  const [child, setChild] = useState(null);
  const [hpdt, setHpdt] = useState(null);
  const [history, setHistory] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const userId = session?.user?.id || user?.id;
      if (!userId) return;

      const children = await getChildrenByParent(userId);
      const activeChild = children?.[0] || null;
      setChild(activeChild);
      setHpdt(activeChild?.hpdt_profiles?.[0] || null);

      if (activeChild?.id) {
        const [historyRes, goalsRes] = await Promise.allSettled([
          getHpdtHistory(activeChild.id, 8),
          getIEPGoals(activeChild.id),
        ]);
        setHistory(historyRes.status === 'fulfilled' ? historyRes.value : []);
        setGoals(goalsRes.status === 'fulfilled' ? goalsRes.value : []);
      }
    } catch (error) {
      console.warn('Progress load error:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session, user]);

  useEffect(() => { loadData(); }, [loadData]);

  const trend = useMemo(() => {
    const rows = history.length ? history : (hpdt ? [{ recorded_at: hpdt.last_updated, overall_score: hpdt.overall_score }] : []);
    return rows.slice(-4);
  }, [history, hpdt]);

  const latestScore = hpdt?.overall_score ?? trend[trend.length - 1]?.overall_score ?? 0;
  const firstScore = trend[0]?.overall_score ?? latestScore;
  const delta = Math.round((latestScore || 0) - (firstScore || 0));

  if (loading) {
    return <View style={st.loadingWrap}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <ScrollView
      style={st.root}
      contentContainerStyle={st.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
    >
      <Text style={st.screenTitle}>Tiến trình</Text>
      {child && <Text style={st.screenSub}>{child.full_name || child.nickname}</Text>}

      <View style={st.card}>
        <Text style={st.cardTitle}>Xu hướng hpDT gần đây</Text>
        {trend.length ? (
          <>
            <View style={st.trendRow}>
              {trend.map((row, i) => {
                const score = Math.round(row.overall_score || 0);
                return (
                  <View key={`${row.recorded_at}-${i}`} style={st.trendCol}>
                    <View style={st.trendBar}>
                      <View style={[st.trendFill, { height: `${Math.max(score, 4)}%` }]} />
                    </View>
                    <Text style={st.trendScore}>{score}</Text>
                    <Text style={st.trendLabel}>L{i + 1}</Text>
                  </View>
                );
              })}
            </View>
            <Text style={[st.trendNote, { color: delta >= 0 ? colors.success : colors.warning }]}>
              {delta >= 0 ? `Tăng +${delta}` : `Giảm ${delta}`} điểm trong dữ liệu gần nhất
            </Text>
          </>
        ) : (
          <Text style={st.emptyText}>Chưa có lịch sử hpDT cho bé.</Text>
        )}
      </View>

      <View style={st.card}>
        <Text style={st.cardTitle}>Chi tiết theo lĩnh vực</Text>
        {hpdt ? DOMAINS.map(d => {
          const score = Math.round(hpdt[d.key] || 0);
          const color = colors.domain[d.domain] || colors.primary;
          return (
            <View key={d.key} style={st.domainRow}>
              <View style={[st.domainDot, { backgroundColor: color }]} />
              <Text style={st.domainLabel}>{d.label}</Text>
              <View style={st.domainBarWrap}>
                <View style={[st.domainBarFill, { width: `${score}%`, backgroundColor: color }]} />
              </View>
              <Text style={[st.domainScore, { color }]}>{score}</Text>
            </View>
          );
        }) : <Text style={st.emptyText}>Chưa có hồ sơ hpDT.</Text>}
      </View>

      <View style={st.card}>
        <Text style={st.cardTitle}>Mục tiêu IEP đang thực hiện</Text>
        {goals.length ? goals.map(goal => (
          <View key={goal.id} style={st.goalRow}>
            <Text style={st.goalTitle}>{goal.goal_title}</Text>
            <Text style={st.goalPct}>{goal.current_progress_pct || 0}%</Text>
          </View>
        )) : <Text style={st.emptyText}>Chưa có mục tiêu IEP active.</Text>}
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  screenTitle: { ...typography.h2, color: colors.textDark },
  screenSub: { ...typography.bodySm, color: colors.textMid, marginTop: 2, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
    ...shadows.sm, marginBottom: spacing.md,
  },
  cardTitle: { ...typography.label, color: colors.textDark, fontWeight: '700', fontSize: 15, marginBottom: spacing.md },
  trendRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginBottom: spacing.sm, height: 92 },
  trendCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  trendBar: { width: '80%', height: 72, backgroundColor: colors.bgMuted, borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  trendFill: { width: '100%', borderRadius: 4, backgroundColor: colors.primary },
  trendScore: { ...typography.caption, color: colors.primary, fontWeight: '700', marginTop: 3 },
  trendLabel: { ...typography.caption, color: colors.textLight, fontSize: 10 },
  trendNote: { ...typography.caption, fontWeight: '700', marginTop: spacing.xs },
  domainRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  domainDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.xs },
  domainLabel: { ...typography.caption, color: colors.textMid, width: 76, fontSize: 12 },
  domainBarWrap: { flex: 1, height: 8, backgroundColor: colors.bgMuted, borderRadius: 4, overflow: 'hidden', marginHorizontal: spacing.xs },
  domainBarFill: { height: '100%', borderRadius: 4 },
  domainScore: { ...typography.caption, fontWeight: '700', fontSize: 12, width: 28, textAlign: 'right' },
  goalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  goalTitle: { ...typography.bodySm, color: colors.textDark, flex: 1, lineHeight: 18 },
  goalPct: { ...typography.label, color: colors.primary, fontWeight: '800', marginLeft: spacing.sm },
  emptyText: { ...typography.body, color: colors.textLight, textAlign: 'center', paddingVertical: spacing.md },
});
