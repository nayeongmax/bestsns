// Netlify Serverless Function: portone-webhook.js
// 포트원 V2 웹훅 수신 → 결제 완료/취소(환불) 시 Supabase DB 상태 동기화

const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

/**
 * 포트원 API에서 결제 정보 조회
 */
async function getPortonePayment(paymentId) {
  const res = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
    headers: {
      'Authorization': `PortOne ${PORTONE_API_SECRET}`,
    },
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

/**
 * Supabase REST API로 테이블 row 업데이트 (payment_id 기준)
 */
async function updateSupabaseByPaymentId(table, paymentId, updateData) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?payment_id=eq.${encodeURIComponent(paymentId)}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(updateData),
    }
  );
  return res;
}

/**
 * Supabase REST API로 테이블에 row 삽입
 */
async function insertSupabaseRow(table, rowData) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}`,
    {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(rowData),
    }
  );
  return res;
}

/**
 * Supabase REST API로 channel_orders 테이블 row 조회 (payment_id 기준)
 */
async function fetchChannelOrderByPaymentId(paymentId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/channel_orders?payment_id=eq.${encodeURIComponent(paymentId)}&select=id&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );
  if (!res.ok) return null;
  const rows = await res.json().catch(() => null);
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

/**
 * Supabase REST API로 store_orders 테이블 row 조회 (payment_id 기준)
 */
async function fetchStoreOrderByPaymentId(paymentId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/store_orders?payment_id=eq.${encodeURIComponent(paymentId)}&select=*&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );
  if (!res.ok) return null;
  const rows = await res.json().catch(() => null);
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=UTF-8',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { type, data } = body;
  const paymentId = data?.paymentId;

  console.log(`[portone-webhook] type=${type} paymentId=${paymentId}`);

  if (!paymentId) {
    console.log(`[portone-webhook] paymentId 없음 (type=${type}) → 200 반환 (재시도 방지)`);
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'No paymentId, event ignored' }) };
  }

  // 결제 완료 이벤트 처리 (Transaction.Paid)
  if (type === 'Transaction.Paid') {
    // env 미설정 시에도 200 반환 (포트원 재시도 방지)
    if (!PORTONE_API_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.warn('[portone-webhook] env vars not configured, skipping Transaction.Paid sync');
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'Transaction.Paid received (env not configured)' }) };
    }

    try {
      // 포트원 API로 결제 상태 재확인 (위변조 방지)
      const portonePayment = await getPortonePayment(paymentId);
      if (!portonePayment) {
        console.warn(`[portone-webhook] Transaction.Paid: Failed to fetch payment ${paymentId}`);
        return { statusCode: 200, headers, body: JSON.stringify({ message: 'Could not verify payment status' }) };
      }

      const status = portonePayment.status;
      console.log(`[portone-webhook] Transaction.Paid PortOne status for ${paymentId}: ${status}`);

      if (status === 'PAID') {
        // store_orders: 결제 완료 상태 동기화
        const existingStoreOrder = await fetchStoreOrderByPaymentId(paymentId);
        if (existingStoreOrder) {
          const r1 = await updateSupabaseByPaymentId('store_orders', paymentId, { status: '결제완료' });
          console.log(`[portone-webhook] Transaction.Paid store_orders status update: ${r1?.status}`);
        } else {
          console.log(`[portone-webhook] Transaction.Paid: store_order not found for ${paymentId} (클라이언트에서 생성 예정)`);
        }

        // channel_orders: payment_id 기준으로 결제완료 상태 동기화
        // 클라이언트에서 INSERT가 실패한 경우를 대비해 row 존재 여부 확인 후 없으면 INSERT
        const channelOrderExists = await fetchChannelOrderByPaymentId(paymentId);
        if (channelOrderExists) {
          const r2 = await updateSupabaseByPaymentId('channel_orders', paymentId, { status: '결제완료' });
          console.log(`[portone-webhook] Transaction.Paid channel_orders update: ${r2?.status}`);
        } else {
          // 클라이언트 INSERT가 실패한 경우: PortOne 결제 정보로 최소한의 row INSERT
          const orderName = portonePayment.orderName ?? '';
          const isChannelOrder = orderName.includes('[채널구매]');
          if (isChannelOrder) {
            const newRow = {
              id: `CO_webhook_${paymentId}`,
              user_id: portonePayment.customer?.customerId ?? 'unknown',
              user_nickname: portonePayment.customer?.fullName ?? 'unknown',
              order_time: portonePayment.paidAt ?? new Date().toISOString(),
              product_id: 'unknown',
              product_name: orderName.replace('[채널구매] ', ''),
              platform: '',
              price: portonePayment.amount?.total ?? 0,
              status: '결제완료',
              payment_id: paymentId,
              payment_method: 'CARD',
              receipt_url: portonePayment.receiptUrl ?? null,
            };
            const insertRes = await insertSupabaseRow('channel_orders', newRow);
            console.log(`[portone-webhook] Transaction.Paid channel_orders INSERT fallback: ${insertRes?.status}`);
          } else {
            console.log(`[portone-webhook] Transaction.Paid channel_orders: no row found but not a channel order (${orderName})`);
          }
        }

        // store_orders: 위에서 이미 처리됨 (existingStoreOrder 분기)
      }
    } catch (err) {
      console.error('[portone-webhook] Transaction.Paid 처리 중 오류:', err);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Transaction.Paid 처리 완료', paymentId }),
    };
  }

  // 결제 취소 이벤트 처리 (Transaction.Cancelled / Transaction.PartialCancelled)
  if (type === 'Transaction.Cancelled' || type === 'Transaction.PartialCancelled') {
    // env 미설정 시에도 200 반환 (포트원 재시도 방지)
    if (!PORTONE_API_SECRET) {
      console.warn('[portone-webhook] PORTONE_API_SECRET not configured');
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'Cancellation received (env not configured)' }) };
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.warn('[portone-webhook] Supabase env vars not configured');
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'Cancellation received (supabase env not configured)' }) };
    }

    // 포트원 API로 실제 상태 재확인 (위변조 방지)
    const portonePayment = await getPortonePayment(paymentId);
    if (!portonePayment) {
      console.warn(`[portone-webhook] Failed to fetch payment ${paymentId} from PortOne`);
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'Could not verify payment status' }) };
    }

    const status = portonePayment.status;
    console.log(`[portone-webhook] PortOne status for ${paymentId}: ${status}`);

    if (status === 'CANCELLED') {
      // orders 테이블 업데이트
      const r1 = await updateSupabaseByPaymentId('orders', paymentId, { status: '환불완료' });
      console.log(`[portone-webhook] orders update: ${r1?.status}`);

      // channel_orders 테이블 업데이트
      const r2 = await updateSupabaseByPaymentId('channel_orders', paymentId, { status: 'refunded' });
      console.log(`[portone-webhook] channel_orders update: ${r2?.status}`);

      // store_orders 테이블 업데이트
      const r3 = await updateSupabaseByPaymentId('store_orders', paymentId, { status: '취소' });
      console.log(`[portone-webhook] store_orders update: ${r3?.status}`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: '환불 상태 동기화 완료', paymentId }),
      };
    }
  }

  // 다른 이벤트 타입은 무시하고 200 반환 (포트원이 재시도하지 않도록)
  return { statusCode: 200, headers, body: JSON.stringify({ message: 'Event received', type }) };
};
