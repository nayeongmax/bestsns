/**
 * create-parttime-tasks.js
 * 원고시트에서 체크된 행을 누구나알바 parttime_tasks에 일괄 생성
 *
 * POST /api/create-parttime-tasks
 * body: { userId: string, tasks: Array<{ title, description, link, workDate }> }
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: '잘못된 요청입니다.' }) }; }

  const { userId, tasks } = body;
  if (!userId || !Array.isArray(tasks) || tasks.length === 0) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: '유효하지 않은 데이터입니다.' }) };
  }

  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  const rows = tasks
    .filter(t => (t.title || '').trim())
    .map(t => {
      const workDate = (t.workDate || today).slice(0, 10);
      const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const cafeCat = (t.cafeCat || '').trim();
      const sections = {
        게시글목록: [{ 제목: String(t.title || '').slice(0, 200), 내용: String(t.description || '').slice(0, 5000) }],
        작업링크: t.link || '',
      };
      if (cafeCat) sections['카테고리선택'] = cafeCat;
      return {
        id,
        title: String(t.jobTitle || t.title || '').slice(0, 200),
        description: String(t.description || t.title || '').slice(0, 5000),
        category: '네이버카페',
        reward: Math.max(0, parseInt(t.reward, 10) || 0),
        max_applicants: 1,
        postVisibility: '전체공개',
        workTimeSlot: (t.workTimeSlot && t.workTimeSlot !== '시간미지정') ? t.workTimeSlot : null,
        sections,
        application_period_start: today,
        application_period_end: workDate,
        work_period_start: workDate,
        work_period_end: workDate,
        created_at: now,
        created_by: userId,
        applicants: [],
        point_paid: false,
        paid_user_ids: [],
      };
    });

  if (rows.length === 0) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: '생성할 업무가 없습니다.' }) };
  }

  const { error } = await supabase.from('parttime_tasks').insert(rows);
  if (error) {
    console.error('[create-parttime-tasks] insert 실패:', error.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: '업무 생성 실패: ' + error.message }) };
  }

  console.log(`[create-parttime-tasks] ${rows.length}개 생성 by ${userId}`);
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, count: rows.length }) };
};
