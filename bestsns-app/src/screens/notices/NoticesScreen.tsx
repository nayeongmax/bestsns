import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Modal, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, Radius, Shadow } from '../../lib/theme';
import type { Notice } from '../../types';

export default function NoticesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Notice | null>(null);

  async function load() {
    const { data } = await supabase.from('notices').select('*').order('date', { ascending: false });
    if (data) {
      setNotices(data.map(n => ({
        id: String(n.id), title: String(n.title ?? ''), content: String(n.content ?? ''),
        date: String(n.date ?? n.created_at ?? ''), category: String(n.category ?? '공지'),
        isPinned: Boolean(n.is_pinned),
      })));
    }
  }

  useEffect(() => { load().finally(() => setLoading(false)); }, []);
  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📢 공지사항</Text>
      </View>

      <FlatList
        data={notices}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: Spacing.md, gap: 10, paddingBottom: insets.bottom + 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.noticeCard, item.isPinned && styles.pinnedCard]} onPress={() => setSelected(item)}>
            <View style={styles.noticeRow}>
              {item.isPinned && <View style={styles.pinBadge}><Text style={styles.pinText}>📌 고정</Text></View>}
              <View style={styles.catPill}>
                <Text style={styles.catText}>{item.category}</Text>
              </View>
            </View>
            <Text style={styles.noticeTitle}>{item.title}</Text>
            <Text style={styles.noticeDate}>{item.date.slice(0, 10)}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>📭 공지사항이 없습니다</Text></View>}
      />

      <Modal visible={!!selected} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <View style={styles.modalHandle} />
            <ScrollView>
              <View style={[styles.catPill, { alignSelf: 'flex-start', marginBottom: 8 }]}>
                <Text style={styles.catText}>{selected?.category}</Text>
              </View>
              <Text style={styles.modalTitle}>{selected?.title}</Text>
              <Text style={styles.modalDate}>{selected?.date.slice(0, 10)}</Text>
              <View style={styles.divider} />
              <Text style={styles.modalContent}>{selected?.content}</Text>
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setSelected(null)}>
              <Text style={styles.closeBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { marginRight: Spacing.sm, padding: 4 },
  backIcon: { fontSize: 22, color: Colors.primary, fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: Colors.textPrimary },
  noticeCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, ...Shadow.sm },
  pinnedCard: { borderLeftWidth: 3, borderLeftColor: Colors.primary },
  noticeRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  pinBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  pinText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  catPill: { backgroundColor: Colors.primaryLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  catText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  noticeTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  noticeDate: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 15, color: Colors.textMuted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '80%' },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  modalDate: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  modalContent: { fontSize: 15, color: Colors.textPrimary, lineHeight: 24 },
  closeBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.lg },
  closeBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
