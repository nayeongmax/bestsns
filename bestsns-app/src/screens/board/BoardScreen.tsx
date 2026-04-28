import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, TextInput, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Spacing, Radius, Shadow } from '../../lib/theme';
import type { RootStackParamList } from '../../navigation/types';
import type { Post } from '../../types';

const CATEGORIES = ['전체', '유튜브', '수익화', '마케팅', '자유'];
const CAT_ICONS: Record<string, string> = {
  '전체': '📋', '유튜브': '▶️', '수익화': '💰', '마케팅': '📣', '자유': '💬',
};

export default function BoardScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState('전체');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  async function load(reset = false) {
    const offset = reset ? 0 : page * PAGE_SIZE;
    let query = supabase
      .from('site_posts')
      .select('*')
      .eq('is_deleted', false)
      .order('date', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (category !== '전체') query = query.eq('category', category);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data } = await query;
    if (data) {
      const mapped: Post[] = data.map(p => ({
        id: String(p.id),
        category: String(p.category ?? '자유'),
        title: String(p.title ?? ''),
        content: String(p.content ?? ''),
        author: String(p.author ?? ''),
        author_id: String(p.author_id ?? ''),
        author_image: p.author_image ?? null,
        date: String(p.date ?? ''),
        views: Number(p.views ?? 0),
        likes_count: Number(p.likes_count ?? 0),
        images: Array.isArray(p.images) ? p.images : [],
        is_deleted: Boolean(p.is_deleted),
      }));
      if (reset) setPosts(mapped);
      else setPosts(prev => [...prev, ...mapped]);
    }
  }

  useEffect(() => {
    setPage(0);
    load(true).finally(() => setLoading(false));
  }, [category, search]);

  async function onRefresh() {
    setRefreshing(true);
    setPage(0);
    await load(true);
    setRefreshing(false);
  }

  const hotPosts = [...posts].sort((a, b) => b.likes_count - a.likes_count).slice(0, 2);

  const ListHeader = () => (
    <>
      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="게시글 검색..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      {/* Categories */}
      <View style={styles.catRow}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.catBtn, category === cat && styles.catBtnActive]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[styles.catText, category === cat && styles.catTextActive]}>
              {CAT_ICONS[cat]} {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* HOT Posts */}
      {hotPosts.length > 0 && category === '전체' && !search && (
        <View style={{ paddingHorizontal: Spacing.md, marginBottom: Spacing.sm }}>
          <Text style={styles.hotTitle}>🔥 HOT 게시글</Text>
          {hotPosts.map(p => (
            <TouchableOpacity
              key={p.id}
              style={styles.hotCard}
              onPress={() => navigation.navigate('BoardDetail', { postId: p.id })}
            >
              <View style={styles.hotBadge}><Text style={styles.hotBadgeText}>HOT</Text></View>
              <Text style={styles.hotPostTitle} numberOfLines={2}>{p.title}</Text>
              <View style={styles.hotMeta}>
                <Text style={styles.metaText}>❤️ {p.likes_count}</Text>
                <Text style={styles.metaText}>👁 {p.views}</Text>
                <Text style={styles.metaText}>💬 {p.author}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.listTitle}>📝 게시글 목록</Text>
    </>
  );

  const renderItem = ({ item, index }: { item: Post; index: number }) => (
    <TouchableOpacity
      style={styles.postCard}
      onPress={() => navigation.navigate('BoardDetail', { postId: item.id })}
    >
      <View style={styles.postRow}>
        <View style={styles.postNum}>
          <Text style={styles.postNumText}>{index + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.postTitleRow}>
            <View style={styles.catPill}>
              <Text style={styles.catPillText}>{CAT_ICONS[item.category] ?? '📋'} {item.category}</Text>
            </View>
          </View>
          <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.postMeta}>
            <Text style={styles.metaText}>✍️ {item.author}</Text>
            <Text style={styles.metaText}>❤️ {item.likes_count}</Text>
            <Text style={styles.metaText}>👁 {item.views}</Text>
            <Text style={styles.metaText}>{item.date.slice(0, 10)}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Text style={styles.headerTitle}>💬 자유게시판</Text>
        {user && (
          <TouchableOpacity style={styles.writeBtn} onPress={() => navigation.navigate('BoardWrite')}>
            <Text style={styles.writeBtnText}>✏️ 글쓰기</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={posts}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListHeaderComponent={<ListHeader />}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        onEndReached={() => {
          setPage(p => p + 1);
          load();
        }}
        onEndReachedThreshold={0.3}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { backgroundColor: Colors.surface, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: Colors.textPrimary },
  writeBtn: { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full },
  writeBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', margin: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: Colors.textPrimary },
  catRow: { flexDirection: 'row', paddingHorizontal: Spacing.md, gap: 8, marginBottom: Spacing.md, flexWrap: 'wrap' },
  catBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border },
  catBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  catTextActive: { color: '#fff' },
  hotTitle: { fontSize: 15, fontWeight: '800', color: Colors.hot, marginBottom: 8 },
  hotCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: Colors.hot, ...Shadow.sm },
  hotBadge: { backgroundColor: Colors.hot, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.sm, marginBottom: 6 },
  hotBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  hotPostTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  hotMeta: { flexDirection: 'row', gap: 10, marginTop: 6 },
  listTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary, paddingHorizontal: Spacing.md, marginBottom: 8 },
  postCard: { backgroundColor: Colors.surface, marginHorizontal: Spacing.md, marginBottom: 8, borderRadius: Radius.md, padding: Spacing.md, ...Shadow.sm },
  postRow: { flexDirection: 'row', gap: Spacing.sm },
  postNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  postNumText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  postTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  catPill: { backgroundColor: Colors.primaryLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  catPillText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  postTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, lineHeight: 20 },
  postMeta: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  metaText: { fontSize: 11, color: Colors.textMuted },
});
