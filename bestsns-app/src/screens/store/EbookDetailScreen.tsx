import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Spacing, Radius, Shadow } from '../../lib/theme';
import type { RootStackParamList } from '../../navigation/types';
import type { EbookProduct } from '../../types';

type Route = RouteProp<RootStackParamList, 'EbookDetail'>;

const TYPE_ICONS: Record<string, string> = { marketing: '📣', lecture: '🎓', consulting: '💡', template: '📄', ebook: '📚' };

export default function EbookDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { params } = useRoute<Route>();
  const { user } = useAuth();
  const [product, setProduct] = useState<EbookProduct | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('store_products').select('*').eq('id', params.ebookId).single()
      .then(({ data: p }) => {
        if (p) setProduct({
          id: String(p.id), title: String(p.title ?? p.name ?? ''), description: String(p.description ?? ''),
          price: Number(p.price ?? 0), category: String(p.category ?? 'ebook'),
          coverImageUrl: p.cover_image_url ?? p.image_url ?? undefined, isActive: Boolean(p.is_active),
          sellerId: String(p.seller_id ?? ''), sellerNickname: String(p.seller_nickname ?? ''),
          rating: Number(p.rating ?? 0), reviewCount: Number(p.review_count ?? 0),
        });
      });
    setLoading(false);
  }, [params.ebookId]);

  async function purchase() {
    if (!user) { Alert.alert('로그인 필요'); return; }
    if (!product) return;
    if ((user.points ?? 0) < product.price) {
      Alert.alert('포인트 부족', `필요: ${product.price.toLocaleString()}P\n보유: ${(user.points ?? 0).toLocaleString()}P`);
      return;
    }
    Alert.alert('구매 확인', `${product.title}\n${product.price.toLocaleString()}원`, [
      { text: '취소', style: 'cancel' },
      {
        text: '구매하기', onPress: async () => {
          const { error } = await supabase.from('store_orders').insert({
            user_id: user.id, product_id: product.id, product_name: product.title,
            price: product.price, status: 'pending', created_at: new Date().toISOString(),
          });
          if (error) Alert.alert('구매 실패', error.message);
          else Alert.alert('✅ 구매 완료!', '마이페이지에서 확인하세요.');
        }
      },
    ]);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.secondary} /></View>;
  if (!product) return <View style={styles.center}><Text>상품을 찾을 수 없습니다</Text></View>;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{product.title}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        {product.coverImageUrl
          ? <Image source={{ uri: product.coverImageUrl }} style={styles.heroImg} resizeMode="cover" />
          : <View style={styles.heroPlaceholder}><Text style={styles.heroEmoji}>{TYPE_ICONS[product.category] ?? '📦'}</Text></View>
        }
        <View style={styles.content}>
          <View style={styles.tagRow}>
            <View style={styles.catPill}><Text style={styles.catText}>{TYPE_ICONS[product.category]} {product.category}</Text></View>
            {product.rating ? <Text style={styles.rating}>⭐ {product.rating.toFixed(1)} ({product.reviewCount})</Text> : null}
          </View>
          <Text style={styles.title}>{product.title}</Text>
          <Text style={styles.seller}>🙋 {product.sellerNickname}</Text>
          <View style={styles.divider} />
          <Text style={styles.desc}>{product.description}</Text>
        </View>
      </ScrollView>
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.sm }]}>
        <View>
          <Text style={styles.priceLabel}>판매가</Text>
          <Text style={styles.price}>{product.price.toLocaleString()}원</Text>
        </View>
        <TouchableOpacity style={styles.buyBtn} onPress={purchase}>
          <Text style={styles.buyBtnText}>🛒 구매하기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { marginRight: Spacing.sm, padding: 4 },
  backIcon: { fontSize: 22, color: Colors.secondary, fontWeight: '600' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  heroImg: { width: '100%', height: 220 },
  heroPlaceholder: { width: '100%', height: 220, backgroundColor: '#FFF3EE', justifyContent: 'center', alignItems: 'center' },
  heroEmoji: { fontSize: 72 },
  content: { padding: Spacing.lg },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  catPill: { backgroundColor: '#FFF3EE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  catText: { fontSize: 12, fontWeight: '700', color: Colors.secondary },
  rating: { fontSize: 13, color: Colors.gold },
  title: { fontSize: 22, fontWeight: '900', color: Colors.textPrimary },
  seller: { fontSize: 13, color: Colors.textMuted, marginTop: 6 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  desc: { fontSize: 15, color: Colors.textPrimary, lineHeight: 24 },
  bottomBar: { backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  priceLabel: { fontSize: 12, color: Colors.textMuted },
  price: { fontSize: 22, fontWeight: '900', color: Colors.secondary },
  buyBtn: { backgroundColor: Colors.secondary, paddingHorizontal: Spacing.xl, paddingVertical: 14, borderRadius: Radius.lg, ...Shadow.md },
  buyBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
