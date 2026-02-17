/**
 * 채팅방 메타(메모/거래중/즐겨찾기) Supabase 연동 (1단계 chat_room_meta)
 */
import { supabase } from '@/supabase';

export interface ChatRoomMetaPatch {
  memo?: string;
  isTrading?: boolean;
  isFavorite?: boolean;
}

/** 해당 사용자의 모든 채팅방 메타 조회 → room_id 기준 Record */
export async function fetchChatRoomMeta(
  userId: string
): Promise<Record<string, { memo?: string; isTrading?: boolean; isFavorite?: boolean }>> {
  const { data, error } = await supabase
    .from('chat_room_meta')
    .select('room_id, memo, is_trading, is_favorite')
    .eq('user_id', userId);
  if (error) throw error;
  const out: Record<string, { memo?: string; isTrading?: boolean; isFavorite?: boolean }> = {};
  (data ?? []).forEach((row: Record<string, unknown>) => {
    const roomId = String(row.room_id);
    out[roomId] = {
      memo: row.memo != null ? String(row.memo) : undefined,
      isTrading: row.is_trading != null ? Boolean(row.is_trading) : undefined,
      isFavorite: row.is_favorite != null ? Boolean(row.is_favorite) : undefined,
    };
  });
  return out;
}

/** 한 채팅방 메타 갱신 (있으면 patch 반영, 없으면 insert) */
export async function upsertChatRoomMeta(
  userId: string,
  roomId: string,
  patch: ChatRoomMetaPatch
): Promise<void> {
  const { data: existing } = await supabase
    .from('chat_room_meta')
    .select('memo, is_trading, is_favorite')
    .eq('user_id', userId)
    .eq('room_id', roomId)
    .maybeSingle();

  const prev = (existing as { memo?: string; is_trading?: boolean; is_favorite?: boolean } | null) || {};
  const row = {
    user_id: userId,
    room_id: roomId,
    memo: patch.memo !== undefined ? patch.memo : prev.memo ?? null,
    is_trading: patch.isTrading !== undefined ? patch.isTrading : prev.is_trading ?? false,
    is_favorite: patch.isFavorite !== undefined ? patch.isFavorite : prev.is_favorite ?? false,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('chat_room_meta').upsert(row, {
    onConflict: 'user_id,room_id',
  });
  if (error) throw error;
}
