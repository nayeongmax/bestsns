import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, RefreshControl, TextInput, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, Radius, Shadow } from '../../lib/theme';
import type { RootStackParamList } from '../../navigation/types';
import type { ChannelProduct } from '../../types';

export default function ChannelsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [channels, setChannels] = useState<ChannelProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('전체');

  const CATEGORIES = ['전체', ...Array.from(new Set(channels.map(c => c.category)))];

  async function load() {
    const { data } = await supabase.from('channel_products').select('*').eq('is_active', true).order('created_at', { ascending: false });
    if (data) {
      setChannels(data.map(c => ({
        id: String(c.id), name: String(c.name ?? ''), description: String(c.description ?? ''),
        price: Number(c.price ?? 0), category: String(c.category ?? '기타'),
        imageUrl: c.image_url ?? undefined, isActive: Boolean(c.is_active),
        sellerId: String(c.seller_id ?? ''), sellerNickname: String(c.seller_nickname ?? ''),
        rating: Number(c.rating ?? 0), reviewCount: Number(c.review_count ?? 0),
      })));
    }
  }

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const filtered = channels
    .filter(c => category === '전체' || c.category === category)
    .filter(c => !search || c.name.includes(search) || c.description.includes(search));

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Text style={styles.headerTitle}>📺 채널 판매</Text>
        <Text style={styles.headerSub}>SNS 채널을 사고 팔아요</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="채널 검색..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      {/* Categories */}
      <View style={styles.catScrollWrap}>
        <FlatList
          data={CATEGORIES}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={i => i}
          contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.catBtn, category === item && styles.catBtnActive]} onPress={() => setCategory(item)}>
              <Text style={[styles.catText, category === item && styles.catTextActive]}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        numColumns={2}
        contentContainerStyle={{ padding: Spacing.md, gap: 12, paddingBottom: insets.bottom + 100 }}
        columnWrapperStyle={{ gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.channelCard}
            onPress={() => navigation.navigate('ChannelDetail', { channelId: item.id })}
          >
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.channelImg} resizeMode="cover" />
            ) : (
              <View style={styles.channelImgPlaceholder}>
                <Text style={styles.channelImgEmoji}>📺</Text>
              </View>
            )}
            <View style={styles.channelInfo}>
              <View style={styles.catPill}>
                <Text style={styles.catPillText}>{item.category}</Text>
              </View>
              <Text style={styles.channelName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.channelSeller}>🙋 {item.sellerNickname}</Text>
              {item.rating ? (
                <Text style={styles.channelRating}>⭐ {item.rating.toFixed(1)} ({item.reviewCount})</Text>
              ) : null}
              <Text style={styles.channelPrice}>{item.price.toLocaleString()}원</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyText}>등록된 채널이 없습니다</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', margin: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: Colors.textPrimary },
  catScrollWrap: { marginBottom: Spacing.sm },
  catBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border },
  catBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  catTextActive: { color: '#fff' },
  channelCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.sm },
  channelImg: { width: '100%', height: 120 },
  channelImgPlaceholder: { width: '100%', height: 120, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  channelImgEmoji: { fontSize: 40 },
  channelInfo: { padding: Spacing.sm },
  catPill: { backgroundColor: Colors.primaryLight, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full, marginBottom: 4 },
  catPillText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  channelName: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, lineHeight: 18 },
  channelSeller: { fontSize: 11, color: Colors.textMuted, marginTop: 3 },
  channelRating: { fontSize: 11, color: Colors.gold, marginTop: 2 },
  channelPrice: { fontSize: 15, fontWeight: '900', color: Colors.primary, marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: Colors.textMuted },
});
