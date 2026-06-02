import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, radius, spacing, shadows } from '../../lib/colors';
import { typography } from '../../lib/typography';
import { useAuth } from '../../contexts/AuthContext';
import { getExerciseAssignments, logTeacherSession } from '../../lib/supabase';

// ── Domain config ─────────────────────────────────────────────────────────────
const DOMAIN_META = {
  communication: { label: 'Giao tiếp',  color: colors.domain.communication },
  social:        { label: 'Xã hội',     color: colors.domain.social },
  behavior:      { label: 'Hành vi',    color: colors.domain.behavior },
  sensory:       { label: 'Cảm giác',   color: colors.domain.sensory },
  motor:         { label: 'Vận động',   color: colors.domain.motor },
  cognitive:     { label: 'Nhận thức',  color: colors.domain.cognitive },
};

function getDomain(key) {
  return DOMAIN_META[key] || { label: key, color: colors.primary };
}

// ── Mock fallback ─────────────────────────────────────────────────────────────
const MOCK_ASSIGNMENTS = [
  {
    id: 'a1',
    exercises: { name: 'Đọc truyện tranh nói từ đơn', description: 'Dùng sách tranh tương phản, chỉ tay và khuyến khích trẻ lặp lại tên con vật.', domain: 'communication', difficulty_level: 'easy', duration_minutes: 10 },
  },
  {
    id: 'a2',
    exercises: { name: 'Chơi bóng luân phiên 5 lượt', description: 'Lăn bóng qua lại, nói "lượt của cô", "lượt của bé" để xây dựng khái niệm chờ lượt.', domain: 'social', difficulty_level: 'medium', duration_minutes: 15 },
  },
  {
    id: 'a3',
    exercises: { name: 'Sử dụng thẻ PECS yêu cầu nước', description: 'Trẻ đưa thẻ hình để nhận đồ vật, thay vì la hét.', domain: 'cognitive', difficulty_level: 'medium', duration_minutes: 10 },
  },
];

// ── Difficulty label ──────────────────────────────────────────────────────────
const DIFF_LABEL = { easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' };

// ── Score presets ─────────────────────────────────────────────────────────────
const SCORE_PRESETS = [
  { label: 'Không đạt', value: '25',  color: colors.danger },
  { label: 'Đạt',       value: '60',  color: colors.amber },
  { label: 'Tốt',       value: '80',  color: colors.secondary },
  { label: 'Xuất sắc',  value: '100', color: colors.primary },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function ExerciseCard({ assignment, checked, score, onToggle, onScoreChange }) {
  const ex     = assignment.exercises || {};
  const domain = getDomain(ex.domain);
  const diff   = DIFF_LABEL[ex.difficulty_level] || ex.difficulty_level;

  return (
    <View style={[styles.exCard, checked && styles.exCardChecked]}>
      {/* ── Top row: checkbox + name ── */}
      <TouchableOpacity style={styles.exHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked && <Text style={styles.checkMark}>✓</Text>}
        </View>
        <View style={styles.exNameBlock}>
          <Text style={[styles.exName, checked && styles.exNameChecked]} numberOfLines={2}>
            {ex.name || 'Bài tập'}
          </Text>
          <View style={styles.exChips}>
            <View style={[styles.chip, { backgroundColor: domain.color + '22' }]}>
              <Text style={[styles.chipText, { color: domain.color }]}>{domain.label}</Text>
            </View>
            {diff ? (
              <View style={styles.chipGrey}>
                <Text style={styles.chipGreyText}>{diff}</Text>
              </View>
            ) : null}
            {ex.duration_minutes ? (
              <View style={styles.chipGrey}>
                <Text style={styles.chipGreyText}>{ex.duration_minutes} phút</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>

      {/* ── Description ── */}
      {ex.description ? (
        <Text style={styles.exDesc} numberOfLines={checked ? undefined : 2}>
          {ex.description}
        </Text>
      ) : null}

      {/* ── Score section — chỉ hiện khi checked ── */}
      {checked && (
        <View style={styles.scoreSection}>
          <Text style={styles.scoreLabel}>Đánh giá kết quả</Text>

          {/* Preset buttons */}
          <View style={styles.presetRow}>
            {SCORE_PRESETS.map(p => (
              <TouchableOpacity
                key={p.value}
                style={[
                  styles.presetBtn,
                  score === p.value && { backgroundColor: p.color, borderColor: p.color },
                ]}
                onPress={() => onScoreChange(p.value)}
                activeOpacity={0.75}
              >
                <Text style={[
                  styles.presetBtnText,
                  score === p.value && { color: colors.white },
                ]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Manual score input */}
          <View style={styles.scoreInputRow}>
            <Text style={styles.scoreInputLabel}>Điểm cụ thể (0–100):</Text>
            <TextInput
              style={styles.scoreInput}
              value={score}
              onChangeText={v => onScoreChange(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              maxLength={3}
              placeholder="--"
              placeholderTextColor={colors.textLight}
            />
          </View>
        </View>
      )}
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function LogSessionScreen({ navigation, route }) {
  const { profile } = useAuth();
  const studentId    = route.params?.studentId;
  const studentName  = route.params?.studentName || 'Học sinh';

  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  });
  const sessionDate = new Date().toISOString().split('T')[0];

  const [assignments, setAssignments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);

  // exerciseState: { [assignmentId]: { checked: bool, score: string } }
  const [exState, setExState] = useState({});
  const [sessionNotes, setSessionNotes] = useState('');

  const loadAssignments = useCallback(async () => {
    if (!studentId) {
      setAssignments(MOCK_ASSIGNMENTS);
      setLoading(false);
      return;
    }
    try {
      const data = await getExerciseAssignments(studentId, 'teacher');
      const list = data?.length ? data : MOCK_ASSIGNMENTS;
      setAssignments(list);
    } catch {
      setAssignments(MOCK_ASSIGNMENTS);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { loadAssignments(); }, [loadAssignments]);

  // ── State helpers ──
  const toggleExercise = (id) => {
    setExState(prev => ({
      ...prev,
      [id]: { score: prev[id]?.score || '', checked: !prev[id]?.checked },
    }));
  };

  const setScore = (id, value) => {
    const clamped = value === '' ? '' : String(Math.min(Number(value), 100));
    setExState(prev => ({
      ...prev,
      [id]: { ...prev[id], score: clamped },
    }));
  };

  const checkedCount = assignments.filter(a => exState[a.id]?.checked).length;

  // ── Submit ──
  const handleSave = async () => {
    if (checkedCount === 0) {
      Alert.alert('Chưa chọn bài tập', 'Hãy đánh dấu ít nhất 1 bài tập đã thực hiện.');
      return;
    }

    const completedExercises = assignments
      .filter(a => exState[a.id]?.checked)
      .map(a => ({
        assignmentId: a.id,
        score:        exState[a.id]?.score !== '' ? Number(exState[a.id].score) : null,
        notes:        null,
      }));

    setSaving(true);
    try {
      await logTeacherSession({
        childId:             studentId,
        performedById:       profile?.id,
        sessionDate,
        completedExercises,
        sessionNotes,
      });

      Alert.alert(
        'Lưu thành công ✓',
        `Đã ghi nhận ${checkedCount} bài tập cho bé ${studentName}.`,
        [{ text: 'Xong', onPress: () => navigation.goBack() }],
      );
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể lưu buổi học. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.secondary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Quay lại</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ghi buổi học</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Hero ── */}
        <View style={[styles.heroCard, { backgroundColor: colors.tealBg }]}>
          <View style={styles.heroRow}>
            <View style={styles.heroAvatar}>
              <Text style={{ fontSize: 28 }}>👦</Text>
            </View>
            <View>
              <Text style={styles.heroName}>{studentName}</Text>
              <Text style={styles.heroDate}>{today}</Text>
            </View>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNum}>{assignments.length}</Text>
              <Text style={styles.heroStatLabel}>Bài tập được giao</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatNum, { color: colors.secondary }]}>{checkedCount}</Text>
              <Text style={styles.heroStatLabel}>Đã hoàn thành</Text>
            </View>
          </View>
        </View>

        {/* ── Exercise List ── */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>BÀI TẬP BUỔI HỌC</Text>
          <Text style={styles.sectionSub}>Tick bài đã thực hiện và chấm điểm</Text>
        </View>

        {assignments.map(a => (
          <ExerciseCard
            key={a.id}
            assignment={a}
            checked={!!exState[a.id]?.checked}
            score={exState[a.id]?.score || ''}
            onToggle={() => toggleExercise(a.id)}
            onScoreChange={v => setScore(a.id, v)}
          />
        ))}

        {/* ── Session Notes ── */}
        <View style={styles.card}>
          <Text style={styles.notesTitle}>GHI CHÚ BUỔI HỌC</Text>
          <Text style={styles.notesHint}>Nhận xét tổng quát, tình trạng của bé, điều cần lưu ý…</Text>
          <TextInput
            style={styles.notesInput}
            value={sessionNotes}
            onChangeText={setSessionNotes}
            placeholder="Bé hôm nay hợp tác tốt, tập trung tốt hơn tuần trước…"
            placeholderTextColor={colors.textLight}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* ── Submit ── */}
        <TouchableOpacity
          style={[styles.saveBtn, (saving || checkedCount === 0) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving || checkedCount === 0}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.saveBtnText}>
              💾  Lưu buổi học{checkedCount > 0 ? ` (${checkedCount} bài)` : ''}
            </Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
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

  // Hero
  heroCard: {
    borderRadius:  radius.xl,
    padding:       spacing.xl,
    marginBottom:  spacing.md,
    borderWidth:   1,
    borderColor:   colors.tealLight,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  spacing.lg,
  },
  heroAvatar: {
    width:           52,
    height:          52,
    borderRadius:    radius.full,
    backgroundColor: colors.white,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     colors.tealLight,
    marginRight:     spacing.md,
  },
  heroName:  { ...typography.h4, color: colors.textDark },
  heroDate:  { ...typography.caption, color: colors.textMid, marginTop: 2 },
  heroStats: {
    flexDirection:    'row',
    backgroundColor:  colors.white,
    borderRadius:     radius.lg,
    paddingVertical:  spacing.md,
    borderWidth:      1,
    borderColor:      colors.tealLight,
  },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatDivider: { width: 1, backgroundColor: colors.tealLight },
  heroStatNum:   { ...typography.h3, color: colors.textDark },
  heroStatLabel: { ...typography.caption, color: colors.textLight, marginTop: 2 },

  // Section head
  sectionHead: { marginBottom: spacing.sm },
  sectionTitle: {
    ...typography.caption,
    color:        colors.textLight,
    fontWeight:   '700',
    letterSpacing: 0.5,
  },
  sectionSub: { ...typography.caption, color: colors.textLight, marginTop: 2 },

  // Exercise Card
  exCard: {
    backgroundColor: colors.bgCard,
    borderRadius:    radius.xl,
    padding:         spacing.lg,
    marginBottom:    spacing.sm,
    borderWidth:     1,
    borderColor:     colors.border,
    ...shadows.sm,
  },
  exCardChecked: {
    borderColor:     colors.secondaryLight,
    backgroundColor: colors.secondaryBg,
  },
  exHeader: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    marginBottom:  spacing.sm,
  },

  // Checkbox
  checkbox: {
    width:           24,
    height:          24,
    borderRadius:    radius.xs + 2,
    borderWidth:     2,
    borderColor:     colors.border,
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     spacing.sm,
    marginTop:       1,
    flexShrink:      0,
    backgroundColor: colors.white,
  },
  checkboxChecked: {
    borderColor:     colors.secondary,
    backgroundColor: colors.secondary,
  },
  checkMark: { color: colors.white, fontSize: 13, fontWeight: '700', lineHeight: 16 },

  exNameBlock: { flex: 1 },
  exName:      { ...typography.h4, color: colors.textDark, lineHeight: 22 },
  exNameChecked: { color: colors.secondaryDark },

  exChips: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    marginTop:     spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
    borderRadius:      radius.full,
    marginRight:       spacing.xs,
    marginTop:         spacing.xs,
  },
  chipText: { fontSize: 11, fontWeight: '700' },
  chipGrey: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
    borderRadius:      radius.full,
    backgroundColor:   colors.bgMuted,
    marginRight:       spacing.xs,
    marginTop:         spacing.xs,
  },
  chipGreyText: { fontSize: 11, color: colors.textLight },

  exDesc: {
    ...typography.bodySm,
    color:      colors.textMid,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },

  // Score section
  scoreSection: {
    borderTopWidth: 1,
    borderTopColor: colors.secondaryLight,
    paddingTop:     spacing.md,
    marginTop:      spacing.xs,
  },
  scoreLabel: {
    ...typography.caption,
    color:        colors.textLight,
    fontWeight:   '700',
    letterSpacing: 0.4,
    marginBottom:  spacing.sm,
  },
  presetRow: {
    flexDirection: 'row',
    marginBottom:  spacing.sm,
  },
  presetBtn: {
    flex:             1,
    paddingVertical:  spacing.sm,
    borderRadius:     radius.md,
    borderWidth:      1,
    borderColor:      colors.border,
    alignItems:       'center',
    marginRight:      spacing.xs,
    backgroundColor:  colors.white,
  },
  presetBtnText: { fontSize: 11, fontWeight: '600', color: colors.textMid },

  scoreInputRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginTop:     spacing.xs,
  },
  scoreInputLabel: { ...typography.bodySm, color: colors.textMid, flex: 1 },
  scoreInput: {
    borderWidth:     1,
    borderColor:     colors.border,
    borderRadius:    radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    width:           72,
    textAlign:       'center',
    ...typography.h4,
    color:           colors.textDark,
    backgroundColor: colors.white,
  },

  // Notes card
  card: {
    backgroundColor: colors.bgCard,
    borderRadius:    radius.xl,
    padding:         spacing.xl,
    marginBottom:    spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    ...shadows.sm,
  },
  notesTitle: {
    ...typography.caption,
    color:        colors.textLight,
    fontWeight:   '700',
    letterSpacing: 0.5,
    marginBottom:  spacing.xs,
  },
  notesHint: { ...typography.caption, color: colors.textLight, marginBottom: spacing.md },
  notesInput: {
    borderWidth:      1,
    borderColor:      colors.border,
    borderRadius:     radius.lg,
    padding:          spacing.md,
    minHeight:        96,
    ...typography.body,
    color:            colors.textDark,
    backgroundColor:  colors.bg,
  },

  // Save button
  saveBtn: {
    backgroundColor: colors.secondary,
    borderRadius:    radius.xl,
    paddingVertical: spacing.lg,
    alignItems:      'center',
    marginTop:       spacing.sm,
    ...shadows.md,
  },
  saveBtnDisabled: {
    backgroundColor: colors.secondaryLight,
    ...shadows.sm,
  },
  saveBtnText: { ...typography.h4, color: colors.white },
});
