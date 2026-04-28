import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Spacing, Radius, Shadow } from '../../lib/theme';

const PACKAGES = [
  { amount: 10000, label: '1만 포인트', bonus: 0, emoji: '💵' },
  { amount: 30000, label: '3만 포인트', bonus: 1000, emoji: '💴' },
  { amount: 50000, label: '5만 포인트', bonus: 3000, emoji: '💶' },
  { amount: 100000, label: '10만 포인트', bonus: 10000, emoji: '💰' },
  { amount: 300000, label: '30만 포인트', bonus: 50000, emoji: '🏆' },
  { amount: 500000, label: '50만 포인트', bonus: 100000, emoji: '💎' },
];

export default function PointPaymentScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuth();
  const [selected, setSelected] = useState<number | null>(null);

  function handlePay() {
    if (selected === null) { Alert.alert('패키지를 선택해주세요'); return; }
    const pkg = PACKAGES[selected];
    Alert.alert(
      '💳 포인트 충전',
      `${pkg.label}${pkg.bonus > 0 ? `\n🎁 보너스 +${pkg.bonus.toLocaleString()}P` : ''}\n\n실제 결제 기능은 앱 출시 후 연동됩니다.`,
      [{ text: '확인' }],
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>💳 포인트 충전</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + 100 }}>
        {/* Current Balance */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>현재 보유 포인트</Text>
          <Text style={styles.balanceValue}>💰 {(user?.points ?? 0).toLocaleString()}P</Text>
        </View>

        <Text style={styles.sectionTitle}>충전 패키지 선택</Text>
        <View style={styles.grid}>
          {PACKAGES.map((pkg, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.pkgCard, selected === idx && styles.pkgCardActive]}
              onPress={() => setSelected(idx)}
            >
              <Text style={styles.pkgEmoji}>{pkg.emoji}</Text>
              <Text style={[styles.pkgAmount, selected === idx && styles.pkgAmountActive]}>
                {pkg.amount.toLocaleString()}P
              </Text>
              <Text style={[styles.pkgLabel, selected === idx && styles.pkgLabelActive]}>{pkg.label}</Text>
              {pkg.bonus > 0 && (
                <View style={styles.bonusBadge}>
                  <Text style={styles.bonusText}>+{pkg.bonus.toLocaleString()}P 보너스</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.payBtn} onPress={handlePay}>
          <Text style={styles.payBtnText}>
            {selected !== null
              ? `💳 ${(PACKAGES[selected].amount + PACKAGES[selected].bonus).toLocaleString()}P 충전하기`
              : '패키지를 선택해주세요'
            }
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { marginRight: Spacing.sm, padding: 4 },
  backIcon: { fontSize: 22, color: Colors.primary, fontWeight: '600' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '900', color: Colors.textPrimary },
  balanceCard: { backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: Spacing.lg, alignItems: 'center', marginBottom: Spacing.xl, ...Shadow.md },
  balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  balanceValue: { fontSize: 28, fontWeight: '900', color: '#fff', marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: Spacing.xl },
  pkgCard: { width: '47%', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', borderWidth: 2, borderColor: Colors.border, ...Shadow.sm },
  pkgCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  pkgEmoji: { fontSize: 32, marginBottom: 6 },
  pkgAmount: { fontSize: 18, fontWeight: '900', color: Colors.textPrimary },
  pkgAmountActive: { color: Colors.primary },
  pkgLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  pkgLabelActive: { color: Colors.primary },
  bonusBadge: { backgroundColor: Colors.success + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, marginTop: 6 },
  bonusText: { fontSize: 10, fontWeight: '700', color: Colors.success },
  payBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 16, alignItems: 'center', ...Shadow.md },
  payBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
