import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import { getChildrenByParent, supabase } from '../../lib/supabase';
import {
  buildCloudinaryThumbUrl,
  enqueueChildAvatarGeneration,
  fetchChildAvatarState,
  getChildDisplayAvatar,
  uploadChildAvatarToCloudinary,
} from '../../lib/childAvatar';
import { colors, radius, shadows, spacing } from '../../lib/colors';
import { typography } from '../../lib/typography';

// ── Avatar upload steps ───────────────────────────────────────────────────────
const STEP_IDLE       = 0;
const STEP_SAVE_INFO  = 1;
const STEP_CLOUDINARY = 2;
const STEP_AVATAR_3D  = 3;
const STEP_DONE       = 4;

// ── Options ───────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'basic',    label: 'Cơ bản',  emoji: '👤' },
  { key: 'medical',  label: 'Y tế',    emoji: '🏥' },
  { key: 'learning', label: 'Học tập', emoji: '📚' },
];

const DIAGNOSIS_OPTIONS = [
  { value: 'diagnosed',     label: 'Đã được chẩn đoán ASD' },
  { value: 'pending',       label: 'Đang chờ kết quả' },
  { value: 'not_diagnosed', label: 'Chưa được chẩn đoán' },
];

const ASSESSMENT_TOOLS = ['ADOS-2', 'ADI-R', 'CARS-2', 'M-CHAT', 'ASQ-3', 'Khác'];

const COMORBIDITY_OPTIONS = [
  'ADHD', 'Động kinh', 'Lo âu', 'Trầm cảm',
  'Vấn đề tiêu hóa', 'Rối loạn giấc ngủ', 'Khác',
];

const EDUCATION_OPTIONS = [
  { value: 'specialized',    label: 'Trường chuyên biệt' },
  { value: 'semi_inclusive', label: 'Trường bán hòa nhập' },
  { value: 'inclusive',      label: 'Trường hòa nhập' },
  { value: 'preschool',      label: 'Trường mầm non' },
  { value: 'not_enrolled',   label: 'Chưa đi học' },
];

const COMPANION_OPTIONS = [
  { value: 'mother',      label: 'Mẹ' },
  { value: 'father',      label: 'Bố' },
  { value: 'grandparent', label: 'Ông bà' },
  { value: 'helper',      label: 'Người giúp việc' },
  { value: 'other',       label: 'Khác' },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, value, onChangeText, placeholder, keyboardType, multiline }) {
  return (
    <View style={st.field}>
      {label ? <Text style={st.fieldLabel}>{label}</Text> : null}
      <TextInput
        style={[st.input, multiline && st.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        keyboardType={keyboardType || 'default'}
        multiline={!!multiline}
        numberOfLines={multiline ? 3 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
        autoCapitalize="none"
      />
    </View>
  );
}

function RadioGroup({ label, options, value, onChange }) {
  return (
    <View style={st.field}>
      {label ? <Text style={st.fieldLabel}>{label}</Text> : null}
      <View style={st.radioGroup}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[st.radioBtn, value === opt.value && st.radioBtnActive]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.75}
          >
            <View style={st.radioIndicator}>
              {value === opt.value && <View style={st.radioIndicatorDot} />}
            </View>
            <Text style={[st.radioBtnText, value === opt.value && st.radioBtnTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function MultiChips({ label, options, selected, onToggle }) {
  return (
    <View style={st.field}>
      {label ? <Text style={st.fieldLabel}>{label}</Text> : null}
      <View style={st.chipsWrap}>
        {options.map(opt => {
          const active = selected.includes(opt);
          return (
            <TouchableOpacity
              key={opt}
              style={[st.chip, active && st.chipActive]}
              onPress={() => onToggle(opt)}
              activeOpacity={0.75}
            >
              <Text style={[st.chipText, active && st.chipTextActive]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function StepRow({ label, step, currentStep }) {
  const done    = currentStep > step;
  const active  = currentStep === step;
  const pending = currentStep < step;
  return (
    <View style={st.stepRow}>
      <View style={[st.stepIcon, done && st.stepIconDone, active && st.stepIconActive, pending && st.stepIconPending]}>
        {done   ? <Text style={st.stepCheck}>✓</Text>
        : active ? <ActivityIndicator size="small" color={colors.white} />
        :          <View style={st.stepDot} />}
      </View>
      <Text style={[st.stepLabel, done && st.stepLabelDone, active && st.stepLabelActive]}>
        {label}
      </Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ChildProfileScreen({ navigation }) {
  const { user, profile, session } = useAuth();
  const userId     = session?.user?.id || user?.id || profile?.id;
  const centerCode = user?.center_code || profile?.center_code || 'BIC-HCM';

  const [activeTab, setActiveTab] = useState('basic');
  const [child,     setChild]     = useState(null);
  const [diagnosis, setDiagnosis] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);

  // Avatar upload flow
  const [avatarAsset,     setAvatarAsset]     = useState(null);
  const [avatarPreview,   setAvatarPreview]   = useState(null);
  const [uploadStep,      setUploadStep]      = useState(STEP_IDLE);
  const [pollCount,       setPollCount]       = useState(0);
  const [avatar3DSuccess, setAvatar3DSuccess] = useState(null);

  // Tab 0 — Cơ bản
  const [basic, setBasicState] = useState({ full_name: '', nickname: '', dob: '', gender: '' });

  // Tab 1 — Y tế
  const [medical, setMedicalState] = useState({
    diagnosis_status: '',
    diagnosis_notes:  '',
    diagnosis_date:   '',
    diagnosis_place:  '',
    assessment_tools: [],
    comorbidities:    [],
    comorbidities_other: '',
    has_medications:  false,
    medications:      [],
  });

  // Tab 2 — Học tập
  const [learning, setLearningState] = useState({
    education_setting:      '',
    intervention_companion: '',
  });

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const children = await getChildrenByParent(userId);
      const c = children?.[0] || null;
      if (!c) { setLoading(false); return; }

      setChild(c);
      setAvatarPreview(getChildDisplayAvatar(c));
      setBasicState({
        full_name: c.full_name      || '',
        nickname:  c.nickname       || '',
        dob:       c.date_of_birth  || '',
        gender:    c.gender         || '',
      });
      setLearningState({
        education_setting:      c.education_setting      || '',
        intervention_companion: c.intervention_companion || '',
      });

      // Diagnosis (most recent)
      const { data: diagData } = await supabase
        .from('diagnoses')
        .select('*, assessment_tools(*)')
        .eq('child_id', c.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setDiagnosis(diagData || null);

      if (diagData) {
        const tools = (diagData.assessment_tools || []).map(t => t.tool_name);
        setMedicalState(m => ({
          ...m,
          diagnosis_status: diagData.status          || '',
          diagnosis_notes:  diagData.notes           || '',
          diagnosis_date:   diagData.diagnosis_date  || '',
          diagnosis_place:  diagData.diagnosis_place || '',
          assessment_tools: tools,
        }));
      }

      // Comorbidities
      const { data: comorbData } = await supabase
        .from('comorbidities')
        .select('condition_name')
        .eq('child_id', c.id);
      const comorbList = (comorbData || []).map(r => r.condition_name);
      const predefined = COMORBIDITY_OPTIONS.filter(o => o !== 'Khác');
      const customValues = comorbList.filter(c => !predefined.includes(c));
      const standardValues = comorbList.filter(c => predefined.includes(c));
      
      let finalComorb = standardValues;
      let otherText = '';
      if (customValues.length > 0) {
        finalComorb.push('Khác');
        otherText = customValues.join(', ');
      }
      
      setMedicalState(m => ({
        ...m,
        comorbidities: finalComorb,
        comorbidities_other: otherText,
      }));

      // Medications (active only)
      const { data: medData } = await supabase
        .from('medications')
        .select('*')
        .eq('child_id', c.id)
        .is('end_date', null)
        .order('created_at', { ascending: true });

      const meds = (medData || []).map(med => ({
        _key:       med.id,
        id:         med.id,
        drug_name:  med.drug_name  || '',
        dosage:     med.dosage     || '',
        frequency:  med.frequency  || '',
        purpose:    med.purpose    || '',
        start_date: med.start_date || '',
      }));
      setMedicalState(m => ({
        ...m,
        has_medications: meds.length > 0,
        medications:     meds,
      }));
    } catch (err) {
      console.warn('ChildProfileScreen load:', err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Setters ───────────────────────────────────────────────────────────────

  const setB = (k, v) => setBasicState(s => ({ ...s, [k]: v }));
  const setM = (k, v) => setMedicalState(s => ({ ...s, [k]: v }));
  const setL = (k, v) => setLearningState(s => ({ ...s, [k]: v }));

  function toggleTool(tool) {
    setMedicalState(m => ({
      ...m,
      assessment_tools: m.assessment_tools.includes(tool)
        ? m.assessment_tools.filter(t => t !== tool)
        : [...m.assessment_tools, tool],
    }));
  }

  function toggleComorbidity(cond) {
    setMedicalState(m => ({
      ...m,
      comorbidities: m.comorbidities.includes(cond)
        ? m.comorbidities.filter(x => x !== cond)
        : [...m.comorbidities, cond],
    }));
  }

  function addMedication() {
    const blank = { _key: String(Date.now()), drug_name: '', dosage: '', frequency: '', purpose: '', start_date: '' };
    setMedicalState(m => ({ ...m, medications: [...m.medications, blank] }));
  }

  function removeMedication(key) {
    setMedicalState(m => ({ ...m, medications: m.medications.filter(x => x._key !== key) }));
  }

  function updateMedication(key, field, val) {
    setMedicalState(m => ({
      ...m,
      medications: m.medications.map(x => x._key === key ? { ...x, [field]: val } : x),
    }));
  }

  // ── Avatar ────────────────────────────────────────────────────────────────

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Thiếu quyền', 'Ứng dụng cần quyền truy cập thư viện ảnh.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]) {
      setAvatarAsset(result.assets[0]);
      setAvatarPreview(result.assets[0].uri);
    }
  }

  async function pollAvatar3D(childId, previousAvatar3D, maxAttempts = 8) {
    for (let i = 0; i < maxAttempts; i++) {
      setPollCount(i + 1);
      await new Promise(r => setTimeout(r, 2500));
      const latest = await fetchChildAvatarState(childId);
      if (latest.avatar_3d_url && latest.avatar_3d_url !== previousAvatar3D) {
        setChild(prev => ({ ...prev, ...latest }));
        setAvatarPreview(latest.avatar_3d_url);
        setAvatar3DSuccess(latest.avatar_3d_url);
        return latest;
      }
    }
    return null;
  }

  // ── Save: Cơ bản ─────────────────────────────────────────────────────────

  async function handleSaveBasic() {
    if (!child?.id) return;
    if (!basic.full_name.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập họ và tên đầy đủ của con.');
      return;
    }
    if (!basic.nickname.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập biệt danh của con.');
      return;
    }
    setSaving(true);
    if (avatarAsset) setUploadStep(STEP_SAVE_INFO);
    try {
      const patch = {
        full_name:     basic.full_name.trim(),
        nickname:      basic.nickname.trim(),
        date_of_birth: basic.dob    || null,
        gender:        basic.gender || null,
        updated_at:    new Date().toISOString(),
      };

      let uploadedAvatar = null;
      if (avatarAsset) {
        setUploadStep(STEP_CLOUDINARY);
        uploadedAvatar = await uploadChildAvatarToCloudinary({
          asset: avatarAsset, centerCode, childId: child.id, avatarType: 'source',
        });
        patch.avatar_url       = uploadedAvatar.url;
        patch.avatar_thumb_url = uploadedAvatar.thumbUrl || buildCloudinaryThumbUrl(uploadedAvatar.url);
      }

      const { data: updated, error } = await supabase
        .from('children')
        .update(patch)
        .eq('id', child.id)
        .select('*')
        .single();
      if (error) throw error;
      setChild(updated);
      setAvatarPreview(getChildDisplayAvatar(updated));

      if (avatarAsset && uploadedAvatar) {
        setUploadStep(STEP_AVATAR_3D);
        setPollCount(0);
        await enqueueChildAvatarGeneration({
          child: updated, parentId: userId, centerCode,
          preferences: { source: 'child_profile' },
        });
        await pollAvatar3D(updated.id, child?.avatar_3d_url || null, 8);
        setUploadStep(STEP_DONE);
        await new Promise(r => setTimeout(r, 2000));
      }

      setAvatarAsset(null);
      Alert.alert('Thành công', 'Đã lưu thông tin cơ bản của con.');
      navigation.navigate('TrangChu');
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể lưu. Vui lòng thử lại.');
    } finally {
      setSaving(false);
      setUploadStep(STEP_IDLE);
      setAvatar3DSuccess(null);
      setPollCount(0);
    }
  }

  // ── Save: Y tế ────────────────────────────────────────────────────────────

  async function handleSaveMedical() {
    if (!child?.id) return;
    if (!medical.diagnosis_status) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn tình trạng chẩn đoán của con.');
      return;
    }
    setSaving(true);
    try {
      const diagPayload = {
        child_id:        child.id,
        status:          medical.diagnosis_status,
        notes:           medical.diagnosis_notes.trim() || null,
        diagnosis_date:  medical.diagnosis_date         || null,
        diagnosis_place: medical.diagnosis_place.trim() || null,
        created_by:      userId,
        updated_at:      new Date().toISOString(),
      };

      let diagRecord = diagnosis;
      if (diagnosis?.id) {
        const { data, error } = await supabase
          .from('diagnoses').update(diagPayload).eq('id', diagnosis.id).select().single();
        if (error) throw error;
        diagRecord = data;
      } else {
        const { data, error } = await supabase
          .from('diagnoses').insert(diagPayload).select().single();
        if (error) throw error;
        diagRecord = data;
        setDiagnosis(diagRecord);
      }

      // assessment_tools
      await supabase.from('assessment_tools').delete().eq('diagnosis_id', diagRecord.id);
      if (medical.assessment_tools.length > 0 && medical.diagnosis_status !== 'not_diagnosed') {
        await supabase.from('assessment_tools').insert(
          medical.assessment_tools.map(t => ({ diagnosis_id: diagRecord.id, tool_name: t }))
        );
      }

      // comorbidities
      await supabase.from('comorbidities').delete().eq('child_id', child.id);
      if (medical.comorbidities.length > 0) {
        const finalComorbToSave = [];
        for (const c of medical.comorbidities) {
          if (c === 'Khác') {
            if (medical.comorbidities_other && medical.comorbidities_other.trim()) {
              finalComorbToSave.push(medical.comorbidities_other.trim());
            }
          } else {
            finalComorbToSave.push(c);
          }
        }
        if (finalComorbToSave.length > 0) {
          await supabase.from('comorbidities').insert(
            finalComorbToSave.map(c => ({ child_id: child.id, condition_name: c, reported_by: 'parent' }))
          );
        }
      }

      // medications (active only)
      await supabase.from('medications').delete().eq('child_id', child.id).is('end_date', null);
      if (medical.has_medications) {
        const validMeds = medical.medications.filter(m => m.drug_name.trim());
        if (validMeds.length > 0) {
          await supabase.from('medications').insert(
            validMeds.map(m => ({
              child_id:   child.id,
              drug_name:  m.drug_name.trim(),
              dosage:     m.dosage.trim()    || null,
              frequency:  m.frequency.trim() || null,
              purpose:    m.purpose.trim()   || null,
              start_date: m.start_date       || null,
              created_by: userId,
            }))
          );
        }
      }

      Alert.alert('Thành công', 'Đã lưu thông tin y tế của con.');
      navigation.navigate('TrangChu');
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể lưu. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  // ── Save: Học tập ─────────────────────────────────────────────────────────

  async function handleSaveLearning() {
    if (!child?.id) return;
    if (!learning.education_setting) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn môi trường học tập của con.');
      return;
    }
    if (!learning.intervention_companion) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn người đồng hành can thiệp.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('children')
        .update({
          education_setting:      learning.education_setting,
          intervention_companion: learning.intervention_companion,
          updated_at:             new Date().toISOString(),
        })
        .eq('id', child.id);
      if (error) throw error;
      setChild(c => ({ ...c, ...learning }));
      Alert.alert('Thành công', 'Đã lưu thông tin học tập của con.');
      navigation.navigate('TrangChu');
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể lưu. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const showOverlay = uploadStep !== STEP_IDLE;

  if (loading) {
    return (
      <View style={[st.root, st.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[typography.body, { color: colors.textMid, marginTop: spacing.md }]}>
          Đang tải hồ sơ bé...
        </Text>
      </View>
    );
  }

  if (!child) {
    return (
      <View style={[st.root, st.centered]}>
        <Text style={{ fontSize: 48, marginBottom: spacing.md }}>👦</Text>
        <Text style={[typography.h4, { color: colors.textDark, marginBottom: spacing.sm }]}>
          Chưa có hồ sơ bé
        </Text>
        <Text style={[typography.body, { color: colors.textMid, textAlign: 'center' }]}>
          Liên hệ trung tâm để thêm hồ sơ con vào tài khoản.
        </Text>
        <TouchableOpacity style={st.backBtnAlt} onPress={() => navigation.goBack()}>
          <Text style={st.backBtnAltText}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={st.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity style={st.backBtn} onPress={() => navigation.goBack()}>
          <Text style={st.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={st.title}>Hồ sơ bé</Text>
        <View style={st.backBtn} />
      </View>

      {/* Tab bar */}
      <View style={st.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[st.tab, activeTab === tab.key && st.tabActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.75}
          >
            <Text style={[st.tabText, activeTab === tab.key && st.tabTextActive]}>
              {tab.emoji} {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">

        {/* ─────────────────────── TAB: CƠ BẢN ─────────────────────── */}
        {activeTab === 'basic' && (
          <>
            {/* Avatar */}
            <View style={st.card}>
              <Text style={st.sectionTitle}>Avatar bé</Text>
              <View style={st.avatarRow}>
                <TouchableOpacity style={st.avatarBtn} onPress={pickImage} activeOpacity={0.82}>
                  {avatarPreview ? (
                    <Image source={{ uri: avatarPreview }} style={st.avatarImg} />
                  ) : (
                    <Text style={st.avatarFallback}>👦</Text>
                  )}
                  <View style={st.avatarEditBadge}>
                    <Text style={st.avatarEditText}>✎</Text>
                  </View>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={st.avatarName}>{child.nickname || child.full_name}</Text>
                  {avatarAsset ? (
                    <Text style={[st.avatarHint, { color: colors.primary, fontWeight: '600' }]}>
                      Ảnh mới đã chọn — nhấn Lưu để upload
                    </Text>
                  ) : (
                    <Text style={st.avatarHint}>
                      Nhấn vào ảnh để thay. Sẽ tự tạo avatar 3D cartoon.
                    </Text>
                  )}
                  {child.avatar_3d_url ? (
                    <Text style={[st.avatarBadge, { color: colors.secondaryDark }]}>
                      ✨ Đang dùng avatar 3D
                    </Text>
                  ) : child.avatar_url ? (
                    <Text style={[st.avatarBadge, { color: colors.textLight }]}>
                      📸 Ảnh gốc (chưa có 3D)
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Thông tin cơ bản */}
            <View style={st.card}>
              <Text style={st.sectionTitle}>Thông tin cơ bản</Text>
              <Field
                label="Họ và tên đầy đủ *"
                value={basic.full_name}
                onChangeText={v => setB('full_name', v)}
                placeholder="VD: Nguyễn Văn An"
              />
              <Field
                label="Biệt danh *"
                value={basic.nickname}
                onChangeText={v => setB('nickname', v)}
                placeholder="VD: An, Mít, Tom..."
              />
              <Field
                label="Ngày sinh (YYYY-MM-DD)"
                value={basic.dob}
                onChangeText={v => setB('dob', v)}
                placeholder="VD: 2019-06-15"
                keyboardType="numeric"
              />
              <View style={st.field}>
                <Text style={st.fieldLabel}>Giới tính</Text>
                <View style={st.genderRow}>
                  {[['male', 'Bé trai'], ['female', 'Bé gái'], ['other', 'Khác']].map(([val, lbl]) => (
                    <TouchableOpacity
                      key={val}
                      style={[st.genderBtn, basic.gender === val && st.genderBtnActive]}
                      onPress={() => setB('gender', val)}
                      activeOpacity={0.75}
                    >
                      <Text style={[st.genderBtnText, basic.gender === val && st.genderBtnTextActive]}>
                        {lbl}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[st.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSaveBasic}
              disabled={saving}
            >
              {saving && uploadStep === STEP_IDLE
                ? <ActivityIndicator color={colors.white} />
                : <Text style={st.saveBtnText}>Lưu thông tin cơ bản</Text>}
            </TouchableOpacity>
          </>
        )}

        {/* ─────────────────────── TAB: Y TẾ ─────────────────────── */}
        {activeTab === 'medical' && (
          <>
            {/* Chẩn đoán */}
            <View style={st.card}>
              <Text style={st.sectionTitle}>Tình trạng chẩn đoán</Text>
              <RadioGroup
                label="Con đã được chẩn đoán / đánh giá như thế nào? *"
                options={DIAGNOSIS_OPTIONS}
                value={medical.diagnosis_status}
                onChange={v => setM('diagnosis_status', v)}
              />

              {medical.diagnosis_status && medical.diagnosis_status !== 'not_diagnosed' && (
                <Field
                  label="Mô tả thêm kết luận chẩn đoán"
                  value={medical.diagnosis_notes}
                  onChangeText={v => setM('diagnosis_notes', v)}
                  placeholder='VD: "Tuổi nhận thức chậm hơn 1 năm so với chương trình mầm non 2018"'
                  multiline
                />
              )}

              {medical.diagnosis_status === 'diagnosed' && (
                <>
                  <Field
                    label="Ngày chẩn đoán (YYYY-MM-DD)"
                    value={medical.diagnosis_date}
                    onChangeText={v => setM('diagnosis_date', v)}
                    placeholder="VD: 2023-01-15"
                    keyboardType="numeric"
                  />
                  <Field
                    label="Cơ sở thực hiện chẩn đoán"
                    value={medical.diagnosis_place}
                    onChangeText={v => setM('diagnosis_place', v)}
                    placeholder="VD: Bệnh viện Nhi Đồng 1"
                  />
                  <MultiChips
                    label="Công cụ đánh giá đã dùng"
                    options={ASSESSMENT_TOOLS}
                    selected={medical.assessment_tools}
                    onToggle={toggleTool}
                  />
                </>
              )}
            </View>

            {/* Bệnh đồng mắc */}
            <View style={st.card}>
              <Text style={st.sectionTitle}>Bệnh đồng mắc</Text>
              <Text style={st.hintText}>Chọn nếu con có bệnh đồng mắc. Bỏ chọn tất cả nếu không có.</Text>
              <MultiChips
                options={COMORBIDITY_OPTIONS}
                selected={medical.comorbidities}
                onToggle={toggleComorbidity}
              />
              {medical.comorbidities.includes('Khác') && (
                <Field
                  placeholder="Nhập bệnh đồng mắc khác..."
                  value={medical.comorbidities_other}
                  onChangeText={v => setM('comorbidities_other', v)}
                />
              )}
            </View>

            {/* Thuốc */}
            <View style={st.card}>
              <Text style={st.sectionTitle}>Thuốc đang dùng</Text>
              <View style={st.yesNoRow}>
                {[
                  { val: false, lbl: 'Không dùng thuốc' },
                  { val: true,  lbl: 'Có dùng thuốc'    },
                ].map(({ val, lbl }) => (
                  <TouchableOpacity
                    key={String(val)}
                    style={[st.yesNoBtn, medical.has_medications === val && st.yesNoBtnActive]}
                    onPress={() => {
                      setM('has_medications', val);
                      if (!val) setM('medications', []);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={[st.yesNoBtnText, medical.has_medications === val && st.yesNoBtnTextActive]}>
                      {lbl}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {medical.has_medications && (
                <>
                  {medical.medications.map((med, idx) => (
                    <View key={med._key} style={st.medCard}>
                      <View style={st.medCardHeader}>
                        <Text style={st.medCardTitle}>Thuốc {idx + 1}</Text>
                        <TouchableOpacity onPress={() => removeMedication(med._key)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Text style={st.medDeleteBtn}>✕ Xóa</Text>
                        </TouchableOpacity>
                      </View>
                      <Field
                        label="Tên thuốc *"
                        value={med.drug_name}
                        onChangeText={v => updateMedication(med._key, 'drug_name', v)}
                        placeholder="VD: Risperidone"
                      />
                      <Field
                        label="Liều dùng"
                        value={med.dosage}
                        onChangeText={v => updateMedication(med._key, 'dosage', v)}
                        placeholder="VD: 0.25mg"
                      />
                      <Field
                        label="Tần suất"
                        value={med.frequency}
                        onChangeText={v => updateMedication(med._key, 'frequency', v)}
                        placeholder="VD: 1 lần/ngày buổi tối"
                      />
                      <Field
                        label="Mục đích sử dụng"
                        value={med.purpose}
                        onChangeText={v => updateMedication(med._key, 'purpose', v)}
                        placeholder="VD: Giảm tăng động, hỗ trợ tập trung"
                      />
                      <Field
                        label="Ngày bắt đầu (YYYY-MM-DD)"
                        value={med.start_date}
                        onChangeText={v => updateMedication(med._key, 'start_date', v)}
                        placeholder="VD: 2024-03-01"
                        keyboardType="numeric"
                      />
                    </View>
                  ))}
                  <TouchableOpacity style={st.addMedBtn} onPress={addMedication} activeOpacity={0.75}>
                    <Text style={st.addMedBtnText}>+ Thêm thuốc</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            <TouchableOpacity
              style={[st.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSaveMedical}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={colors.white} />
                : <Text style={st.saveBtnText}>Lưu thông tin y tế</Text>}
            </TouchableOpacity>
          </>
        )}

        {/* ─────────────────────── TAB: HỌC TẬP ─────────────────────── */}
        {activeTab === 'learning' && (
          <>
            <View style={st.card}>
              <Text style={st.sectionTitle}>Môi trường học tập</Text>
              <RadioGroup
                label="Hiện tại con đang học ở đâu? *"
                options={EDUCATION_OPTIONS}
                value={learning.education_setting}
                onChange={v => setL('education_setting', v)}
              />
            </View>

            <View style={st.card}>
              <Text style={st.sectionTitle}>Người đồng hành can thiệp</Text>
              <RadioGroup
                label="Trong gia đình, ai sẽ đồng hành cùng con nhiều nhất? *"
                options={COMPANION_OPTIONS}
                value={learning.intervention_companion}
                onChange={v => setL('intervention_companion', v)}
              />
              <Text style={st.hintText}>
                Thông tin này giúp AI4Autism cá nhân hóa gợi ý phù hợp với hoàn cảnh gia đình bạn.
              </Text>
            </View>

            <TouchableOpacity
              style={[st.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSaveLearning}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={colors.white} />
                : <Text style={st.saveBtnText}>Lưu thông tin học tập</Text>}
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* ── Avatar upload overlay ── */}
      {showOverlay && (
        <View style={st.overlay}>
          <View style={st.overlayCard}>
            {avatar3DSuccess ? (
              <>
                <Image source={{ uri: avatar3DSuccess }} style={st.successImg} />
                <Text style={st.successTitle}>Avatar 3D đã tạo xong!</Text>
                <Text style={st.successSub}>Ảnh được cập nhật tự động.</Text>
              </>
            ) : (
              <>
                <Text style={st.overlayTitle}>Đang xử lý avatar bé</Text>
                <View style={st.stepList}>
                  <StepRow label="Lưu thông tin" step={STEP_SAVE_INFO} currentStep={uploadStep} />
                  <StepRow label="Tải ảnh lên Cloudinary" step={STEP_CLOUDINARY} currentStep={uploadStep} />
                  <StepRow
                    label={uploadStep === STEP_AVATAR_3D && pollCount > 0
                      ? `Tạo avatar 3D (${pollCount}/8)`
                      : 'Tạo avatar 3D'}
                    step={STEP_AVATAR_3D}
                    currentStep={uploadStep}
                  />
                </View>
                <Text style={st.overlayNote}>
                  {uploadStep === STEP_CLOUDINARY && 'Đang upload ảnh gốc...'}
                  {uploadStep === STEP_AVATAR_3D  && 'AI đang vẽ avatar cartoon, vui lòng chờ...'}
                  {uploadStep === STEP_DONE       && 'Hoàn tất!'}
                </Text>
              </>
            )}
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  scroll:  { padding: spacing.lg, paddingBottom: spacing.xxl },

  // Header
  header:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm, backgroundColor: colors.bg },
  backBtn:  { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 34, color: colors.textDark, lineHeight: 36 },
  title:    { ...typography.h2, color: colors.textDark, flex: 1, textAlign: 'center' },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.bgMuted,
    borderRadius: radius.full,
    padding: 3,
  },
  tab: {
    flex: 1, paddingVertical: 8, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  tabActive: { backgroundColor: colors.bgCard, ...shadows.sm },
  tabText:       { ...typography.bodySm, color: colors.textMid, fontWeight: '600' },
  tabTextActive: { color: colors.primary, fontWeight: '700' },

  // Card
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  sectionTitle: { ...typography.label, color: colors.textDark, fontWeight: '800', marginBottom: spacing.md },

  // Field
  field: { marginBottom: spacing.md },
  fieldLabel: { ...typography.label, color: colors.textDark, fontWeight: '700', marginBottom: 6 },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textDark,
  },
  inputMultiline: { minHeight: 80, paddingTop: spacing.sm },

  // Radio
  radioGroup: { gap: 8 },
  radioBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.bgMuted,
    gap: spacing.sm,
  },
  radioBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  radioIndicator: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioIndicatorDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  radioBtnText:       { ...typography.body, color: colors.textMid, flex: 1 },
  radioBtnTextActive: { color: colors.primaryDark, fontWeight: '600' },

  // Chips
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.bgMuted,
  },
  chipActive:     { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  chipText:       { ...typography.bodySm, color: colors.textMid, fontWeight: '600' },
  chipTextActive: { color: colors.primaryDark, fontWeight: '700' },

  // Gender
  genderRow: { flexDirection: 'row', gap: spacing.sm },
  genderBtn: {
    flex: 1, height: 44, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.bgMuted,
  },
  genderBtnActive:    { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  genderBtnText:      { ...typography.label, color: colors.textMid },
  genderBtnTextActive: { color: colors.primaryDark, fontWeight: '800' },

  // Yes/No
  yesNoRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  yesNoBtn: {
    flex: 1, height: 44, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.bgMuted,
  },
  yesNoBtnActive:    { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  yesNoBtnText:      { ...typography.body, color: colors.textMid, fontWeight: '600' },
  yesNoBtnTextActive: { color: colors.primaryDark, fontWeight: '700' },

  // Medication card
  medCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bgSection,
  },
  medCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  medCardTitle:  { ...typography.label, color: colors.textDark, fontWeight: '700' },
  medDeleteBtn:  { ...typography.caption, color: colors.danger, fontWeight: '700' },
  addMedBtn: {
    marginTop: spacing.sm,
    height: 42, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  addMedBtnText: { ...typography.body, color: colors.primary, fontWeight: '700' },

  hintText: { ...typography.caption, color: colors.textLight, lineHeight: 18, marginBottom: spacing.sm },

  // Save button
  saveBtn: {
    height: 52, borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.sm,
    marginBottom: spacing.sm,
  },
  saveBtnText: { ...typography.btn, color: colors.white, fontSize: 16 },

  // Back alt (empty state)
  backBtnAlt: {
    marginTop: spacing.xl, height: 44, paddingHorizontal: spacing.xl,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnAltText: { ...typography.body, color: colors.primary, fontWeight: '700' },

  // Avatar
  avatarRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatarBtn: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.bgMuted,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg:      { width: '100%', height: '100%' },
  avatarFallback: { fontSize: 40 },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.bgCard,
  },
  avatarEditText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  avatarName:     { ...typography.h4, color: colors.textDark },
  avatarHint:     { ...typography.caption, color: colors.textMid, marginTop: 4, lineHeight: 18 },
  avatarBadge:    { ...typography.caption, marginTop: 6, fontWeight: '700' },

  // Overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(30,20,15,0.45)',
    alignItems: 'center', justifyContent: 'center',
    padding: spacing.lg,
  },
  overlayCard: {
    width: '100%', maxWidth: 360,
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.lg,
  },
  overlayTitle: { ...typography.h4, color: colors.textDark, marginBottom: spacing.lg },
  overlayNote: {
    ...typography.caption, color: colors.textMid,
    textAlign: 'center', marginTop: spacing.md, lineHeight: 18, minHeight: 18,
  },
  stepList:       { width: '100%', gap: spacing.sm },
  stepRow:        { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepIcon:       { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepIconDone:    { backgroundColor: colors.success },
  stepIconActive:  { backgroundColor: colors.primary },
  stepIconPending: { backgroundColor: colors.bgMuted, borderWidth: 1.5, borderColor: colors.border },
  stepCheck:       { color: colors.white, fontWeight: '800', fontSize: 14 },
  stepDot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textLight },
  stepLabel:       { ...typography.body, color: colors.textLight, flex: 1 },
  stepLabelDone:   { color: colors.success, fontWeight: '600' },
  stepLabelActive: { color: colors.primary, fontWeight: '700' },
  successImg:   { width: 130, height: 130, borderRadius: 65, borderWidth: 3, borderColor: colors.secondaryLight, marginBottom: spacing.md },
  successTitle: { ...typography.h4, color: colors.secondary, textAlign: 'center', marginBottom: 4 },
  successSub:   { ...typography.caption, color: colors.textMid, textAlign: 'center' },
});
