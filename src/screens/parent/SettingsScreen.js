import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Image, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View, Platform,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { getChildrenByParent } from '../../lib/supabase';
import { getChildDisplayAvatar } from '../../lib/childAvatar';
import { colors, radius, shadows, spacing } from '../../lib/colors';
import { typography } from '../../lib/typography';

function SettingRow({ emoji, label, onPress, rightContent, border = true }) {
  return (
    <TouchableOpacity
      style={[st.settingRow, !border && { borderBottomWidth: 0 }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Text style={st.settingEmoji}>{emoji}</Text>
      <Text style={st.settingLabel}>{label}</Text>
      <View style={st.settingRight}>
        {rightContent || (onPress && <Text style={st.settingArrow}>›</Text>)}
      </View>
    </TouchableOpacity>
  );
}

function SectionHeader({ title }) {
  return <Text style={st.sectionTitle}>{title}</Text>;
}

export default function SettingsScreen({ navigation }) {
  const { user, profile, logout } = useAuth();
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [language, setLanguage] = useState('vi');
  const [child, setChild] = useState(null);

  const displayName = user?.full_name || profile?.full_name || 'Người dùng';
  const email = user?.email || profile?.email || '';
  const plan = user?.subscription_plan || profile?.subscription_plan || 'enterprise';
  const planLabel = { basic: 'Cơ bản', standard: 'Tiêu chuẩn', enterprise: 'Doanh nghiệp', trial: 'Dùng thử' }[plan] || plan;
  const role = user?.role || profile?.role || 'parent';
  const roleLabel = { parent: 'Phụ huynh', teacher: 'Giáo viên', specialist: 'Chuyên gia', admin: 'Admin' }[role] || role;

  const childAvatarUri = getChildDisplayAvatar(child);

  const loadChild = useCallback(async () => {
    const userId = user?.id || profile?.id;
    if (!userId || role !== 'parent') return;
    try {
      const children = await getChildrenByParent(userId);
      setChild(children?.[0] || null);
    } catch {
      setChild(null);
    }
  }, [profile?.id, role, user?.id]);

  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', loadChild);
    loadChild();
    return unsubscribe;
  }, [loadChild, navigation]);

  function handleLogout() {
    if (Platform.OS === 'web') {
      const confirmLogout = window.confirm('Bạn có chắc muốn đăng xuất khỏi AI4Autism không?');
      if (confirmLogout) {
        logout();
      }
    } else {
      Alert.alert(
        'Đăng xuất',
        'Bạn có chắc muốn đăng xuất khỏi AI4Autism không?',
        [
          { text: 'Huỷ', style: 'cancel' },
          { text: 'Đăng xuất', style: 'destructive', onPress: logout },
        ]
      );
    }
  }

  return (
    <ScrollView style={st.root} contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
      <Text style={st.screenTitle}>Cài đặt</Text>

      {/* ── Profile card ── */}
      <View style={[st.card, st.profileCard]}>
        <View style={st.avatarCircle}>
          {childAvatarUri ? (
            <Image source={{ uri: childAvatarUri }} style={st.avatarImage} />
          ) : (
            <Text style={st.avatarLetter}>{displayName.charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={st.profileName}>{displayName}</Text>
          <Text style={st.profileEmail}>{email}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
            <View style={st.badge}><Text style={st.badgeText}>{roleLabel}</Text></View>
            <View style={[st.badge, { backgroundColor: colors.secondaryBg }]}>
              <Text style={[st.badgeText, { color: colors.secondaryDark }]}>{planLabel}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Tài khoản ── */}
      <SectionHeader title="TÀI KHOẢN" />
      <View style={st.card}>
        <SettingRow
          emoji="👤" label="Thông tin cá nhân"
          onPress={() => navigation.navigate('PersonalInfo')}
        />
        <SettingRow
          emoji="👦" label="Hồ sơ bé"
          onPress={() => navigation.navigate('ChildProfile')}
        />
        <SettingRow
          emoji="💎" label="Gói đăng ký"
          border={false}
          rightContent={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ ...typography.caption, color: colors.secondaryDark, fontWeight: '700' }}>{planLabel}</Text>
              <Text style={st.settingArrow}>›</Text>
            </View>
          }
          onPress={() => Alert.alert('Gói hiện tại', `Bạn đang dùng gói ${planLabel}. Liên hệ trung tâm để nâng cấp.`)}
        />
      </View>

      {/* ── Ứng dụng ── */}
      <SectionHeader title="ỨNG DỤNG" />
      <View style={st.card}>
        <SettingRow
          emoji="🔔" label="Thông báo"
          rightContent={
            <Switch
              value={notifEnabled}
              onValueChange={setNotifEnabled}
              trackColor={{ false: colors.bgMuted, true: colors.primaryLight }}
              thumbColor={notifEnabled ? colors.primary : colors.textLight}
            />
          }
        />
        <SettingRow
          emoji="⌚" label="Kết nối thiết bị"
          border={false}
          rightContent={
            <View style={[st.comingSoonBadge]}>
              <Text style={st.comingSoonText}>Sắp có</Text>
            </View>
          }
        />
      </View>

      {/* ── Ngôn ngữ ── */}
      <SectionHeader title="NGÔN NGỮ" />
      <View style={st.card}>
        <SettingRow
          emoji="🇻🇳" label="Tiếng Việt"
          rightContent={language === 'vi' && <Text style={{ color: colors.success, fontSize: 18 }}>✓</Text>}
          onPress={() => setLanguage('vi')}
        />
        <SettingRow
          emoji="🇺🇸" label="English"
          border={false}
          rightContent={language === 'en' && <Text style={{ color: colors.success, fontSize: 18 }}>✓</Text>}
          onPress={() => setLanguage('en')}
        />
      </View>

      {/* ── Hỗ trợ ── */}
      <SectionHeader title="HỖ TRỢ" />
      <View style={st.card}>
        <SettingRow
          emoji="❓" label="Hướng dẫn sử dụng"
          onPress={() => Alert.alert('Hướng dẫn', 'Vui lòng liên hệ contact@ai4autism.vn')}
        />
        <SettingRow
          emoji="📋" label="Chính sách bảo mật"
          border={false}
          onPress={() => Alert.alert('Bảo mật', 'Thông tin được bảo mật theo Nghị định 13/2023/NĐ-CP')}
        />
      </View>

      {/* ── Logout ── */}
      <TouchableOpacity style={st.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={st.logoutText}>🚪 Đăng xuất</Text>
      </TouchableOpacity>

      <Text style={st.versionText}>AI4Autism v1.0.0 — NBAI</Text>
      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  screenTitle: { ...typography.h2, color: colors.textDark, marginBottom: spacing.md },

  profileCard: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarLetter: { color: colors.white, fontSize: 24, fontWeight: '800' },
  profileName: { ...typography.h3, color: colors.textDark },
  profileEmail: { ...typography.caption, color: colors.textMid, marginTop: 2 },
  badge: { backgroundColor: colors.primaryBg, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { ...typography.caption, color: colors.primary, fontWeight: '700', fontSize: 10 },

  sectionTitle: {
    ...typography.caption, color: colors.textLight, fontWeight: '700',
    letterSpacing: 0.8, marginTop: spacing.md, marginBottom: spacing.xs, paddingLeft: 4,
  },

  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border,
    ...shadows.sm, marginBottom: spacing.md, overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    minHeight: 52,
  },
  settingEmoji: { fontSize: 20, marginRight: spacing.md, width: 28, textAlign: 'center' },
  settingLabel: { ...typography.body, color: colors.textDark, flex: 1 },
  settingRight: { alignItems: 'center', justifyContent: 'center' },
  settingArrow: { fontSize: 22, color: colors.textLight, fontWeight: '600' },

  comingSoonBadge: {
    backgroundColor: colors.bgSection, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: colors.borderStrong,
  },
  comingSoonText: { ...typography.caption, color: colors.textMid, fontSize: 10, fontWeight: '700' },

  logoutBtn: {
    height: 52, backgroundColor: colors.dangerBg,
    borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.danger, marginBottom: spacing.md,
  },
  logoutText: { ...typography.label, color: colors.danger, fontWeight: '700', fontSize: 15 },
  versionText: { ...typography.caption, color: colors.textLight, textAlign: 'center' },
});
