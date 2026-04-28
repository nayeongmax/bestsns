import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Spacing, Radius, Shadow } from '../../lib/theme';

const CATEGORIES = ['유튜브', '수익화', '마케팅', '자유'];
const CAT_ICONS: Record<string, string> = { '유튜브': '▶️', '수익화': '💰', '마케팅': '📣', '자유': '💬' };

export default function BoardWriteScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuth();
  const [category, setCategory] = useState('자유');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!user) { Alert.alert('로그인 필요'); return; }
    if (!title.trim()) { Alert.alert('제목 입력 필요'); return; }
    if (!content.trim()) { Alert.alert('내용 입력 필요'); return; }
    setSubmitting(true);
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const dateStr = kst.toISOString().replace('T', ' ').slice(0, 19);
    const { error } = await supabase.from('site_posts').insert({
      id: `post_${Date.now()}`,
      category,
      title: title.trim(),
      content: content.trim(),
      author: user.nickname,
      author_id: user.id,
      date: dateStr,
      views: 0,
      likes_count: 0,
      images: [],
      attachments: [],
      is_deleted: false,
    });
    if (error) Alert.alert('작성 실패', error.message);
    else { Alert.alert('✅ 게시글 등록 완료!'); navigation.goBack(); }
    setSubmitting(false);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>✏️ 글쓰기</Text>
        <TouchableOpacity style={styles.submitHeaderBtn} onPress={submit} disabled={submitting}>
          {submitting ? <ActivityIndicator color={Colors.primary} size="small" /> : <Text style={styles.submitHeaderText}>등록</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1, backgroundColor: Colors.background }} contentContainerStyle={{ padding: Spacing.md, paddingBottom: insets.bottom + 100 }}>
        {/* Category */}
        <Text style={styles.label}>📂 카테고리</Text>
        <View style={styles.catRow}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity key={cat} style={[styles.catBtn, category === cat && styles.catBtnActive]} onPress={() => setCategory(cat)}>
              <Text style={[styles.catText, category === cat && styles.catTextActive]}>{CAT_ICONS[cat]} {cat}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Title */}
        <Text style={styles.label}>📝 제목</Text>
        <TextInput
          style={styles.titleInput}
          placeholder="제목을 입력하세요"
          value={title}
          onChangeText={setTitle}
          placeholderTextColor={Colors.textMuted}
          maxLength={100}
        />

        {/* Content */}
        <Text style={styles.label}>💬 내용</Text>
        <TextInput
          style={styles.contentInput}
          placeholder="내용을 입력하세요..."
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
          placeholderTextColor={Colors.textMuted}
        />

        <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={submitting}>
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitText}>✅ 게시글 등록</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { marginRight: Spacing.sm, padding: 4 },
  backIcon: { fontSize: 22, color: Colors.primary, fontWeight: '600' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  submitHeaderBtn: { padding: 8 },
  submitHeaderText: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  label: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginBottom: 8, marginTop: Spacing.sm },
  catRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md, flexWrap: 'wrap' },
  catBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border },
  catBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  catTextActive: { color: '#fff' },
  titleInput: { backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 16, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  contentInput: { backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 15, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, minHeight: 250, marginTop: Spacing.sm, ...Shadow.sm },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.xl, ...Shadow.md },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
