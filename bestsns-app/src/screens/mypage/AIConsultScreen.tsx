import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors, Spacing, Radius, Shadow } from '../../lib/theme';

interface ChatMsg { role: 'user' | 'ai'; text: string }

const QUICK_PROMPTS = [
  '📈 SNS 팔로워 늘리는 법',
  '💰 유튜브 수익화 방법',
  '📣 인스타 마케팅 전략',
  '💼 부업 추천해줘',
];

export default function AIConsultScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'ai', text: '안녕하세요! 🤖 SNS 마케팅 · 수익화 전문 AI 어드바이저입니다.\n무엇이든 물어보세요!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const userMsg = text.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd(), 100);

    try {
      const res = await fetch('/api/ai-consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'ai', text: data.reply ?? '답변을 가져올 수 없습니다.' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: '⚠️ 네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd(), 100);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🤖 AI 마케팅 상담</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: Colors.background }}
        contentContainerStyle={{ padding: Spacing.md, gap: 12, paddingBottom: Spacing.lg }}
      >
        {messages.map((msg, idx) => (
          <View key={idx} style={[styles.msgRow, msg.role === 'user' && styles.msgRowUser]}>
            {msg.role === 'ai' && <Text style={styles.aiAvatar}>🤖</Text>}
            <View style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              <Text style={[styles.bubbleText, msg.role === 'user' && styles.userText]}>{msg.text}</Text>
            </View>
          </View>
        ))}
        {loading && (
          <View style={styles.msgRow}>
            <Text style={styles.aiAvatar}>🤖</Text>
            <View style={styles.aiBubble}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          </View>
        )}

        {/* Quick prompts */}
        {messages.length === 1 && (
          <View style={styles.quickPrompts}>
            {QUICK_PROMPTS.map(p => (
              <TouchableOpacity key={p} style={styles.quickBtn} onPress={() => sendMessage(p)}>
                <Text style={styles.quickText}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={[styles.inputRow, { paddingBottom: insets.bottom + Spacing.sm }]}>
        <TextInput
          style={styles.input}
          placeholder="마케팅 · 수익화 질문하기..."
          value={input}
          onChangeText={setInput}
          placeholderTextColor={Colors.textMuted}
          multiline
        />
        <TouchableOpacity style={[styles.sendBtn, loading && styles.sendBtnDisabled]} onPress={() => sendMessage(input)} disabled={loading || !input.trim()}>
          <Text style={styles.sendIcon}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { marginRight: Spacing.sm, padding: 4 },
  backIcon: { fontSize: 22, color: Colors.primary, fontWeight: '600' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '900', color: Colors.textPrimary },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowUser: { flexDirection: 'row-reverse' },
  aiAvatar: { fontSize: 28, width: 36 },
  bubble: { maxWidth: '78%', borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 10 },
  aiBubble: { backgroundColor: Colors.surface, borderBottomLeftRadius: 4, ...Shadow.sm },
  userBubble: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 21 },
  userText: { color: '#fff' },
  quickPrompts: { gap: 8, marginTop: Spacing.sm },
  quickBtn: { backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border },
  quickText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  inputRow: { backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, gap: 8 },
  input: { flex: 1, backgroundColor: Colors.background, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: 14, color: Colors.textPrimary, maxHeight: 100, borderWidth: 1, borderColor: Colors.border },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', ...Shadow.sm },
  sendBtnDisabled: { opacity: 0.5 },
  sendIcon: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
