import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Spacing, Radius, Shadow } from '../../lib/theme';
import type { RootStackParamList } from '../../navigation/types';
import type { PartTimeTask } from '../../types';

type Route = RouteProp<RootStackParamList, 'PartTimeDetail'>;

export default function PartTimeDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { params } = useRoute<Route>();
  const { user } = useAuth();
  const [task, setTask] = useState<PartTimeTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    supabase.from('part_time_tasks').select('*').eq('id', params.taskId).single()
      .then(({ data: t }) => {
        if (t) setTask({
          id: String(t.id), title: String(t.title ?? ''), description: String(t.description ?? ''),
          reward: Number(t.reward ?? 0), category: String(t.category ?? ''),
          deadline: String(t.deadline ?? ''), status: (t.status ?? 'open') as PartTimeTask['status'],
          creatorId: String(t.creator_id ?? ''), creatorNickname: String(t.creator_nickname ?? ''),
          maxApplicants: Number(t.max_applicants ?? 0), currentApplicants: Number(t.current_applicants ?? 0),
          createdAt: String(t.created_at ?? ''),
        });
      });
    setLoading(false);
  }, [params.taskId]);

  async function apply() {
    if (!user) { Alert.alert('로그인 필요'); return; }
    if (!task) return;
    setApplying(true);
    const { error } = await supabase.from('part_time_applicants').insert({
      task_id: task.id, user_id: user.id, nickname: user.nickname,
      applied_at: new Date().toISOString(), selected: false,
    });
    if (error) Alert.alert('신청 실패', error.message);
    else Alert.alert('✅ 신청 완료!', '선정 결과를 기다려주세요.');
    setApplying(false);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  if (!task) return <View style={styles.center}><Text>알바를 찾을 수 없습니다</Text></View>;

  const dday = Math.ceil((new Date(task.deadline).getTime() - Date.now()) / 86400000);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{task.title}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + 120 }}>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, task.status === 'open' ? styles.openBadge : styles.closedBadge]}>
              <Text style={[styles.statusText, task.status === 'open' ? styles.openText : styles.closedText]}>
                {task.status === 'open' ? '🟢 모집중' : '⛔ 마감'}
              </Text>
            </View>
            <Text style={[styles.dday, dday <= 3 && { color: Colors.danger }]}>
              {dday > 0 ? `D-${dday}` : '마감'}
            </Text>
          </View>
          <Text style={styles.title}>{task.title}</Text>
          <Text style={styles.creator}>🙋 {task.creatorNickname}</Text>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoEmoji}>💰</Text>
              <Text style={styles.infoLabel}>보상</Text>
              <Text style={styles.infoValue}>{task.reward.toLocaleString()}원</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoEmoji}>📅</Text>
              <Text style={styles.infoLabel}>마감일</Text>
              <Text style={styles.infoValue}>{task.deadline.slice(0, 10)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoEmoji}>👥</Text>
              <Text style={styles.infoLabel}>모집인원</Text>
              <Text style={styles.infoValue}>{task.currentApplicants ?? 0}/{task.maxApplicants ?? '∞'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoEmoji}>📂</Text>
              <Text style={styles.infoLabel}>카테고리</Text>
              <Text style={styles.infoValue}>{task.category}</Text>
            </View>
          </View>

          <View style={styles.divider} />
          <Text style={styles.descTitle}>📋 작업 내용</Text>
          <Text style={styles.desc}>{task.description}</Text>
        </View>
      </ScrollView>

      {task.status === 'open' && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.sm }]}>
          <TouchableOpacity style={styles.applyBtn} onPress={apply} disabled={applying}>
            {applying
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.applyBtnText}>💼 신청하기</Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { marginRight: Spacing.sm, padding: 4 },
  backIcon: { fontSize: 22, color: Colors.primary, fontWeight: '600' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, ...Shadow.md },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full },
  openBadge: { backgroundColor: Colors.success + '20' },
  closedBadge: { backgroundColor: Colors.textMuted + '20' },
  statusText: { fontSize: 13, fontWeight: '700' },
  openText: { color: Colors.success },
  closedText: { color: Colors.textMuted },
  dday: { fontSize: 16, fontWeight: '800', color: Colors.textSecondary },
  title: { fontSize: 22, fontWeight: '900', color: Colors.textPrimary, marginBottom: 6 },
  creator: { fontSize: 13, color: Colors.textMuted },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: Spacing.md },
  infoItem: { flex: 1, minWidth: '40%', backgroundColor: Colors.background, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center' },
  infoEmoji: { fontSize: 24 },
  infoLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  infoValue: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  descTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  desc: { fontSize: 15, color: Colors.textPrimary, lineHeight: 24 },
  bottomBar: { backgroundColor: Colors.surface, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  applyBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 16, alignItems: 'center', ...Shadow.md },
  applyBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
