import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Spacing, Radius, Shadow } from '../../lib/theme';

interface Message {
  id: string;
  user_id: string;
  nickname: string;
  content: string;
  created_at: string;
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const flatRef = useRef<FlatList>(null);

  async function loadMessages() {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(60);
    if (data) setMessages(data.reverse().map(m => ({
      id: String(m.id), user_id: String(m.user_id ?? ''), nickname: String(m.nickname ?? ''),
      content: String(m.content ?? ''), created_at: String(m.created_at ?? ''),
    })));
  }

  useEffect(() => {
    loadMessages().finally(() => setLoading(false));

    const channel = supabase
      .channel('chat_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, payload => {
        const m = payload.new as any;
        setMessages(prev => [...prev, {
          id: String(m.id), user_id: String(m.user_id ?? ''), nickname: String(m.nickname ?? ''),
          content: String(m.content ?? ''), created_at: String(m.created_at ?? ''),
        }]);
        setTimeout(() => flatRef.current?.scrollToEnd(), 100);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function sendMessage() {
    if (!user || !text.trim()) return;
    const content = text.trim();
    setText('');
    await supabase.from('chat_messages').insert({
      user_id: user.id, nickname: user.nickname, content,
      created_at: new Date().toISOString(),
    });
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>💬 실시간 채팅</Text>
      </View>

      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={item => item.id}
        style={{ flex: 1, backgroundColor: Colors.background }}
        contentContainerStyle={{ padding: Spacing.md, gap: 8, paddingBottom: Spacing.lg }}
        onContentSizeChange={() => flatRef.current?.scrollToEnd()}
        renderItem={({ item }) => {
          const isMe = item.user_id === user?.id;
          return (
            <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
              {!isMe && <View style={styles.avatar}><Text style={styles.avatarText}>{item.nickname[0]}</Text></View>}
              <View style={[styles.bubble, isMe && styles.bubbleMe]}>
                {!isMe && <Text style={styles.msgNick}>{item.nickname}</Text>}
                <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.content}</Text>
                <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>{item.created_at.slice(11, 16)}</Text>
              </View>
            </View>
          );
        }}
      />

      <View style={[styles.inputRow, { paddingBottom: insets.bottom + Spacing.sm }]}>
        <TextInput
          style={styles.input}
          placeholder={user ? '메시지 입력...' : '로그인 후 채팅 가능'}
          value={text}
          onChangeText={setText}
          placeholderTextColor={Colors.textMuted}
          editable={!!user}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage} disabled={!text.trim()}>
          <Text style={styles.sendIcon}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { marginRight: Spacing.sm, padding: 4 },
  backIcon: { fontSize: 22, color: Colors.primary, fontWeight: '600' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '900', color: Colors.textPrimary },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowMe: { flexDirection: 'row-reverse' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  bubble: { maxWidth: '72%', backgroundColor: Colors.surface, borderRadius: Radius.lg, borderBottomLeftRadius: 4, paddingHorizontal: 12, paddingVertical: 8, ...Shadow.sm },
  bubbleMe: { backgroundColor: Colors.primary, borderBottomLeftRadius: Radius.lg, borderBottomRightRadius: 4 },
  msgNick: { fontSize: 11, fontWeight: '700', color: Colors.primary, marginBottom: 3 },
  msgText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  msgTextMe: { color: '#fff' },
  msgTime: { fontSize: 10, color: Colors.textMuted, marginTop: 4, textAlign: 'right' },
  msgTimeMe: { color: 'rgba(255,255,255,0.7)' },
  inputRow: { backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, gap: 8 },
  input: { flex: 1, backgroundColor: Colors.background, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: 14, color: Colors.textPrimary, maxHeight: 100, borderWidth: 1, borderColor: Colors.border },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', ...Shadow.sm },
  sendIcon: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
