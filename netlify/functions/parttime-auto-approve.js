/**
 * parttime-auto-approve.js — 매시간 실행: 통과 후 4일 경과한 알바 작업 자동 지급
 *
 * netlify.toml 에 아래 설정 필요:
 *   [functions."parttime-auto-approve"]
 *     schedule = "0 * * * *"
 */

const FREELANCER_FEE_RATE = 0.05 + 0.033 + 0.033; // 정산수수료 + 원천징수 + 결제수수료

exports.handler = async () => {
  const supabaseUrl = (
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  ).replace(/\/$/, '');
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('[parttime-auto-approve] Supabase 환경변수 없음');
    return { statusCode: 500, body: 'Missing env' };
  }

  const headers = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };

  const now = Date.now();
  let paidCount = 0;

  // 1. parttime_tasks 전체 조회
  const tasksRes = await fetch(
    `${supabaseUrl}/rest/v1/parttime_tasks?select=id,title,reward,applicants,paid_user_ids,point_paid`,
    { headers }
  );
  if (!tasksRes.ok) {
    console.error('[parttime-auto-approve] tasks 조회 실패:', await tasksRes.text());
    return { statusCode: 500, body: 'tasks fetch failed' };
  }
  const tasks = await tasksRes.json();

  for (const task of tasks) {
    const applicants = Array.isArray(task.applicants) ? task.applicants : [];
    const paidUserIds = Array.isArray(task.paid_user_ids) ? task.paid_user_ids : [];

    const selectedWithLink = applicants.filter(
      (a) => a.selected && ((a.workLinks?.length ?? 0) > 0 || !!(a.workLink || '').trim())
    );
    if (selectedWithLink.length === 0) continue;

    let taskChanged = false;
    const updatedPaidIds = [...paidUserIds];
    let updatedApplicants = [...applicants];

    for (const a of selectedWithLink) {
      if (updatedPaidIds.includes(a.userId)) continue;

      let shouldPay = false;
      if (a.autoApproveAt) {
        if (new Date(a.autoApproveAt).getTime() <= now) shouldPay = true;
      }
      if (!shouldPay) continue;

      // 잔액 조회
      const balRes = await fetch(
        `${supabaseUrl}/rest/v1/freelancer_balances?user_id=eq.${encodeURIComponent(a.userId)}&select=balance`,
        { headers }
      );
      const balData = balRes.ok ? await balRes.json() : [];
      const curBalance = balData[0]?.balance ?? 0;

      const gross = task.reward;
      const net = Math.round(gross * (1 - FREELANCER_FEE_RATE));
      const newBalance = curBalance + Math.max(0, net);

      // 잔액 업서트
      await fetch(`${supabaseUrl}/rest/v1/freelancer_balances`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ user_id: a.userId, balance: newBalance }),
      });

      // 수익 내역 추가
      const entryId = `earn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await fetch(`${supabaseUrl}/rest/v1/freelancer_earnings_history`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: entryId,
          user_id: a.userId,
          type: 'task',
          amount: gross,
          label: task.title,
        }),
      });

      const paidAt = new Date().toISOString();
      updatedPaidIds.push(a.userId);
      updatedApplicants = updatedApplicants.map((ap) =>
        ap.userId === a.userId ? { ...ap, paidAt } : ap
      );
      taskChanged = true;
      paidCount++;
      console.log(`[parttime-auto-approve] 지급 완료: ${a.nickname || a.userId} / 작업: ${task.title} / ${gross.toLocaleString()}원`);
    }

    if (!taskChanged) continue;

    const allSelected = updatedApplicants.filter(
      (ap) => ap.selected && ((ap.workLinks?.length ?? 0) > 0 || !!(ap.workLink || '').trim())
    );
    const pointPaid = allSelected.every((ap) => updatedPaidIds.includes(ap.userId));

    await fetch(`${supabaseUrl}/rest/v1/parttime_tasks?id=eq.${task.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        applicants: updatedApplicants,
        paid_user_ids: updatedPaidIds,
        point_paid: pointPaid,
      }),
    });
  }

  console.log(`[parttime-auto-approve] 완료: ${paidCount}명 자동 지급`);
  return { statusCode: 200, body: JSON.stringify({ paid: paidCount }) };
};
