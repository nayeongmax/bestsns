import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, Radius, Shadow } from '../../lib/theme';
import type { RootStackParamList } from '../../navigation/types';
import type { PartTimeTask } from '../../types';

const STATUS_MAP: Record<string, { label: string; color: string; emoji: string }> = {
  open:       { label: '모집중', color: Colors.success, emoji: '🟢' },
  in_progress:{ label: '진행중', color: Colors.primary, emoji: '⚡' },
  completed:  { label: '완료',  color: Colors.textMuted, emoji: '✅' },
  cancelled:  { label: '취소',  color: Colors.danger, emoji: '❌' },
};

export default function PartTimeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [tasks, setTasks] = useState<PartTimeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open'>('open');

  async function load() {
    let query = supabase.from('part_time_tasks').select('*').order('created_at', { ascending: false });
    if (filter === 'open') query = query.eq('status', 'open');
    const { data } = await query;
    if (data) {
      setTasks(data.map(t => ({
        id: String(t.id), title: String(t.title ?? ''), description: String(t.description ?? ''),
        reward: Number(t.reward ?? 0), category: String(t.category ?? ''),
        deadline: String(t.deadline ?? ''), status: (t.status ?? 'open') as PartTimeTask['status'],
        creatorId: String(t.creator_id ?? ''), creatorNickname: String(t.creator_nickname ?? ''),
        maxApplicants: Number(t.max_applicants ?? 0), currentApplicants: Number(t.current_applicants ?? 0),
        createdAt: String(t.created_at ?? ''),
      })));
    }
  }

  useEffect(() => { load().finally(() => setLoading(false)); }, [filter]);
  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Text style={styles.headerTitle}>💼 누구나알바</Text>
        <Text style={styles.headerSub}>온라인 부업 · 프리랜서 작업</Text>
      </View>

      {/* Filter */}
      <View style={styles.filterRow}>
        {(['open', 'all'] as const).map(f => (
          <TouchableOpacity key={f} style={[styles.filterBtn, filter === f && styles.filterBtnActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'open' ? '🟢 모집중' : '📋 전체'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={tasks}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: Spacing.md, gap: 12, paddingBottom: insets.bottom + 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item }) => {
          const st = STATUS_MAP[item.status] ?? STATUS_MAP.open;
          const dday = Math.ceil((new Date(item.deadline).getTime() - Date.now()) / 86400000);
          return (
            <TouchableOpacity style={styles.taskCard} onPress={() => navigation.navigate('PartTimeDetail', { taskId: item.id })}>
              <View style={styles.taskHeader}>
                <View style={[styles.statusBadge, { backgroundColor: st.color + '20' }]}>
                  <Text style={[styles.statusText, { color: st.color }]}>{st.emoji} {st.label}</Text>
                </View>
                <Text style={[styles.dday, dday <= 3 && { color: Colors.danger }]}>
                  {dday > 0 ? `D-${dday}` : '마감'}
                </Text>
              </View>
              <Text style={styles.taskTitle}>{item.title}</Text>
              <Text style={styles.taskDesc} numberOfLines={2}>{item.description}</Text>
              <View style={styles.taskFooter}>
                <View style={styles.rewardTag}>
                  <Text style={styles.rewardText}>💰 {item.reward.toLocaleString()}원</Text>
                </View>
                <Text style={styles.taskMeta}>
                  👥 {item.currentApplicants ?? 0}/{item.maxApplicants ?? '∞'}명
                </Text>
                <Text style={styles.taskMeta}>🙋 {item.creatorNickname}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>💼</Text>
            <Text style={styles.emptyText}>등록된 알바가 없습니다</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { backgroundColor: '#1A1040', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  filterRow: { flexDirection: 'row', padding: Spacing.md, gap: 10 },
  filterBtn: { flex: 1, paddingVertical: 10, borderRadius: Radius.lg, backgroundColor: Colors.surface, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  filterTextActive: { color: '#fff' },
  taskCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  statusText: { fontSize: 12, fontWeight: '700' },
  dday: { fontSize: 13, fontWeight: '800', color: Colors.textSecondary },
  taskTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  taskDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: Spacing.sm },
  taskFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  rewardTag: { backgroundColor: '#FFF3EE', paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full },
  rewardText: { fontSize: 14, fontWeight: '800', color: Colors.secondary },
  taskMeta: { fontSize: 12, color: Colors.textMuted },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: Colors.textMuted },
});
