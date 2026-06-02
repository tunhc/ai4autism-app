/**
 * TeacherExercisesScreen
 * Giáo viên xem & quản lý bài tập được AI giao (assigned_to_role = 'teacher')
 *
 * Flow:
 *  - Load danh sách học sinh được phân công
 *  - Cho phép chọn từng bé (horizontal tab)
 *  - Hiển thị bài tập AI-generated với hướng dẫn đầy đủ (expandable)
 *  - Nút "Ghi buổi học" → navigate đến LogSessionScreen
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { colors, radius, spacing, shadows } from '../../lib/colors';
import { typography } from '../../lib/typography';
import { useAuth } from '../../contexts/AuthContext';
import { getChildrenByTeacher, getTeacherExercisesForChild } from '../../lib/supabase';

// ── Domain config ──────────────────────────────────────────────────────────────
const DOMAIN_META = {
  communication: { label: 'Giao tiếp', color: colors.domain.communication },
  social:        { label: 'Xã hội',    color: colors.domain.social },
  behavior:      { label: 'Hành vi',   color: colors.domain.behavior },
  sensory:       { label: 'Cảm giác',  color: colors.domain.sensory },
  motor:         { label: 'Vận động',  color: colors.domain.motor },
  cognitive:     { label: 'Nhận thức', color: colors.domain.cognitive },
};

function getDomain(key) {
  return DOMAIN_META[key] || { label: key || 'Khác', color: colors.primary };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatDueDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Parse instructions_teacher: stored as plain text (newline-separated steps)
 * or as a JSON string array.
 */
function parseInstructions(raw) {
  if (!raw) return [];
  if (typeof raw === 'string') {
    // Try JSON first
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(item =>
          typeof item === 'string' ? item : item?.description || item?.title || JSON.stringify(item),
        ).filter(Boolean);
      }
    } catch { /* not JSON */ }
    // Plain text — split by newline
    return raw.split('\n').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

// ── Progress ring (simple text version) ───────────────────────────────────────
function ProgressBadge({ done, total }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isComplete = done >= total && total > 0;
  return (
    <View style={[styles.progressBadge, isComplete && styles.progressBadgeDone]}>
      <Text style={[styles.progressBadgeText, isComplete && styles.progressBadgeTextDone]}>
        {done}/{total} phiên{isComplete ? ' ✓' : ''}
      </Text>
    </View>
  );
}

// ── Exercise Card ──────────────────────────────────────────────────────────────
function ExerciseCard({ assignment, index }) {
  const [expanded, setExpanded] = useState(false);
  const ex      = assignment.exercises || {};
  const domain  = getDomain(ex.domain);
  const steps   = parseInstructions(ex.instructions_teacher);
  const done    = assignment.completed_sessions || 0;
  const total   = assignment.required_sessions  || 6;
  const dueStr  = formatDueDate(assignment.due_date);
  const isAI    = Boolean(assignment.source_report_id);
  const isComplete = done >= total && total > 0;

  return (
    <View style={[styles.exCard, isComplete && styles.exCardDone]}>
      {/* ── Header ── */}
      <TouchableOpacity
        style={styles.exHeader}
        onPress={() => setExpanded(v => !v)}
        activeOpacity={0.75}
      >
        {/* Index number bubble */}
        <View style={[styles.exIndex, { backgroundColor: domain.color }]}>
          <Text style={styles.exIndexText}>{index + 1}</Text>
        </View>

        <View style={styles.exMeta}>
          <View style={styles.exTitleRow}>
            <Text style={[styles.exTitle, isComplete && styles.exTitleDone]} numberOfLines={expanded ? undefined : 2}>
              {ex.name || 'Bài tập'}
            </Text>
            {isAI && (
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>AI</Text>
              </View>
            )}
          </View>

          <View style={styles.exChips}>
            <View style={[styles.chip, { backgroundColor: domain.color + '22' }]}>
              <Text style={[styles.chipText, { color: domain.color }]}>{domain.label}</Text>
            </View>
            {ex.duration_minutes ? (
              <View style={styles.chipGrey}>
                <Text style={styles.chipGreyText}>{ex.duration_minutes} phút</Text>
              </View>
            ) : null}
            {ex.exercise_type === 'esdm_naturalistic' ? (
              <View style={styles.chipGrey}>
                <Text style={styles.chipGreyText}>ESDM</Text>
              </View>
            ) : ex.exercise_type ? (
              <View style={styles.chipGrey}>
                <Text style={styles.chipGreyText}>ABA</Text>
              </View>
            ) : null}
          </View>
        </View>

        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {/* ── Description (always visible) ── */}
      {!!ex.description && (
        <Text style={styles.exDesc} numberOfLines={expanded ? undefined : 2}>
          {ex.description.replace(/^\[(?:ABA|ESDM)\]\n?/, '')}
        </Text>
      )}

      {/* ── Steps (expanded only) ── */}
      {expanded && steps.length > 0 && (
        <View style={styles.stepsBox}>
          <Text style={styles.stepsTitle}>HƯỚNG DẪN THỰC HIỆN</Text>
          {steps.map((step, si) => (
            <View key={si} style={styles.stepRow}>
              <View style={[styles.stepBullet, { backgroundColor: domain.color }]}>
                <Text style={styles.stepBulletText}>{si + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Notes (target outcome) ── */}
      {expanded && !!assignment.notes && (
        <View style={styles.notesBox}>
          <Text style={styles.notesLabel}>Kết quả kỳ vọng</Text>
          <Text style={styles.notesText}>{assignment.notes}</Text>
        </View>
      )}

      {/* ── Footer: progress + due date ── */}
      <View style={styles.exFooter}>
        <ProgressBadge done={done} total={total} />
        {dueStr && (
          <Text style={styles.dueText}>Hạn: {dueStr}</Text>
        )}
        {!expanded && steps.length > 0 && (
          <TouchableOpacity onPress={() => setExpanded(true)} style={styles.seeMoreBtn}>
            <Text style={styles.seeMoreText}>Xem hướng dẫn ▼</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Child Tab ──────────────────────────────────────────────────────────────────
function ChildTab({ child, active, onPress }) {
  const name = child.nickname || child.full_name?.split(' ').pop() || 'Bé';
  return (
    <TouchableOpacity
      style={[styles.childTab, active && styles.childTabActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.childTabText, active && styles.childTabTextActive]}>
        {name}
      </Text>
    </TouchableOpacity>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function TeacherExercisesScreen({ navigation, route }) {
  const { profile } = useAuth();
  const teacherId = profile?.id;

  // If navigated from StudentDetail with a specific child
  const initChildId   = route?.params?.studentId   || null;
  const initChildName = route?.params?.studentName  || null;

  const [children,     setChildren]     = useState([]);
  const [selectedChild, setSelectedChild] = useState(
    initChildId ? { id: initChildId, full_name: initChildName, nickname: initChildName } : null,
  );
  const [exercises,    setExercises]    = useState([]);
  const [loadingList,  setLoadingList]  = useState(true);
  const [loadingEx,    setLoadingEx]    = useState(false);
  const [refreshing,   setRefreshing]   = useState(false);

  const canGoBack = navigation?.canGoBack?.();

  // ── Load children list ──
  const loadChildren = useCallback(async () => {
    if (!teacherId) { setLoadingList(false); return; }
    try {
      const list = await getChildrenByTeacher(teacherId);
      setChildren(list || []);
      // Auto-select first child if none pre-selected
      if (!initChildId && list?.length) {
        setSelectedChild(list[0]);
      }
    } catch (e) {
      console.warn('TeacherExercises loadChildren:', e.message);
    } finally {
      setLoadingList(false);
    }
  }, [teacherId, initChildId]);

  // ── Load exercises for selected child ──
  const loadExercises = useCallback(async (child) => {
    if (!child?.id) return;
    setLoadingEx(true);
    try {
      const data = await getTeacherExercisesForChild(child.id);
      setExercises(data || []);
    } catch (e) {
      console.warn('TeacherExercises loadExercises:', e.message);
      setExercises([]);
    } finally {
      setLoadingEx(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadChildren(); }, [loadChildren]);
  useEffect(() => { loadExercises(selectedChild); }, [selectedChild, loadExercises]);

  const handleSelectChild = (child) => {
    if (child.id === selectedChild?.id) return;
    setSelectedChild(child);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadExercises(selectedChild);
  };

  const handleLogSession = () => {
    if (!selectedChild) return;
    navigation.navigate('LogSession', {
      studentId:   selectedChild.id,
      studentName: selectedChild.full_name || selectedChild.nickname || 'Học sinh',
    });
  };

  // ── Loading screen ──
  if (loadingList) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.secondary} />
      </View>
    );
  }

  const childName = selectedChild?.full_name || selectedChild?.nickname || '—';
  const aiCount   = exercises.filter(e => e.source_report_id).length;

  return (
    <View style={styles.root}>

      {/* ── Fixed header ── */}
      <View style={styles.header}>
        {canGoBack && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Quay lại</Text>
          </TouchableOpacity>
        )}
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>✏️  Bài tập giáo viên</Text>
        </View>
        {canGoBack && <View style={styles.backBtn} />}
      </View>

      {/* ── Child tabs (horizontal scroll) ── */}
      {children.length > 1 && (
        <View style={styles.tabsWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsScroll}
          >
            {children.map(child => (
              <ChildTab
                key={child.id}
                child={child}
                active={child.id === selectedChild?.id}
                onPress={() => handleSelectChild(child)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.secondary]} />
        }
      >
        {/* Summary bar */}
        {selectedChild && (
          <View style={styles.summaryBar}>
            <View style={styles.summaryInfo}>
              <Text style={styles.summaryName}>{childName}</Text>
              {exercises.length > 0 && (
                <Text style={styles.summaryCount}>
                  {exercises.length} bài tập
                  {aiCount > 0 ? ` • ${aiCount} từ AI Report` : ''}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.logBtn}
              onPress={handleLogSession}
              disabled={!selectedChild || exercises.length === 0}
            >
              <Text style={styles.logBtnText}>Ghi phiên 💾</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Exercises */}
        {loadingEx ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.secondary} />
            <Text style={styles.loadingText}>Đang tải bài tập…</Text>
          </View>
        ) : exercises.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>Chưa có bài tập</Text>
            <Text style={styles.emptySub}>
              {selectedChild
                ? `Bé ${childName} chưa có bài tập giáo viên nào đang active.`
                : 'Chọn một bé để xem bài tập.'}
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>BÀI TẬP ĐƯỢC GIAO ({exercises.length})</Text>
            {exercises.map((a, idx) => (
              <ExerciseCard key={a.id} assignment={a} index={idx} />
            ))}
          </>
        )}

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>

      {/* ── Sticky bottom CTA ── */}
      {!loadingEx && exercises.length > 0 && selectedChild && (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.bottomBtn} onPress={handleLogSession} activeOpacity={0.85}>
            <Text style={styles.bottomBtnText}>
              💾  Ghi buổi học cho bé {selectedChild.nickname || childName.split(' ').pop()}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bg },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },

  // Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop:        56,
    paddingBottom:     spacing.md,
    backgroundColor:   colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn:       { width: 80 },
  backText:      { ...typography.bodySm, color: colors.secondary, fontWeight: '600' },
  headerCenter:  { flex: 1, alignItems: 'center' },
  headerTitle:   { ...typography.h4, color: colors.textDark, fontWeight: '700' },

  // Child tabs
  tabsWrap: {
    backgroundColor:   colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabsScroll: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  childTab: {
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.xs + 2,
    borderRadius:      radius.full,
    borderWidth:       1.5,
    borderColor:       colors.border,
    backgroundColor:   colors.bgCard,
  },
  childTabActive: {
    borderColor:     colors.secondary,
    backgroundColor: colors.secondaryBg,
  },
  childTabText:       { ...typography.bodySm, color: colors.textMid, fontWeight: '600' },
  childTabTextActive: { color: colors.secondaryDark, fontWeight: '700' },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },

  // Summary bar
  summaryBar: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   spacing.md,
  },
  summaryInfo:  { flex: 1 },
  summaryName:  { ...typography.h4, color: colors.textDark },
  summaryCount: { ...typography.caption, color: colors.textMid, marginTop: 2 },
  logBtn: {
    backgroundColor: colors.secondaryBg,
    borderWidth:     1,
    borderColor:     colors.secondaryLight,
    borderRadius:    radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs + 2,
  },
  logBtnText: { ...typography.caption, color: colors.secondaryDark, fontWeight: '700' },

  // Loading / empty
  centerBox: { alignItems: 'center', paddingTop: spacing.xxxl },
  loadingText: { ...typography.body, color: colors.textLight, marginTop: spacing.md },
  emptyCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    padding: spacing.xxl, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, ...shadows.sm,
  },
  emptyEmoji: { fontSize: 40, marginBottom: spacing.md },
  emptyTitle: { ...typography.h4, color: colors.textDark, marginBottom: spacing.sm },
  emptySub:   { ...typography.body, color: colors.textLight, textAlign: 'center', lineHeight: 20 },

  // Section label
  sectionLabel: {
    ...typography.caption, color: colors.textLight,
    fontWeight: '700', letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },

  // Exercise card
  exCard: {
    backgroundColor: colors.bgCard,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.border,
    marginBottom:    spacing.md,
    overflow:        'hidden',
    ...shadows.sm,
  },
  exCardDone: {
    borderColor:     colors.secondaryLight,
    backgroundColor: '#F5FAF6',
  },

  exHeader: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    padding:        spacing.lg,
    paddingBottom:  spacing.sm,
  },

  exIndex: {
    width:           32,
    height:          32,
    borderRadius:    radius.full,
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     spacing.sm,
    flexShrink:      0,
    marginTop:       2,
  },
  exIndexText: { color: colors.white, fontSize: 14, fontWeight: '800' },

  exMeta:     { flex: 1 },
  exTitleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xs },
  exTitle:    { ...typography.h4, color: colors.textDark, flex: 1, lineHeight: 22 },
  exTitleDone:{ color: colors.secondaryDark },

  aiBadge: {
    backgroundColor: colors.primaryBg,
    borderRadius:    radius.xs,
    paddingHorizontal: 5,
    paddingVertical:   1,
    marginLeft:      spacing.xs,
    marginTop:       3,
  },
  aiBadgeText: { fontSize: 9, fontWeight: '800', color: colors.primaryDark, letterSpacing: 0.5 },

  exChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
    borderRadius:      radius.full,
  },
  chipText: { fontSize: 11, fontWeight: '700' },
  chipGrey: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
    borderRadius:      radius.full,
    backgroundColor:   colors.bgMuted,
  },
  chipGreyText: { fontSize: 11, color: colors.textLight },
  chevron: { fontSize: 10, color: colors.textLight, paddingTop: 6, paddingLeft: spacing.sm },

  exDesc: {
    ...typography.bodySm,
    color:       colors.textMid,
    lineHeight:  18,
    paddingHorizontal: spacing.lg,
    paddingBottom:     spacing.sm,
  },

  // Steps
  stepsBox: {
    backgroundColor:   colors.bgMuted,
    borderTopWidth:    1,
    borderTopColor:    colors.border,
    padding:           spacing.lg,
  },
  stepsTitle: {
    ...typography.caption,
    color:         colors.textLight,
    fontWeight:    '700',
    letterSpacing: 0.5,
    marginBottom:  spacing.md,
  },
  stepRow: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    marginBottom:   spacing.sm,
  },
  stepBullet: {
    width:           20,
    height:          20,
    borderRadius:    radius.full,
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     spacing.sm,
    flexShrink:      0,
    marginTop:       1,
  },
  stepBulletText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  stepText: { ...typography.bodySm, color: colors.textMid, flex: 1, lineHeight: 18 },

  // Notes
  notesBox: {
    backgroundColor:   colors.primaryBg,
    borderTopWidth:    1,
    borderTopColor:    colors.primaryLight,
    padding:           spacing.md,
    paddingHorizontal: spacing.lg,
  },
  notesLabel: {
    ...typography.caption,
    color:        colors.primaryDark,
    fontWeight:   '700',
    marginBottom: 4,
  },
  notesText: { ...typography.bodySm, color: colors.textMid, lineHeight: 18 },

  // Footer
  exFooter: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
    borderTopWidth:    1,
    borderTopColor:    colors.border,
    gap:               spacing.sm,
    flexWrap:          'wrap',
  },

  progressBadge: {
    backgroundColor: colors.bgMuted,
    borderRadius:    radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
  },
  progressBadgeDone: { backgroundColor: colors.successBg },
  progressBadgeText: { ...typography.caption, color: colors.textMid, fontWeight: '600' },
  progressBadgeTextDone: { color: colors.secondaryDark },

  dueText: { ...typography.caption, color: colors.textLight },

  seeMoreBtn: {
    marginLeft:        'auto',
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
  },
  seeMoreText: { ...typography.caption, color: colors.primary, fontWeight: '600' },

  // Bottom CTA bar
  bottomBar: {
    backgroundColor:   colors.bgCard,
    borderTopWidth:    1,
    borderTopColor:    colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    paddingBottom:     spacing.xl,
  },
  bottomBtn: {
    backgroundColor: colors.secondary,
    borderRadius:    radius.xl,
    paddingVertical: spacing.md,
    alignItems:      'center',
    ...shadows.md,
  },
  bottomBtnText: { ...typography.h4, color: colors.white, fontWeight: '700' },
});
