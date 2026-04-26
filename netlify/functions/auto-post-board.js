/**
 * auto-post-board.js
 * 매일 02:00 UTC(한국 11:00 AM) 실행
 * auto_post_pool 에서 미사용 10개를 랜덤 선택 → site_posts 에 당일 무작위 시간으로 게시
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

const headers = {
  Authorization: `Bearer ${SERVICE_KEY}`,
  apikey: SERVICE_KEY,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
};

async function query(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

function randomTime() {
  // 오전 8시 ~ 오후 11시 사이 랜덤
  const h = 8 + Math.floor(Math.random() * 15);
  const m = Math.floor(Math.random() * 60);
  const s = Math.floor(Math.random() * 60);
  const now = new Date();
  // KST 날짜 기준
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dateStr = kst.toISOString().slice(0, 10);
  return `${dateStr} ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

exports.handler = async () => {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return { statusCode: 500, body: 'Missing Supabase env vars' };
  }

  try {
    // 1. 미사용 풀 10개 랜덤 조회
    const pool = await query('/auto_post_pool?is_used=eq.false&order=random_order.asc&limit=10');
    if (!pool || pool.length === 0) {
      console.log('[auto-post] 남은 풀 없음. is_used 전체 리셋합니다.');
      await query('/auto_post_pool?is_used=eq.true', { method: 'PATCH', body: JSON.stringify({ is_used: false }) });
      return { statusCode: 200, body: 'Pool exhausted — reset done' };
    }

    // 2. site_posts 에 삽입
    const posts = pool.map(p => ({
      id: `auto_${Date.now()}_${p.id}`,
      category: p.category,
      title: p.title,
      content: p.content,
      author: p.author,
      author_id: `auto_user_${p.id}`,
      author_image: null,
      date: randomTime(),
      views: Math.floor(Math.random() * 800) + 50,
      likes_count: Math.floor(Math.random() * 60) + 1,
      images: [],
      attachments: [],
      is_deleted: false,
    }));

    await query('/site_posts', { method: 'POST', body: JSON.stringify(posts), headers: { Prefer: 'return=minimal' } });

    // 3. 사용 표시
    const ids = pool.map(p => p.id);
    await query(`/auto_post_pool?id=in.(${ids.join(',')})`, { method: 'PATCH', body: JSON.stringify({ is_used: true }) });

    console.log(`[auto-post] ${posts.length}개 게시 완료`);
    return { statusCode: 200, body: `Posted ${posts.length}` };
  } catch (e) {
    console.error('[auto-post]', e);
    return { statusCode: 500, body: String(e) };
  }
};
