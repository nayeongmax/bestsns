import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, ActivityIndicator, Alert, RefreshControl, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Spacing, Radius, Shadow } from '../../lib/theme';
import type { RootStackParamList } from '../../navigation/types';
import type { SMMProduct, SMMOrder } from '../../types';

const CATEGORY_ICONS: Record<string, string> = {
  '인스타그램': '📸',
  '유튜브': '▶️',
  '틱톡': '🎵',
  '페이스북': '💙',
  '카카오': '💛',
  '네이버': '🟢',
  '트위터': '🐦',
  '기타': '📱',
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const [products, setProducts] = useState<SMMProduct[]>([]);
  const [orders, setOrders] = useState<SMMOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [orderModal, setOrderModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SMMProduct | null>(null);
  const [targetUrl, setTargetUrl] = useState('');
  const [quantity, setQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const categories = ['전체', ...Array.from(new Set(products.map(p => p.category)))];
  const filtered = selectedCategory === '전체'
    ? products
    : products.filter(p => p.category === selectedCategory);

  async function load() {
    const { data: prods } = await supabase
      .from('smm_products')
      .select('*')
      .eq('is_active', true)
      .order('category');
    if (prods) {
      setProducts(prods.map(p => ({
        id: String(p.id),
        name: String(p.name ?? ''),
        description: String(p.description ?? ''),
        price: Number(p.price ?? 0),
        category: String(p.category ?? '기타'),
        minQuantity: Number(p.min_quantity ?? 1),
        maxQuantity: Number(p.max_quantity ?? 10000),
        isActive: Boolean(p.is_active),
      })));
    }
    if (user) {
      const { data: ords } = await supabase
        .from('smm_orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (ords) {
        setOrders(ords.map(o => ({
          id: String(o.id),
          userId: String(o.user_id),
          productId: String(o.product_id ?? ''),
          productName: String(o.product_name ?? ''),
          targetUrl: String(o.target_url ?? ''),
          quantity: Number(o.quantity ?? 0),
          price: Number(o.price ?? 0),
          status: (o.status ?? 'pending') as SMMOrder['status'],
          createdAt: String(o.created_at ?? ''),
        })));
      }
    }
  }

  useEffect(() => { load().finally(() => setLoading(false)); }, [user]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function submitOrder() {
    if (!user) { Alert.alert('로그인 필요', '로그인 후 주문하세요.'); return; }
    if (!selectedProduct) return;
    const qty = parseInt(quantity);
    if (!targetUrl) { Alert.alert('입력 오류', '대상 URL을 입력해주세요.'); return; }
    if (isNaN(qty) || qty < (selectedProduct.minQuantity ?? 1)) {
      Alert.alert('수량 오류', `최소 ${selectedProduct.minQuantity ?? 1}개 이상 입력해주세요.`);
      return;
    }
    const total = qty * selectedProduct.price;
    if ((user.points ?? 0) < total) {
      Alert.alert('포인트 부족', `필요 포인트: ${total.toLocaleString()}P\n보유: ${(user.points ?? 0).toLocaleString()}P`);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('smm_orders').insert({
      user_id: user.id,
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      target_url: targetUrl,
      quantity: qty,
      price: total,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
    if (error) { Alert.alert('주문 실패', error.message); }
    else {
      Alert.alert('✅ 주문 완료!', '주문이 접수되었습니다.');
      setOrderModal(false);
      setTargetUrl('');
      setQuantity('');
      await load();
    }
    setSubmitting(false);
  }

  const statusBadge = (s: string) => {
    const map: Record<string, { label: string; color: string }> = {
      pending: { label: '대기중', color: Colors.warning },
      processing: { label: '진행중', color: Colors.primary },
      completed: { label: '완료', color: Colors.success },
      cancelled: { label: '취소', color: Colors.danger },
      partial: { label: '부분완료', color: Colors.secondary },
    };
    return map[s] ?? { label: s, color: Colors.textMuted };
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Hero Banner */}
        <View style={[styles.hero, { paddingTop: insets.top + Spacing.md }]}>
          <Text style={styles.heroEmoji}>📈</Text>
          <Text style={styles.heroTitle}>SNS 마케팅 주문</Text>
          <Text style={styles.heroSub}>팔로워 · 좋아요 · 조회수 · 댓글</Text>
          {user && (
            <View style={styles.pointsBadge}>
              <Text style={styles.pointsText}>💰 {(user.points ?? 0).toLocaleString()}P 보유</Text>
            </View>
          )}
        </View>

        {/* Category Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: 8 }}>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.catBtn, selectedCategory === cat && styles.catBtnActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.catText, selectedCategory === cat && styles.catTextActive]}>
                {cat === '전체' ? '🌐 전체' : `${CATEGORY_ICONS[cat] ?? '📱'} ${cat}`}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Products */}
        <View style={{ paddingHorizontal: Spacing.md, gap: 12, marginTop: Spacing.sm }}>
          {filtered.map(product => (
            <TouchableOpacity
              key={product.id}
              style={styles.productCard}
              onPress={() => {
                if (!user) { Alert.alert('로그인 필요', '로그인 후 주문하세요.'); return; }
                setSelectedProduct(product);
                setOrderModal(true);
              }}
            >
              <View style={styles.productHeader}>
                <Text style={styles.productIcon}>{CATEGORY_ICONS[product.category] ?? '📱'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productCategory}>{product.category}</Text>
                </View>
                <View style={styles.priceTag}>
                  <Text style={styles.priceText}>{product.price.toLocaleString()}P</Text>
                  <Text style={styles.priceUnit}>/개</Text>
                </View>
              </View>
              {product.description ? (
                <Text style={styles.productDesc} numberOfLines={2}>{product.description}</Text>
              ) : null}
              <View style={styles.productFooter}>
                <Text style={styles.minQty}>최소 {(product.minQuantity ?? 1).toLocaleString()}개</Text>
                <View style={styles.orderBtn}>
                  <Text style={styles.orderBtnText}>🛒 주문하기</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* My Orders */}
        {orders.length > 0 && (
          <View style={{ marginTop: Spacing.xl, paddingHorizontal: Spacing.md }}>
            <Text style={styles.sectionTitle}>📋 내 주문 내역</Text>
            {orders.slice(0, 5).map(order => {
              const badge = statusBadge(order.status);
              return (
                <View key={order.id} style={styles.orderCard}>
                  <View style={styles.orderRow}>
                    <Text style={styles.orderName} numberOfLines={1}>{order.productName}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: badge.color + '20' }]}>
                      <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.orderDetail}>
                    수량: {order.quantity.toLocaleString()}개 · {order.price.toLocaleString()}P
                  </Text>
                  <Text style={styles.orderUrl} numberOfLines={1}>{order.targetUrl}</Text>
                  <Text style={styles.orderDate}>{order.createdAt.slice(0, 10)}</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Order Modal */}
      <Modal visible={orderModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🛒 주문하기</Text>
            {selectedProduct && (
              <>
                <View style={styles.modalProductInfo}>
                  <Text style={styles.modalProductName}>{selectedProduct.name}</Text>
                  <Text style={styles.modalProductPrice}>{selectedProduct.price.toLocaleString()}P/개</Text>
                </View>
                <Text style={styles.modalLabel}>🔗 대상 URL</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="https://..."
                  value={targetUrl}
                  onChangeText={setTargetUrl}
                  autoCapitalize="none"
                  placeholderTextColor={Colors.textMuted}
                />
                <Text style={styles.modalLabel}>📊 수량</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={`최소 ${(selectedProduct.minQuantity ?? 1).toLocaleString()}개`}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                  placeholderTextColor={Colors.textMuted}
                />
                {quantity ? (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>💰 총 결제금액</Text>
                    <Text style={styles.totalAmount}>
                      {(parseInt(quantity || '0') * selectedProduct.price).toLocaleString()}P
                    </Text>
                  </View>
                ) : null}
              </>
            )}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setOrderModal(false)}>
                <Text style={styles.cancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={submitOrder} disabled={submitting}>
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.confirmText}>✅ 주문 확정</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  hero: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    alignItems: 'center',
  },
  heroEmoji: { fontSize: 48, marginBottom: 8 },
  heroTitle: { fontSize: 24, fontWeight: '900', color: '#fff' },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  pointsBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 6, marginTop: Spacing.sm },
  pointsText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  catScroll: { marginVertical: Spacing.md },
  catBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border },
  catBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  catTextActive: { color: '#fff' },
  productCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
  productHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  productIcon: { fontSize: 28 },
  productName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  productCategory: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  priceTag: { flexDirection: 'row', alignItems: 'baseline' },
  priceText: { fontSize: 18, fontWeight: '900', color: Colors.primary },
  priceUnit: { fontSize: 11, color: Colors.textMuted, marginLeft: 2 },
  productDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 6, lineHeight: 18 },
  productFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  minQty: { fontSize: 11, color: Colors.textMuted },
  orderBtn: { backgroundColor: Colors.primaryLight, paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.full },
  orderBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.sm },
  orderCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: 10, ...Shadow.sm },
  orderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
  statusText: { fontSize: 11, fontWeight: '700' },
  orderDetail: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  orderUrl: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  orderDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, paddingBottom: Spacing.xxl },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.md },
  modalProductInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.primaryLight, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  modalProductName: { fontSize: 14, fontWeight: '700', color: Colors.primary, flex: 1 },
  modalProductPrice: { fontSize: 16, fontWeight: '900', color: Colors.primary },
  modalLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6, marginTop: Spacing.sm },
  modalInput: { backgroundColor: Colors.background, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 15, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.primaryLight, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.md },
  totalLabel: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  totalAmount: { fontSize: 20, fontWeight: '900', color: Colors.primary },
  modalBtns: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: Radius.lg, backgroundColor: Colors.background, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  confirmBtn: { flex: 2, paddingVertical: 14, borderRadius: Radius.lg, backgroundColor: Colors.primary, alignItems: 'center', ...Shadow.sm },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
