/**
 * auto-post-board.js
 * */5 * * * * 마다 실행
 * 오전 9시 ~ 오후 9시(KST) 사이, 시간당 1개 무작위 분에 게시 (하루 12개)
 * 예: 9:03, 10:27, 11:44, ..., 20:11
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

/**
 * 다음 게시 시각 계산 (KST 기준)
 * - 현재 KST 시간 + 1시간대의 무작위 분
 * - 다음 시간이 21시 이상이면 → 내일 9시대
 */
function calcNextPostAt(nowUtc) {
  const KST_OFFSET = 9 * 60 * 60 * 1000;
  const kstNow = new Date(nowUtc.getTime() + KST_OFFSET);
  const kstHour = kstNow.getUTCHours();
  const randomMin = Math.floor(Math.random() * 60);

  const nextKstHour = kstHour + 1;
  const overflow = nextKstHour >= 21;

  const next = new Date(kstNow);
  if (overflow) {
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(9);
  } else {
    next.setUTCHours(nextKstHour);
  }
  next.setUTCMinutes(randomMin);
  next.setUTCSeconds(0);
  next.setUTCMilliseconds(0);

  return new Date(next.getTime() - KST_OFFSET);
}

exports.handler = async () => {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return { statusCode: 500, body: 'Missing Supabase env vars' };
  }

  try {
    const now = new Date();
    const KST_OFFSET = 9 * 60 * 60 * 1000;
    const kstHour = new Date(now.getTime() + KST_OFFSET).getUTCHours();

    // 게시 허용 시간: KST 9시 ~ 20시 (21시 전까지)
    if (kstHour < 9 || kstHour >= 21) {
      return { statusCode: 200, body: `Outside posting hours (KST ${kstHour}:xx)` };
    }

    // 1. 다음 게시 시각 확인
    const configs = await query('/auto_post_config?id=eq.1&select=next_post_at');
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
      await upsertConfig(calcNextPostAt(now));
      return { statusCode: 200, body: 'Pool reset — will post next hour' };
    }

    const p = pool[0];

    // 3. site_posts 삽입 (현재 KST 시각으로)
    const kst = new Date(now.getTime() + KST_OFFSET);
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
        views: Math.floor(Math.random() * 1200) + 100,
        likes_count: Math.floor(Math.random() * 60) + 1,
        images: [],
        attachments: [],
        is_deleted: false,
      }]),
    });

    // 4. 사용 표시
    await query(`/auto_post_pool?id=eq.${p.id}`, { method: 'PATCH', body: JSON.stringify({ is_used: true }) });

    // 5. 다음 게시 시각 = 다음 시간대 무작위 분
    const nextPostAt = calcNextPostAt(now);
    await upsertConfig(nextPostAt);

    const kstNext = new Date(nextPostAt.getTime() + KST_OFFSET);
    console.log(`[auto-post] "${p.title}" 게시. 다음: KST ${kstNext.getUTCHours()}:${String(kstNext.getUTCMinutes()).padStart(2,'0')}`);
    return { statusCode: 200, body: `Posted: ${p.title}` };
  } catch (e) {
    console.error('[auto-post]', e);
    return { statusCode: 500, body: String(e) };
  }
};
