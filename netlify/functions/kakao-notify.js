/**
 * kakao-notify.js — 카카오 알림톡 발송 (운영자 알림)
 *
 * 카카오 비즈메시지 API (알림톡)를 통해 운영자에게 알림을 발송합니다.
 *
 * 필요한 환경 변수 (Netlify > Environment Variables):
 *   KAKAO_API_KEY       — 솔라피(Solapi) 또는 카카오 알림톡 서비스 API 키
 *   KAKAO_API_SECRET    — API Secret
 *   KAKAO_SENDER_KEY    — 카카오 채널 발신 프로필 키 (senderKey)
 *   KAKAO_PHONE         — 운영자 휴대폰 번호 (예: 01012345678)
 *   KAKAO_TEMPLATE_ORDER_FAIL  — 주문 전체 실패 알림 템플릿 코드
 *   KAKAO_TEMPLATE_AUTO_DISABLE — 공급처 자동비활성화 알림 템플릿 코드
 *
 * ※ 솔라피(Solapi) 기준으로 구현되어 있습니다. https://solapi.com
 *   다른 알림톡 서비스 사용 시 API 요청 부분을 수정하세요.
 *
 * POST /.netlify/functions/kakao-notify
 *   { type: 'order_all_failed', productName, platform, quantity, userId, userNickname, triedProviders }
 *   { type: 'provider_auto_disabled', providerId, successRate }
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=UTF-8',
};

function resp(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

/**
 * HMAC-SHA256 서명 생성 (솔라피 인증용)
 * Node.js 내장 crypto 사용
 */
function createSolapiSignature(apiKey, apiSecret) {
  const crypto = require('crypto');
  const date = new Date().toISOString();
  const salt = Math.random().toString(36).substring(2, 12);
  const data = `${date}${salt}`;
  const signature = crypto.createHmac('sha256', apiSecret).update(data).digest('hex');
  return {
    Authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
  };
}

/**
 * 솔라피 알림톡 발송
 */
async function sendSolapiAlimtalk({ apiKey, apiSecret, senderKey, to, templateCode, variables }) {
  const authHeader = createSolapiSignature(apiKey, apiSecret);

  const payload = {
    message: {
      to,
      from: to, // 솔라피는 발신번호 별도 등록 필요, 여기선 수신번호로 대체
      kakaoOptions: {
        senderKey,
        templateCode,
        variables,
      },
    },
  };

  const res = await fetch('https://api.solapi.com/messages/v4/send', {
    method: 'POST',
    headers: {
      ...authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = await res.json();
  if (!res.ok || result.errorCode) {
    throw new Error(result.errorMessage || result.errorCode || '알림톡 발송 실패');
  }
  return result;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return resp(405, { error: 'Method not allowed' });
  }

  const apiKey      = process.env.KAKAO_API_KEY;
  const apiSecret   = process.env.KAKAO_API_SECRET;
  const senderKey   = process.env.KAKAO_SENDER_KEY;
  const operatorPhone = process.env.KAKAO_PHONE;

  // 환경변수 미설정 시 조용히 성공 처리 (알림톡 미사용 운영 가능)
  if (!apiKey || !apiSecret || !senderKey || !operatorPhone) {
    console.warn('[kakao-notify] 환경변수 미설정. 알림톡을 건너뜁니다.');
    return resp(200, { success: true, skipped: true });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return resp(400, { error: 'Invalid JSON' });
  }

  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  try {
    if (body.type === 'order_all_failed') {
      const templateCode = process.env.KAKAO_TEMPLATE_ORDER_FAIL;
      if (!templateCode) {
        console.warn('[kakao-notify] KAKAO_TEMPLATE_ORDER_FAIL 미설정');
        return resp(200, { success: true, skipped: true });
      }

      await sendSolapiAlimtalk({
        apiKey,
        apiSecret,
        senderKey,
        to: operatorPhone,
        templateCode,
        variables: {
          '#{시각}':       now,
          '#{상품명}':     String(body.productName ?? ''),
          '#{플랫폼}':     String(body.platform ?? ''),
          '#{수량}':       String(body.quantity ?? ''),
          '#{사용자}':     String(body.userNickname ?? body.userId ?? ''),
          '#{공급처목록}': String(body.triedProviders ?? ''),
        },
      });

      console.log('[kakao-notify] 주문 전체 실패 알림 발송 완료');
      return resp(200, { success: true });

    } else if (body.type === 'provider_auto_disabled') {
      const templateCode = process.env.KAKAO_TEMPLATE_AUTO_DISABLE;
      if (!templateCode) {
        console.warn('[kakao-notify] KAKAO_TEMPLATE_AUTO_DISABLE 미설정');
        return resp(200, { success: true, skipped: true });
      }

      await sendSolapiAlimtalk({
        apiKey,
        apiSecret,
        senderKey,
        to: operatorPhone,
        templateCode,
        variables: {
          '#{시각}':      now,
          '#{공급처ID}':  String(body.providerId ?? ''),
          '#{성공률}':    String(body.successRate ?? ''),
        },
      });

      console.log('[kakao-notify] 공급처 자동 비활성화 알림 발송 완료:', body.providerId);
      return resp(200, { success: true });

    } else {
      return resp(400, { error: `알 수 없는 type: ${body.type}` });
    }
  } catch (e) {
    console.error('[kakao-notify] 발송 오류:', e.message);
    // 알림 실패가 주문 처리를 막아서는 안 되므로 200 반환
    return resp(200, { success: false, error: e.message });
  }
};
