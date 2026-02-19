/**
 * 사이트 공통 Supabase DB 연동 (기존 1·2·5단계 SQL 테이블 사용)
 * - site_notices (공지), grade_configs (등급), site_posts + site_post_comments (게시글)
 */
import { supabase } from './supabase';
import type { Notice, GradeConfig, Post, BoardComment } from '@/types';

// ─── site_notices ───────────────────────────────────────────────────────
function noticeToRow(n: Notice): Record<string, unknown> {
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    images: (n.images ?? []) as unknown[],
    date: n.date,
    is_hidden: n.isHidden ?? false,
  };
}

function rowToNotice(row: Record<string, unknown>): Notice {
  return {
    id: String(row.id),
    title: String(row.title),
    content: String(row.content),
    images: Array.isArray(row.images) ? (row.images as string[]) : undefined,
    date: String(row.date),
    isHidden: Boolean(row.is_hidden),
  };
}

export async function fetchNotices(): Promise<Notice[]> {
  const { data, error } = await supabase.from('site_notices').select('*').order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => rowToNotice(row as Record<string, unknown>));
}

export async function upsertNotices(list: Notice[]): Promise<void> {
  if (list.length === 0) return;
  const { error } = await supabase.from('site_notices').upsert(list.map(noticeToRow), { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteNotice(id: string): Promise<void> {
  const { error } = await supabase.from('site_notices').delete().eq('id', id);
  if (error) throw error;
}

// ─── grade_configs ──────────────────────────────────────────────────────
function gradeToRow(g: GradeConfig): Record<string, unknown> {
  return {
    id: g.id,
    name: g.name,
    target: g.target ?? 'both',
    min_sales: g.minSales ?? 0,
    min_purchase: g.minPurchase ?? 0,
    color: g.color,
    sort_order: g.sortOrder ?? 0,
  };
}

function rowToGrade(row: Record<string, unknown>): GradeConfig {
  return {
    id: String(row.id),
    name: String(row.name),
    target: (row.target as GradeConfig['target']) ?? 'both',
    minSales: Number(row.min_sales ?? 0),
    minPurchase: Number(row.min_purchase ?? 0),
    color: String(row.color),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export async function fetchGradeConfigs(): Promise<GradeConfig[]> {
  const { data, error } = await supabase.from('grade_configs').select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => rowToGrade(row as Record<string, unknown>));
}

export async function upsertGradeConfigs(list: GradeConfig[]): Promise<void> {
  if (list.length === 0) return;
  const { error } = await supabase.from('grade_configs').upsert(list.map(gradeToRow), { onConflict: 'id' });
  if (error) throw error;
}

// ─── site_posts + site_post_comments ────────────────────────────────────
function postToRow(p: Post): Record<string, unknown> {
  return {
    id: p.id,
    category: p.category ?? '',
    title: p.title,
    content: p.content,
    author: p.author,
    author_id: p.authorId,
    author_image: p.authorImage ?? null,
    date: p.date,
    views: p.views ?? 0,
    likes_count: p.likes ?? 0,
    images: (p.images ?? []) as unknown[],
    attachments: [],
    is_deleted: p.isDeleted ?? false,
  };
}

function rowToPost(row: Record<string, unknown>, comments: BoardComment[] = []): Post {
  return {
    id: String(row.id),
    category: String(row.category ?? ''),
    title: String(row.title),
    content: String(row.content),
    author: String(row.author),
    authorId: String(row.author_id),
    authorImage: row.author_image != null ? String(row.author_image) : undefined,
    date: String(row.date),
    views: Number(row.views ?? 0),
    likes: Number(row.likes_count ?? 0),
    images: Array.isArray(row.images) ? (row.images as string[]) : undefined,
    isDeleted: Boolean(row.is_deleted),
    comments,
  };
}

function commentToRow(c: BoardComment, postId: string): Record<string, unknown> {
  return {
    id: c.id,
    post_id: postId,
    parent_id: c.parentId ?? null,
    author: c.author,
    author_id: c.authorId,
    content: c.content,
    date: c.date,
    is_deleted: c.isDeleted ?? false,
    images: [],
    attachments: [],
  };
}

function rowToComment(row: Record<string, unknown>): BoardComment {
  return {
    id: String(row.id),
    author: String(row.author),
    authorId: String(row.author_id),
    content: String(row.content),
    date: String(row.date),
    isDeleted: Boolean(row.is_deleted),
    parentId: row.parent_id != null ? String(row.parent_id) : undefined,
  };
}

export async function fetchPosts(): Promise<Post[]> {
  const { data: postsData, error: postsErr } = await supabase.from('site_posts').select('*').order('date', { ascending: false });
  if (postsErr) throw postsErr;
  const posts = (postsData ?? []) as Record<string, unknown>[];
  if (posts.length === 0) return [];
  const ids = posts.map((p) => String(p.id));
  const { data: commentsData, error: commentsErr } = await supabase.from('site_post_comments').select('*').in('post_id', ids);
  if (commentsErr) throw commentsErr;
  const commentsByPost = (commentsData ?? []).reduce<Record<string, BoardComment[]>>((acc, row) => {
    const r = row as Record<string, unknown>;
    const postId = String(r.post_id);
    if (!acc[postId]) acc[postId] = [];
    acc[postId].push(rowToComment(r));
    return acc;
  }, {});
  return posts.map((row) => rowToPost(row, commentsByPost[String(row.id)] ?? []));
}

export async function upsertPosts(list: Post[]): Promise<void> {
  if (list.length === 0) return;
  const { error: postsErr } = await supabase.from('site_posts').upsert(list.map(postToRow), { onConflict: 'id' });
  if (postsErr) throw postsErr;
  for (const p of list) {
    if (!(p.comments?.length)) continue;
    const rows = p.comments.map((c) => commentToRow(c, p.id));
    const { error: commentsErr } = await supabase.from('site_post_comments').upsert(rows, { onConflict: 'id' });
    if (commentsErr) console.warn('site_post_comments 저장:', commentsErr);
  }
}
