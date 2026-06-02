import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { colors, radius, shadows, spacing } from '../../lib/colors';
import { typography } from '../../lib/typography';

const CENTER_CODE = 'BIC-HCM';
const AI4AUTISM_LOGO = require('../../../assets/branding/AI4Autism-gemini.png');
const NBAI_LOGO = require('../../../assets/branding/NBAI logo-de.png');

const ROLES = [
  { key: 'parent',     label: 'Phụ huynh',  emoji: '👨‍👩‍👧', desc: 'Theo dõi tiến trình của bé' },
  { key: 'teacher',    label: 'Giáo viên',  emoji: '👩‍🏫', desc: 'Quản lý lớp học & bài tập' },
  { key: 'specialist', label: 'Chuyên gia', emoji: '🔬', desc: 'Đánh giá & tư vấn chuyên sâu' },
];

export default function LoginScreen() {
  const { login, MOCK_PROFILES } = useAuth();

  // Role selection
  const [selectedRole, setSelectedRole] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Login form
  const [legacyId, setLegacyId] = useState('');
  const [password, setPassword] = useState('');
  const [remember30Days, setRemember30Days] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function openLoginModal(role) {
    setSelectedRole(role);
    setLegacyId('');
    setPassword('');
    setError('');
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
    setSelectedRole(null);
  }

  function applyDemo(profile) {
    setLegacyId(profile.legacy_id);
    setPassword(profile.password);
    setError('');
  }

  async function handleLogin() {
    const normalizedId = legacyId.trim();
    if (!normalizedId || !password) {
      setError('Vui lòng nhập mã người dùng và mật khẩu.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login({ legacyId: normalizedId, password, remember30Days });
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }

  // Demo accounts filtered for selected role
  const demoForRole = selectedRole
    ? Object.values(MOCK_PROFILES).filter(p => p.role === selectedRole).slice(0, 2)
    : [];

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
        {/* ── Logo ── */}
        <View style={styles.header}>
          <Image source={AI4AUTISM_LOGO} style={styles.productLogo} resizeMode="contain" />
          <View style={styles.companyRow}>
            <Text style={styles.companyLabel}>Powered by</Text>
            <Image source={NBAI_LOGO} style={styles.companyLogo} resizeMode="contain" />
          </View>
        </View>

        {/* ── Role picker ── */}
        <View style={styles.card}>
          <Text style={styles.title}>Chọn vai trò của bạn</Text>
          <Text style={styles.subtitle}>
            Bấm vào vai trò để đăng nhập vào hệ thống AI4Autism.
          </Text>

          <View style={styles.rolesGrid}>
            {ROLES.map(role => (
              <TouchableOpacity
                key={role.key}
                style={styles.roleTile}
                onPress={() => openLoginModal(role.key)}
                activeOpacity={0.78}
              >
                <Text style={styles.roleEmoji}>{role.emoji}</Text>
                <Text style={styles.roleLabel}>{role.label}</Text>
                <Text style={styles.roleDesc}>{role.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={styles.footer}>
          AI4Autism - NBAI{'\n'}Hỗ trợ: contact@ai4autism.vn
        </Text>
      </ScrollView>

      {/* ── Login Modal ── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.modalKAV}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalCard}>
              {/* Handle bar */}
              <View style={styles.handleBar} />

              {/* Modal header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalEmoji}>
                  {ROLES.find(r => r.key === selectedRole)?.emoji}
                </Text>
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={styles.modalTitle}>
                    Đăng nhập — {ROLES.find(r => r.key === selectedRole)?.label}
                  </Text>
                  <Text style={styles.modalSubtitle}>Trung tâm {CENTER_CODE}</Text>
                </View>
                <TouchableOpacity onPress={closeModal} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Form */}
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Mã người dùng</Text>
                <TextInput
                  style={styles.input}
                  placeholder={
                    selectedRole === 'parent' ? 'Vi du: PH_KBC-HCM_Long-G20'
                    : selectedRole === 'teacher' ? 'Vi du: GV_KBC_VY'
                    : 'Vi du: CG_NBAI_Lam'
                  }
                  placeholderTextColor={colors.textLight}
                  value={legacyId}
                  onChangeText={setLegacyId}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Mật khẩu</Text>
                <View style={styles.pwRow}>
                  <TextInput
                    style={[styles.input, styles.pwInput]}
                    placeholder="Nhập mật khẩu"
                    placeholderTextColor={colors.textLight}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPw}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowPw(v => !v)}
                  >
                    <Text style={styles.eyeText}>{showPw ? 'Ẩn' : 'Hiện'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.rememberRow}
                onPress={() => setRemember30Days(v => !v)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, remember30Days && styles.checkboxActive]}>
                  {remember30Days && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.rememberText}>Ghi nhớ đăng nhập 30 ngày</Text>
              </TouchableOpacity>

              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.loginBtn, loading && styles.btnDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.82}
              >
                {loading
                  ? <ActivityIndicator size="small" color={colors.white} />
                  : <Text style={styles.loginBtnText}>Đăng nhập</Text>
                }
              </TouchableOpacity>


            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function formatError(err) {
  const msg = err?.message || '';
  if (msg.includes('resolve_login_email')) return 'Database chưa cấu hình. Vui lòng tạo RPC resolve_login_email.';
  if (msg.includes('Database error querying schema')) return 'Lỗi máy chủ Supabase: Hệ thống Trigger (auth.users) đang bị lỗi. Vui lòng kiểm tra lại cấu hình Database.';
  if (msg.toLowerCase().includes('invalid login')) return 'Mã người dùng hoặc mật khẩu không chính xác.';
  return msg || 'Đăng nhập thất bại. Vui lòng thử lại.';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },

  header: { alignItems: 'center', marginBottom: spacing.lg },
  productLogo: { width: '100%', maxWidth: 320, height: 104, marginBottom: spacing.sm },
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  companyLabel: { ...typography.caption, color: colors.textMid },
  companyLogo: { width: 96, height: 44 },

  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
    marginBottom: spacing.lg,
  },
  title: { ...typography.h3, color: colors.textDark, marginBottom: 6 },
  subtitle: { ...typography.body, color: colors.textMid, marginBottom: spacing.lg, lineHeight: 22 },

  rolesGrid: {
    flexDirection: 'column',
    gap: 12,
  },
  roleTile: {
    width: '100%',
    backgroundColor: colors.bgMuted,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    minHeight: 110,
    justifyContent: 'center',
    ...shadows.sm,
  },
  roleEmoji: { fontSize: 32, marginBottom: 6 },
  roleLabel: { ...typography.label, color: colors.textDark, fontWeight: '700', marginBottom: 3 },
  roleDesc: { ...typography.caption, color: colors.textMid, textAlign: 'center', lineHeight: 16 },

  footer: { ...typography.caption, color: colors.textLight, textAlign: 'center', lineHeight: 20 },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalKAV: { justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  modalEmoji: { fontSize: 28 },
  modalTitle: { ...typography.h3, color: colors.textDark },
  modalSubtitle: { ...typography.caption, color: colors.textMid, marginTop: 2 },
  closeBtn: { padding: 6 },
  closeBtnText: { fontSize: 16, color: colors.textMid },

  fieldWrap: { marginBottom: spacing.md },
  label: { ...typography.label, color: colors.textDark, fontWeight: '600', marginBottom: 6 },
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
  pwRow: { flexDirection: 'row', alignItems: 'center' },
  pwInput: { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  eyeBtn: {
    height: 48,
    minWidth: 58,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.bgMuted,
    borderWidth: 1.5,
    borderLeftWidth: 0,
    borderColor: colors.border,
    borderTopRightRadius: radius.md,
    borderBottomRightRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeText: { ...typography.caption, color: colors.primary, fontWeight: '700' },

  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  checkboxActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  checkmark: { color: colors.white, fontSize: 15, fontWeight: '800', lineHeight: 18 },
  rememberText: { ...typography.body, color: colors.textDark, flex: 1 },

  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { ...typography.caption, color: '#991B1B', lineHeight: 18 },

  loginBtn: {
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
    marginTop: spacing.xs,
  },
  btnDisabled: { opacity: 0.6 },
  loginBtnText: { ...typography.btn, color: colors.white, fontSize: 16 },

  demoSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  demoLabel: { ...typography.caption, color: colors.textLight, marginBottom: spacing.sm },
  demoBtnsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  demoBtn: {
    flex: 1,
    minHeight: 38,
    backgroundColor: colors.bgMuted,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  demoBtnText: { ...typography.caption, color: colors.textDark, fontWeight: '700' },
});
