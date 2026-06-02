import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert, Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, getChildrenByParent } from '../../lib/supabase';
import { buildCloudinaryThumbUrl, enqueueChildAvatarGeneration } from '../../lib/childAvatar';
import { colors, radius, shadows, spacing } from '../../lib/colors';
import { typography } from '../../lib/typography';

export default function ProfileCompletionScreen() {
  const { user, session, refreshUser, logout } = useAuth();
  const isParent = user?.role === 'parent';

  const [form, setForm] = useState({
    full_name:         user?.full_name || '',
    email:             user?.email || '',
    phone:             '',
    permanent_address: '',
    // Parent only — child info
    child_name:        '',
    child_dob:         '',    // YYYY-MM-DD
    child_gender:      '',    // 'male'|'female'|'other'
    child_avatar:      '',
  });
  const [childAvatarAsset, setChildAvatarAsset] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);  // 1 = user info | 2 = child info (parent)
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (isParent && session?.user?.id) {
      getChildrenByParent(session.user.id).then(children => {
        if (children && children.length > 0) {
          const child = children[0];
          setForm(f => ({
            ...f,
            child_name: child.full_name || f.child_name,
            child_dob: child.date_of_birth || f.child_dob,
            child_gender: child.gender || f.child_gender,
            child_avatar: child.avatar_url || f.child_avatar,
          }));
        }
      }).catch(err => console.log('Lỗi tải thông tin bé:', err));
    }
  }, [isParent, session?.user?.id]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const validateStep1 = () => {
    if (!form.full_name.trim())       return 'Vui lòng nhập họ tên.';
    if (!form.email.trim())           return 'Vui lòng nhập email.';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) return 'Email không đúng định dạng.';
    if (!form.phone.trim())           return 'Vui lòng nhập số điện thoại.';
    if (!/^\d{10}$/.test(form.phone.trim())) return 'Số điện thoại phải gồm đúng 10 chữ số (VD: 0901234567).';
    return null;
  };

  const validateStep2 = () => {
    if (!form.child_name.trim())  return 'Vui lòng nhập tên bé.';
    if (!form.child_dob)          return 'Vui lòng nhập ngày sinh của bé.';
    if (!form.child_gender)       return 'Vui lòng chọn giới tính.';
    return null;
  };

  const handleNextStep = () => {
    setError('');
    const err = validateStep1();
    if (err) { setError(err); return; }
    if (isParent) { setStep(2); return; }
    handleSubmit();
  };

  const handleSubmit = async () => {
    setError('');
    if (isParent && step === 2) {
      const err = validateStep2();
      if (err) { setError(err); return; }
    }

    setLoading(true);
    try {
      // Update user profile
      const { error: uErr } = await supabase
        .from('users')
        .update({
          full_name:          form.full_name.trim(),
          email:              form.email.trim().toLowerCase(),
          phone:              form.phone.trim(),
          permanent_address:  form.permanent_address.trim() || null,
          profile_complete:   true,
          profile_completed_at: new Date().toISOString(),
          updated_at:         new Date().toISOString(),
        })
        .eq('id', session.user.id);

      if (uErr) throw uErr;

      // If parent — create child record
      if (isParent) {
        const childCode = generateChildCode(user, form.child_name, form.child_dob);
        let avatarUrl = null;
        let avatarUpload = null;

        // Upload to Cloudinary if it's a local file
        if (form.child_avatar && !form.child_avatar.startsWith('http')) {
          try {
            const data = new FormData();
            data.append('file', {
              uri: form.child_avatar,
              type: 'image/jpeg',
              name: 'avatar.jpg',
            });
            data.append('upload_preset', process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'ai4autism_preset');
            
            // Lưu hình ảnh theo cấu trúc cây: [center_code]/[role]/[child_code hoặc vst_code]
            const centerCode = user?.center_code || 'BIC-HCM';
            data.append('folder', `${centerCode}/child/${childCode}`);
            const res = await fetch(
              `https://api.cloudinary.com/v1_1/${process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'demo'}/image/upload`,
              { method: 'POST', body: data }
            );
            const result = await res.json();
            if (result.secure_url) avatarUrl = result.secure_url;
          } catch (uploadErr) {
            console.log('Lỗi upload avatar:', uploadErr);
          }
        } else if (form.child_avatar && form.child_avatar.startsWith('http')) {
          avatarUrl = form.child_avatar;
        }
        if (childAvatarAsset && avatarUrl) {
          avatarUpload = {
            url: avatarUrl,
            thumbUrl: buildCloudinaryThumbUrl(avatarUrl),
          };
        }

        // Kiểm tra xem bé đã tồn tại chưa để tránh tạo duplicate
        const { data: existingChildren } = await supabase
          .from('children')
          .select('id, avatar_url, avatar_thumb_url, avatar_3d_url, avatar_job_id')
          .eq('parent_id', session.user.id)
          .eq('is_active', true)
          .limit(1);

        const childData = {
            child_code:     childCode,
            center_id:      user.center_id,
            parent_id:      session.user.id,
            full_name:      form.child_name.trim(),
            date_of_birth:  form.child_dob,
            gender:         form.child_gender,
            ...(avatarUpload ? {
              avatar_url:       avatarUpload.url,
              avatar_thumb_url: avatarUpload.thumbUrl,
            } : {}),
        };

        let cErr = null;
        let savedChild = null;
        if (existingChildren && existingChildren.length > 0) {
          // Update bé hiện tại
          const { data, error } = await supabase
            .from('children')
            .update(childData)
            .eq('id', existingChildren[0].id)
            .select('*')
            .single();
          cErr = error;
          savedChild = data;
        } else {
          // Insert bé mới
          const { data, error } = await supabase
            .from('children')
            .insert(childData)
            .select('*')
            .single();
          cErr = error;
          savedChild = data;
        }

        if (cErr && !cErr.message?.includes('duplicate')) throw cErr;

        if (avatarUpload && savedChild?.id) {
          await enqueueChildAvatarGeneration({
            child: savedChild,
            parentId: session.user.id,
            preferences: { source: 'profile_completion' },
          });
        }
      }

      await refreshUser();
      // RootNavigator will redirect to main tabs automatically
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể lưu thông tin. Vui lòng thử lại.\n' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // e.g. "KBC-HCM-An-G24" from center + child name + gender + age (months)
  const generateChildCode = (u, childName, dob) => {
    const centerCode = u?.center_code || 'BIC-HCM';
    const firstName = childName.trim().split(' ').pop();
    const ageMonths = monthsBetween(new Date(dob), new Date());
    const gender = form.child_gender === 'male' ? 'G' : 'B';
    return `${centerCode}-${firstName}-${gender}${ageMonths}`;
  };

  const monthsBetween = (d1, d2) =>
    (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());

  // ── RENDER STEP 1: User info ──────────────────────────────
  const renderStep1 = () => (
    <>
      <Text style={styles.stepLabel}>Bước 1/{ isParent ? '2' : '1' } — Thông tin của bạn</Text>

      <Field label="Họ tên đầy đủ *" value={form.full_name}
        onChange={v => set('full_name', v)} placeholder="Nguyễn Thị Mai" />

      <Field label="Email *" value={form.email}
        onChange={v => set('email', v)} placeholder="email@example.com"
        keyboardType="email-address" />

      <Field label="Số điện thoại *" value={form.phone}
        onChange={v => set('phone', v)} placeholder="0901 234 567"
        keyboardType="phone-pad" />

      <Field label="Địa chỉ thường trú" value={form.permanent_address}
        onChange={v => set('permanent_address', v)}
        placeholder="123 Đường ABC, Quận 7, TP.HCM" />

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.btn, loading && styles.btnDisabled]}
        onPress={handleNextStep} disabled={loading}
        activeOpacity={0.82}
      >
        {loading
          ? <ActivityIndicator color={colors.white} />
          : <Text style={styles.btnText}>{isParent ? 'Tiếp theo →' : 'Hoàn tất'}</Text>
        }
      </TouchableOpacity>
    </>
  );

  // ── RENDER STEP 2: Child info (parent only) ───────────────
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setChildAvatarAsset(result.assets[0]);
      set('child_avatar', result.assets[0].uri);
    }
  };

  const renderStep2 = () => (
    <>
      <Text style={styles.stepLabel}>Bước 2/2 — Thông tin bé</Text>
      <Text style={styles.hint}>
        Bạn có thể cập nhật thêm chi tiết hồ sơ bé sau khi đăng nhập.
      </Text>

      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={pickImage} style={styles.avatarBtn}>
          {form.child_avatar ? (
            <Image source={{ uri: form.child_avatar }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarPlaceholder}>+ Ảnh bé</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.avatarHint}>Chỉ hỗ trợ file ảnh (JPG/PNG), dung lượng khuyên dùng tối đa 5MB. Ảnh này sẽ dùng làm hình đại diện cho bé.</Text>
      </View>

      <Field label="Tên bé *" value={form.child_name}
        onChange={v => set('child_name', v)} placeholder="Nguyễn Minh An" />

      <Field label="Ngày sinh (YYYY-MM-DD) *" value={form.child_dob}
        onChange={v => set('child_dob', v)} placeholder="2021-03-15"
        keyboardType="numeric" />

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Giới tính *</Text>
        <View style={styles.genderRow}>
          {[['male','Nam 👦'],['female','Nữ 👧']].map(([val, label]) => (
            <TouchableOpacity
              key={val}
              style={[styles.genderBtn, form.child_gender === val && styles.genderBtnActive]}
              onPress={() => set('child_gender', val)}
            >
              <Text style={[styles.genderText, form.child_gender === val && styles.genderTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.row}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
          <Text style={styles.backText}>← Quay lại</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnFlex, loading && styles.btnDisabled]}
          onPress={handleSubmit} disabled={loading}
          activeOpacity={0.82}
        >
          {loading
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.btnText}>Hoàn tất 🎉</Text>
          }
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>📋</Text>
          <Text style={styles.title}>Hoàn thiện hồ sơ</Text>
          <Text style={styles.subtitle}>
            {isParent
              ? 'Vui lòng cập nhật thông tin để bắt đầu theo dõi tiến độ của bé.'
              : 'Vui lòng cập nhật thông tin để sử dụng đầy đủ tính năng.'}
          </Text>
        </View>

        <View style={styles.card}>
          {step === 1 ? renderStep1() : renderStep2()}
        </View>

        <Text style={styles.footer}>
          Thông tin được bảo mật theo Nghị định 13/2023/NĐ-CP
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Reusable Field ────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, keyboardType }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        keyboardType={keyboardType || 'default'}
        autoCapitalize="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: spacing.xs,
  },
  logoutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.bgMuted,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutText: {
    ...typography.caption,
    color: colors.textMid,
    fontWeight: '600',
  },

  header: { alignItems: 'center', marginBottom: spacing.lg },
  emoji: { fontSize: 40, marginBottom: spacing.xs },
  title: { ...typography.h2, color: colors.textDark, textAlign: 'center' },
  subtitle: {
    ...typography.body,
    color: colors.textMid,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 22,
  },

  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
    marginBottom: spacing.md,
  },

  stepLabel: {
    ...typography.label,
    color: colors.primary,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  hint: {
    ...typography.caption,
    color: colors.textMid,
    marginBottom: spacing.md,
  },

  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  avatarBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.bgMuted,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarPlaceholder: { ...typography.caption, color: colors.textMid, textAlign: 'center' },
  avatarHint: { ...typography.caption, color: colors.textLight, flex: 1 },

  fieldWrap: { marginBottom: spacing.md },
  label: {
    ...typography.label,
    color: colors.textDark,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    height: 48,
    backgroundColor: colors.bgMuted,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.textDark,
  },

  // Gender picker
  genderRow: { flexDirection: 'row', gap: 8 },
  genderBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderBtnActive: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primary,
  },
  genderText: { ...typography.label, color: colors.textMid },
  genderTextActive: { color: colors.primary, fontWeight: '700' },

  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { ...typography.caption, color: '#991B1B', lineHeight: 18 },

  // Buttons
  row: { flexDirection: 'row', gap: 10, marginTop: spacing.xs },
  btn: {
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
    marginTop: spacing.xs,
  },
  btnFlex: { flex: 1 },
  btnDisabled: { opacity: 0.6 },
  btnText: { ...typography.btn, color: colors.white, fontSize: 16 },

  backBtn: {
    height: 52,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgMuted,
  },
  backText: { ...typography.label, color: colors.textMid },

  footer: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'center',
  },
});
