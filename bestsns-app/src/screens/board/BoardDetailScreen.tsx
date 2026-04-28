import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Spacing, Radius, Shadow } from '../../lib/theme';
import type { RootStackParamList } from '../../navigation/types';
import type { Post, PostComment } from '../../types';

type Route = RouteProp<RootStackParamList, 'BoardDetail'>;

export default function BoardDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { params } = useRoute<Route>();
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [liked, setLiked] = useState(false);

  async function load() {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from('site_posts').select('*').eq('id', params.postId).single(),
      supabase.from('site_post_comments').select('*').eq('post_id', params.postId).order('created_at'),
    ]);
    if (p) {
      setPost({
        id: String(p.id), category: String(p.category ?? ''), title: String(p.title ?? ''),
        content: String(p.content ?? ''), author: String(p.author ?? ''), author_id: String(p.author_id ?? ''),
        date: String(p.date ?? ''), views: Number(p.views ?? 0), likes_count: Number(p.likes_count ?? 0),
        images: [], is_deleted: Boolean(p.is_deleted),
      });
      await supabase.from('site_posts').update({ views: (p.views ?? 0) + 1 }).eq('id', params.postId);
    }
    if (c) {
      setComments(c.map(cm => ({
        id: String(cm.id), post_id: String(cm.post_id ?? ''), author: String(cm.author ?? ''),
        author_id: String(cm.author_id ?? ''), content: String(cm.content ?? ''),
        created_at: String(cm.created_at ?? ''), likes: Number(cm.likes ?? 0),
      })));
    }
  }

  useEffect(() => { load().finally(() => setLoading(false)); }, [params.postId]);

  async function submitComment() {
    if (!user) { Alert.alert('로그인 필요', '댓글은 로그인 후 작성 가능합니다.'); return; }
    if (!comment.trim()) return;
    setSubmitting(true);
    await supabase.from('site_post_comments').insert({
      post_id: params.postId,
      author: user.nickname,
      author_id: user.id,
      content: comment.trim(),
      created_at: new Date().toISOString(),
    });
    setComment('');
    await load();
    setSubmitting(false);
  }

  async function toggleLike() {
    if (!post) return;
    const newLikes = liked ? post.likes_count - 1 : post.likes_count + 1;
    await supabase.from('site_posts').update({ likes_count: newLikes }).eq('id', post.id);
    setPost({ ...post, likes_count: newLikes });
    setLiked(!liked);
  }

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );

  if (!post) return (
    <View style={styles.center}>
      <Text style={styles.notFound}>게시글을 찾을 수 없습니다</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{post.title}</Text>
      </View>

      <ScrollView style={{ flex: 1, backgroundColor: Colors.background }} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        {/* Post */}
        <View style={styles.postCard}>
          <View style={styles.catRow}>
            <View style={styles.catPill}>
              <Text style={styles.catText}>{post.category}</Text>
            </View>
          </View>
          <Text style={styles.postTitle}>{post.title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>✍️ {post.author}</Text>
            <Text style={styles.metaText}>📅 {post.date.slice(0, 10)}</Text>
            <Text style={styles.metaText}>👁 {post.views}</Text>
          </View>
          <View style={styles.divider} />
          <Text style={styles.content}>{post.content}</Text>

          {/* Like */}
          <TouchableOpacity style={[styles.likeBtn, liked && styles.likeBtnActive]} onPress={toggleLike}>
            <Text style={[styles.likeBtnText, liked && styles.likeBtnTextActive]}>
              {liked ? '❤️' : '🤍'} 좋아요 {post.likes_count}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Comments */}
        <View style={{ paddingHorizontal: Spacing.md }}>
          <Text style={styles.commentTitle}>💬 댓글 {comments.length}</Text>
          {comments.map(cm => (
            <View key={cm.id} style={styles.commentCard}>
              <View style={styles.commentHeader}>
                <Text style={styles.commentAuthor}>😊 {cm.author}</Text>
                <Text style={styles.commentDate}>{cm.created_at.slice(0, 10)}</Text>
              </View>
              <Text style={styles.commentContent}>{cm.content}</Text>
            </View>
          ))}
          {comments.length === 0 && (
            <Text style={styles.noComment}>첫 번째 댓글을 남겨보세요 ✨</Text>
          )}
        </View>
      </ScrollView>

      {/* Comment Input */}
      <View style={[styles.commentInput, { paddingBottom: insets.bottom + Spacing.sm }]}>
        <TextInput
          style={styles.commentTextInput}
          placeholder={user ? '댓글 작성...' : '로그인 후 댓글 작성 가능'}
          value={comment}
          onChangeText={setComment}
          multiline
          placeholderTextColor={Colors.textMuted}
          editable={!!user}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={submitComment} disabled={submitting || !comment.trim()}>
          {submitting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.sendIcon}>↑</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  notFound: { fontSize: 16, color: Colors.textSecondary },
  header: { backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { marginRight: Spacing.sm, padding: 4 },
  backIcon: { fontSize: 22, color: Colors.primary, fontWeight: '600' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  postCard: { backgroundColor: Colors.surface, margin: Spacing.md, borderRadius: Radius.lg, padding: Spacing.lg, ...Shadow.sm },
  catRow: { flexDirection: 'row', marginBottom: Spacing.sm },
  catPill: { backgroundColor: Colors.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  catText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  postTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, lineHeight: 26 },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 8, flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: Colors.textMuted },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  content: { fontSize: 15, color: Colors.textPrimary, lineHeight: 24, whiteSpace: 'pre-wrap' } as any,
  likeBtn: { flexDirection: 'row', alignSelf: 'center', marginTop: Spacing.lg, paddingHorizontal: 24, paddingVertical: 10, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border },
  likeBtnActive: { backgroundColor: '#FFE4E4', borderColor: Colors.hot },
  likeBtnText: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  likeBtnTextActive: { color: Colors.hot },
  commentTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.sm },
  commentCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  commentAuthor: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  commentDate: { fontSize: 11, color: Colors.textMuted },
  commentContent: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  noComment: { textAlign: 'center', color: Colors.textMuted, fontSize: 14, paddingVertical: Spacing.lg },
  commentInput: { backgroundColor: Colors.surface, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  commentTextInput: { flex: 1, backgroundColor: Colors.background, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: 14, color: Colors.textPrimary, maxHeight: 100, borderWidth: 1, borderColor: Colors.border },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
