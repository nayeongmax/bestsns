// Netlify Serverless Function: smm-api.js
// 이 코드는 서버에서만 실행되므로 보안이 매우 강력합니다.

exports.handler = async (event, context) => {
  // CORS 헤더 설정
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json; charset=UTF-8'
  };

  // OPTIONS 요청 처리 (Preflight)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const params = event.queryStringParameters || {};
    const body = event.body ? JSON.parse(event.body) : {};
    
    // 1. 전체 동기화 로직 (Batch Sync)
    if (event.httpMethod === 'POST' && body.providers) {
      const results = {};
      
      for (const p of body.providers) {
        const id = p.id;
        const url = p.apiUrl;
        // 환경 변수에서 키를 가져옴 (예: SMM_KEY_P1, SMM_KEY_P2 ...)
        const envKeyName = `SMM_KEY_${id.toUpperCase()}`;
        const apiKey = process.env[envKeyName];

        if (!apiKey) continue;

        try {
          const fetchResponse = await fetch(`${url}?key=${apiKey}&action=services`);
          const data = await fetchResponse.json();
          
          if (Array.isArray(data)) {
            results[id] = {};
            data.forEach(service => {
              results[id][service.service] = parseFloat(service.rate);
            });
          }
        } catch (err) {
          console.error(`Provider ${id} fetch error:`, err);
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'success', data: results })
      };
    }

    // 2. 공급처에 주문 전송 (Order Submit)
    if (event.httpMethod === 'POST' && body.action === 'submit') {
      const { providerId, apiUrl, serviceId, link, quantity } = body;
      const envKeyName = `SMM_KEY_${String(providerId).toUpperCase()}`;
      const apiKey = process.env[envKeyName];

      if (!apiKey) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ status: 'error', message: 'API 키가 설정되지 않았습니다.' })
        };
      }

      const formData = new URLSearchParams({
        key: apiKey,
        action: 'add',
        service: String(serviceId),
        link: String(link),
        quantity: String(quantity)
      });

      const fetchResponse = await fetch(String(apiUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });
      const data = await fetchResponse.json();

      console.log('[smm-api] JAP 응답 전체:', JSON.stringify(data));
      console.log('[smm-api] 요청 정보 - providerId:', providerId, '| apiUrl:', apiUrl, '| serviceId:', serviceId, '| quantity:', quantity);

      if (data.order) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ status: 'success', orderId: String(data.order) })
        };
      } else {
        const errMsg = data.error || JSON.stringify(data) || '공급처 주문 실패';
        console.error('[smm-api] JAP 주문 실패:', errMsg);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ status: 'error', message: errMsg })
        };
      }
    }

    // 3. 단일 가격 조회 로직 (Single Get Price)
    if (event.httpMethod === 'GET' && params.providerId && params.serviceId) {
      const { providerId, serviceId, apiUrl } = params;
      const envKeyName = `SMM_KEY_${providerId.toUpperCase()}`;
      const apiKey = process.env[envKeyName];

      if (!apiKey || !apiUrl) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ status: 'error', message: 'API 설정이 누락되었습니다.' })
        };
      }

      const fetchResponse = await fetch(`${apiUrl}?key=${apiKey}&action=services`);
      const services = await fetchResponse.json();
      
      let foundPrice = null;
      if (Array.isArray(services)) {
        const target = services.find(s => String(s.service) === String(serviceId));
        if (target) foundPrice = parseFloat(target.rate);
      }

      if (foundPrice !== null) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ status: 'success', price: foundPrice })
        };
      } else {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ status: 'error', message: '서비스를 찾을 수 없습니다.' })
        };
      }
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ status: 'error', message: '잘못된 요청 방식입니다.' })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ status: 'error', message: error.message })
    };
  }
};