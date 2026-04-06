/**
 * smm-hourly-order-check.js — 매 1시간마다 실행되는 주문 상태 점검 스케줄 함수
 *
 * 1. 진행 중인 주문의 상태를 원천사이트(공급처 API)에서 조회
 * 2. completed 상태이면 자동으로 '작업완료' 처리
 * 3. 3시간이 지나도 완료되지 않은 주문이 있으면 admin 계정에 사이트 알림 전송
 *
 * netlify.toml 에 아래 설정 필요:
 *   [functions."smm-hourly-order-check"]
 *     schedule = "0 * * * *"
 */

/** 공급처 status 문자열 → 한국어 주문 상태 */
function mapProviderStatus(status) {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === 'completed') return '작업완료';
  if (s === 'partial') return '부분완료';
  if (s === 'in progress') return '진행중';
  if (s === 'pending') return '대기중';
  if (s === 'processing') return '처리중';
  return null;
}

exports.handler = async () => {
  const supabaseUrl = (
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  ).replace(/\/$/, '');
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('[smm-hourly] Supabase 환경변수 없음');
    return { statusCode: 500, body: 'Missing env' };
  }

  const authHeaders = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    'Content-Type': 'application/json',
  };

  const now = new Date();

  // ── 1. 공급처 목록 조회 ───────────────────────────────────────
  const providersRes = await fetch(
    `${supabaseUrl}/rest/v1/smm_providers?select=id,name,api_url`,
    { headers: authHeaders }
  );
  if (!providersRes.ok) {
    console.error('[smm-hourly] providers 조회 실패:', await providersRes.text());
    return { statusCode: 500, body: 'providers fetch failed' };
  }
  const providers = await providersRes.json();

  const providerMap = new Map();
  for (const p of providers) {
    providerMap.set(p.name, { id: p.id, apiUrl: p.api_url });
  }

  // ── 2. 활성 주문 조회 (취소·완료 제외, order_time 포함) ────────
  const ordersRes = await fetch(
    `${supabaseUrl}/rest/v1/smm_orders?select=id,user_id,user_nickname,product_name,provider_name,external_order_id,status,initial_count,remains,order_time` +
      `&or=(status.eq.진행중,status.eq.대기중,status.eq.처리중,status.eq.부분완료,initial_count.is.null,initial_count.eq.0)`,
    { headers: authHeaders }
  );
  if (!ordersRes.ok) {
    console.error('[smm-hourly] orders 조회 실패:', await ordersRes.text());
    return { statusCode: 500, body: 'orders fetch failed' };
  }
  const allOrders = await ordersRes.json();

  // external_order_id가 유효하고 취소·완료가 아닌 주문만 처리
  const activeOrders = allOrders.filter(
    (o) =>
      o.external_order_id &&
      o.external_order_id !== 'PENDING' &&
      o.external_order_id !== 'FAILED' &&
      o.status !== '주문취소' &&
      o.status !== '작업완료'
  );

  console.log(`[smm-hourly] 활성 주문 ${activeOrders.length}건 점검 시작`);

  if (activeOrders.length === 0) {
    console.log('[smm-hourly] 점검 대상 주문 없음');
    return { statusCode: 200, body: 'no active orders' };
  }

  // ── 3. 공급처별로 그룹화 ─────────────────────────────────────
  const groups = new Map();
  for (const order of activeOrders) {
    const provider = providerMap.get(order.provider_name);
    if (!provider) continue;
    if (!groups.has(provider.id)) {
      groups.set(provider.id, { apiUrl: provider.apiUrl, extToOurId: new Map() });
    }
    groups.get(provider.id).extToOurId.set(order.external_order_id, {
      ourId: order.id,
      currentStatus: order.status,
      initialCount: order.initial_count,
    });
  }

  // ── 4. 공급처별 status API 호출 → 업데이트 목록 생성 ─────────
  // ourId → newStatus 매핑 (완료 처리된 주문 추적용)
  const completedIds = new Set();
  const updates = [];

  for (const [providerId, group] of groups) {
    const apiKey = process.env[`SMM_KEY_${String(providerId).toUpperCase()}`];
    if (!apiKey) {
      console.warn(`[smm-hourly] API 키 없음: SMM_KEY_${String(providerId).toUpperCase()}`);
      continue;
    }

    const extIds = [...group.extToOurId.keys()];
    const formData = new URLSearchParams({
      key: apiKey,
      action: 'status',
      orders: extIds.join(','),
    });

    try {
      const statusRes = await fetch(group.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });
      const statusData = await statusRes.json();
      const ordersData = statusData.orders || statusData;

      for (const [extId, data] of Object.entries(ordersData)) {
        const orderInfo = group.extToOurId.get(extId);
        if (!orderInfo) continue;

        const { ourId, currentStatus, initialCount } = orderInfo;
        const update = { id: ourId };

        const startCount = Number(data.start_count ?? 0);
        if (startCount > 0 && (!initialCount || initialCount === 0)) {
          update.initial_count = startCount;
        }

        if (currentStatus !== '작업완료' && data.remains != null) {
          update.remains = Number(data.remains);
        }

        const mappedStatus = mapProviderStatus(data.status);
        if (mappedStatus && mappedStatus !== currentStatus) {
          update.status = mappedStatus;
          if (mappedStatus === '작업완료') {
            completedIds.add(ourId);
          }
        }

        if (update.initial_count != null || update.remains != null || update.status != null) {
          updates.push(update);
        }
      }
    } catch (e) {
      console.error(`[smm-hourly] provider ${providerId} API 오류:`, e);
    }
  }

  // ── 5. DB 업데이트 (PATCH) ───────────────────────────────────
  let successCount = 0;
  if (updates.length > 0) {
    const patchResults = await Promise.all(
      updates.map(({ id, ...fields }) =>
        fetch(
          `${supabaseUrl}/rest/v1/smm_orders?id=eq.${encodeURIComponent(id)}`,
          {
            method: 'PATCH',
            headers: { ...authHeaders, Prefer: 'return=minimal' },
            body: JSON.stringify(fields),
          }
        ).then((r) => ({ id, fields, ok: r.ok }))
      )
    );

    successCount = patchResults.filter((r) => r.ok).length;
    patchResults.forEach(({ id, fields, ok }) => {
      if (ok) {
        const isCompleted = fields.status === '작업완료';
        console.log(
          `[smm-hourly] ${isCompleted ? '✅ 작업완료' : '업데이트'}: ${id} →`,
          JSON.stringify(fields)
        );
      } else {
        console.error(`[smm-hourly] 업데이트 실패: ${id}`);
      }
    });

    console.log(`[smm-hourly] ${successCount}/${updates.length}건 업데이트 완료 (완료처리: ${completedIds.size}건)`);
  } else {
    console.log('[smm-hourly] 업데이트할 내용 없음');
  }

  // ── 6. 3시간 초과 미완료 주문 → admin 알림 ───────────────────
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();

  // 이번 상태조회 후에도 여전히 미완료인 주문 중 3시간 초과된 것 수집
  // (새로 완료 처리된 주문은 제외)
  const incompleteOverdue = activeOrders.filter((o) => {
    if (completedIds.has(o.id)) return false;
    if (!o.order_time) return false;
    return o.order_time <= threeHoursAgo;
  });

  if (incompleteOverdue.length > 0) {
    console.log(`[smm-hourly] 3시간 초과 미완료 주문 ${incompleteOverdue.length}건 → admin 알림 전송`);
    await notifyAdmins(supabaseUrl, authHeaders, incompleteOverdue, now);
  } else {
    console.log('[smm-hourly] 3시간 초과 미완료 주문 없음');
  }

  return {
    statusCode: 200,
    body: `updated ${successCount} orders, ${completedIds.size} completed, ${incompleteOverdue.length} overdue`,
  };
};

/**
 * profiles 테이블에서 admin 계정을 조회하고 site_notifications에 알림을 삽입합니다.
 */
async function notifyAdmins(supabaseUrl, authHeaders, overdueOrders, now) {
  // admin 계정 목록 조회
  const adminsRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?role=eq.admin&select=id,nickname`,
    { headers: authHeaders }
  );
  if (!adminsRes.ok) {
    console.error('[smm-hourly] admin 계정 조회 실패:', await adminsRes.text());
    return;
  }
  const admins = await adminsRes.json();

  if (!admins || admins.length === 0) {
    console.warn('[smm-hourly] admin 계정이 없어 알림을 전송할 수 없습니다.');
    return;
  }

  // 알림 메시지 구성
  const orderSummary = overdueOrders
    .slice(0, 5) // 최대 5건까지 표시
    .map((o) => `· [${o.product_name}] ${o.user_nickname} (${o.status || '상태미상'})`)
    .join('\n');

  const moreCount = overdueOrders.length > 5 ? ` 외 ${overdueOrders.length - 5}건` : '';
  const message =
    `미완수된 작업이 있습니다. 확인하세요.\n\n` +
    `3시간 이상 미완료 주문: ${overdueOrders.length}건${moreCount}\n` +
    orderSummary;

  const title = `⚠️ 미완수 작업 ${overdueOrders.length}건`;

  // 각 admin에게 알림 삽입
  const notifications = admins.map((admin) => ({
    id: `NOTIF_HOURLY_${now.getTime()}_${admin.id.slice(0, 6)}`,
    user_id: admin.id,
    type: 'sns_activation',
    title,
    message,
    reason: null,
    is_read: false,
  }));

  const insertRes = await fetch(`${supabaseUrl}/rest/v1/site_notifications`, {
    method: 'POST',
    headers: { ...authHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify(notifications),
  });

  if (insertRes.ok) {
    const adminNames = admins.map((a) => a.nickname || a.id).join(', ');
    console.log(`[smm-hourly] admin 알림 전송 완료 (${adminNames}): ${title}`);
  } else {
    console.error('[smm-hourly] admin 알림 삽입 실패:', await insertRes.text());
  }
}
