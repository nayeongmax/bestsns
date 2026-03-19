// Netlify Serverless Function: portone-webhook.js
// 포트원 V2 웹훅 수신 → 결제 취소(환불) 시 Supabase DB 상태 동기화

const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

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
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
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

  if (!PORTONE_API_SECRET) {
    console.error('[portone-webhook] PORTONE_API_SECRET not configured');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('[portone-webhook] Supabase env vars not configured');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Supabase configuration error' }) };
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
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing paymentId in webhook data' }) };
  }

  // 결제 취소 이벤트 처리
  if (type === 'Transaction.Cancelled' || type === 'Transaction.PartialCancelled') {
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
