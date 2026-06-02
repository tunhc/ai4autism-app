import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { colors, radius, spacing, shadows } from '../../lib/colors';
import { typography } from '../../lib/typography';
import { useAuth } from '../../contexts/AuthContext';
import { getNotifications, markAllNotificationsRead } from '../../lib/supabase';

// Mock messages for UI layout
const MOCK_MESSAGES = [
  { id: 'm1', parentName: 'Mẹ bé Minh Anh', message: 'Cô ơi, tối qua bé An tự nói được từ "quả táo" rồi ạ! Nhờ cô kiểm tra thêm ở lớp xem bé nói lại được không cô nhé.', time: '2 giờ trước', isRead: false },
  { id: 'm2', parentName: 'Bố bé Gia Khoa', message: 'Hôm nay gia đình cho bé đi học muộn 15 phút do kẹt xe cô nhé. Nhờ cô chú ý cho bé ăn sáng giúp em ạ.', time: '5 giờ trước', isRead: false },
  { id: 'm3', parentName: 'Mẹ bé Thùy Linh', message: 'Bé Linh tối qua ngủ không ngon, sáng ra có vẻ cáu gắt. Nhờ cô quan sát và dỗ bé giúp gia đình nhé.', time: '1 ngày trước', isRead: true },
];

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 60)  return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

export default function TeacherMessagesScreen({ navigation }) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState({});

  const loadData = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const notifs = await getNotifications(profile.id);
      if (notifs && notifs.length > 0) {
        setMessages(notifs.map(n => ({
          id: n.id,
          parentName: n.sender_name || n.from_name || n.title || 'Phụ huynh',
          message: n.body || n.message || n.content || '',
          time: formatRelativeTime(n.created_at),
          isRead: n.is_read ?? false,
        })));
      } else {
        setMessages(MOCK_MESSAGES);
      }
    } catch {
      setMessages(MOCK_MESSAGES);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleMarkAllRead = async () => {
    setMessages(prev => prev.map(m => ({ ...m, isRead: true })));
    if (profile?.id) {
      try { await markAllNotificationsRead(profile.id); } catch { }
    }
  };

  const handleSendReply = (msgId) => {
    const txt = replyText[msgId];
    if (!txt?.trim()) return;
    
    // Xử lý gửi tin nhắn ở đây
    
    // Xóa text sau khi gửi
    setReplyText(prev => ({ ...prev, [msgId]: '' }));
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.secondary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* ══ Header ══ */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={{ fontSize: 24, color: colors.textDark }}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Tin nhắn phụ huynh</Text>
        </View>
        <TouchableOpacity style={styles.markReadBtn} onPress={handleMarkAllRead}>
          <Text style={styles.markReadText}>Đã đọc hết</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {messages.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Chưa có tin nhắn nào từ phụ huynh.</Text>
            </View>
          ) : (
            messages.map((msg) => (
              <View key={msg.id} style={[styles.msgCard, !msg.isRead && styles.msgCardUnread]}>
                <View style={styles.msgHeader}>
                  <View style={styles.avatarWrap}>
                    <Text style={{ fontSize: 18 }}>👨‍👩‍👦</Text>
                  </View>
                  <View style={styles.msgMeta}>
                    <Text style={styles.parentName}>{msg.parentName}</Text>
                    <Text style={styles.msgTime}>{msg.time}</Text>
                  </View>
                  {!msg.isRead && <View style={styles.unreadBadge}><Text style={styles.unreadText}>MỚI</Text></View>}
                </View>

                <View style={styles.msgBubble}>
                  <Text style={styles.msgText}>{msg.message}</Text>
                </View>

                <View style={styles.replyArea}>
                  <TextInput
                    style={styles.replyInput}
                    placeholder="Nhập tin nhắn phản hồi..."
                    placeholderTextColor={colors.textLight}
                    value={replyText[msg.id] || ''}
                    onChangeText={(t) => setReplyText({ ...replyText, [msg.id]: t })}
                    multiline
                  />
                  <TouchableOpacity 
                    style={[styles.sendBtn, !replyText[msg.id]?.trim() && { opacity: 0.5 }]} 
                    onPress={() => handleSendReply(msg.id)}
                    disabled={!replyText[msg.id]?.trim()}
                  >
                    <Text style={{ fontSize: 16 }}>📤</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: 56, paddingBottom: spacing.sm,
    backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.border
  },
  backBtn: { padding: spacing.sm },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { ...typography.h3, fontWeight: '700', color: colors.textDark },
  markReadBtn: { padding: spacing.sm },
  markReadText: { ...typography.caption, color: colors.secondaryDark, fontWeight: '600' },
  
  scroll: { padding: spacing.md },
  emptyCard: { padding: spacing.xl, alignItems: 'center' },
  emptyText: { ...typography.body, color: colors.textLight },

  msgCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadows.sm
  },
  msgCardUnread: { borderColor: colors.secondaryLight, backgroundColor: '#F0FDFA' }, // Light emerald bg
  msgHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  avatarWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgMuted, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  msgMeta: { flex: 1 },
  parentName: { ...typography.bodySm, fontWeight: '700', color: colors.textDark },
  msgTime: { fontSize: 10, color: colors.textLight, marginTop: 2 },
  unreadBadge: { backgroundColor: colors.secondary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  unreadText: { fontSize: 9, fontWeight: '800', color: colors.white },
  
  msgBubble: { backgroundColor: colors.bg, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  msgText: { ...typography.bodySm, color: colors.textMid, lineHeight: 20 },
  
  replyArea: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing.md, gap: spacing.xs },
  replyInput: {
    flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.sm, minHeight: 40, maxHeight: 100,
    fontSize: 13, color: colors.textDark
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.secondaryBg,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.secondaryLight
  }
});
