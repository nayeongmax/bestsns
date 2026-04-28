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
import type { EbookProduct } from '../../types';

const TYPE_ICONS: Record<string, string> = {
  marketing: '📣', lecture: '🎓', consulting: '💡', template: '📄', ebook: '📚',
};
const TYPE_LABELS: Record<string, string> = {
  marketing: '마케팅', lecture: '강의', consulting: '컨설팅', template: '템플릿', ebook: '전자책',
};

export default function StoreScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [products, setProducts] = useState<EbookProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('전체');

  const categories = ['전체', ...Array.from(new Set(products.map(p => p.category)))];

  async function load() {
    const { data } = await supabase.from('store_products').select('*').eq('is_active', true).order('created_at', { ascending: false });
    if (data) {
      setProducts(data.map(p => ({
        id: String(p.id), title: String(p.title ?? p.name ?? ''), description: String(p.description ?? ''),
        price: Number(p.price ?? 0), category: String(p.category ?? 'ebook'),
        coverImageUrl: p.cover_image_url ?? p.image_url ?? undefined, isActive: Boolean(p.is_active),
        sellerId: String(p.seller_id ?? ''), sellerNickname: String(p.seller_nickname ?? ''),
        rating: Number(p.rating ?? 0), reviewCount: Number(p.review_count ?? 0),
      })));
    }
  }

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

  const filtered = products
    .filter(p => category === '전체' || p.category === category)
    .filter(p => !search || p.title.includes(search));

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Text style={styles.headerTitle}>🏪 N잡스토어</Text>
        <Text style={styles.headerSub}>전자책 · 강의 · 마케팅 · 컨설팅</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput style={styles.searchInput} placeholder="상품 검색..." value={search} onChangeText={setSearch} placeholderTextColor={Colors.textMuted} />
      </View>

      {/* Categories */}
      <FlatList
        data={categories}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={i => i}
        style={{ marginBottom: Spacing.sm }}
        contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.catBtn, category === item && styles.catBtnActive]} onPress={() => setCategory(item)}>
            <Text style={[styles.catText, category === item && styles.catTextActive]}>
              {item === '전체' ? '🌐 전체' : `${TYPE_ICONS[item] ?? '📦'} ${TYPE_LABELS[item] ?? item}`}
            </Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: Spacing.md, gap: 12, paddingBottom: insets.bottom + 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.productCard} onPress={() => navigation.navigate('EbookDetail', { ebookId: item.id })}>
            <View style={styles.productRow}>
              {item.coverImageUrl ? (
                <Image source={{ uri: item.coverImageUrl }} style={styles.productImg} resizeMode="cover" />
              ) : (
                <View style={styles.productImgPlaceholder}>
                  <Text style={styles.productImgEmoji}>{TYPE_ICONS[item.category] ?? '📦'}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={styles.tagRow}>
                  <View style={styles.catPill}>
                    <Text style={styles.catPillText}>{TYPE_ICONS[item.category] ?? '📦'} {TYPE_LABELS[item.category] ?? item.category}</Text>
                  </View>
                  {item.rating ? <Text style={styles.rating}>⭐ {item.rating.toFixed(1)}</Text> : null}
                </View>
                <Text style={styles.productTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.productSeller}>🙋 {item.sellerNickname}</Text>
                <Text style={styles.productDesc} numberOfLines={2}>{item.description}</Text>
                <Text style={styles.productPrice}>{item.price.toLocaleString()}원</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🏪</Text>
            <Text style={styles.emptyText}>등록된 상품이 없습니다</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { backgroundColor: Colors.secondary, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', margin: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: Colors.textPrimary },
  catBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border },
  catBtnActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  catText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  catTextActive: { color: '#fff' },
  productCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
  productRow: { flexDirection: 'row', gap: Spacing.md },
  productImg: { width: 90, height: 90, borderRadius: Radius.md },
  productImgPlaceholder: { width: 90, height: 90, borderRadius: Radius.md, backgroundColor: '#FFF3EE', justifyContent: 'center', alignItems: 'center' },
  productImgEmoji: { fontSize: 36 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  catPill: { backgroundColor: '#FFF3EE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  catPillText: { fontSize: 10, fontWeight: '700', color: Colors.secondary },
  rating: { fontSize: 11, color: Colors.gold },
  productTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, lineHeight: 20 },
  productSeller: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  productDesc: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17, marginTop: 3 },
  productPrice: { fontSize: 16, fontWeight: '900', color: Colors.secondary, marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: Colors.textMuted },
});
