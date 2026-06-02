import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { getChildrenByParent, getParentJournalEntries } from '../../lib/supabase';
import { colors, radius, spacing, shadows } from '../../lib/colors';
import { typography } from '../../lib/typography';

export default function JournalScreen({ navigation, route }) {
  const { user, session } = useAuth();
  const [child, setChild] = useState(route?.params?.child || null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const userId = session?.user?.id || user?.id;
      let activeChild = child;
      if (!activeChild && userId) {
        const children = await getChildrenByParent(userId);
        activeChild = children?.[0] || null;
        setChild(activeChild);
      }
      setEntries(activeChild?.id ? await getParentJournalEntries(activeChild.id, 30) : []);
    } catch (error) {
      console.warn('Journal load error:', error.message);
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [child, session, user]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return <View style={styles.loadingWrap}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
    >
      {navigation?.goBack && (
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Quay lại</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.screenTitle}>Nhật ký</Text>
      {child && <Text style={styles.screenSub}>{child.full_name || child.nickname}</Text>}

      {entries.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyTitle}>Chưa có nhật ký</Text>
          <Text style={styles.emptySub}>Các ghi chú hằng ngày của phụ huynh sẽ được hiển thị tại đây.</Text>
        </View>
      ) : entries.map(entry => {
        const date = entry.entry_date ? new Date(entry.entry_date) : null;
        return (
          <View key={entry.id} style={styles.entryCard}>
            <View style={styles.entryHead}>
              <Text style={styles.entryDate}>{date ? date.toLocaleDateString('vi-VN') : 'Không rõ ngày'}</Text>
              {!!entry.mood_tags?.[0] && <Text style={styles.entryMood}>{entry.mood_tags[0]}</Text>}
            </View>
            {!!entry.activity_tags?.[0] && <Text style={styles.entryActivity}>{entry.activity_tags[0]}</Text>}
            <Text style={styles.entryContent}>{entry.content || 'Không có nội dung.'}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  backBtn: { alignSelf: 'flex-start', marginBottom: spacing.md },
  backText: { ...typography.bodySm, color: colors.primary, fontWeight: '600' },
  screenTitle: { ...typography.h2, color: colors.textDark },
  screenSub: { ...typography.bodySm, color: colors.textMid, marginTop: 2, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    padding: spacing.xl, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, ...shadows.sm,
  },
  emptyTitle: { ...typography.h4, color: colors.textDark, marginBottom: spacing.sm },
  emptySub: { ...typography.body, color: colors.textLight, textAlign: 'center', lineHeight: 20 },
  entryCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
    ...shadows.sm, marginBottom: spacing.md,
  },
  entryHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  entryDate: { ...typography.label, color: colors.textDark, fontWeight: '700' },
  entryMood: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  entryActivity: { ...typography.caption, color: colors.textLight, marginBottom: spacing.sm },
  entryContent: { ...typography.body, color: colors.textMid, lineHeight: 21 },
});
