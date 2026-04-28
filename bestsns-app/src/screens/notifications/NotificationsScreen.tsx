import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Spacing, Radius, Shadow } from '../../lib/theme';
import type { SiteNotification } from '../../types';

const NOTIF_ICONS: Record<string, string> = {
  sns_activation: '📈', store_order: '🛍️', channel_order: '📺',
  part_time: '💼', system: '🔔', point: '💰',
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<SiteNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) {
      setNotifs(data.map(n => ({
        id: String(n.id), userId: String(n.user_id ?? ''), type: String(n.type ?? 'system'),
        title: String(n.title ?? ''), message: String(n.message ?? ''),
        isRead: Boolean(n.is_read), createdAt: String(n.created_at ?? ''),
      })));
    }
  }

  async function markAllRead() {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
  }

  useEffect(() => { load().finally(() => setLoading(false)); }, [user]);
  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
  );

  const unreadCount = notifs.filter(n => !n.isRead).length;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🔔 알림</Text>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markBtn} onPress={markAllRead}>
            <Text style={styles.markText}>모두 읽음</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifs}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: Spacing.md, gap: 8, paddingBottom: insets.bottom + 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item }) => (
          <View style={[styles.notifCard, !item.isRead && styles.unreadCard]}>
            <Text style={styles.notifIcon}>{NOTIF_ICONS[item.type] ?? '🔔'}</Text>
            <View style={{ flex: 1 }}>
              <View style={styles.notifRow}>
                <Text style={styles.notifTitle}>{item.title}</Text>
                {!item.isRead && <View style={styles.unreadDot} />}
              </View>
              <Text style={styles.notifMsg}>{item.message}</Text>
              <Text style={styles.notifTime}>{item.createdAt.slice(0, 16).replace('T', ' ')}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔕</Text>
            <Text style={styles.emptyText}>알림이 없습니다</Text>
          </View>
        }
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
  markBtn: { padding: 8 },
  markText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  notifCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, flexDirection: 'row', gap: Spacing.sm, ...Shadow.sm },
  unreadCard: { borderLeftWidth: 3, borderLeftColor: Colors.primary, backgroundColor: Colors.primaryLight },
  notifIcon: { fontSize: 28, width: 36 },
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notifTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  notifMsg: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginTop: 3 },
  notifTime: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: Colors.textMuted },
});
