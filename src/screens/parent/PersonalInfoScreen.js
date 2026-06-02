import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { colors, radius, shadows, spacing } from '../../lib/colors';
import { typography } from '../../lib/typography';

function Field({ label, value, onChangeText, placeholder, keyboardType }) {
  return (
    <View style={st.field}>
      <Text style={st.label}>{label}</Text>
      <TextInput
        style={st.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        keyboardType={keyboardType || 'default'}
        autoCapitalize="none"
      />
    </View>
  );
}

export default function PersonalInfoScreen({ navigation }) {
  const { user, profile, session, refreshUser } = useAuth();
  const userId = session?.user?.id || user?.id || profile?.id;

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name:         user?.full_name         || profile?.full_name         || '',
    email:             user?.email             || profile?.email             || '',
    phone:             user?.phone             || profile?.phone             || '',
    permanent_address: user?.permanent_address || profile?.permanent_address || '',
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  async function handleSave() {
    if (!userId) return;
    if (!form.full_name.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập họ tên.');
      return;
    }
    if (!form.email.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập email.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name:         form.full_name.trim(),
          email:             form.email.trim().toLowerCase(),
          phone:             form.phone.trim()             || null,
          permanent_address: form.permanent_address.trim() || null,
          updated_at:        new Date().toISOString(),
        })
        .eq('id', userId);
      if (error) throw error;
      await refreshUser?.();
      Alert.alert('Đã lưu', 'Thông tin cá nhân đã được cập nhật.');
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể lưu thông tin. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={st.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={st.header}>
          <TouchableOpacity style={st.backBtn} onPress={() => navigation.goBack()}>
            <Text style={st.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={st.title}>Thông tin cá nhân</Text>
          <View style={st.backBtn} />
        </View>

        {/* Form */}
        <View style={st.card}>
          <Text style={st.sectionTitle}>Phụ huynh</Text>
          <Field label="Họ tên"       value={form.full_name}         onChangeText={v => set('full_name', v)} />
          <Field label="Email"         value={form.email}             onChangeText={v => set('email', v)} keyboardType="email-address" />
          <Field label="Số điện thoại" value={form.phone}             onChangeText={v => set('phone', v)} keyboardType="phone-pad" />
          <Field label="Địa chỉ"       value={form.permanent_address} onChangeText={v => set('permanent_address', v)} />
        </View>

        <TouchableOpacity
          style={[st.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color={colors.white} />
            : <Text style={st.saveText}>Lưu thay đổi</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },

  header:   { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  backBtn:  { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 34, color: colors.textDark, lineHeight: 36 },
  title:    { ...typography.h2, color: colors.textDark, flex: 1, textAlign: 'center' },

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

  field: { marginBottom: spacing.md },
  label: { ...typography.label, color: colors.textDark, fontWeight: '700', marginBottom: 6 },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgMuted,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.textDark,
  },

  saveBtn: {
    height: 52, borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.sm,
  },
  saveText: { ...typography.btn, color: colors.white, fontSize: 16 },
});
