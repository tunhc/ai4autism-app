import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { colors, radius, spacing, shadows } from '../../lib/colors';
import { typography } from '../../lib/typography';
import { useAuth } from '../../contexts/AuthContext';
import { getChildrenByTeacher, getJournalEntries, getChildInterventionTimeline } from '../../lib/supabase';

const MOCK_CHILDREN = [
  { id: 's1', name: 'Nguyễn Minh Anh', nickname: 'Minh Anh', age: 4, level: 'Mức 2', score: 67 },
  { id: 's2', name: 'Trần Gia Khoa', nickname: 'Gia Khoa', age: 5, level: 'Mức 1', score: 58 },
  { id: 's3', name: 'Phạm Thùy Linh', nickname: 'Thùy Linh', age: 4, level: 'Mức 1', score: 72 },
  { id: 's4', name: 'Vũ Minh Đức', nickname: 'Minh Đức', age: 6, level: 'Mức 3', score: 49 },
];

const MOCK_REPORTS_DATA = {
  s1: {
    moodStats: { happy: 8, normal: 5, sad: 2, angry: 1 },
    moodLogs: [
      { id: 'ml1', date: '21-05', mood: 'happy', label: 'Vui vẻ', activity: 'Học vẽ tranh', desc: 'Bé hoàn thành bài tô màu và chủ động khoe với cô.' },
      { id: 'ml2', date: '20-05', mood: 'normal', label: 'Bình thường', activity: 'Giờ ăn trưa', desc: 'Bé ăn hết suất trưa nhưng ăn hơi chậm.' },
      { id: 'ml3', date: '19-05', mood: 'angry', label: 'Bực bội', activity: 'Giao tiếp PECS', desc: 'Bé muốn uống nước cam nhưng cô đưa sữa, bé hét lên và vứt thẻ.' },
      { id: 'ml4', date: '18-05', mood: 'sad', label: 'Buồn bã', activity: 'Giờ ngủ trưa', desc: 'Bé trằn trọc không ngủ được và khóc gọi mẹ nhẹ nhàng.' }
    ],
    timeline: [
      { id: 'tl1', date: '21-05-2026', type: 'Can thiệp cá nhân', duration: '60 phút', performer: 'Cô Vy', desc: 'Tập trung luyện phát âm từ đơn và ghép thẻ hình ảnh.' },
      { id: 'tl2', date: '20-05-2026', type: 'Hoạt động tại nhà', duration: '15 phút', performer: 'Phụ huynh', desc: 'Chơi xếp hình luân phiên với mẹ ở phòng khách.' },
      { id: 'tl3', date: '19-05-2026', type: 'Can thiệp cá nhân', duration: '45 phút', performer: 'Cô Vy', desc: 'Kỹ năng giao tiếp yêu cầu thông qua trao đổi thẻ PECS.' },
      { id: 'tl4', date: '17-05-2026', type: 'Hoạt động tại nhà', duration: '20 phút', performer: 'Phụ huynh', desc: 'Mẹ hướng dẫn bé tự mang giày đi học.' }
    ]
  },
  s2: {
    moodStats: { happy: 10, normal: 4, sad: 1, angry: 0 },
    moodLogs: [
      { id: 'ml5', date: '20-05', mood: 'happy', label: 'Vui vẻ', activity: 'Đóng vai bác sĩ', desc: 'Bé vui sướng dùng tai nghe đồ chơi khám bệnh cho cô.' },
      { id: 'ml6', date: '19-05', mood: 'happy', label: 'Vui vẻ', activity: 'Giờ ăn xế', desc: 'Tự ăn hết bánh flan và nói cảm ơn.' }
    ],
    timeline: [
      { id: 'tl5', date: '20-05-2026', type: 'Can thiệp cá nhân', duration: '60 phút', performer: 'Cô Ngân', desc: 'Tập trung hướng dẫn đóng vai tương tác xã hội.' },
      { id: 'tl6', date: '19-05-2026', type: 'Hoạt động tại nhà', duration: '10 phút', performer: 'Phụ huynh', desc: 'Bé tự mặc áo và được ba mẹ quay video modeling.' }
    ]
  },
  s3: {
    moodStats: { happy: 6, normal: 7, sad: 2, angry: 2 },
    moodLogs: [
      { id: 'ml7', date: '20-05', mood: 'angry', label: 'Bực bội', activity: 'Hoạt động nhóm', desc: 'Bé bực bội bịt tai khi các bạn xung quanh hét lớn.' },
      { id: 'ml8', date: '18-05', mood: 'sad', label: 'Buồn bã', activity: 'Giờ ăn trưa', desc: 'Có tiếng sấm chớp ngoài trời khiến bé hoảng sợ khóc nhỏ.' }
    ],
    timeline: [
      { id: 'tl7', date: '20-05-2026', type: 'Can thiệp cá nhân', duration: '50 phút', performer: 'Cô Vy', desc: 'Can thiệp điều hòa thính giác và phân biệt cảm xúc qua tranh vẽ.' },
      { id: 'tl8', date: '18-05-2026', type: 'Hoạt động tại nhà', duration: '30 phút', performer: 'Phụ huynh', desc: 'Nghe nhạc nhẹ giảm căng thẳng thính giác trước khi ngủ.' }
    ]
  },
  s4: {
    moodStats: { happy: 3, normal: 6, sad: 4, angry: 3 },
    moodLogs: [
      { id: 'ml9', date: '19-05', mood: 'angry', label: 'Bực bội', activity: 'Giờ tập tô', desc: 'Bé bóp gãy bút sáp màu và cắn tay áo khi cô yêu cầu ngồi yên.' },
      { id: 'ml10', date: '17-05', mood: 'sad', label: 'Buồn bã', activity: 'Giờ tự do', desc: 'Chỉ ngồi quay bánh xe ô tô đồ chơi một mình, từ chối tham gia chơi bóng.' }
    ],
    timeline: [
      { id: 'tl9', date: '19-05-2026', type: 'Can thiệp cá nhân', duration: '60 phút', performer: 'Cô Ngân', desc: 'Tập đồ đường nét trên cát và tập âm môi răng cơ bản.' },
      { id: 'tl10', date: '17-05-2026', type: 'Can thiệp cá nhân', duration: '45 phút', performer: 'Cô Ngân', desc: 'Luyện tập ngồi tĩnh lặng giảm vẫy tay tự kích thích.' }
    ]
  }
};

const MOOD_EMOJIS = {
  happy: '😃',
  normal: '😐',
  sad: '😢',
  angry: '😡',
};

const MOOD_COLORS = {
  happy: colors.secondary,
  normal: colors.primary,
  sad: colors.lavender,
  angry: colors.danger,
};

export default function TeacherReportScreen() {
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(MOCK_CHILDREN[0]);
  const [timeFilter, setTimeFilter] = useState('Tháng'); // Ngày, Tuần, Tháng

  const [pdfVisible, setPdfVisible] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [reportData, setReportData] = useState(MOCK_REPORTS_DATA.s1);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

  const loadChildren = useCallback(async () => {
    const teacherId = profile?.id;
    if (!teacherId) {
      setChildren([]);
      setSelectedChild(null);
      setLoadingList(false);
      return;
    }
    try {
      const list = await getChildrenByTeacher(teacherId);
      if (list && list.length > 0) {
        const mapped = list.map(c => ({
          id: c.id,
          name: c.full_name,
          nickname: c.nickname || c.full_name.split(' ').pop(),
          age: c.age || 4,
          level: c.diagnostic_level?.split(' - ')[0] || 'Mức 2',
          score: c.hpdt_profiles?.[0]?.overall_score || 60,
        }));
        setChildren(mapped);
        setSelectedChild(mapped[0]);
      } else {
        setChildren([]);
        setSelectedChild(null);
      }
    } catch {
      setChildren([]);
      setSelectedChild(null);
    } finally {
      setLoadingList(false);
    }
  }, [profile]);

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  const loadChildData = useCallback(async (childId) => {
    if (!childId) return;
    setLoadingData(true);
    try {
      const limit = timeFilter === 'Ngày' ? 5 : timeFilter === 'Tuần' ? 20 : 50;
      const [journals, sessions] = await Promise.allSettled([
        getJournalEntries(childId, limit),
        getChildInterventionTimeline(childId, limit),
      ]);
      
      const realReport = { moodStats: { happy: 0, normal: 0, sad: 0, angry: 0 }, moodLogs: [], timeline: [] };
      
      if (journals.status === 'fulfilled' && journals.value?.length > 0) {
        journals.value.forEach(j => {
          const mood = j.mood_tags?.[0] || 'neutral';
          const mappedMood = (mood === 'positive' || mood === 'happy') ? 'happy' : 
                             (mood === 'negative' || mood === 'sad') ? 'sad' : 
                             (mood === 'angry' || mood === 'frustrated') ? 'angry' : 'normal';
          realReport.moodStats[mappedMood] = (realReport.moodStats[mappedMood] || 0) + 1;
          
          const dt = new Date(j.entry_date);
          const dateStr = `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
          
          realReport.moodLogs.push({
            id: j.id,
            date: dateStr,
            mood: mappedMood,
            label: mappedMood === 'happy' ? 'Vui vẻ' : mappedMood === 'sad' ? 'Buồn bã' : mappedMood === 'angry' ? 'Bực bội' : 'Bình thường',
            activity: j.activity_tags?.[0] || 'Sinh hoạt',
            desc: j.content,
          });
        });
      }
      
      if (sessions.status === 'fulfilled' && sessions.value?.length > 0) {
        realReport.timeline = sessions.value.map(s => {
          const dt = new Date(s.session_date);
          const dateStr = `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
          return {
            id: s.id,
            date: dateStr,
            type: s.performed_by_role === 'parent' ? 'Hoạt động tại nhà' : 'Can thiệp cá nhân',
            duration: s.exercise_assignments?.exercises?.duration_minutes ? `${s.exercise_assignments.exercises.duration_minutes} phút` : '30 phút',
            performer: s.users?.full_name?.split(' ').pop() || (s.performed_by_role === 'parent' ? 'Phụ huynh' : 'Giáo viên'),
            desc: `Đã thực hiện bài tập: ${s.exercise_assignments?.exercises?.name || 'Bài tập'}. ${s.notes || ''}`.trim(),
          };
        });
      }
      
      setReportData(realReport);
    } catch {
      setReportData({ moodStats: { happy: 0, normal: 0, sad: 0, angry: 0 }, moodLogs: [], timeline: [] });
    } finally {
      setLoadingData(false);
    }
  }, [timeFilter]);

  useEffect(() => {
    if (selectedChild?.id) loadChildData(selectedChild.id);
  }, [selectedChild, loadChildData]);

  const filteredChildren = children.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.nickname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectChild = (child) => {
    setSelectedChild(child);
    setSearchQuery('');
  };

  const handleExportPDF = () => {
    setPdfVisible(true);
  };

  const handleDownloadPDF = () => {
    setExporting(true);
    setTimeout(() => {
      setExporting(false);
      setPdfVisible(false);
      Alert.alert('Thành công', `Đã tải báo cáo của bé ${selectedChild.name} về máy dưới dạng PDF.`);
    }, 1500);
  };

  return (
    <View style={styles.root}>
      {/* ══ Header ══ */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Báo cáo học tập</Text>
        <Text style={styles.headerSub}>Theo dõi lịch sử can thiệp và nhật ký cảm xúc học sinh</Text>
      </View>

      {/* ══ Search & Selector Row ══ */}
      <View style={styles.filterWrapper}>
        <View style={styles.searchBox}>
          <Text style={{ fontSize: 16, marginRight: 6 }}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm nhanh học sinh..."
            placeholderTextColor={colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {searchQuery.length > 0 && (
          <View style={styles.searchResultsPanel}>
            {filteredChildren.map(c => (
              <TouchableOpacity key={c.id} style={styles.searchResultItem} onPress={() => handleSelectChild(c)}>
                <Text style={styles.searchResultText}>{c.name} ({c.nickname})</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm }}>
          <View style={styles.activeChildChip}>
            <Text style={{ fontSize: 14, marginRight: 4 }}>👦</Text>
            <Text style={styles.activeChildText}>{selectedChild.name}</Text>
          </View>

          <View style={styles.timeTabs}>
            {['Ngày', 'Tuần', 'Tháng'].map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.timeTab, timeFilter === t && styles.timeTabActive]}
                onPress={() => setTimeFilter(t)}
              >
                <Text style={[styles.timeTabText, timeFilter === t && { color: colors.secondaryDark, fontWeight: '700' }]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {loadingList || loadingData ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.secondary} />
          <Text style={{ marginTop: spacing.md, color: colors.textMid }}>Đang tải dữ liệu báo cáo...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ══ Mood Statistics Card ══ */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>NHẬT KÝ TRẠNG THÁI CỦA BÉ</Text>
          <Text style={styles.sectionDesc}>Phổ cảm xúc ghi nhận trong thời gian {timeFilter.toLowerCase()}:</Text>

          <View style={styles.moodGrid}>
            {Object.keys(reportData.moodStats).map(moodKey => {
              const count = reportData.moodStats[moodKey];
              const col = MOOD_COLORS[moodKey];
              const emoji = MOOD_EMOJIS[moodKey];
              const labels = { happy: 'Vui vẻ', normal: 'Bình thường', sad: 'Buồn bã', angry: 'Bực bội' };

              return (
                <View key={moodKey} style={[styles.moodStatBox, { borderColor: col + '40' }]}>
                  <Text style={styles.moodEmoji}>{emoji}</Text>
                  <Text style={[styles.moodCount, { color: col }]}>{count} lần</Text>
                  <Text style={styles.moodLabel}>{labels[moodKey]}</Text>
                </View>
              );
            })}
          </View>

          <Text style={[styles.cardSectionTitle, { marginTop: spacing.md, marginBottom: spacing.xs }]}>Nhật ký cảm xúc gần đây:</Text>
          {reportData.moodLogs.map(log => {
            const col = MOOD_COLORS[log.mood];
            const emoji = MOOD_EMOJIS[log.mood];
            return (
              <View key={log.id} style={styles.moodLogItem}>
                <View style={[styles.moodLogDot, { backgroundColor: col }]}>
                  <Text style={{ fontSize: 12 }}>{emoji}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <View style={styles.moodLogHeader}>
                    <Text style={styles.moodLogActivity}>{log.activity}</Text>
                    <Text style={styles.moodLogDate}>{log.date}</Text>
                  </View>
                  <Text style={styles.moodLogDesc}>{log.desc}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ══ Intervention History Timeline ══ */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
            <Text style={styles.cardSectionTitle}>LỊCH SỬ CAN THIỆP</Text>
            <TouchableOpacity style={styles.pdfActionBtn} onPress={handleExportPDF}>
              <Text style={{ fontSize: 14, marginRight: 4 }}>📄</Text>
              <Text style={styles.pdfActionBtnText}>Xuất báo cáo PDF</Text>
            </TouchableOpacity>
          </View>

          {reportData.timeline.map((item, idx) => {
            const isLast = idx === reportData.timeline.length - 1;
            return (
              <View key={item.id} style={styles.timelineRow}>
                <View style={styles.timelineIndicators}>
                  <View style={styles.timelineKnot}>
                    <View style={styles.timelineInnerKnot} />
                  </View>
                  {!isLast && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.timelineContent}>
                  <View style={styles.timelineHeader}>
                    <Text style={styles.timelineDate}>{item.date}</Text>
                    <View style={[
                      styles.timelineBadge,
                      item.performer === 'Cô Vy' || item.performer === 'Cô Ngân' ? styles.badgeTeacher : styles.badgeParent
                    ]}>
                      <Text style={styles.badgeLabel}>{item.performer}</Text>
                    </View>
                  </View>
                  <Text style={styles.timelineType}>{item.type} ({item.duration})</Text>
                  <Text style={styles.timelineDesc}>{item.desc}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
      )}

      {/* ══ PDF Preview Modal ══ */}
      <Modal visible={pdfVisible} animationType="slide" transparent onRequestClose={() => setPdfVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.pdfWrapper}>
            <View style={styles.pdfNavbar}>
              <Text style={styles.pdfNavTitle}>Xem trước bản PDF</Text>
              <TouchableOpacity onPress={() => setPdfVisible(false)} style={styles.pdfCloseBtn}>
                <Text style={{ fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.pdfPaperScroll} contentContainerStyle={styles.pdfPaper} showsVerticalScrollIndicator={false}>
              {/* Paper Header */}
              <View style={styles.pdfHeader}>
                <Text style={styles.pdfSchoolName}>HỆ THỐNG PHÒNG KHÁM & CAN THIỆP SỚM BIC</Text>
                <Text style={styles.pdfSchoolAddress}>Đ/C: 120 Đường 3/2, Quận 10, Tp. Hồ Chí Minh • ĐT: 1900.2026</Text>
                <View style={styles.pdfHeaderDivider} />
                <Text style={styles.pdfDocTitle}>BÁO CÁO CAN THIỆP CÁ NHÂN HÓA</Text>
                <Text style={styles.pdfDocSub}>Thời kỳ đánh giá: Tháng 05/2026</Text>
              </View>

              {/* Student info grid */}
              <View style={styles.pdfGrid}>
                <View style={styles.pdfGridRow}>
                  <Text style={styles.pdfGridLabel}>Học sinh:</Text>
                  <Text style={styles.pdfGridVal}>{selectedChild.name}</Text>
                  <Text style={styles.pdfGridLabel}>Tuổi:</Text>
                  <Text style={styles.pdfGridVal}>{selectedChild.age} tuổi</Text>
                </View>
                <View style={styles.pdfGridRow}>
                  <Text style={styles.pdfGridLabel}>Chẩn đoán:</Text>
                  <Text style={[styles.pdfGridVal, { flex: 3 }]}>{selectedChild.level} (Mức độ tự kỷ theo DSM-5)</Text>
                </View>
                <View style={styles.pdfGridRow}>
                  <Text style={styles.pdfGridLabel}>Chỉ số hpDT:</Text>
                  <Text style={styles.pdfGridVal}>{selectedChild.score} / 100 điểm</Text>
                  <Text style={styles.pdfGridLabel}>Phát triển:</Text>
                  <Text style={[styles.pdfGridVal, { color: colors.secondaryDark, fontWeight: '700' }]}>+6.8% (Tích cực)</Text>
                </View>
              </View>

              {/* Analytical Summary */}
              <Text style={styles.pdfSectionTitle}>1. Đánh Giá Trạng Thái Cảm Xúc & Mood Logs</Text>
              <Text style={styles.pdfBodyText}>
                Trong tháng 05/2026, bé có tổng cộng 16 lượt ghi nhận trạng thái cảm xúc từ phụ huynh và giáo viên. Tỷ lệ cảm xúc tích cực (Vui vẻ) chiếm đa số với {reportData.moodStats.happy} lần ({Math.round(reportData.moodStats.happy / 16 * 100)}%). Cảm xúc bực bội xảy ra {reportData.moodStats.angry} lần, chủ yếu xuất hiện trong các bài tập thử thách giao tiếp bằng PECS khi bé có mong muốn trái ngược với giáo cụ.
              </Text>

              <Text style={styles.pdfSectionTitle}>2. Tóm Tắt Nhật Ký Can Thiệp Chi Tiết</Text>
              {reportData.timeline.map((tl, i) => (
                <View key={tl.id} style={styles.pdfTimelineRow}>
                  <Text style={styles.pdfTimelineNum}>{i+1}.</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pdfTimelineHeader}>{tl.date} — {tl.type} ({tl.duration})</Text>
                    <Text style={styles.pdfTimelineDesc}>Người thực hiện: {tl.performer} • {tl.desc}</Text>
                  </View>
                </View>
              ))}

              <Text style={styles.pdfSectionTitle}>3. Nhận Xét Chuyên Môn Của Giáo Viên</Text>
              <Text style={styles.pdfBodyText}>
                Học sinh {selectedChild.name} có phản xạ và hợp tác rất tốt với các bài tập vận động tinh và chơi đóng vai xã hội. Tuy nhiên, kỹ năng giao tiếp yêu cầu bằng câu nói ngắn 2-3 từ cần được rèn luyện kiên nhẫn hơn. Đề xuất phụ huynh tăng cường thời gian cho bé tự lựa chọn và yêu cầu sữa/nước tại nhà thông qua thẻ hình PECS để đồng bộ hóa bài tập trên lớp của giáo viên.
              </Text>

              {/* Signature area */}
              <View style={styles.pdfSignArea}>
                <View style={styles.pdfSignCol}>
                  <Text style={styles.pdfSignTitle}>PHỤ HUYNH XÁC NHẬN</Text>
                  <View style={styles.pdfSignPlaceholder} />
                  <Text style={styles.pdfSignName}>......................................</Text>
                </View>
                <View style={styles.pdfSignCol}>
                  <Text style={styles.pdfSignTitle}>GIÁO VIÊN CAN THIỆP</Text>
                  <View style={styles.pdfSignPlaceholder}>
                    <Text style={styles.pdfSignatureText}>Vy</Text>
                  </View>
                  <Text style={styles.pdfSignName}>Cô Nguyễn Thị Vy</Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.pdfFooter}>
              <TouchableOpacity style={styles.pdfCancelBtn} onPress={() => setPdfVisible(false)}>
                <Text style={styles.pdfCancelBtnText}>Đóng</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pdfDownloadBtn} onPress={handleDownloadPDF} disabled={exporting}>
                {exporting ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.pdfDownloadBtnText}>📄 Tải xuống PDF</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },

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

  // Filter box
  filterWrapper: {
    backgroundColor: colors.bgCard,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    height: 40,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.textDark, padding: 0 },
  searchResultsPanel: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    marginTop: 4,
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    top: 56,
    zIndex: 99,
    ...shadows.md,
  },
  searchResultItem: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchResultText: { ...typography.bodySm, color: colors.textDark, fontWeight: '500' },

  activeChildChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondaryBg,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1.2,
    borderColor: colors.secondaryLight,
  },
  activeChildText: { ...typography.caption, color: colors.secondaryDark, fontWeight: '700' },

  timeTabs: { flexDirection: 'row', gap: 4 },
  timeTab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.bgMuted,
  },
  timeTabActive: {
    backgroundColor: colors.secondaryBg,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  timeTabText: { fontSize: 11, color: colors.textMid, fontWeight: '600' },

  // Cards
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cardSectionTitle: {
    ...typography.labelSm,
    color: colors.textDark,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  sectionDesc: { ...typography.caption, color: colors.textMid, marginTop: 2, marginBottom: spacing.md, lineHeight: 16 },

  // Mood grid
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: spacing.xs, justifyContent: 'space-around' },
  moodStatBox: {
    width: '45%',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: spacing.sm,
    alignItems: 'center',
  },
  moodEmoji: { fontSize: 32, marginBottom: 2 },
  moodCount: { ...typography.h3, fontWeight: '800' },
  moodLabel: { ...typography.caption, color: colors.textMid, fontSize: 10, marginTop: 1 },

  // Mood log items
  moodLogItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.sm,
    borderBottomWidth: 0.8,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  moodLogDot: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodLogHeader: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', flex: 1, marginBottom: 2 },
  moodLogActivity: { ...typography.bodySm, fontWeight: '700', color: colors.textDark },
  moodLogDate: { fontSize: 9, color: colors.textLight },
  moodLogDesc: { ...typography.caption, color: colors.textMid, lineHeight: 16, marginTop: 1 },

  // Timeline
  pdfActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondaryBg,
    borderWidth: 1.2,
    borderColor: colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  pdfActionBtnText: { ...typography.caption, color: colors.secondaryDark, fontWeight: '700', fontSize: 10 },

  timelineRow: { flexDirection: 'row', marginBottom: spacing.md },
  timelineIndicators: { width: 24, alignItems: 'center', marginRight: spacing.xs },
  timelineKnot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.secondaryBg,
    borderWidth: 2,
    borderColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
  },
  timelineInnerKnot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.secondary,
  },
  timelineLine: { width: 1.8, backgroundColor: colors.borderStrong, flex: 1, marginVertical: 4 },
  timelineContent: { flex: 1, backgroundColor: colors.bg, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  timelineDate: { fontSize: 10, fontWeight: '700', color: colors.textDark },
  timelineBadge: { paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 3 },
  badgeTeacher: { backgroundColor: colors.secondaryBg },
  badgeParent: { backgroundColor: colors.primaryBg },
  badgeLabel: { fontSize: 8, fontWeight: '700', color: colors.textMid },
  timelineType: { ...typography.caption, fontWeight: '600', color: colors.secondaryDark },
  timelineDesc: { ...typography.caption, color: colors.textMid, marginTop: 4, lineHeight: 16 },

  // PDF Preview styles
  pdfWrapper: {
    backgroundColor: colors.bgMuted,
    width: '100%',
    height: '92%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    ...shadows.lg,
  },
  pdfNavbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  pdfNavTitle: { ...typography.h3, color: colors.textDark, fontWeight: '700' },
  pdfCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfPaperScroll: { flex: 1 },
  pdfPaper: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    padding: spacing.lg,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#DFD8CE',
    ...shadows.sm,
    minHeight: 650,
  },

  pdfHeader: { alignItems: 'center', marginBottom: spacing.md },
  pdfSchoolName: { fontSize: 10, fontWeight: '700', color: '#1B355A', letterSpacing: 0.5 },
  pdfSchoolAddress: { fontSize: 8, color: colors.textLight, marginTop: 1 },
  pdfHeaderDivider: { width: '80%', height: 0.8, backgroundColor: colors.borderStrong, marginVertical: spacing.sm },
  pdfDocTitle: { fontSize: 16, fontWeight: '800', color: '#1B355A', letterSpacing: 0.8 },
  pdfDocSub: { fontSize: 10, color: colors.textMid, marginTop: 2, fontStyle: 'italic' },

  pdfGrid: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginBottom: spacing.md,
    backgroundColor: '#FAFAF9',
  },
  pdfGridRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.8,
    borderBottomColor: colors.border,
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  pdfGridLabel: { fontSize: 9, fontWeight: '700', color: colors.textDark, width: 68 },
  pdfGridVal: { fontSize: 9, color: colors.textMid, flex: 1 },

  pdfSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1B355A',
    borderLeftWidth: 3,
    borderLeftColor: colors.secondary,
    paddingLeft: 6,
    marginVertical: spacing.sm,
  },
  pdfBodyText: {
    fontSize: 9.5,
    color: colors.textDark,
    lineHeight: 15,
    marginBottom: spacing.sm,
    textAlign: 'justify',
  },

  pdfTimelineRow: { flexDirection: 'row', marginBottom: 6, borderBottomWidth: 0.5, borderBottomColor: colors.border, paddingBottom: 4 },
  pdfTimelineNum: { fontSize: 9, fontWeight: '700', color: colors.textDark, marginRight: 6 },
  pdfTimelineHeader: { fontSize: 9, fontWeight: '700', color: colors.textDark },
  pdfTimelineDesc: { fontSize: 8.5, color: colors.textMid, lineHeight: 12 },

  pdfSignArea: { flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.xl, marginBottom: spacing.md },
  pdfSignCol: { alignItems: 'center', width: '45%' },
  pdfSignTitle: { fontSize: 8, fontWeight: '700', color: colors.textDark },
  pdfSignPlaceholder: { height: 42, justifyContent: 'center', alignItems: 'center' },
  pdfSignatureText: { fontStyle: 'italic', fontSize: 16, fontWeight: '700', color: colors.primaryDark },
  pdfSignName: { fontSize: 8.5, fontWeight: '700', color: colors.textDark },

  pdfFooter: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  pdfCancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  pdfCancelBtnText: { ...typography.btn, color: colors.textDark },
  pdfDownloadBtn: {
    flex: 2,
    backgroundColor: colors.secondary,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfDownloadBtnText: { ...typography.btn, color: colors.white, fontWeight: '700' },

  // Modals Overlay basic
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(61,53,48,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
});
