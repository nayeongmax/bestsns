/**
 * auto-post-board.js
 * */5 * * * * 마다 실행
 * auto_post_config.next_post_at 에 도달하면 auto_post_pool 에서 1개 꺼내 site_posts 에 삽입
 * 다음 게시 시각 = 지금 + 55~75분(랜덤) → 매 시간 랜덤 분에 게시되는 효과
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

async function upsertConfig(nextPostAt) {
  await query('/auto_post_config', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id: 1, next_post_at: nextPostAt.toISOString() }),
  });
}

exports.handler = async () => {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return { statusCode: 500, body: 'Missing Supabase env vars' };
  }

  try {
    // 1. 다음 게시 시각 확인
    const configs = await query('/auto_post_config?id=eq.1&select=next_post_at');
    const now = new Date();

    if (configs && configs.length > 0) {
      const nextAt = new Date(configs[0].next_post_at);
      if (now < nextAt) {
        return { statusCode: 200, body: `Next post at ${nextAt.toISOString()}` };
      }
    }

    // 2. 미사용 풀 1개 조회
    const pool = await query('/auto_post_pool?is_used=eq.false&order=random_order.asc&limit=1');
    if (!pool || pool.length === 0) {
      console.log('[auto-post] 풀 소진 → 전체 리셋');
      await query('/auto_post_pool?is_used=eq.true', { method: 'PATCH', body: JSON.stringify({ is_used: false }) });
      await upsertConfig(new Date(now.getTime() + 5 * 60 * 1000));
      return { statusCode: 200, body: 'Pool reset — will retry in 5 min' };
    }

    const p = pool[0];

    // 3. site_posts 삽입 (현재 KST 시각으로)
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const dateStr = kst.toISOString().replace('T', ' ').slice(0, 19);

    await query('/site_posts', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify([{
        id: `auto_${Date.now()}_${p.id}`,
        category: p.category,
        title: p.title,
        content: p.content,
        author: p.author,
        author_id: `auto_user_${p.id}`,
        author_image: null,
        date: dateStr,
        views: Math.floor(Math.random() * 800) + 50,
        likes_count: Math.floor(Math.random() * 60) + 1,
        images: [],
        attachments: [],
        is_deleted: false,
      }]),
    });

    // 4. 사용 표시
    await query(`/auto_post_pool?id=eq.${p.id}`, { method: 'PATCH', body: JSON.stringify({ is_used: true }) });

    // 5. 다음 게시 시각 = 55~75분 후 랜덤 (매 시간 다른 분에 올라오는 효과)
    const minutesUntilNext = 55 + Math.floor(Math.random() * 21);
    const nextPostAt = new Date(now.getTime() + minutesUntilNext * 60 * 1000);
    await upsertConfig(nextPostAt);

    console.log(`[auto-post] "${p.title}" 게시. 다음: ${nextPostAt.toISOString()} (${minutesUntilNext}분 후)`);
    return { statusCode: 200, body: `Posted: ${p.title}` };
  } catch (e) {
    console.error('[auto-post]', e);
    return { statusCode: 500, body: String(e) };
  }
};
