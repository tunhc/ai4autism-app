import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing, shadows } from '../../lib/colors';
import { typography } from '../../lib/typography';
import { useAuth } from '../../contexts/AuthContext';
import { getAIReportForVideo, getExercisesForReport, updateHpdtRolling } from '../../lib/supabase';

const NAVY = '#1B3A6B';
const SECTION_BLUE = '#1E4D8C';

const EXERCISE_BG = [
  '#1B3A6B', // dark navy
  '#1A5C37', // dark green
  '#7A4B1A', // amber
  '#1A5958', // dark teal
  '#4A2C7A', // purple
];

const DOMAIN_LABELS = {
  communication: 'Giao tiếp',
  social: 'Xã hội',
  behavior: 'Hành vi',
  sensory: 'Cảm giác',
  motor: 'Vận động',
  cognitive: 'Nhận thức',
  fine_motor: 'Vận động tinh',
  gross_motor: 'Vận động thô',
  social_interaction: 'Tương tác xã hội',
  language: 'Ngôn ngữ',
  imitation: 'Bắt chước',
  cognition: 'Nhận thức',
};

function safeArr(val) {
  return Array.isArray(val) ? val : [];
}

function normalizeReportJson(report) {
  const raw =
    report?.report_json ||
    report?.analysis_json ||
    report?.result_json ||
    report?.merged_result;
  if (!raw) return null;

  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (parsed && typeof parsed === 'object' && !parsed.domain_scores) {
    if (parsed.hpdtAverages || parsed.claudeSummary || parsed.milestones || parsed.diary_notes) {
      return {
        ...parsed,
        domain_scores:
          Object.keys(parsed.hpdtAverages || {}).length > 0 ? parsed.hpdtAverages : {},
        message_to_uploader: parsed.claudeSummary || '',
        recommendations: (parsed.milestones || []).map(m => ({ text: m })),
        observations: parsed.diary_notes ? [{ text: parsed.diary_notes }] : [],
      };
    }
  }

  return parsed;
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function AIReportScreen({ navigation, route }) {
  const { profile } = useAuth();
  const child = route?.params?.child;
  const videoId = route?.params?.videoId;
  const childId = route?.params?.childId || child?.id;

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [exercises, setExercises] = useState([]);

  useEffect(() => {
    let mounted = true;

    async function loadReport() {
      setLoading(true);
      try {
        const foundReport = await getAIReportForVideo(videoId, childId);
        if (!mounted) return;
        setReport(foundReport);

        if (foundReport?.id) {
          const linked = await getExercisesForReport(
            foundReport.id,
            foundReport.child_id || childId,
          );
          if (mounted) setExercises(linked);

          // Update HPDT rolling average ngay sau khi report done
          if (['done', 'completed'].includes(foundReport.status)) {
            updateHpdtRolling(foundReport.child_id || childId).catch(() => {});
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadReport();
    return () => { mounted = false; };
  }, [videoId, childId]);

  const reportJson = useMemo(() => normalizeReportJson(report), [report]);

  // ── Metadata
  const childName =
    reportJson?.child_name || child?.name || '—';
  const recordingDate =
    reportJson?.recording_date ||
    reportJson?.video_date ||
    (report?.created_at
      ? new Date(report.created_at).toLocaleDateString('vi-VN')
      : '—');
  const videoContext = reportJson?.context || reportJson?.video_context || '—';
  const videoDuration = reportJson?.duration || reportJson?.video_duration || '—';
  const shortId = report?.id ? String(report.id).substring(0, 8).toUpperCase() : '—';

  // ── Section data
  const sceneAnalysis = safeArr(reportJson?.scene_analysis);
  const strengths = safeArr(
    reportJson?.strengths || reportJson?.behavior_summary?.strengths,
  );
  const challenges = safeArr(
    reportJson?.challenges || reportJson?.behavior_summary?.challenges,
  );
  const clinicalAdvice = reportJson?.clinical_advice || {};
  const adviceOverview =
    typeof clinicalAdvice.overview === 'string' ? clinicalAdvice.overview : '';
  const adviceRecs = safeArr(
    clinicalAdvice.priority_recommendations || clinicalAdvice.recommendations,
  );
  const reportExercises = safeArr(reportJson?.exercises);
  const weeklySchedule = reportJson?.weekly_schedule;
  const message = report?.message_to_uploader || reportJson?.message_to_uploader;

  // ── Fallback (old format)
  const domainScores = reportJson?.domain_scores || report?.domain_scores || {};
  const oldObs = safeArr(reportJson?.observations);
  const oldRecs = safeArr(reportJson?.recommendations);
  const hasNewFormat =
    sceneAnalysis.length > 0 || reportExercises.length > 0 || strengths.length > 0;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Quay lại</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.centerCard}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.mutedText}>Đang tải báo cáo...</Text>
        </View>
      ) : !report ? (
        <View style={styles.centerCard}>
          <Text style={styles.emptyTitle}>Chưa có báo cáo cho video này</Text>
          <Text style={styles.mutedText}>
            Video sẽ được phân tích và báo cáo sẽ có tại đây sau khi hoàn tất.
          </Text>
        </View>
      ) : (
        <>
          {/* ── Cover ─────────────────────────────────────────── */}
          <View style={styles.reportCover}>
            <Text style={styles.reportTitle}>BÁO CÁO CAN THIỆP ĐA LIỆU PHÁP</Text>
            <Text style={styles.reportSubtitle}>Trẻ tự kỷ — Can thiệp tại nhà</Text>
          </View>

          {/* ── Info grid ─────────────────────────────────────── */}
          <View style={styles.infoGrid}>
            {[
              { label: 'Họ và tên', value: childName },
              { label: 'Ngày quay', value: recordingDate },
              { label: 'Bối cảnh', value: videoContext },
              { label: 'Thời lượng', value: videoDuration },
              { label: 'Mã báo cáo', value: shortId },
            ].map((item, idx, arr) => (
              <View
                key={idx}
                style={[
                  styles.infoCell,
                  idx % 2 === 0 && idx < arr.length - 1 ? styles.infoCellBorderRight : null,
                  idx < arr.length - 2 ? styles.infoCellBorderBottom : null,
                  idx === arr.length - 1 && arr.length % 2 === 1
                    ? styles.infoCellFull
                    : null,
                ]}
              >
                <Text style={styles.infoCellLabel}>{item.label}</Text>
                <Text style={styles.infoCellValue}>{item.value}</Text>
              </View>
            ))}
          </View>

          {/* ── I. Scene Analysis ─────────────────────────────── */}
          {sceneAnalysis.length > 0 && (
            <View style={styles.section}>
              <SectionHeader roman="I." title="Phân Tích Video Chi Tiết Theo Từng Cảnh" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.thCell, { width: 72 }]}>Thời{'\n'}điểm</Text>
                    <Text style={[styles.thCell, { width: 140 }]}>Cảnh / Hoạt động</Text>
                    <Text style={[styles.thCell, { width: 150 }]}>Hành vi ghi nhận</Text>
                    <Text style={[styles.thCell, { width: 170, borderRightWidth: 0 }]}>
                      Nhận xét lâm sàng
                    </Text>
                  </View>
                  {sceneAnalysis.map((row, idx) => (
                    <View
                      key={idx}
                      style={[styles.tdRow, idx % 2 === 1 && styles.tdRowAlt]}
                    >
                      <Text style={[styles.tdCell, { width: 72 }]}>
                        {row.time_range || row.time || row.timestamp || ''}
                      </Text>
                      <Text style={[styles.tdCell, { width: 140 }]}>
                        {row.scene || row.activity || ''}
                      </Text>
                      <Text style={[styles.tdCell, { width: 150 }]}>
                        {row.observed_behavior || row.behavior || ''}
                      </Text>
                      <Text
                        style={[styles.tdCell, { width: 170, borderRightWidth: 0 }]}
                      >
                        {row.clinical_note || row.clinical_comment || ''}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* ── II. Behavior Summary ──────────────────────────── */}
          {(strengths.length > 0 || challenges.length > 0) && (
            <View style={styles.section}>
              <SectionHeader roman="II." title="Tổng Hợp Hành Vi Quan Sát Được" />

              {strengths.length > 0 && (
                <>
                  <Text style={styles.subSectionTitle}>
                    2.1 Điểm Mạnh Ghi Nhận Từ Video
                  </Text>
                  <View style={styles.hr} />
                  <View style={styles.strengthBox}>
                    <Text style={styles.strengthBoxTitle}>
                      Các điểm tích cực quan sát được trong video:
                    </Text>
                    {strengths.map((item, idx) => (
                      <Text key={idx} style={styles.strengthItem}>
                        {'• '}
                        {typeof item === 'string' ? item : item.text || ''}
                      </Text>
                    ))}
                  </View>
                </>
              )}

              {challenges.length > 0 && (
                <>
                  <Text style={[styles.subSectionTitle, { marginTop: spacing.lg }]}>
                    2.2 Những Khó Khăn Cần Can Thiệp
                  </Text>
                  <View style={styles.hr} />
                  <View style={styles.challengeBox}>
                    <Text style={styles.challengeBoxTitle}>
                      Các vấn đề cần ưu tiên can thiệp:
                    </Text>
                    {challenges.map((item, idx) => (
                      <Text key={idx} style={styles.challengeItem}>
                        {'• '}
                        {typeof item === 'string' ? item : item.text || ''}
                      </Text>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}

          {/* ── III. Clinical Advice ──────────────────────────── */}
          {(adviceOverview || adviceRecs.length > 0) && (
            <View style={styles.section}>
              <SectionHeader roman="III." title="Lời Khuyên Lâm Sàng Cho Phụ Huynh" />
              <View style={styles.adviceBox}>
                {!!adviceOverview && (
                  <>
                    <Text style={styles.adviceSubTitle}>Nhận xét tổng quan</Text>
                    <Text style={styles.adviceBodyText}>{adviceOverview}</Text>
                  </>
                )}
                {adviceRecs.length > 0 && (
                  <>
                    <Text
                      style={[
                        styles.adviceSubTitle,
                        adviceOverview ? { marginTop: spacing.md } : null,
                      ]}
                    >
                      Khuyến nghị ưu tiên:
                    </Text>
                    {adviceRecs.map((item, idx) => (
                      <Text key={idx} style={styles.adviceItem}>
                        {'• '}
                        {typeof item === 'string'
                          ? item
                          : item.text || item.recommendation || ''}
                      </Text>
                    ))}
                  </>
                )}
              </View>
            </View>
          )}

          {/* ── IV. Exercises ─────────────────────────────────── */}
          {reportExercises.length > 0 && (
            <View style={styles.section}>
              <SectionHeader
                roman="IV."
                title={`${reportExercises.length} Bài Tập Can Thiệp Đa Liệu Pháp`}
              />
              <Text style={styles.exercisesIntro}>
                Mỗi bài tập được thiết kế dựa trực tiếp trên hành vi và điểm mạnh quan
                sát từ video, kết hợp đa liệu pháp để tối ưu hóa hiệu quả tại nhà.
              </Text>
              {reportExercises.map((ex, idx) => (
                <ExerciseCard key={idx} exercise={ex} index={idx} />
              ))}
            </View>
          )}

          {/* ── V. Weekly Schedule ────────────────────────────── */}
          {!!weeklySchedule && (
            <View style={styles.section}>
              <SectionHeader roman="V." title="Gợi Ý Lịch Can Thiệp Hàng Tuần" />
              <WeeklyScheduleTable schedule={weeklySchedule} />
              <View style={styles.warningBox}>
                <Text style={styles.warningTitle}>⚠  Lưu ý lâm sàng quan trọng</Text>
                <Text style={styles.warningBody}>
                  Kế hoạch này dựa trên quan sát hành vi từ video và không thay thế đánh
                  giá lâm sàng chuyên sâu. Phụ huynh nên chia sẻ các bài tập này với
                  chuyên gia AI4autism & Giáo viên tại BI Center đang theo dõi bé để điều
                  chỉnh phù hợp với hồ sơ cá nhân.{'\n\n'}Điều quan trọng nhất: theo dõi
                  phản ứng của bé sau mỗi bài tập và điều chỉnh cường độ/thời gian theo
                  dấu hiệu bé. Nếu bé có dấu hiệu quá tải (covering ears, turning away,
                  meltdown), giảm ngay cường độ kích thích.
                </Text>
              </View>
            </View>
          )}

          {/* ── AI message ────────────────────────────────────── */}
          {!!message && (
            <View style={styles.messageCard}>
              <Text style={styles.messageTitle}>Lời nhắn từ AI</Text>
              <Text style={styles.messageBody}>{message}</Text>
            </View>
          )}

          {/* ── Fallback: old format ──────────────────────────── */}
          {!hasNewFormat && (
            <>
              {Object.entries(domainScores).length > 0 && (
                <View style={styles.fallbackCard}>
                  <Text style={styles.fallbackTitle}>Điểm theo lĩnh vực</Text>
                  {Object.entries(domainScores).map(([domain, score]) => {
                    const pct = Math.max(0, Math.min(100, Number(score) || 0));
                    return (
                      <View key={domain} style={styles.scoreRow}>
                        <Text style={styles.scoreLabel}>
                          {DOMAIN_LABELS[domain] || domain}
                        </Text>
                        <View style={styles.scoreTrack}>
                          <View style={[styles.scoreFill, { width: `${pct}%` }]} />
                        </View>
                        <Text style={styles.scoreValue}>{pct}%</Text>
                      </View>
                    );
                  })}
                </View>
              )}
              {oldObs.length > 0 && (
                <View style={styles.fallbackCard}>
                  <Text style={styles.fallbackTitle}>Quan sát chính</Text>
                  {oldObs.slice(0, 5).map((item, idx) => (
                    <Text key={idx} style={styles.listItem}>
                      {'• '}{item.note || item.text || item.summary}
                    </Text>
                  ))}
                </View>
              )}
              {oldRecs.length > 0 && (
                <View style={styles.fallbackCard}>
                  <Text style={styles.fallbackTitle}>Gợi ý can thiệp</Text>
                  {oldRecs.slice(0, 5).map((item, idx) => (
                    <Text key={idx} style={styles.listItem}>
                      {'• '}{item.action || item.recommendation || item.text}
                    </Text>
                  ))}
                </View>
              )}
            </>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Tài liệu can thiệp nội bộ • Không thay thế đánh giá lâm sàng chuyên sâu
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

// ── SectionHeader ────────────────────────────────────────────────────────────

function SectionHeader({ roman, title }) {
  return (
    <View style={styles.sectionHeaderWrap}>
      <Text style={styles.sectionHeaderText}>
        {roman} {title}
      </Text>
      <View style={styles.sectionDivider} />
    </View>
  );
}

// ── ExerciseCard ─────────────────────────────────────────────────────────────

function ExerciseCard({ exercise, index }) {
  const headerBg = EXERCISE_BG[index % EXERCISE_BG.length];
  const steps = safeArr(exercise.steps);
  const targets = safeArr(exercise.targets);
  const num = exercise.number || index + 1;

  return (
    <View style={styles.exCard}>
      <View style={[styles.exHeader, { backgroundColor: headerBg }]}>
        <Text style={styles.exTitle}>
          Bài {num}{'  '}{exercise.title || exercise.name || ''}
        </Text>
        {!!exercise.therapy_method && (
          <Text style={styles.exTherapy}>
            Liệu pháp: {exercise.therapy_method}
          </Text>
        )}
      </View>
      <View style={styles.exBody}>
        {!!exercise.observation_note && (
          <Text style={styles.exObsNote}>{exercise.observation_note}</Text>
        )}
        {!!exercise.goal && (
          <>
            <Text style={styles.exFieldLabel}>Mục tiêu</Text>
            <Text style={styles.exFieldBody}>{exercise.goal}</Text>
          </>
        )}
        {steps.length > 0 && (
          <>
            <Text style={styles.exFieldLabel}>Cách thực hiện</Text>
            {steps.map((step, si) => (
              <Text key={si} style={styles.exStep}>
                {'• '}{typeof step === 'string' ? step : step.text || ''}
              </Text>
            ))}
          </>
        )}
        {targets.length > 0 && (
          <>
            <Text style={styles.exFieldLabel}>Mục tiêu hướng đến:</Text>
            <Text style={styles.exTargets}>{targets.join(' | ')}</Text>
          </>
        )}
      </View>
    </View>
  );
}

// ── WeeklyScheduleTable ──────────────────────────────────────────────────────

const SCHEDULE_DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6-7'];

function WeeklyScheduleTable({ schedule }) {
  let rows;
  if (Array.isArray(schedule?.rows)) {
    rows = schedule.rows;
  } else {
    rows = [
      { label: 'Buổi sáng', days: safeArr(schedule.morning) },
      { label: 'Buổi chiều', days: safeArr(schedule.afternoon) },
      { label: 'Thời gian', days: safeArr(schedule.duration) },
    ].filter(r => r.days.some(Boolean));
  }

  if (!rows.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scheduleScroll}
    >
      <View>
        {/* Header */}
        <View style={styles.schHeaderRow}>
          <View style={[styles.schCell, styles.schLabelCell, styles.schHeaderBg]}>
            <Text style={styles.schHeaderText}>Thứ</Text>
          </View>
          {SCHEDULE_DAYS.map(d => (
            <View key={d} style={[styles.schCell, styles.schHeaderBg]}>
              <Text style={styles.schHeaderText}>{d}</Text>
            </View>
          ))}
        </View>
        {/* Data rows */}
        {rows.map((row, ri) => (
          <View key={ri} style={[styles.schRow, ri % 2 === 1 && styles.schRowAlt]}>
            <View style={[styles.schCell, styles.schLabelCell, styles.schLabelBg]}>
              <Text style={styles.schLabelText}>{row.label}</Text>
            </View>
            {SCHEDULE_DAYS.map((_, di) => (
              <View key={di} style={styles.schCell}>
                <Text style={styles.schCellText}>
                  {(row.days && row.days[di]) || '—'}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingTop: 52, paddingBottom: spacing.xxxl },

  backBtn: { alignSelf: 'flex-start', marginBottom: spacing.lg },
  backText: { ...typography.bodySm, color: colors.primary, fontWeight: '600' },

  // Loading / empty
  centerCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
    gap: spacing.sm,
  },
  mutedText: { ...typography.body, color: colors.textLight, textAlign: 'center', lineHeight: 20 },
  emptyTitle: { ...typography.h4, color: colors.textDark, textAlign: 'center' },

  // Cover
  reportCover: {
    backgroundColor: NAVY,
    borderRadius: radius.xl,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  reportTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  reportSubtitle: {
    ...typography.bodySm,
    color: '#B8D4E8',
    fontStyle: 'italic',
    marginTop: 6,
    textAlign: 'center',
  },

  // Info grid (2-column, flex-wrap)
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.bgCard,
    marginBottom: spacing.lg,
  },
  infoCell: { width: '50%', padding: spacing.sm },
  infoCellFull: { width: '100%' },
  infoCellBorderRight: { borderRightWidth: 1, borderRightColor: colors.border },
  infoCellBorderBottom: { borderBottomWidth: 1, borderBottomColor: colors.border },
  infoCellLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 2,
  },
  infoCellValue: { ...typography.bodySm, color: colors.textDark },

  // Section
  section: { marginBottom: spacing.xl },
  sectionHeaderWrap: { marginBottom: spacing.md },
  sectionHeaderText: {
    fontSize: 17,
    fontWeight: '700',
    color: SECTION_BLUE,
    marginBottom: 6,
  },
  sectionDivider: { height: 1.5, backgroundColor: SECTION_BLUE, opacity: 0.25 },
  subSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: SECTION_BLUE,
    marginBottom: spacing.xs,
  },
  hr: { height: 1, backgroundColor: colors.border, marginBottom: spacing.sm },

  // Scene analysis table
  tableHeaderRow: { flexDirection: 'row', backgroundColor: NAVY },
  thCell: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.2)',
  },
  tdRow: { flexDirection: 'row', backgroundColor: colors.bgCard },
  tdRowAlt: { backgroundColor: '#EEF3F8' },
  tdCell: {
    fontSize: 11,
    color: colors.textMid,
    padding: 8,
    lineHeight: 17,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  // Strength box
  strengthBox: {
    backgroundColor: '#EBF5EF',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#C2DBC8',
  },
  strengthBoxTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A5C37',
    marginBottom: spacing.sm,
  },
  strengthItem: { fontSize: 13, color: '#2D5A3D', lineHeight: 20, marginBottom: 4 },

  // Challenge box
  challengeBox: {
    backgroundColor: '#FDF0F0',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E8C4C4',
  },
  challengeBoxTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9B1C1C',
    marginBottom: spacing.sm,
  },
  challengeItem: { fontSize: 13, color: '#7A2A2A', lineHeight: 20, marginBottom: 4 },

  // Advice box
  adviceBox: {
    backgroundColor: colors.primaryBg,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  adviceSubTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  adviceBodyText: { ...typography.body, color: colors.textMid, lineHeight: 22 },
  adviceItem: { ...typography.body, color: colors.textMid, lineHeight: 22, marginBottom: 4 },

  // Exercises
  exercisesIntro: {
    ...typography.body,
    color: colors.textMid,
    lineHeight: 22,
    marginBottom: spacing.md,
  },

  // Exercise card
  exCard: {
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  exHeader: { padding: spacing.md },
  exTitle: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.1 },
  exTherapy: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    fontStyle: 'italic',
    marginTop: 4,
  },
  exBody: { backgroundColor: colors.bgCard, padding: spacing.md },
  exObsNote: {
    fontSize: 12,
    color: colors.textMid,
    fontStyle: 'italic',
    lineHeight: 18,
    backgroundColor: '#F5F0E8',
    padding: spacing.sm,
    borderRadius: radius.xs,
    marginBottom: spacing.sm,
  },
  exFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  exFieldBody: { ...typography.body, color: colors.textMid, lineHeight: 20 },
  exStep: { fontSize: 13, color: colors.textMid, lineHeight: 20, marginBottom: 4 },
  exTargets: { fontSize: 12, color: colors.textMid, fontStyle: 'italic', lineHeight: 20 },

  // Weekly schedule
  scheduleScroll: { marginBottom: spacing.md },
  schHeaderRow: { flexDirection: 'row' },
  schRow: { flexDirection: 'row', backgroundColor: colors.bgCard },
  schRowAlt: { backgroundColor: '#EEF3F8' },
  schCell: {
    width: 110,
    minHeight: 44,
    padding: 8,
    borderWidth: 0.5,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  schLabelCell: { width: 88 },
  schHeaderBg: { backgroundColor: NAVY },
  schLabelBg: { backgroundColor: '#EBF0F8' },
  schHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  schLabelText: { fontSize: 12, fontWeight: '700', color: colors.textDark },
  schCellText: { fontSize: 11, color: colors.textMid, lineHeight: 16 },

  // Warning box
  warningBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#F0D060',
    marginTop: spacing.md,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: spacing.sm,
  },
  warningBody: { fontSize: 12, color: '#78350F', lineHeight: 20 },

  // AI message
  messageCard: {
    backgroundColor: colors.secondaryBg,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.secondaryLight,
    ...shadows.sm,
    marginBottom: spacing.md,
  },
  messageTitle: { ...typography.h4, color: colors.secondaryDark, marginBottom: spacing.sm },
  messageBody: { ...typography.body, color: colors.textMid, lineHeight: 22 },

  // Fallback (old format)
  fallbackCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
    marginBottom: spacing.md,
  },
  fallbackTitle: { ...typography.h4, color: colors.textDark, marginBottom: spacing.sm },
  listItem: { ...typography.body, color: colors.textMid, lineHeight: 22, marginBottom: spacing.xs },
  scoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  scoreLabel: { ...typography.caption, color: colors.textMid, width: 100 },
  scoreTrack: {
    flex: 1,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.bgMuted,
    overflow: 'hidden',
  },
  scoreFill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.primary },
  scoreValue: {
    ...typography.caption,
    color: colors.textDark,
    fontWeight: '700',
    width: 42,
    textAlign: 'right',
  },

  // Footer
  footer: { alignItems: 'center', paddingTop: spacing.md },
  footerText: { ...typography.caption, color: colors.textLight, textAlign: 'center' },
});
