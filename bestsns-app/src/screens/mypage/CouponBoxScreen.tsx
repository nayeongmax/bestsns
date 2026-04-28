import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Spacing, Radius, Shadow } from '../../lib/theme';

interface Coupon {
  id: string;
  code: string;
  discountAmount: number;
  discountPercent?: number;
  description: string;
  expiresAt: string;
  isUsed: boolean;
}

export default function CouponBoxScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase.from('user_coupons').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setCoupons(data.map(c => ({
          id: String(c.id), code: String(c.code ?? ''), discountAmount: Number(c.discount_amount ?? 0),
          discountPercent: c.discount_percent ? Number(c.discount_percent) : undefined,
          description: String(c.description ?? ''), expiresAt: String(c.expires_at ?? ''),
          isUsed: Boolean(c.is_used),
        })));
      });
    setLoading(false);
  }, [user]);

  const now = new Date();
  const valid = coupons.filter(c => !c.isUsed && new Date(c.expiresAt) > now);
  const expired = coupons.filter(c => c.isUsed || new Date(c.expiresAt) <= now);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🎫 쿠폰함</Text>
        <View style={styles.countBadge}><Text style={styles.countText}>{valid.length}장</Text></View>
      </View>

      <FlatList
        data={[...valid, ...expired]}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: Spacing.md, gap: 12, paddingBottom: insets.bottom + 80 }}
        ListHeaderComponent={valid.length > 0 ? null : (
          <View style={styles.empty}><Text style={styles.emptyEmoji}>🎫</Text><Text style={styles.emptyText}>사용 가능한 쿠폰이 없습니다</Text></View>
        )}
        renderItem={({ item }) => {
          const isExpired = item.isUsed || new Date(item.expiresAt) <= now;
          return (
            <View style={[styles.couponCard, isExpired && styles.expiredCard]}>
              <View style={styles.couponLeft}>
                <Text style={styles.couponEmoji}>{isExpired ? '✅' : '🎫'}</Text>
                <View>
                  <Text style={[styles.couponDiscount, isExpired && styles.expiredText]}>
                    {item.discountPercent ? `${item.discountPercent}% 할인` : `${item.discountAmount.toLocaleString()}P 할인`}
                  </Text>
                  <Text style={styles.couponDesc}>{item.description}</Text>
                  <Text style={styles.couponCode}>코드: {item.code}</Text>
                </View>
              </View>
              <View style={styles.couponRight}>
                {isExpired
                  ? <Text style={styles.usedText}>{item.isUsed ? '사용완료' : '만료'}</Text>
                  : <Text style={styles.expiresText}>{item.expiresAt.slice(0, 10)}\n까지</Text>
                }
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { marginRight: Spacing.sm, padding: 4 },
  backIcon: { fontSize: 22, color: Colors.primary, fontWeight: '600' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '900', color: Colors.textPrimary },
  countBadge: { backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  countText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  couponCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: Colors.primary, ...Shadow.sm },
  expiredCard: { borderColor: Colors.border, opacity: 0.6 },
  couponLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  couponEmoji: { fontSize: 32 },
  couponDiscount: { fontSize: 18, fontWeight: '900', color: Colors.primary },
  expiredText: { color: Colors.textMuted },
  couponDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  couponCode: { fontSize: 11, color: Colors.textMuted, marginTop: 2, fontFamily: 'monospace' },
  couponRight: { alignItems: 'center' },
  usedText: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  expiresText: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: Colors.textMuted },
});
