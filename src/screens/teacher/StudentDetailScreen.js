import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { colors, radius, spacing, shadows } from '../../lib/colors';
import { typography } from '../../lib/typography';
import { supabase, getIEPGoals, getLatestAIReport } from '../../lib/supabase';

// ── Domain config (6 chiều, không có overall) ─────────────────────────────────
const DOMAINS = [
  { key: 'communication_score', domain: 'communication', label: 'Giao tiếp',  color: colors.domain.communication },
  { key: 'social_score',        domain: 'social',        label: 'Xã hội',     color: colors.domain.social },
  { key: 'behavior_score',      domain: 'behavior',      label: 'Hành vi',    color: colors.domain.behavior },
  { key: 'sensory_score',       domain: 'sensory',       label: 'Cảm giác',   color: colors.domain.sensory },
  { key: 'motor_score',         domain: 'motor',         label: 'Vận động',   color: colors.domain.motor },
  { key: 'cognitive_score',     domain: 'cognitive',     label: 'Nhận thức',  color: colors.domain.cognitive },
];

function getDomainMeta(key) {
  return DOMAINS.find(d => d.domain === key || d.key === key) || { label: key, color: colors.primary };
}

// ── Mock fallbacks ─────────────────────────────────────────────────────────────
const MOCK_CHILD = {
  id: 's1',
  full_name: 'Nguyễn Minh Anh',
  nickname: 'Minh Anh',
  age: 4,
  diagnostic_level: 'Mức 2 - Cần hỗ trợ đáng kể',
  hpdt_profiles: [{
    communication_score: 65,
    social_score:        58,
    behavior_score:      72,
    sensory_score:       61,
    motor_score:         68,
    cognitive_score:     74,
    overall_score:       67,
    last_updated:        '2026-05-20',
  }],
};

const MOCK_IEP = [
  { id: 'g1', domain: 'communication', goal_title: 'Duy trì giao tiếp mắt 3-5 giây khi gọi tên', current_progress_pct: 70, deadline: '2026-08-01', priority_rank: 1 },
  { id: 'g2', domain: 'social',        goal_title: 'Nói câu 2-3 từ để yêu cầu đồ vật',            current_progress_pct: 50, deadline: '2026-08-01', priority_rank: 2 },
  { id: 'g3', domain: 'motor',         goal_title: 'Ngồi làm bài liên tục 5 phút',                 current_progress_pct: 80, deadline: '2026-07-01', priority_rank: 3 },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function OverallCircle({ score }) {
  const borderColor =
    score >= 70 ? colors.secondary :
    score >= 50 ? colors.amber :
                  colors.danger;
  const textColor = borderColor;

  return (
    <View style={[styles.circle, { borderColor }]}>
      <Text style={[styles.circleScore, { color: textColor }]}>{score}</Text>
      <Text style={styles.circleLabel}>hpDT</Text>
    </View>
  );
}

function DomainBar({ label, score, color }) {
  const pct = Math.min(Math.max(score, 0), 100);
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.barVal, { color }]}>{score}</Text>
    </View>
  );
}

function IEPCard({ goal }) {
  const pct  = goal.current_progress_pct ?? 0;
  const meta = getDomainMeta(goal.domain);
  const chipBg = meta.color + '22';

  return (
    <View style={styles.iepCard}>
      <View style={styles.iepTop}>
        <View style={[styles.iepChip, { backgroundColor: chipBg }]}>
          <Text style={[styles.iepChipText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <Text style={styles.iepPct}>{pct}%</Text>
      </View>
      <Text style={styles.iepTitle}>{goal.goal_title}</Text>
      <View style={styles.iepTrack}>
        <View style={[styles.iepFill, { width: `${pct}%`, backgroundColor: meta.color }]} />
      </View>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function StudentDetailScreen({ navigation, route }) {
  const studentId          = route.params?.studentId;
  const studentNameFallback = route.params?.studentName;

  const [child,    setChild]    = useState(null);
  const [iepGoals, setIepGoals] = useState([]);
  const [aiReport, setAiReport] = useState(null);
  const [loading,  setLoading]  = useState(true);

  const loadData = useCallback(async () => {
    if (!studentId) {
      setChild(MOCK_CHILD);
      setIepGoals(MOCK_IEP);
      setLoading(false);
      return;
    }
    try {
      const [childRes, iepRes, aiRes] = await Promise.allSettled([
        supabase
          .from('children')
          .select(`
            id, full_name, nickname, age, diagnostic_level,
            hpdt_profiles(
              communication_score, social_score, behavior_score,
              sensory_score, motor_score, cognitive_score,
              overall_score, last_updated
            )
          `)
          .eq('id', studentId)
          .single(),
        getIEPGoals(studentId),
        getLatestAIReport(studentId),
      ]);

      const childData =
        childRes.status === 'fulfilled' && !childRes.value.error
          ? childRes.value.data
          : MOCK_CHILD;

      setChild(childData ?? MOCK_CHILD);
      setIepGoals(
        iepRes.status === 'fulfilled' && iepRes.value?.length
          ? iepRes.value
          : MOCK_IEP
      );
      setAiReport(aiRes.status === 'fulfilled' ? aiRes.value : null);
    } catch {
      setChild(MOCK_CHILD);
      setIepGoals(MOCK_IEP);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Loading ──
  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.secondary} />
        {studentNameFallback && (
          <Text style={styles.loadingName}>{studentNameFallback}</Text>
        )}
      </View>
    );
  }

  const hpdt        = child?.hpdt_profiles?.[0] || {};
  const overallScore = hpdt.overall_score ?? child?.overall_score ?? '--';
  const lastUpdated  = hpdt.last_updated
    ? new Date(hpdt.last_updated).toLocaleDateString('vi-VN')
    : null;

  return (
    <View style={styles.root}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Quay lại</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hồ sơ học sinh</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero Card ── */}
        <View style={[styles.heroCard, { backgroundColor: colors.primaryBg }]}>
          <View style={styles.heroInfo}>
            <View style={styles.heroAvatar}>
              <Text style={styles.heroEmoji}>👦</Text>
            </View>
            <View style={styles.heroText}>
              <Text style={styles.heroName}>{child?.full_name}</Text>
              {child?.nickname && child.nickname !== child.full_name && (
                <Text style={styles.heroNick}>"{child.nickname}"</Text>
              )}
              <Text style={styles.heroMeta}>
                {child?.age ? `${child.age} tuổi` : ''}
                {child?.diagnostic_level ? `  •  ${child.diagnostic_level}` : ''}
              </Text>
            </View>
          </View>
          <OverallCircle score={overallScore} />
        </View>

        {/* ── hpDT 6 Chiều ── */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>CHỈ SỐ hpDT — 6 CHIỀU</Text>
            {lastUpdated && (
              <Text style={styles.cardSub}>Cập nhật {lastUpdated}</Text>
            )}
          </View>
          {DOMAINS.map(d => (
            <DomainBar
              key={d.key}
              label={d.label}
              score={hpdt[d.key] ?? 0}
              color={d.color}
            />
          ))}
        </View>

        {/* ── IEP Goals ── */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>MỤC TIÊU IEP ĐANG THỰC HIỆN</Text>
            <Text style={styles.cardSub}>{iepGoals.length} mục tiêu</Text>
          </View>
          {iepGoals.length === 0 ? (
            <Text style={styles.emptyText}>Chưa có mục tiêu IEP nào đang hoạt động.</Text>
          ) : (
            iepGoals.map(g => <IEPCard key={g.id} goal={g} />)
          )}
        </View>

        {/* ── AI Report (nếu có) ── */}
        {aiReport && (
          <View style={[styles.card, styles.aiCard]}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>PHÂN TÍCH AI GẦN NHẤT</Text>
              <Text style={[styles.cardSub, { color: colors.teal }]}>
                {new Date(aiReport.created_at).toLocaleDateString('vi-VN')}
              </Text>
            </View>
            {aiReport.summary ? (
              <Text style={styles.aiSummary}>{aiReport.summary}</Text>
            ) : (
              <Text style={styles.aiSummary}>Báo cáo đã sẵn sàng. Xem chi tiết trong tab Thư viện.</Text>
            )}
          </View>
        )}

        {/* ── CTA Buttons ── */}
        <TouchableOpacity
          style={[styles.ctaBtn, styles.ctaBtnSecondary]}
          onPress={() => navigation.navigate('TeacherExercises', {
            studentId:   child?.id,
            studentName: child?.full_name,
          })}
          activeOpacity={0.8}
        >
          <Text style={[styles.ctaBtnText, { color: colors.secondary }]}>🏋️  Xem bài tập của bé</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() => navigation.navigate('LogSession', {
            studentId:   child?.id,
            studentName: child?.full_name,
          })}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaBtnText}>📝  Ghi buổi học</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bg },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  loadingName: { ...typography.body, color: colors.textMid, marginTop: spacing.md },

  // Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop:        52,
    paddingBottom:     spacing.sm,
    backgroundColor:   colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn:      { width: 80 },
  backText:     { ...typography.bodySm, color: colors.secondary, fontWeight: '600' },
  headerTitle:  { ...typography.h4, color: colors.textDark },
  headerSpacer: { width: 80 },

  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.lg,
    paddingBottom:     spacing.xxxl,
  },

  // Hero Card
  heroCard: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    borderRadius:   radius.xl,
    padding:        spacing.xl,
    marginBottom:   spacing.md,
    borderWidth:    1,
    borderColor:    colors.primaryLight,
  },
  heroInfo:   { flexDirection: 'row', alignItems: 'center', flex: 1 },
  heroAvatar: {
    width:           56,
    height:          56,
    borderRadius:    radius.full,
    backgroundColor: colors.white,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     colors.primaryLight,
    marginRight:     spacing.md,
  },
  heroEmoji: { fontSize: 32 },
  heroText:  { flex: 1 },
  heroName:  { ...typography.h4, color: colors.textDark },
  heroNick:  { ...typography.bodySm, color: colors.textMid, fontStyle: 'italic', marginTop: 1 },
  heroMeta:  { ...typography.caption, color: colors.textLight, marginTop: 3 },

  // Overall Score Circle
  circle: {
    width:           68,
    height:          68,
    borderRadius:    radius.full,
    borderWidth:     3,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.white,
  },
  circleScore: { ...typography.scoreSm, lineHeight: 24 },
  circleLabel: { fontSize: 10, color: colors.textLight, marginTop: 1 },

  // Card
  card: {
    backgroundColor: colors.bgCard,
    borderRadius:    radius.xl,
    padding:         spacing.xl,
    marginBottom:    spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    ...shadows.sm,
  },
  cardHead: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   spacing.lg,
  },
  cardTitle: {
    ...typography.caption,
    color:       colors.textLight,
    fontWeight:  '700',
    letterSpacing: 0.5,
  },
  cardSub: { ...typography.caption, color: colors.textLight },

  // Domain Bars
  barRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  spacing.sm,
  },
  barLabel: {
    ...typography.bodySm,
    color:       colors.textMid,
    width:       76,
    marginRight: spacing.sm,
  },
  barTrack: {
    flex:            1,
    height:          10,
    borderRadius:    radius.full,
    backgroundColor: colors.bgMuted,
    overflow:        'hidden',
    marginRight:     spacing.sm,
  },
  barFill: { height: '100%', borderRadius: radius.full },
  barVal:  { ...typography.bodySm, fontWeight: '700', width: 26, textAlign: 'right' },

  // IEP Goals
  iepCard: {
    backgroundColor: colors.bgMuted,
    borderRadius:    radius.lg,
    padding:         spacing.md,
    marginBottom:    spacing.sm,
  },
  iepTop: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   6,
  },
  iepChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
    borderRadius:      radius.full,
  },
  iepChipText: { fontSize: 11, fontWeight: '700' },
  iepPct:      { ...typography.bodySm, fontWeight: '700', color: colors.textMid },
  iepTitle: {
    ...typography.bodySm,
    color:        colors.textDark,
    marginBottom: spacing.sm,
    lineHeight:   18,
  },
  iepTrack: {
    height:          6,
    borderRadius:    radius.full,
    backgroundColor: colors.border,
    overflow:        'hidden',
  },
  iepFill:   { height: '100%', borderRadius: radius.full },
  emptyText: { ...typography.body, color: colors.textLight, textAlign: 'center', paddingVertical: spacing.md },

  // AI Card
  aiCard:    { borderColor: colors.tealLight, backgroundColor: colors.tealBg },
  aiSummary: { ...typography.body, color: colors.textMid, lineHeight: 20 },

  // CTA Buttons
  ctaBtn: {
    backgroundColor: colors.secondary,
    borderRadius:    radius.xl,
    paddingVertical: spacing.lg,
    alignItems:      'center',
    marginTop:       spacing.sm,
    ...shadows.md,
  },
  ctaBtnSecondary: {
    backgroundColor: colors.white,
    borderWidth:     2,
    borderColor:     colors.secondary,
    ...shadows.sm,
  },
  ctaBtnText: { ...typography.h4, color: colors.white },
});
