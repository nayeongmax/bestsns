/**
 * create-parttime-tasks.js
 * 원고시트에서 체크된 행을 누구나알바 parttime_tasks에 1개 업무로 생성
 * (체크한 행 수에 관계없이 업무 1개 — sections.작업세트목록에 게시글 묶음)
 *
 * POST /api/create-parttime-tasks
 * body: { userId: string, tasks: Array<{ title, description, link, workDate, cafeCat, jobTitle, reward, workTimeSlot }> }
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
  catch (e) { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: '잘못된 요청입니다: ' + e.message }) }; }

  // 전체 핸들러를 try/catch로 감싸 예외 시 정확한 에러 반환
  try {
    const { userId, tasks } = body;
    if (!userId || !Array.isArray(tasks) || tasks.length === 0) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: '유효하지 않은 데이터입니다.' }) };
    }

    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    // 제목이 있는 행만 필터
    const validTasks = tasks.filter(t => (t.title || '').trim());
    if (validTasks.length === 0) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: '생성할 업무가 없습니다. (title 필드 확인 필요)' }) };
    }

    // 모달 공통값 (첫 번째 task 기준 — 모달에서 동일하게 입력됨)
    const first = validTasks[0];
    const workDate = (first.workDate || today).slice(0, 10);

    // 체크된 행 전체를 작업세트목록으로 묶기 — 카테고리는 게시글마다 개별 저장
    const worklist = validTasks.map(t => ({
      '링크':     t.link   || '',
      '제목':     String(t.title       || '').slice(0, 200),
      '내용':     String(t.description || '').slice(0, 5000),
      '카테고리': String(t.cafeCat     || '').slice(0, 50),
      '링크확인': '',
    }));

    const sections = { '작업세트목록': worklist };

    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const row = {
      id,
      title:       String(first.jobTitle || first.title || '').slice(0, 200),
      description: '원고 복붙해서 업로드하기',
      category:    '네이버카페',
      reward:      Math.max(0, parseInt(first.reward, 10) || 0),
      max_applicants: 1,
      post_visibility: '전체공개',
      work_time_slot:  (first.workTimeSlot && first.workTimeSlot !== '시간미지정') ? first.workTimeSlot : null,
      sections,
      application_period_start: workDate,
      application_period_end:   workDate,
      work_period_start:        workDate,
      work_period_end:          workDate,
      created_at:  now,
      created_by:  userId,
      applicants:  [],
      point_paid:  false,
      paid_user_ids: [],
    };

    const { error } = await supabase.from('parttime_tasks').insert([row]);
    if (error) {
      console.error('[create-parttime-tasks] insert 실패:', error.message);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: '업무 생성 실패: ' + error.message }) };
    }

    console.log(`[create-parttime-tasks] 업무 1개 (게시글 ${validTasks.length}건) 생성 by ${userId}`);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, count: 1, postCount: validTasks.length }) };

  } catch (e) {
    console.error('[create-parttime-tasks] 예외:', e.message, e.stack);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: '서버 예외: ' + e.message }) };
  }
};
