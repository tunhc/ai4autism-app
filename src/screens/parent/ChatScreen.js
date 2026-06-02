import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { getChildrenByParent, getPrimaryVstProfile } from '../../lib/supabase';
import { colors, radius, shadows, spacing } from '../../lib/colors';
import { typography } from '../../lib/typography';

const INITIAL_MESSAGES = [
  {
    id: '1',
    role: 'assistant',
    content: 'Xin chào! Tôi là VST AI — trợ lý đồng hành cùng bé trên hành trình phát triển. Bạn muốn hỏi điều gì về bé hôm nay? 😊',
    created_at: new Date().toISOString(),
  },
];

const QUICK_PROMPTS = [
  'Hôm nay bé như thế nào?',
  'Bé có tiến bộ gì tuần này?',
  'Tôi nên làm gì khi bé ăn vạ?',
  'Bài tập hôm nay cho bé là gì?',
];

function ChatBubble({ msg, vstProfile }) {
  const isUser = msg.role === 'user';
  const d = new Date(msg.created_at);
  const timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  return (
    <View style={[st.bubbleWrap, isUser ? st.bubbleWrapUser : st.bubbleWrapBot]}>
      {!isUser && (
        <View style={st.botAvatar}>
          {vstProfile?.avatar_url ? (
            <Image source={{ uri: vstProfile.avatar_url }} style={st.avatarImage} />
          ) : (
            <Text style={{ fontSize: 18 }}>👩‍🏫</Text>
          )}
        </View>
      )}
      <View style={{ maxWidth: '80%' }}>
        <View style={[st.bubble, isUser ? st.bubbleUser : st.bubbleBot]}>
          <Text style={[st.bubbleText, isUser && { color: colors.white }]}>{msg.content}</Text>
        </View>
        <Text style={[st.timeText, isUser && { textAlign: 'right' }]}>{timeStr}</Text>
      </View>
    </View>
  );
}

export default function ChatScreen({ navigation }) {
  const { user } = useAuth();
  const [child, setChild] = useState(null);
  const [vstProfile, setVstProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    async function loadVstData() {
      try {
        if (!user?.id) return;
        const childrenList = await getChildrenByParent(user.id);
        if (childrenList && childrenList.length > 0) {
          const activeChild = childrenList[0];
          setChild(activeChild);
          
          // Lấy VST Profile của giáo viên chính (is_primary = true)
          const profile = await getPrimaryVstProfile(activeChild.id);
          setVstProfile(profile);
          
          const childName = activeChild.nickname || activeChild.full_name.split(' ').pop();
          const greetingText = profile
            ? `Xin chào! Tôi là ${profile.vst_name} (Bản sao số VST AI của giáo viên). Tôi sẽ đồng hành cùng ba mẹ để thảo luận và đưa ra các lời khuyên hỗ trợ bé ${childName} dựa trên phong cách giảng dạy thực tế của tôi. Bạn muốn hỏi điều gì hôm nay? 😊`
            : `Xin chào! Tôi là VST AI — trợ lý đồng hành cùng bé ${childName} trên hành trình phát triển. Bạn muốn hỏi điều gì về bé hôm nay? 😊`;

          setMessages([
            {
              id: '1',
              role: 'assistant',
              content: greetingText,
              created_at: new Date().toISOString(),
            }
          ]);
        } else {
          setMessages([
            {
              id: '1',
              role: 'assistant',
              content: 'Xin chào! Tôi là VST AI — trợ lý đồng hành cùng bé trên hành trình phát triển. Bạn muốn hỏi điều gì về bé hôm nay? 😊',
              created_at: new Date().toISOString(),
            }
          ]);
        }
      } catch (e) {
        console.error('Error loading VST data:', e);
      } finally {
        setLoading(false);
      }
    }
    loadVstData();
  }, [user]);

  async function sendMessage(text = input.trim()) {
    if (!text) return;
    setInput('');
    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    // Simulate AI response
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));

    const botMsg = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: generateMockResponse(text),
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, botMsg]);
    setIsTyping(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }

  if (loading) {
    return (
      <View style={[st.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const vstName = vstProfile?.vst_name || 'Cô Vy (VST AI)';
  const displayTitle = vstProfile?.display_title || 'Giáo viên can thiệp sớm';

  return (
    <View style={st.root}>
      {/* ── Header ── */}
      <View style={st.header}>
        <View style={st.vstAvatar}>
          {vstProfile?.avatar_url ? (
            <Image source={{ uri: vstProfile.avatar_url }} style={st.headerAvatarImage} />
          ) : (
            <Text style={{ fontSize: 24 }}>👩‍🏫</Text>
          )}
        </View>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={st.headerTitle}>{vstName}</Text>
          <Text style={st.headerSub}>{displayTitle}</Text>
        </View>
        <View style={st.onlineBadge}>
          <View style={st.onlineDot} />
          <Text style={st.onlineText}>Online</Text>
        </View>
        <TouchableOpacity
          style={st.closeBtn}
          onPress={() => navigation?.navigate?.('TrangChu')}
          activeOpacity={0.7}
        >
          <Text style={st.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* ── Messages ── */}
      <ScrollView
        ref={scrollRef}
        style={st.messageArea}
        contentContainerStyle={{ padding: spacing.md }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {messages.map(m => <ChatBubble key={m.id} msg={m} vstProfile={vstProfile} />)}
        {isTyping && (
          <View style={[st.bubbleWrap, st.bubbleWrapBot]}>
            <View style={st.botAvatar}>
              {vstProfile?.avatar_url ? (
                <Image source={{ uri: vstProfile.avatar_url }} style={st.avatarImage} />
              ) : (
                <Text style={{ fontSize: 18 }}>👩‍🏫</Text>
              )}
            </View>
            <View style={[st.bubble, st.bubbleBot, { paddingHorizontal: spacing.md }]}>
              <Text style={{ color: colors.textLight, letterSpacing: 4 }}>• • •</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Quick prompts ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={st.quickPromptsBar}
        contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 8 }}
      >
        {QUICK_PROMPTS.map(p => (
          <TouchableOpacity key={p} style={st.quickChip} onPress={() => sendMessage(p)}>
            <Text style={st.quickChipText}>{p}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Input bar ── */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={st.inputBar}>
          <TouchableOpacity style={st.voiceBtn}>
            <Text style={{ fontSize: 22 }}>🎤</Text>
          </TouchableOpacity>
          <TextInput
            style={st.input}
            placeholder="Nhập câu hỏi của bạn..."
            placeholderTextColor={colors.textLight}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            onSubmitEditing={() => sendMessage()}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[st.sendBtn, !input.trim() && { opacity: 0.4 }]}
            onPress={() => sendMessage()}
            disabled={!input.trim()}
          >
            <Text style={{ fontSize: 20 }}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function generateMockResponse(text) {
  const lower = text.toLowerCase();
  if (lower.includes('tiến bộ') || lower.includes('tiến trình')) {
    return 'Bé đang tiến bộ rất tốt! Điểm hpDT tổng hợp tăng từ 52 lên 67 trong 4 tuần gần nhất. Lĩnh vực Giao tiếp có sự cải thiện đáng kể nhất (+8 điểm). Tiếp tục duy trì các hoạt động đọc sách và hát bài hát quen thuộc mỗi ngày nhé! 🌟';
  }
  if (lower.includes('ăn vạ') || lower.includes('khó chịu') || lower.includes('meltdown')) {
    return 'Khi bé ăn vạ, hãy: (1) Giữ bình tĩnh — bé cảm nhận được cảm xúc của bạn. (2) Giảm kích thích: đưa bé ra khỏi môi trường ồn ào. (3) Dùng ngôn ngữ đơn giản: "Con đang tức à? Bình tĩnh nào." (4) Thử kỹ thuật thở 4-4-4 cùng bé. Xem phần SOS để có hướng dẫn chi tiết hơn 💪';
  }
  if (lower.includes('bài tập') || lower.includes('hoạt động')) {
    return 'Hôm nay bé có 3 hoạt động tại nhà: Đọc sách 10 phút (Giao tiếp), Chơi đất nặn (Cảm giác), và Hát bài hát quen thuộc (Nhận thức). Bạn có muốn tôi hướng dẫn chi tiết cách thực hiện bất kỳ hoạt động nào không? 📚';
  }
  return 'Cảm ơn bạn đã chia sẻ! Tôi đang phân tích thông tin về bé để đưa ra lời khuyên phù hợp nhất. Nếu bạn có câu hỏi cụ thể về các lĩnh vực phát triển như Giao tiếp, Xã hội, hay Cảm giác, hãy hỏi tôi nhé! 😊';
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.md,
    backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.border,
    ...shadows.sm,
  },
  vstAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primaryBg, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.primary,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  headerTitle: { ...typography.label, color: colors.textDark, fontWeight: '700' },
  headerSub: { ...typography.caption, color: colors.textMid, marginTop: 1 },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: spacing.sm },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  onlineText: { ...typography.caption, color: colors.success, fontWeight: '700' },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.bgMuted, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.border,
  },
  closeBtnText: { fontSize: 15, color: colors.textMid, fontWeight: '700' },

  messageArea: { flex: 1 },

  bubbleWrap: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing.sm },
  bubbleWrapUser: { justifyContent: 'flex-end' },
  bubbleWrapBot: { justifyContent: 'flex-start' },
  botAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primaryBg, alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.xs,
  },
  bubble: { borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubbleUser: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleText: { ...typography.body, color: colors.textDark, lineHeight: 22 },
  timeText: { ...typography.caption, color: colors.textLight, marginTop: 2, fontSize: 10, paddingHorizontal: 4 },

  quickPromptsBar: {
    maxHeight: 48, borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.bgCard, paddingVertical: 8,
  },
  quickChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primaryBg,
  },
  quickChipText: { ...typography.caption, color: colors.primary, fontWeight: '600', fontSize: 12 },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.bgCard, borderTopWidth: 1, borderTopColor: colors.border,
    paddingBottom: Platform.OS === 'ios' ? 28 : spacing.sm,
  },
  voiceBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1, minHeight: 44, maxHeight: 100,
    backgroundColor: colors.bgMuted, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    ...typography.body, color: colors.textDark,
  },
  sendBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
