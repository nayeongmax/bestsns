// Netlify Serverless Function: portone-refund.js
// 서버에서 PORTONE_API_SECRET를 사용해 환불 처리

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=UTF-8'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const apiSecret = process.env.PORTONE_API_SECRET;
  if (!apiSecret) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'PORTONE_API_SECRET not configured' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { paymentId, reason } = body;
  if (!paymentId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'paymentId is required' }) };
  }

  try {
    const res = await fetch(`https://api.portone.io/payments/${paymentId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `PortOne ${apiSecret}`,
      },
      body: JSON.stringify({ reason: reason || '관리자 환불 처리' }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // 이미 취소된 결제인 경우 성공으로 처리 (실제 카드 환불은 완료된 상태)
      const alreadyCancelledTypes = ['ALREADY_CANCELLED', 'CANCELLATION_NOT_ALLOWED'];
      if (alreadyCancelledTypes.includes(data.type)) {
        return { statusCode: 200, headers, body: JSON.stringify({ ...data, alreadyCancelled: true }) };
      }
      return {
        statusCode: res.status,
        headers,
        body: JSON.stringify({ error: data.message || `환불 실패 (HTTP ${res.status})` }),
      };
    }

    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
