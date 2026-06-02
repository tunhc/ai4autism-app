import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { colors, radius, spacing, shadows } from '../../lib/colors';
import { typography } from '../../lib/typography';
import { useAuth } from '../../contexts/AuthContext';

export default function VideoUploadScreen({ navigation, route }) {
  const { profile } = useAuth();
  const child = route?.params?.child;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Quay lại</Text>
        </TouchableOpacity>
      </View>

      {/* Hero */}
      <View style={[styles.hero, { backgroundColor: colors.primaryBg }]}>
        <Text style={styles.heroEmoji}>📹</Text>
        <Text style={styles.heroTitle}>Tải video quan sát</Text>
        <Text style={styles.heroSubtitle}>Quay và tải video để AI phân tích sự phát triển của bé</Text>
      </View>

      {/* Coming soon */}
      <View style={styles.card}>
        <Text style={styles.comingSoon}>🚧 Đang xây dựng...</Text>
        <Text style={styles.comingSoonSub}>
          Tính năng này sẽ sớm ra mắt trong phiên bản tiếp theo.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.xxxl },

  header: { marginBottom: spacing.md },
  backBtn: { alignSelf: 'flex-start' },
  backText: { ...typography.bodySm, color: colors.primary, fontWeight: '600' },

  hero: {
    borderRadius: radius.xl, padding: spacing.xl,
    alignItems: 'center', marginBottom: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  heroEmoji: { fontSize: 48, marginBottom: spacing.sm },
  heroTitle: { ...typography.h3, color: colors.textDark, textAlign: 'center' },
  heroSubtitle: { ...typography.body, color: colors.textMid, textAlign: 'center', marginTop: 6, lineHeight: 20 },

  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    padding: spacing.xl, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, ...shadows.sm,
  },
  comingSoon: { ...typography.h4, color: colors.textDark, marginBottom: spacing.sm },
  comingSoonSub: { ...typography.body, color: colors.textLight, textAlign: 'center', lineHeight: 20 },
});
