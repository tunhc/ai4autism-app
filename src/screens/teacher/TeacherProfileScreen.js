import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  Image,
  Modal,
  TextInput,
  ActivityIndicator
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, radius, spacing, shadows } from '../../lib/colors';
import { typography } from '../../lib/typography';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { uploadTeacherAvatarToCloudinary } from '../../lib/teacherAvatar';

export default function TeacherProfileScreen() {
  const { profile, logout, refreshProfile } = useAuth();
  const userId = profile?.id;
  const centerCode = profile?.center_code || profile?.centers?.center_code || 'BIC-HCM';

  const roleStr = profile?.role === 'specialist' ? 'Chuyên gia' : 'Giáo viên';
  const roleTitle = profile?.role === 'specialist' ? 'Chuyên gia can thiệp' : 'Giáo viên chuyên biệt';
  const teacherName = profile?.full_name || roleStr;
  const teacherEmail = profile?.email || '';
  const teacherPhone = profile?.phone || 'Chưa cập nhật';
  const centerName = profile?.centers?.name || 'Trung tâm';
  const legacyId = profile?.legacy_id || '';
  const avatarUrl = profile?.avatar_url || null;

  // States
  const [loading, setLoading] = useState(false);
  const [videoModelingCount, setVideoModelingCount] = useState(0);

  // Modals
  const [isEditEmailVisible, setEditEmailVisible] = useState(false);
  const [isEditPhoneVisible, setEditPhoneVisible] = useState(false);
  const [isEditPasswordVisible, setEditPasswordVisible] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Fetch count
  useEffect(() => {
    async function loadStats() {
      if (!userId) return;
      try {
        const { count, error } = await supabase
          .from('video_modeling_library')
          .select('*', { count: 'exact', head: true })
          .eq('created_by', userId);
        if (!error && count !== null) {
          setVideoModelingCount(count);
        }
      } catch (e) {
        console.warn('Cannot fetch video modeling count', e);
      }
    }
    loadStats();
  }, [userId]);

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmLogout = window.confirm(`Bạn có chắc chắn muốn đăng xuất khỏi tài khoản ${roleStr.toLowerCase()}?`);
      if (confirmLogout) {
        logout();
      }
    } else {
      Alert.alert(
        'Đăng xuất',
        'Bạn có chắc chắn muốn đăng xuất?',
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Đăng xuất', style: 'destructive', onPress: () => logout() }
        ]
      );
    }
  };

  const pickAndUploadAvatar = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Lỗi', 'Cần quyền truy cập thư viện ảnh để đổi avatar.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setLoading(true);
        const uploadedInfo = await uploadTeacherAvatarToCloudinary({
          asset: result.assets[0],
          centerCode,
          teacherId: userId
        });

        if (uploadedInfo?.url) {
          const { error } = await supabase.from('users').update({ avatar_url: uploadedInfo.url }).eq('id', userId);
          if (error) throw error;
          
          Alert.alert('Thành công', 'Cập nhật avatar thành công!');
          if (refreshProfile) refreshProfile();
        }
      }
    } catch (e) {
      Alert.alert('Lỗi', e.message || 'Không thể cập nhật avatar.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePhone = async () => {
    if (!newPhone.trim()) return Alert.alert('Lỗi', 'Vui lòng nhập số điện thoại');
    setLoading(true);
    try {
      const { error } = await supabase.from('users').update({ phone: newPhone.trim() }).eq('id', userId);
      if (error) throw error;
      Alert.alert('Thành công', 'Đã cập nhật số điện thoại.');
      setEditPhoneVisible(false);
      setNewPhone('');
      if (refreshProfile) refreshProfile();
    } catch (e) {
      Alert.alert('Lỗi', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail.trim()) return Alert.alert('Lỗi', 'Vui lòng nhập email');
    setLoading(true);
    try {
      // First update in users table
      const { error: dbError } = await supabase.from('users').update({ email: newEmail.trim() }).eq('id', userId);
      if (dbError) throw dbError;
      
      // Then try update auth user if they are logged in via Supabase Auth
      await supabase.auth.updateUser({ email: newEmail.trim() });
      
      Alert.alert('Thành công', 'Đã cập nhật email. Nếu dùng email để đăng nhập, vui lòng kiểm tra hộp thư để xác nhận.');
      setEditEmailVisible(false);
      setNewEmail('');
      if (refreshProfile) refreshProfile();
    } catch (e) {
      Alert.alert('Lỗi', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword.trim() || newPassword.length < 6) {
      return Alert.alert('Lỗi', 'Mật khẩu phải có ít nhất 6 ký tự.');
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      Alert.alert('Thành công', 'Đã cập nhật mật khẩu.');
      setEditPasswordVisible(false);
      setNewPassword('');
    } catch (e) {
      Alert.alert('Lỗi', e.message || 'Không thể đổi mật khẩu. Hãy chắc chắn bạn đã đăng nhập.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* ══ Header ══ */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cài đặt {roleStr}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {/* Profile Header Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileCardInner}>
            <TouchableOpacity onPress={pickAndUploadAvatar} disabled={loading}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarLarge} />
              ) : (
                <View style={styles.avatarLargeFallback}>
                  <Text style={{ fontSize: 38 }}>👩‍🏫</Text>
                </View>
              )}
              <View style={styles.editAvatarIcon}>
                <Text style={{ color: 'white', fontSize: 12 }}>✎</Text>
              </View>
            </TouchableOpacity>
            
            <View style={styles.profileTextWrap}>
              <Text style={styles.profileName}>{teacherName}</Text>
              <Text style={styles.profileRole}>{roleTitle} • {legacyId}</Text>
              <Text style={styles.profileCenter}>{centerName}</Text>
            </View>
          </View>
        </View>

        {/* Thống kê giáo án */}
        <Text style={styles.sectionHeading}>Kho Giáo án & Thư viện</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>📖</Text>
            <Text style={styles.statTitle}>Giáo án cá nhân</Text>
            <Text style={styles.statValue}>{videoModelingCount} video modeling</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>⭐</Text>
            <Text style={styles.statTitle}>Tài liệu yêu thích</Text>
            <Text style={styles.statValue}>24 học liệu mẫu</Text>
          </View>
        </View>

        {/* Section: Thông tin cá nhân */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>THÔNG TIN CÁ NHÂN</Text>
          
          <TouchableOpacity style={styles.detailRow} onPress={() => { setNewEmail(teacherEmail); setEditEmailVisible(true); }}>
            <Text style={styles.detailLabel}>Email liên hệ:</Text>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Text style={styles.detailValue}>{teacherEmail || 'Thêm email'}</Text>
              <Text style={styles.menuItemArrow}> ›</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.divider} />

          <TouchableOpacity style={styles.detailRow} onPress={() => { setNewPhone(teacherPhone); setEditPhoneVisible(true); }}>
            <Text style={styles.detailLabel}>Số điện thoại:</Text>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Text style={styles.detailValue}>{teacherPhone}</Text>
              <Text style={styles.menuItemArrow}> ›</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.divider} />

          <TouchableOpacity style={styles.detailRow} onPress={() => setEditPasswordVisible(true)}>
            <Text style={styles.detailLabel}>Mật khẩu:</Text>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Text style={styles.detailValue}>********</Text>
              <Text style={styles.menuItemArrow}> ›</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Section: Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.logoutBtnText}>Đăng xuất tài khoản</Text>
        </TouchableOpacity>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {/* Modals for Editing */}
      <EditModal 
        visible={isEditEmailVisible} 
        title="Cập nhật Email" 
        value={newEmail} 
        setValue={setNewEmail} 
        onClose={() => setEditEmailVisible(false)} 
        onSave={handleUpdateEmail} 
        placeholder="Nhập email mới" 
        keyboardType="email-address" 
      />
      <EditModal 
        visible={isEditPhoneVisible} 
        title="Cập nhật Số điện thoại" 
        value={newPhone} 
        setValue={setNewPhone} 
        onClose={() => setEditPhoneVisible(false)} 
        onSave={handleUpdatePhone} 
        placeholder="Nhập số điện thoại" 
        keyboardType="phone-pad" 
      />
      <EditModal 
        visible={isEditPasswordVisible} 
        title="Đổi mật khẩu" 
        value={newPassword} 
        setValue={setNewPassword} 
        onClose={() => setEditPasswordVisible(false)} 
        onSave={handleUpdatePassword} 
        placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)" 
        secureTextEntry={true} 
      />
    </View>
  );
}

// Sub-component for edit modal
function EditModal({ visible, title, value, setValue, onClose, onSave, placeholder, keyboardType = 'default', secureTextEntry = false }) {
  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View style={styles.modalBg}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TextInput
            style={styles.modalInput}
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            keyboardType={keyboardType}
            secureTextEntry={secureTextEntry}
            autoCapitalize="none"
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalBtnCancel} onPress={onClose}>
              <Text style={styles.modalBtnCancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalBtnSave} onPress={onSave}>
              <Text style={styles.modalBtnSaveText}>Lưu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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
    backgroundColor: colors.bg,
    alignItems: 'center'
  },
  headerTitle: { ...typography.h3, color: colors.textDark, fontWeight: '700' },

  // Profile Card
  profileCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.md,
    ...shadows.sm,
  },
  profileCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarLarge: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: colors.secondaryLight,
  },
  avatarLargeFallback: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.secondaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.secondaryLight,
  },
  editAvatarIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.secondary,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bgCard,
  },
  profileTextWrap: {
    marginLeft: spacing.lg,
    flex: 1,
  },
  profileName: { ...typography.h4, color: colors.textDark, fontWeight: '700' },
  profileRole: { ...typography.bodySm, color: colors.secondaryDark, marginTop: 4, fontWeight: '600' },
  profileCenter: { ...typography.caption, color: colors.textMid, marginTop: 4 },

  // Stats
  sectionHeading: { ...typography.h4, color: colors.textDark, marginTop: spacing.xl, marginBottom: spacing.md, fontWeight: '700' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statCard: {
    flex: 1,
    backgroundColor: colors.secondaryBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.secondaryLight,
  },
  statIcon: { fontSize: 24, marginBottom: 8 },
  statTitle: { ...typography.label, color: colors.textDark, fontWeight: '600', marginBottom: 4, textAlign: 'center' },
  statValue: { ...typography.caption, color: colors.textMid, textAlign: 'center' },

  // Standard cards
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cardSectionTitle: {
    ...typography.labelSm,
    color: colors.textDark,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },

  // Details
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, alignItems: 'center' },
  detailLabel: { ...typography.body, color: colors.textMid },
  detailValue: { ...typography.body, color: colors.textDark, fontWeight: '600' },

  divider: { height: 0.8, backgroundColor: colors.border },
  menuItemArrow: { fontSize: 20, color: colors.textLight, paddingLeft: 8 },

  // Logout button
  logoutBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  logoutBtnText: { ...typography.btn, color: colors.danger, fontWeight: '700' },

  // Loading
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },

  // Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: '85%', backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: spacing.xl, ...shadows.md },
  modalTitle: { ...typography.h4, color: colors.textDark, fontWeight: '700', marginBottom: spacing.lg, textAlign: 'center' },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.body,
    marginBottom: spacing.xl,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between' },
  modalBtnCancel: { flex: 1, alignItems: 'center', padding: spacing.md, marginRight: spacing.sm, borderRadius: radius.md, backgroundColor: colors.border },
  modalBtnCancelText: { ...typography.btn, color: colors.textDark },
  modalBtnSave: { flex: 1, alignItems: 'center', padding: spacing.md, marginLeft: spacing.sm, borderRadius: radius.md, backgroundColor: colors.primary },
  modalBtnSaveText: { ...typography.btn, color: colors.white },
});
