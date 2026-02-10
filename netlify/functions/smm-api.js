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

    // 2. 단일 가격 조회 로직 (Single Get Price)
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