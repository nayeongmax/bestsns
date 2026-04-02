/**
 * smm-sync-initial-count.js — 최초수량(initial_count) 자동 동기화 스케줄 함수
 *
 * 매 5분마다 자동 실행되어, initial_count가 0이거나 NULL인 주문에 대해
 * 공급처 API에서 start_count를 조회하고 DB에 업데이트합니다.
 *
 * netlify.toml 에 아래 설정 필요:
 *   [functions."smm-sync-initial-count"]
 *     schedule = "*/5 * * * *"
 */

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

  // 2. initial_count가 0이거나 NULL인 주문 조회 (취소 제외)
  const ordersRes = await fetch(
    `${supabaseUrl}/rest/v1/smm_orders?select=id,provider_name,external_order_id,status&or=(initial_count.is.null,initial_count.eq.0)`,
    { headers: authHeaders }
  );
  if (!ordersRes.ok) {
    console.error('[smm-sync] orders 조회 실패:', await ordersRes.text());
    return { statusCode: 500, body: 'orders fetch failed' };
  }
  const allOrders = await ordersRes.json();

  // PENDING/FAILED/취소 주문 제외
  const orders = allOrders.filter(
    (o) =>
      o.external_order_id &&
      o.external_order_id !== 'PENDING' &&
      o.external_order_id !== 'FAILED' &&
      o.status !== '주문취소'
  );

  if (orders.length === 0) {
    console.log('[smm-sync] 동기화 대상 주문 없음');
    return { statusCode: 200, body: 'no orders to sync' };
  }

  console.log(`[smm-sync] 동기화 대상 주문 ${orders.length}건`);

  // 3. 공급처별 그룹화
  // providerId → { apiUrl, extToOurId: Map<externalOrderId, ourOrderId> }
  const groups = new Map();
  for (const order of orders) {
    const provider = providerMap.get(order.provider_name);
    if (!provider) continue;
    if (!groups.has(provider.id)) {
      groups.set(provider.id, { apiUrl: provider.apiUrl, extToOurId: new Map() });
    }
    groups.get(provider.id).extToOurId.set(order.external_order_id, order.id);
  }

  // 4. 공급처별 status API 호출 → start_count 수집
  const updates = []; // { id, initial_count }

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
        const startCount = Number(data.start_count ?? 0);
        if (startCount > 0) {
          const ourId = group.extToOurId.get(extId);
          if (ourId) {
            updates.push({ id: ourId, initial_count: startCount });
          }
        }
      }
    } catch (e) {
      console.error(`[smm-sync] provider ${providerId} status API 오류:`, e);
    }
  }

  if (updates.length === 0) {
    console.log('[smm-sync] 업데이트할 start_count 없음 (모두 0 또는 미제공)');
    return { statusCode: 200, body: 'no start_count available yet' };
  }

  // 5. initial_count만 PATCH (다른 컬럼 보존)
  const patchResults = await Promise.all(
    updates.map(({ id, initial_count }) =>
      fetch(
        `${supabaseUrl}/rest/v1/smm_orders?id=eq.${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: { ...authHeaders, Prefer: 'return=minimal' },
          body: JSON.stringify({ initial_count }),
        }
      ).then((r) => ({ id, initial_count, ok: r.ok }))
    )
  );

  const successCount = patchResults.filter((r) => r.ok).length;
  patchResults.forEach(({ id, initial_count, ok }) => {
    if (ok) {
      console.log(`[smm-sync] 업데이트 완료: ${id} → initial_count=${initial_count}`);
    } else {
      console.error(`[smm-sync] 업데이트 실패: ${id}`);
    }
  });

  console.log(`[smm-sync] ${successCount}/${updates.length}건 업데이트 완료`);
  return { statusCode: 200, body: `updated ${successCount} orders` };
};
