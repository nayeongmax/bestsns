/**
 * smm-sync-initial-count.js — 주문 상태 자동 동기화 스케줄 함수
 *
 * 매 5분마다 자동 실행되어, 진행 중인 주문에 대해 공급처 API에서
 * start_count, remains, status를 조회하고 DB에 업데이트합니다.
 *
 * netlify.toml 에 아래 설정 필요:
 *   [functions."smm-sync-initial-count"]
 *     schedule = "*/5 * * * *"
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
  // Canceled/Refunded는 환불·재시도 로직이 필요하므로 여기서는 처리하지 않음
  // (관리자 화면의 handleCheckOrderStatuses에서 처리)
  return null;
}

exports.handler = async () => {
  const supabaseUrl = (
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  ).replace(/\/$/, '');
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('[smm-sync] Supabase 환경변수 없음');
    return { statusCode: 500, body: 'Missing env' };
  }

  const authHeaders = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    'Content-Type': 'application/json',
  };

  // 1. 공급처 목록 조회
  const providersRes = await fetch(
    `${supabaseUrl}/rest/v1/smm_providers?select=id,name,api_url`,
    { headers: authHeaders }
  );
  if (!providersRes.ok) {
    console.error('[smm-sync] providers 조회 실패:', await providersRes.text());
    return { statusCode: 500, body: 'providers fetch failed' };
  }
  const providers = await providersRes.json();

  // provider name → { id, apiUrl } 맵
  const providerMap = new Map();
  for (const p of providers) {
    providerMap.set(p.name, { id: p.id, apiUrl: p.api_url });
  }

  // 2. 진행 중인 주문(모든 활성 상태) OR initial_count가 0/NULL인 주문 조회 (취소/완료 제외)
  const ordersRes = await fetch(
    `${supabaseUrl}/rest/v1/smm_orders?select=id,provider_name,external_order_id,status,initial_count,remains&or=(status.eq.진행중,status.eq.대기중,status.eq.처리중,status.eq.부분완료,initial_count.is.null,initial_count.eq.0)`,
    { headers: authHeaders }
  );
  if (!ordersRes.ok) {
    console.error('[smm-sync] orders 조회 실패:', await ordersRes.text());
    return { statusCode: 500, body: 'orders fetch failed' };
  }
  const allOrders = await ordersRes.json();

  // PENDING/FAILED/취소/완료 주문 제외
  const orders = allOrders.filter(
    (o) =>
      o.external_order_id &&
      o.external_order_id !== 'PENDING' &&
      o.external_order_id !== 'FAILED' &&
      o.status !== '주문취소' &&
      o.status !== '작업완료'
  );

  if (orders.length === 0) {
    console.log('[smm-sync] 동기화 대상 주문 없음');
    return { statusCode: 200, body: 'no orders to sync' };
  }

  console.log(`[smm-sync] 동기화 대상 주문 ${orders.length}건`);

  // 3. 공급처별 그룹화
  // providerId → { apiUrl, extToOurId: Map<externalOrderId, { ourId, currentStatus, initialCount }> }
  const groups = new Map();
  for (const order of orders) {
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

  // 4. 공급처별 status API 호출 → start_count, remains, status 수집
  const updates = []; // { id, initial_count?, remains?, status? }

  for (const [providerId, group] of groups) {
    const apiKey = process.env[`SMM_KEY_${String(providerId).toUpperCase()}`];
    if (!apiKey) {
      console.warn(`[smm-sync] API 키 없음: SMM_KEY_${String(providerId).toUpperCase()}`);
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

        // start_count → initial_count (아직 0/null인 경우만)
        const startCount = Number(data.start_count ?? 0);
        if (startCount > 0 && (!initialCount || initialCount === 0)) {
          update.initial_count = startCount;
        }

        // remains 업데이트 (작업완료 제외)
        if (currentStatus !== '작업완료' && data.remains != null) {
          update.remains = Number(data.remains);
        }

        // status 업데이트: Completed → 작업완료
        const mappedStatus = mapProviderStatus(data.status);
        if (mappedStatus && mappedStatus !== currentStatus) {
          update.status = mappedStatus;
        }

        // 실제 업데이트할 내용이 있는 경우만 추가
        if (update.initial_count != null || update.remains != null || update.status != null) {
          updates.push(update);
        }
      }
    } catch (e) {
      console.error(`[smm-sync] provider ${providerId} status API 오류:`, e);
    }
  }

  if (updates.length === 0) {
    console.log('[smm-sync] 업데이트할 내용 없음');
    return { statusCode: 200, body: 'no updates available yet' };
  }

  // 5. PATCH (업데이트할 필드만)
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

  const successCount = patchResults.filter((r) => r.ok).length;
  patchResults.forEach(({ id, fields, ok }) => {
    if (ok) {
      console.log(`[smm-sync] 업데이트 완료: ${id} →`, JSON.stringify(fields));
    } else {
      console.error(`[smm-sync] 업데이트 실패: ${id}`);
    }
  });

  console.log(`[smm-sync] ${successCount}/${updates.length}건 업데이트 완료`);

  // ── 6. 공급처 성공률 주기적 체크 → 80% 미만이면 자동 비활성화 ──────────
  try {
    await checkAndAutoDisableProviders(supabaseUrl, authHeaders);
  } catch (e) {
    console.warn('[smm-sync] 공급처 자동비활성화 체크 실패:', e.message);
  }

  return { statusCode: 200, body: `updated ${successCount} orders` };
};

/**
 * smm_provider_stats 테이블을 읽어 성공률 80% 미만 공급처를 자동 비활성화.
 * 10건 미만 시도는 아직 데이터 부족이라 판단하여 건너뜀.
 */
async function checkAndAutoDisableProviders(supabaseUrl, authHeaders) {
  const statsRes = await fetch(
    `${supabaseUrl}/rest/v1/smm_provider_stats?select=id,total_attempts,success_rate,auto_disabled`,
    { headers: authHeaders }
  );
  if (!statsRes.ok) return;
  const stats = await statsRes.json();

  for (const stat of stats) {
    if (stat.auto_disabled) continue;
    if ((stat.total_attempts ?? 0) < 10) continue;
    if ((stat.success_rate ?? 100) < 80) {
      console.log(`[smm-sync] 공급처 ${stat.id} 성공률 ${stat.success_rate}% → 자동 비활성화`);
      await fetch(
        `${supabaseUrl}/rest/v1/smm_providers?id=eq.${encodeURIComponent(stat.id)}`,
        {
          method: 'PATCH',
          headers: { ...authHeaders, Prefer: 'return=minimal' },
          body: JSON.stringify({ is_hidden: true }),
        }
      );
      await fetch(
        `${supabaseUrl}/rest/v1/smm_provider_stats?id=eq.${encodeURIComponent(stat.id)}`,
        {
          method: 'PATCH',
          headers: { ...authHeaders, Prefer: 'return=minimal' },
          body: JSON.stringify({ auto_disabled: true, updated_at: new Date().toISOString() }),
        }
      );
      // 카카오 알림
      const siteUrl = process.env.URL;
      if (siteUrl) {
        fetch(`${siteUrl}/.netlify/functions/kakao-notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'provider_auto_disabled',
            providerId: stat.id,
            successRate: stat.success_rate,
          }),
        }).catch(() => {});
      }
    }
  }
}
