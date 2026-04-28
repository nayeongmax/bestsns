import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Spacing, Radius, Shadow } from '../../lib/theme';
import type { RootStackParamList } from '../../navigation/types';

interface MenuItem { icon: string; label: string; screen?: keyof RootStackParamList; onPress?: () => void; badge?: string }

export default function MyPageScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, signOut } = useAuth();

  function handleLogout() {
    Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: signOut },
    ]);
  }

  const menuSections: { title: string; items: MenuItem[] }[] = [
    {
      title: '💰 포인트 & 결제',
      items: [
        { icon: '💳', label: '포인트 충전', screen: 'PointPayment' },
        { icon: '🎫', label: '쿠폰함', screen: 'CouponBox' },
      ],
    },
    {
      title: '📋 활동',
      items: [
        { icon: '🔔', label: '알림', screen: 'Notifications' },
        { icon: '📢', label: '공지사항', screen: 'Notices' },
        { icon: '💬', label: '채팅', screen: 'Chat' },
        { icon: '🤖', label: 'AI 상담', screen: 'AIConsult' },
      ],
    },
    {
      title: '⚙️ 계정',
      items: [
        { icon: '🚪', label: '로그아웃', onPress: handleLogout },
      ],
    },
  ];

  if (!user) {
    return (
      <View style={[styles.loginPrompt, { paddingTop: insets.top + Spacing.xl }]}>
        <Text style={styles.loginEmoji}>👤</Text>
        <Text style={styles.loginTitle}>로그인이 필요합니다</Text>
        <Text style={styles.loginSub}>BESTSNS의 모든 서비스를 이용해보세요</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => navigation.navigate('Auth')}>
          <Text style={styles.loginBtnText}>🚀 로그인 / 회원가입</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const grade = () => {
    const amt = user.totalPurchaseAmount ?? 0;
    if (amt >= 500000) return { label: 'VIP', emoji: '💎', color: '#8B5CF6' };
    if (amt >= 100000) return { label: 'GOLD', emoji: '🥇', color: Colors.gold };
    if (amt >= 30000) return { label: 'SILVER', emoji: '🥈', color: '#94A3B8' };
    return { label: 'BRONZE', emoji: '🥉', color: '#B45309' };
  };
  const g = grade();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.background }} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
      {/* Profile Header */}
      <View style={[styles.profileHeader, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarEmoji}>😊</Text>
          <View style={[styles.gradeBadge, { backgroundColor: g.color }]}>
            <Text style={styles.gradeBadgeText}>{g.emoji} {g.label}</Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.nickname}>{user.nickname}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <Text style={styles.joinDate}>가입일: {user.joinDate ?? '-'}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statEmoji}>💰</Text>
          <Text style={styles.statValue}>{(user.points ?? 0).toLocaleString()}</Text>
          <Text style={styles.statLabel}>포인트</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statEmoji}>🛒</Text>
          <Text style={styles.statValue}>{(user.totalPurchaseAmount ?? 0).toLocaleString()}</Text>
          <Text style={styles.statLabel}>총 구매액</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statEmoji}>💼</Text>
          <Text style={styles.statValue}>{(user.freelancerEarnings ?? 0).toLocaleString()}</Text>
          <Text style={styles.statLabel}>수익통장</Text>
        </View>
      </View>

      {/* Menu */}
      {menuSections.map(section => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.menuCard}>
            {section.items.map((item, idx) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.menuItem, idx < section.items.length - 1 && styles.menuItemBorder]}
                onPress={() => {
                  if (item.onPress) item.onPress();
                  else if (item.screen) navigation.navigate(item.screen as any);
                }}
              >
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={styles.menuLabel}>{item.label}</Text>
                {item.badge && (
                  <View style={styles.badge}><Text style={styles.badgeText}>{item.badge}</Text></View>
                )}
                <Text style={styles.menuArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loginPrompt: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', paddingHorizontal: Spacing.xl },
  loginEmoji: { fontSize: 80, marginBottom: Spacing.lg },
  loginTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  loginSub: { fontSize: 14, color: Colors.textSecondary, marginTop: 8, textAlign: 'center' },
  loginBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: 14, borderRadius: Radius.lg, marginTop: Spacing.xl, ...Shadow.md },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  profileHeader: { backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing.md },
  avatarWrap: { width: 70, height: 70, position: 'relative' },
  avatarEmoji: { fontSize: 56 },
  gradeBadge: { position: 'absolute', bottom: -4, right: -4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full },
  gradeBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  nickname: { fontSize: 20, fontWeight: '900', color: '#fff' },
  email: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  joinDate: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  statsRow: { flexDirection: 'row', backgroundColor: Colors.surface, marginHorizontal: Spacing.md, marginTop: -1, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.md, marginBottom: Spacing.sm },
  statItem: { flex: 1, alignItems: 'center' },
  statEmoji: { fontSize: 22 },
  statValue: { fontSize: 16, fontWeight: '900', color: Colors.textPrimary, marginTop: 4 },
  statLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: Colors.border },
  section: { paddingHorizontal: Spacing.md, marginTop: Spacing.md },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginBottom: 8, paddingLeft: 4 },
  menuCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.sm },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 14 },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  menuIcon: { fontSize: 22, width: 36 },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  badge: { backgroundColor: Colors.danger, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full, marginRight: 8 },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  menuArrow: { fontSize: 20, color: Colors.textMuted },
});
