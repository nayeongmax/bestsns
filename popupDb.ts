import { supabase } from './supabase';

export interface SitePopup {
  id: string;
  title: string;
  body: string;
  imageUrl: string;
  isActive: boolean;
  createdAt: string;
}

function rowToPopup(row: Record<string, unknown>): SitePopup {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    body: String(row.body ?? ''),
    imageUrl: String(row.image_url ?? ''),
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at ?? ''),
  };
}

export async function fetchActivePopup(): Promise<SitePopup | null> {
  const { data, error } = await supabase
    .from('site_popups')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error || !data?.length) return null;
  return rowToPopup(data[0] as Record<string, unknown>);
}

export async function fetchAllPopups(): Promise<SitePopup[]> {
  const { data, error } = await supabase
    .from('site_popups')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => rowToPopup(row as Record<string, unknown>));
}

export async function upsertPopup(popup: SitePopup): Promise<void> {
  const { error } = await supabase.from('site_popups').upsert({
    id: popup.id,
    title: popup.title,
    body: popup.body,
    image_url: popup.imageUrl || null,
    is_active: popup.isActive,
    created_at: popup.createdAt,
  });
  if (error) throw error;
}

export async function deletePopup(id: string): Promise<void> {
  const { error } = await supabase.from('site_popups').delete().eq('id', id);
  if (error) throw error;
}

export async function deactivateAllPopups(): Promise<void> {
  const { error } = await supabase
    .from('site_popups')
    .update({ is_active: false })
    .eq('is_active', true);
  if (error) throw error;
}
