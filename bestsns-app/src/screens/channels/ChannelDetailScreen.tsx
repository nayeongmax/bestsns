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
import type { ChannelProduct } from '../../types';

type Route = RouteProp<RootStackParamList, 'ChannelDetail'>;

export default function ChannelDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { params } = useRoute<Route>();
  const { user } = useAuth();
  const [channel, setChannel] = useState<ChannelProduct | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('channel_products').select('*').eq('id', params.channelId).single()
      .then(({ data }) => {
        if (data) setChannel({
          id: String(data.id), name: String(data.name ?? ''), description: String(data.description ?? ''),
          price: Number(data.price ?? 0), category: String(data.category ?? ''),
          imageUrl: data.image_url ?? undefined, isActive: Boolean(data.is_active),
          sellerId: String(data.seller_id ?? ''), sellerNickname: String(data.seller_nickname ?? ''),
          rating: Number(data.rating ?? 0), reviewCount: Number(data.review_count ?? 0),
        });
      });
    setLoading(false);
  }, [params.channelId]);

  async function purchase() {
    if (!user) { Alert.alert('로그인 필요'); return; }
    if (!channel) return;
    if ((user.points ?? 0) < channel.price) {
      Alert.alert('포인트 부족', `필요: ${channel.price.toLocaleString()}P\n보유: ${(user.points ?? 0).toLocaleString()}P`);
      return;
    }
    Alert.alert('구매 확인', `${channel.name}\n${channel.price.toLocaleString()}원`, [
      { text: '취소', style: 'cancel' },
      {
        text: '구매하기', onPress: async () => {
          const { error } = await supabase.from('channel_orders').insert({
            user_id: user.id, channel_id: channel.id, channel_name: channel.name,
            price: channel.price, status: 'pending', created_at: new Date().toISOString(),
          });
          if (error) Alert.alert('구매 실패', error.message);
          else Alert.alert('✅ 구매 완료!', '마이페이지에서 확인하세요.');
        }
      },
    ]);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  if (!channel) return <View style={styles.center}><Text>채널을 찾을 수 없습니다</Text></View>;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{channel.name}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        {channel.imageUrl
          ? <Image source={{ uri: channel.imageUrl }} style={styles.heroImg} resizeMode="cover" />
          : <View style={styles.heroPlaceholder}><Text style={styles.heroEmoji}>📺</Text></View>
        }
        <View style={styles.content}>
          <View style={styles.catPill}><Text style={styles.catText}>{channel.category}</Text></View>
          <Text style={styles.title}>{channel.name}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>🙋 {channel.sellerNickname}</Text>
            {channel.rating ? <Text style={styles.metaText}>⭐ {channel.rating.toFixed(1)} ({channel.reviewCount})</Text> : null}
          </View>
          <View style={styles.divider} />
          <Text style={styles.desc}>{channel.description}</Text>
        </View>
      </ScrollView>
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.sm }]}>
        <View>
          <Text style={styles.priceLabel}>판매가</Text>
          <Text style={styles.price}>{channel.price.toLocaleString()}원</Text>
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
  backIcon: { fontSize: 22, color: Colors.primary, fontWeight: '600' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  heroImg: { width: '100%', height: 220 },
  heroPlaceholder: { width: '100%', height: 220, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  heroEmoji: { fontSize: 72 },
  content: { padding: Spacing.lg },
  catPill: { backgroundColor: Colors.primaryLight, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, marginBottom: 8 },
  catText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  title: { fontSize: 22, fontWeight: '900', color: Colors.textPrimary },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  metaText: { fontSize: 13, color: Colors.textMuted },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  desc: { fontSize: 15, color: Colors.textPrimary, lineHeight: 24 },
  bottomBar: { backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  priceLabel: { fontSize: 12, color: Colors.textMuted },
  price: { fontSize: 22, fontWeight: '900', color: Colors.primary },
  buyBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: 14, borderRadius: Radius.lg, ...Shadow.md },
  buyBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
