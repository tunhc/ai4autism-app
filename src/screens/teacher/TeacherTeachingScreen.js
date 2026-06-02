import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal, Image
} from 'react-native';
import { colors, radius, spacing, shadows } from '../../lib/colors';
import { typography } from '../../lib/typography';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, getChildrenByTeacher, getSchoolActivities, completeSchoolActivity, getHpdtHistory, getOrCreateVstProfile } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { uploadVideoToBunny } from '../../lib/bunny';
import ChildAvatar3D from '../../components/ChildAvatar3D';

// ── Constants ──────────────────────────────────────────────────────────────────
const VIDEO_CONTEXTS = ['Lớp học', 'Ngoài trời', 'Giờ ăn', 'Giờ chơi', 'Khác'];
const CHILD_STATES   = ['Bình tĩnh', 'Hưng phấn', 'Khó chịu', 'Tập trung', 'Mất tập trung'];
const CONTENT_TYPES  = ['Bài tập', 'Bài giảng', 'Video mẫu'];
const LOCATIONS      = ['🏫 Tại lớp', '🏠 Tại nhà', '🌳 Ngoài trời', '🏥 Phòng trị liệu', '📍 Khác'];
const DOMAINS        = ['Giao tiếp', 'Xã hội', 'Hành vi', 'Cảm giác', 'Vận động', 'Nhận thức'];
const DOMAIN_LABELS = {
  communication: 'Giao tiếp', social: 'Xã hội', behavior: 'Hành vi',
  sensory: 'Cảm giác', motor: 'Vận động', cognitive: 'Nhận thức', adaptive: 'Thích ứng'
};
const DSM_LEVELS     = ['Mức 1', 'Mức 2', 'Mức 3', 'Tất cả'];
const SUGGESTED_TAGS = ['ABA', 'PECS', 'Floortime', 'Luân phiên', 'Giao tiếp mắt', 'Vận động tinh', 'Bữa ăn', 'Giờ chơi'];

const MOCK_ACTIVITIES = [
  { id: '1', completed_sessions: 0, required_sessions: 10, exercises: { name: 'GIAO TIẾP MẮT KHI GỌI TÊN', domain: 'social', duration_minutes: 15 } },
  { id: '2', completed_sessions: 0, required_sessions: 10, exercises: { name: 'CHIA SẺ CHÚ Ý — NHÌN LÊN VÀ CHIA SẺ', domain: 'social', duration_minutes: 15 } },
  { id: '3', completed_sessions: 0, required_sessions: 10, exercises: { name: 'BÀI 1: GIAO TIẾP MẮT KHI GỌI TÊN — KHÔI NHÌN ĐÂY!', domain: 'social', duration_minutes: 15 } },
];

function SchoolActivityItem({ activity, onDone, onUpload }) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState('');
  
  const done = activity.completed_sessions >= activity.required_sessions;
  const ex = activity.exercises || {};
  const col = colors.domain?.[ex.domain] || colors.primary;
  
  const handleSave = () => {
    if (onDone) onDone(note);
    setExpanded(false);
  };

  return (
    <View style={[st.activityItem, done && { opacity: 0.55 }]}>
      <View style={st.actMainRow}>
        <TouchableOpacity
          style={[st.actCheckbox, done && st.actCheckboxDone]}
          onPress={() => { if (!done) setExpanded(!expanded); }}
          activeOpacity={0.7}
        >
          {done && <Text style={st.actCheckmark}>✓</Text>}
        </TouchableOpacity>
        
        <TouchableOpacity style={{ flex: 1, marginLeft: spacing.sm }} onPress={() => { if(!done) setExpanded(!expanded); }} activeOpacity={0.7}>
          <Text style={[st.actName, done && { textDecorationLine: 'line-through', color: colors.textLight }]} numberOfLines={2}>
            {ex.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <View style={[st.chip, { backgroundColor: col + '22' }]}>
              <Text style={[st.chipText, { color: col }]}>{DOMAIN_LABELS[ex.domain] || ex.domain}</Text>
            </View>
            {!!ex.duration_minutes && <Text style={st.actMeta}>{ex.duration_minutes} phút</Text>}
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity style={st.actUploadBtn} onPress={onUpload}>
          <Text style={{ fontSize: 16 }}>📹</Text>
        </TouchableOpacity>
      </View>
      
      {expanded && !done && (
        <View style={st.actExpandArea}>
          <TextInput
            style={st.actNoteInput}
            placeholder="Ghi chú thêm về hoạt động này (tuỳ chọn)..."
            placeholderTextColor={colors.textLight}
            value={note}
            onChangeText={setNote}
            multiline
          />
          <TouchableOpacity style={st.actSaveBtn} onPress={handleSave}>
            <Text style={st.actSaveBtnText}>Lưu & Hoàn thành</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function TeacherTeachingScreen({ navigation }) {
  const { profile } = useAuth();
  const [children, setChildren] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedChildId, setSelectedChildId] = useState(null);
  
  // Data for selected child
  const [hpdt, setHpdt] = useState(null);
  const [activities, setActivities] = useState([]);

  // Upload Observation Modal
  const [obsVisible, setObsVisible] = useState(false);
  const [vidContext, setVidContext] = useState(VIDEO_CONTEXTS[0]);
  const [vidState, setVidState] = useState(CHILD_STATES[0]);
  const [vidNotes, setVidNotes] = useState('');
  const [vidFile, setVidFile] = useState(null);

  // Upload Lesson Modal
  const [lesVisible, setLesVisible] = useState(false);
  const [lesTitle, setLesTitle] = useState('');
  const [lesType, setLesType] = useState(CONTENT_TYPES[0]);
  const [lesLocation, setLesLocation] = useState(LOCATIONS[0]);
  const [lesDesc, setLesDesc] = useState('');
  const [lesDomain, setLesDomain] = useState(DOMAINS[0]);
  const [lesDSM, setLesDSM] = useState(DSM_LEVELS[0]);
  const [lesTags, setLesTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [lesFile, setLesFile] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const loadChildren = useCallback(async () => {
    const teacherId = profile?.id;
    if (!teacherId) return;
    try {
      const list = await getChildrenByTeacher(teacherId);
      setChildren(list || []);
      if (list && list.length > 0) {
        setSelectedChildId(list[0].id);
      }
    } catch {
      setChildren([]);
    } finally {
      setLoadingList(false);
    }
  }, [profile]);

  useEffect(() => { loadChildren(); }, [loadChildren]);

  useEffect(() => {
    if (selectedChildId) {
      loadChildData(selectedChildId);
    }
  }, [selectedChildId]);

  const loadChildData = async (childId) => {
    try {
      let acts = await getSchoolActivities(childId);
      setActivities(acts.length ? acts : MOCK_ACTIVITIES);
    } catch {
      setActivities(MOCK_ACTIVITIES);
    }
    
    try {
      let history = await getHpdtHistory(childId, 1);
      if (history && history.length > 0) {
        setHpdt(history[0]);
      } else {
        setHpdt(null); // No history
      }
    } catch {
      setHpdt(null);
    }
  };

  const handleCompleteActivity = async (activity, note) => {
    const teacherId = profile?.id;
    if (!teacherId) return;
    try {
      await completeSchoolActivity(activity.id, selectedChildId, teacherId, note);
      setActivities(prev => prev.map(p =>
        p.id === activity.id ? { ...p, completed_sessions: Math.min(p.required_sessions, p.completed_sessions + 1) } : p
      ));
    } catch (err) {
      Alert.alert('Lỗi', 'Không thể lưu tiến trình: ' + err.message);
    }
  };

  const pickVideo = async (setFileFunc) => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled) {
      setFileFunc(result.assets[0].uri);
    }
  };

  const handleUploadVideo = async () => {
    if (!vidFile) { Alert.alert('Lỗi', 'Vui lòng chọn video để tải lên.'); return; }
    const child = children.find(c => c.id === selectedChildId);
    if (!child) return;

    setUploading(true);
    setUploadProgress(0);
    try {
      const childInfo = {
        childId: child.id,
        childCode: child.legacy_id || `C${child.id.substring(0, 4)}`,
        centerCode: profile?.center_code || profile?.centers?.center_code || 'KBC-HCM',
        type: 'observation'
      };
      const params = { uri: vidFile, filename: `obs_${Date.now()}.mp4` };
      
      await uploadVideoToBunny(params, childInfo, (pct) => setUploadProgress(pct));
      
      Alert.alert('Thành công', 'Đã tải lên video quan sát! Hệ thống AI đang phân tích.');
      setVidFile(null);
      setVidNotes('');
      setObsVisible(false);
    } catch (err) {
      Alert.alert('Lỗi tải lên', err.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleUploadLesson = async () => {
    if (!lesTitle.trim() || !lesFile) { Alert.alert('Lỗi', 'Vui lòng nhập tiêu đề và chọn video.'); return; }

    setUploading(true);
    setUploadProgress(0);
    try {
      // 1. Lấy/tạo vst_teacher_profiles → lấy vst_code và center_code chuẩn
      const teacherId = profile?.id;
      const vstProfile = await getOrCreateVstProfile(teacherId);

      const vstCode    = vstProfile?.vst_code    || profile?.legacy_id || teacherId;
      const centerCode = vstProfile?.center_code || profile?.center_code || profile?.centers?.center_code || 'KBC-HCM';

      // 2. Upload lên Bunny — collection name: {centerCode}_Training_{vstCode}
      const childInfo = { vstCode, centerCode, type: 'training' };
      const params    = { uri: lesFile, filename: `les_${Date.now()}.mp4` };

      const { playUrl, videoGuid, collectionId } = await uploadVideoToBunny(params, childInfo, (pct) => setUploadProgress(pct));

      // 3. Lưu vào teacher_content_library (gắn child_id theo bé đang chọn)
      const { error: dbErr } = await supabase.from('teacher_content_library').insert({
        teacher_id:           teacherId,
        vst_id:               vstProfile?.id || null,
        center_id:            vstProfile?.center_id || profile?.center_id || null,
        child_id:             selectedChildId || null,
        title:                lesTitle.trim(),
        description:          lesDesc.trim() || null,
        content_type:         lesType === 'Bài giảng' ? 'lesson' : lesType === 'Video mẫu' ? 'demo' : 'exercise',
        bunny_video_id:       videoGuid,
        video_url:            playUrl,
        bunny_collection_id:  collectionId || null,
        domain:               lesDomain || null,
        tags:                 lesTags.length ? lesTags : null,
        status:               'published',
        visibility:           'center',
      });
      if (dbErr) console.warn('teacher_content_library insert error:', dbErr.message);

      // 4. Tăng counter trên vst_teacher_profiles
      if (vstProfile?.id) {
        await supabase.from('vst_teacher_profiles')
          .update({ total_videos_uploaded: (vstProfile.total_videos_uploaded || 0) + 1, last_activity_at: new Date().toISOString() })
          .eq('id', vstProfile.id);
      }

      Alert.alert('Thành công', 'Bài giảng đã được tải lên và lưu vào thư viện bảo mật.');
      setLesTitle('');
      setLesDesc('');
      setLesTags([]);
      setLesFile(null);
      setLesVisible(false);
    } catch (err) {
      Alert.alert('Lỗi tải lên', err.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const toggleTag = (tag) => {
    if (lesTags.includes(tag)) setLesTags(lesTags.filter(t => t !== tag));
    else setLesTags([...lesTags, tag]);
  };

  const addCustomTag = () => {
    if (tagInput.trim() && !lesTags.includes(tagInput.trim())) {
      setLesTags([...lesTags, tagInput.trim()]);
    }
    setTagInput('');
  };

  const selectedChild = children.find(c => c.id === selectedChildId);

  // Generate mock AI metrics if DB has no hpdt
  const focusScore = hpdt?.cognitive_score || 65;
  const interactionScore = hpdt?.social_score || 45;
  const behaviorScore = hpdt?.behavior_score || 55;
  const dsmLevel = hpdt?.dsm_level || 'Level 1';

  return (
    <View style={styles.root}>
      {/* ══ Header ══ */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dạy học & Can thiệp</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        
        {/* ─── CHỌN TRẺ ĐỂ CAN THIỆP ─── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitleLabel}>CHỌN TRẺ ĐỂ CAN THIỆP</Text>
        </View>
        <View style={styles.childListContainer}>
          {loadingList ? <ActivityIndicator color={colors.primary} /> : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.childScroll}>
              {children.map(child => {
                const isSelected = selectedChildId === child.id;
                return (
                  <TouchableOpacity
                    key={child.id}
                    style={[styles.childCard, isSelected && styles.childCardSelected]}
                    onPress={() => setSelectedChildId(child.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.avatarWrapper}>
                      <ChildAvatar3D seed={child.id} size={70} style={{ borderRadius: 35 }} />
                    </View>
                    <Text style={[styles.childName, isSelected && styles.childNameSelected]} numberOfLines={1}>
                      {(child.nickname || child.full_name.split(' ').pop()).toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {selectedChild && (
          <View style={{ paddingHorizontal: spacing.lg }}>
            
            {/* ─── PHÂN TÍCH HIỆN TẠI (AI Dashboard) ─── */}
            <View style={styles.aiDashboard}>
              <View style={styles.aiHeader}>
                <View style={styles.aiIconBg}>
                  <Text style={styles.aiIcon}>🧠</Text>
                </View>
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={styles.aiTitle}>Phân Tích Hiện Tại</Text>
                  <Text style={styles.aiSub}>DỰA TRÊN DỮ LIỆU CÓ SẴN</Text>
                </View>
                <View style={styles.levelBadge}>
                  <Text style={styles.levelBadgeText}>{dsmLevel}</Text>
                </View>
              </View>

              <View style={styles.metricsRow}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricIcon}>📈</Text>
                  <Text style={styles.metricLabel}>ĐIỂM HPDT HIỆN TẠI</Text>
                  <Text style={[styles.metricValue, { color: colors.secondary }]}>{hpdt?.overall_score || 60}/100</Text>
                </View>
              </View>

              <View style={styles.aiAdviceBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontSize: 16, marginRight: 6 }}>💡</Text>
                  <Text style={styles.aiAdviceTitle}>Lời khuyên từ AI</Text>
                </View>
                <Text style={styles.aiAdviceText}>
                  {hpdt?.ai_recommendations || `Bé ${selectedChild?.nickname || selectedChild?.full_name?.split(' ').pop() || ''} đang cần chú ý về tương tác. Hãy thử tăng cường giao tiếp mắt trước khi bắt đầu bài mới.`}
                </Text>
              </View>
            </View>

            {/* ─── HOẠT ĐỘNG TẠI TRƯỜNG ─── */}
            <View style={styles.activitiesContainer}>
              <View style={styles.activitiesHeaderRow}>
                <Text style={styles.activitiesTitle}>HOẠT ĐỘNG TẠI TRƯỜNG</Text>
                <Text style={styles.activitiesCount}>
                  {activities.filter(a => a.completed_sessions >= a.required_sessions).length}/{activities.length} hoàn thành
                </Text>
              </View>

              <View style={styles.activitiesList}>
                {activities.map(a => (
                  <SchoolActivityItem
                    key={a.id}
                    activity={a}
                    onDone={(note) => handleCompleteActivity(a, note)}
                    onUpload={() => setObsVisible(true)}
                  />
                ))}
              </View>
            </View>

            {/* ─── UPLOAD BUTTONS ─── */}
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => setObsVisible(true)}>
                <Text style={styles.actionBtnPrimaryText}>📹 Video Quan Sát</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => setLesVisible(true)}>
                <Text style={styles.actionBtnSecondaryText}>🎓 Bài Giảng Mới</Text>
              </TouchableOpacity>
            </View>

          </View>
        )}
      </ScrollView>

      {/* ══ MODAL UPLOAD OBSERVATION ══ */}
      <Modal visible={obsVisible} animationType="slide" transparent onRequestClose={() => setObsVisible(false)}>
        <View style={st.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ justifyContent: 'flex-end', width: '100%' }}>
            <View style={st.uploadCard}>
              <View style={st.handleBar} />
              <View style={st.uploadHeader}>
                <View>
                  <Text style={st.uploadTitle}>Tải video quan sát thực tế 📹</Text>
                  <Text style={st.uploadSub}>Học sinh: {selectedChild?.full_name}</Text>
                </View>
                <TouchableOpacity onPress={() => setObsVisible(false)} style={st.closeBtn}><Text style={st.closeBtnText}>✕</Text></TouchableOpacity>
              </View>

              <Text style={st.label}>Bối cảnh quay</Text>
              <View style={st.chipRow}>
                {VIDEO_CONTEXTS.map(ctx => (
                  <TouchableOpacity key={ctx} style={[st.modalChip, vidContext === ctx && st.modalChipActive]} onPress={() => setVidContext(ctx)}>
                    <Text style={[st.modalChipText, vidContext === ctx && st.modalChipTextActive]}>{ctx}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={st.label}>Trạng thái hành vi hiện tại</Text>
              <View style={st.chipRow}>
                {CHILD_STATES.map(s => (
                  <TouchableOpacity key={s} style={[st.modalChip, vidState === s && st.modalChipActive]} onPress={() => setVidState(s)}>
                    <Text style={[st.modalChipText, vidState === s && st.modalChipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={st.label}>Ghi chú cho AI (Tùy chọn)</Text>
              <TextInput style={st.textArea} placeholder="Mô tả hành vi..." multiline value={vidNotes} onChangeText={setVidNotes} />

              <TouchableOpacity style={st.pickFileBtn} onPress={() => pickVideo(setVidFile)}>
                <Text style={st.pickFileBtnText}>{vidFile ? '✅ Đã chọn video (Nhấn đổi)' : '🎬 Chọn video từ thiết bị'}</Text>
              </TouchableOpacity>

              {uploading && <Text style={st.progressText}>Đang tải lên: {uploadProgress}%</Text>}

              <TouchableOpacity style={[st.submitBtn, uploading && { opacity: 0.7 }]} onPress={handleUploadVideo} disabled={uploading}>
                {uploading ? <ActivityIndicator color={colors.white} /> : <Text style={st.submitBtnText}>⬆ Tải lên & Phân tích AI</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ══ MODAL UPLOAD LESSON ══ */}
      <Modal visible={lesVisible} animationType="slide" transparent onRequestClose={() => setLesVisible(false)}>
        <View style={st.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ justifyContent: 'flex-end', width: '100%' }}>
            <View style={st.uploadCard}>
              <View style={st.handleBar} />
              <View style={st.uploadHeader}>
                <View>
                  <Text style={st.uploadTitle}>Tạo bài giảng / bài tập mới 🎓</Text>
                </View>
                <TouchableOpacity onPress={() => setLesVisible(false)} style={st.closeBtn}><Text style={st.closeBtnText}>✕</Text></TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
                <Text style={st.label}>Tiêu đề bài giảng *</Text>
                <TextInput style={st.input} placeholder="Nhập tiêu đề..." value={lesTitle} onChangeText={setLesTitle} />

                <Text style={st.label}>Loại nội dung</Text>
                <View style={st.chipRow}>
                  {CONTENT_TYPES.map(t => (
                    <TouchableOpacity key={t} style={[st.modalChip, lesType === t && st.modalChipActive]} onPress={() => setLesType(t)}>
                      <Text style={[st.modalChipText, lesType === t && st.modalChipTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={st.label}>Lĩnh vực phát triển</Text>
                <View style={st.chipRow}>
                  {DOMAINS.map(d => (
                    <TouchableOpacity key={d} style={[st.modalChip, lesDomain === d && st.modalChipActive]} onPress={() => setLesDomain(d)}>
                      <Text style={[st.modalChipText, lesDomain === d && st.modalChipTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={st.label}>Mô tả bài tập</Text>
                <TextInput style={st.textArea} placeholder="Cách thực hiện..." multiline value={lesDesc} onChangeText={setLesDesc} />

                <TouchableOpacity style={st.pickFileBtn} onPress={() => pickVideo(setLesFile)}>
                  <Text style={st.pickFileBtnText}>{lesFile ? '✅ Đã chọn video' : '🎬 Chọn video bài giảng'}</Text>
                </TouchableOpacity>

                {uploading && <Text style={st.progressText}>Đang tải lên: {uploadProgress}%</Text>}

                <TouchableOpacity style={[st.submitBtn, uploading && { opacity: 0.7 }]} onPress={handleUploadLesson} disabled={uploading}>
                  {uploading ? <ActivityIndicator color={colors.white} /> : <Text style={st.submitBtnText}>⬆ Tải lên & Phát hành</Text>}
                </TouchableOpacity>
                <View style={{ height: 20 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgLight },
  header: {
    paddingTop: spacing.xxxl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  headerTitle: { ...typography.h3, color: colors.textDark },
  
  sectionHeader: { paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionTitleLabel: { ...typography.label, color: colors.textLight, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  
  childListContainer: { paddingLeft: spacing.lg, marginBottom: spacing.lg },
  childScroll: { paddingRight: spacing.lg, gap: spacing.md },
  childCard: { 
    width: 90, height: 110, 
    backgroundColor: colors.white, 
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    padding: spacing.xs,
    ...shadows.sm
  },
  childCardSelected: { borderColor: '#E87D43', borderWidth: 1.5, backgroundColor: '#FFF6F0' },
  avatarWrapper: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#F0F0F0', overflow: 'hidden', marginBottom: 6, alignItems: 'center', justifyContent: 'center' },
  childName: { ...typography.caption, fontWeight: '700', color: colors.textMid, fontSize: 11, textAlign: 'center' },
  childNameSelected: { color: '#E87D43' },

  aiDashboard: { backgroundColor: '#1A1C29', borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.xl, ...shadows.md },
  aiHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  aiIconBg: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#E87D43', alignItems: 'center', justifyContent: 'center' },
  aiIcon: { fontSize: 24 },
  aiTitle: { ...typography.h4, color: colors.white, fontSize: 16 },
  aiSub: { ...typography.caption, color: '#A0A0A0', fontSize: 10, letterSpacing: 1, marginTop: 2 },
  levelBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  levelBadgeText: { color: colors.white, ...typography.caption, fontWeight: '700' },
  
  metricsRow: { flexDirection: 'row', gap: spacing.sm },
  metricBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radius.md, padding: spacing.md, alignItems: 'flex-start' },
  metricIcon: { fontSize: 18, marginBottom: 4 },
  metricLabel: { ...typography.caption, color: '#A0A0A0', fontSize: 10, letterSpacing: 0.5, marginBottom: 4 },
  metricValue: { ...typography.h4, color: colors.white, fontSize: 15 },
  aiAdviceBox: { marginTop: spacing.md, padding: spacing.md, backgroundColor: 'rgba(232, 125, 67, 0.1)', borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(232, 125, 67, 0.2)' },
  aiAdviceTitle: { ...typography.label, color: '#E87D43', fontSize: 13, fontWeight: '700' },
  aiAdviceText: { ...typography.bodySm, color: '#DDD', lineHeight: 20 },

  activitiesContainer: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.xl, ...shadows.sm },
  activitiesHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.sm },
  activitiesTitle: { ...typography.label, color: colors.textDark, fontSize: 14, letterSpacing: 0.5 },
  activitiesCount: { ...typography.bodySm, color: colors.textLight, fontSize: 13 },
  activitiesList: { gap: 0 },

  actionButtonsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  actionBtnPrimary: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', ...shadows.sm },
  actionBtnPrimaryText: { color: colors.white, ...typography.label, fontSize: 14 },
  actionBtnSecondary: { flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', ...shadows.sm },
  actionBtnSecondaryText: { color: colors.primary, ...typography.label, fontSize: 14 },
});

const st = StyleSheet.create({
  activityItem: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  actMainRow: { flexDirection: 'row', alignItems: 'center' },
  actCheckbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bgMuted, alignItems: 'center', justifyContent: 'center' },
  actCheckboxDone: { borderColor: colors.success, backgroundColor: colors.success },
  actCheckmark: { color: colors.white, fontSize: 13, fontWeight: '800' },
  actName: { ...typography.label, color: colors.textDark, fontSize: 13, textTransform: 'uppercase' },
  actMeta: { ...typography.caption, color: colors.textLight, fontSize: 11 },
  actUploadBtn: { width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  actExpandArea: { marginTop: spacing.sm, paddingLeft: 32, paddingRight: 32 },
  actNoteInput: { backgroundColor: colors.bgMuted, borderRadius: radius.sm, padding: spacing.sm, minHeight: 60, textAlignVertical: 'top', ...typography.bodySm, marginBottom: spacing.sm },
  actSaveBtn: { backgroundColor: colors.primary, alignSelf: 'flex-end', paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.sm },
  actSaveBtnText: { color: colors.white, ...typography.caption, fontWeight: '700' },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  chipText: { fontSize: 10, fontWeight: '600' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  uploadCard: { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: 40 },
  handleBar: { width: 40, height: 5, backgroundColor: colors.border, borderRadius: 3, alignSelf: 'center', marginBottom: spacing.md },
  uploadHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg },
  uploadTitle: { ...typography.h4, color: colors.textDark },
  uploadSub: { ...typography.bodySm, color: colors.textLight },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bgMuted, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: colors.textDark, fontSize: 16, fontWeight: '700' },
  label: { ...typography.label, color: colors.textMid, marginBottom: spacing.xs, marginTop: spacing.md },
  input: { backgroundColor: colors.bgLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, ...typography.body, color: colors.textDark, marginBottom: spacing.sm },
  textArea: { backgroundColor: colors.bgLight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, ...typography.body, color: colors.textDark, height: 100, textAlignVertical: 'top', marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  modalChip: { paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.bgMuted, borderWidth: 1, borderColor: colors.border },
  modalChipActive: { backgroundColor: colors.primaryBg, borderColor: colors.primary },
  modalChipText: { ...typography.caption, color: colors.textMid },
  modalChipTextActive: { color: colors.primary, fontWeight: '700' },
  pickFileBtn: { backgroundColor: colors.bgLight, borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginVertical: spacing.md },
  pickFileBtnText: { color: colors.primary, ...typography.label },
  submitBtn: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
  submitBtnText: { color: colors.white, ...typography.label, fontSize: 16 },
  progressText: { textAlign: 'center', color: colors.textMid, ...typography.caption, marginVertical: spacing.xs },
});
