// Netlify Serverless Function: smm-api.js
// 이 코드는 서버에서만 실행되므로 보안이 매우 강력합니다.

// JAP average_time 문자열 → 분(number) 변환
// 예: "1 hour" → 60, "30 minutes" → 30, "2 hours" → 120, "1 day" → 1440, "Not enough data" → null
function parseAvgTimeToMinutes(avgTime) {
  if (!avgTime || typeof avgTime !== 'string') return null;
  const s = avgTime.toLowerCase().trim();
  if (!s || s === 'not enough data' || s === 'n/a' || s === '-') return null;
  if (/^\d+$/.test(s)) return parseInt(s);
  let total = 0;
  const days  = s.match(/(\d+)\s*day/);
  const hours = s.match(/(\d+)\s*hour/);
  const mins  = s.match(/(\d+)\s*min/);
  if (days)  total += parseInt(days[1])  * 1440;
  if (hours) total += parseInt(hours[1]) * 60;
  if (mins)  total += parseInt(mins[1]);
  return total > 0 ? total : null;
}

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
    
    // 1. 전체 동기화 로직 (Batch Sync) — 원가 + 평균 소요시간 동시 반환
    if (event.httpMethod === 'POST' && body.providers) {
      const results  = {};  // { providerId: { serviceId: rate } }
      const avgTimes = {};  // { providerId: { serviceId: minutes|null } }

      for (const p of body.providers) {
        const id = p.id;
        const url = p.apiUrl;
        const envKeyName = `SMM_KEY_${id.toUpperCase()}`;
        const apiKey = process.env[envKeyName];

        if (!apiKey) continue;

        try {
          const fetchResponse = await fetch(`${url}?key=${apiKey}&action=services`);
          const data = await fetchResponse.json();

          if (Array.isArray(data)) {
            results[id]  = {};
            avgTimes[id] = {};
            data.forEach(service => {
              results[id][service.service]  = parseFloat(service.rate);
              avgTimes[id][service.service] = parseAvgTimeToMinutes(service.average_time);
            });
          }
        } catch (err) {
          console.error(`Provider ${id} fetch error:`, err);
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'success', data: results, avgTimes })
      };
    }

    // 2. 공급처에 주문 전송 (Order Submit)
    if (event.httpMethod === 'POST' && body.action === 'submit') {
      const { providerId, apiUrl, serviceId, link, quantity } = body;
      const envKeyName = `SMM_KEY_${String(providerId).toUpperCase()}`;
      const apiKey = process.env[envKeyName];

      if (!apiKey) {
        console.error(`[smm-api] API 키 없음: ${envKeyName} (providerId: ${providerId})`);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ status: 'error', message: `API 키 미설정 (${envKeyName})` })
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
      let foundAvgTime = null;
      if (Array.isArray(services)) {
        const target = services.find(s => String(s.service) === String(serviceId));
        if (target) {
          foundPrice   = parseFloat(target.rate);
          foundAvgTime = parseAvgTimeToMinutes(target.average_time);
        }
      }

      if (foundPrice !== null) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ status: 'success', price: foundPrice, avgTime: foundAvgTime })
        };
      } else {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ status: 'error', message: '서비스를 찾을 수 없습니다.' })
        };
      }
    }

    // 4. 원가 변동 감지 (Price Change Check)
    if (event.httpMethod === 'POST' && body.action === 'checkPrices') {
      const { providers, sources } = body;

      // 각 공급처의 전체 서비스 목록 조회
      const fetchedServices = {};

      for (const p of (providers || [])) {
        const envKeyName = `SMM_KEY_${String(p.id).toUpperCase()}`;
        const apiKey = process.env[envKeyName];
        if (!apiKey) continue;

        try {
          const fetchResponse = await fetch(`${p.apiUrl}?key=${apiKey}&action=services`);
          const data = await fetchResponse.json();
          if (Array.isArray(data)) {
            fetchedServices[p.id] = {};
            data.forEach(service => {
              fetchedServices[p.id][String(service.service)] = {
                rate: parseFloat(service.rate),
                min: service.min,
                max: service.max,
                name: service.name,
                avgTime: parseAvgTimeToMinutes(service.average_time),
              };
            });
          }
        } catch (err) {
          console.error(`Provider ${p.id} price check error:`, err);
        }
      }

      // 등록된 소스와 현재 JAP 가격 비교
      const changes = [];
      for (const src of (sources || [])) {
        const providerServices = fetchedServices[src.providerId];
        if (!providerServices) continue;

        const serviceData = providerServices[String(src.serviceId)];
        if (!serviceData) {
          // 서비스가 더 이상 목록에 없음 (판매 중지 가능성)
          changes.push({
            providerId: src.providerId,
            serviceId: src.serviceId,
            type: 'unavailable',
            oldPrice: src.currentCostPrice,
            newPrice: null,
            productNames: src.productNames || [],
          });
        } else if (Math.abs(serviceData.rate - src.currentCostPrice) > 0.0001) {
          // 원가 변동 감지
          changes.push({
            providerId: src.providerId,
            serviceId: src.serviceId,
            type: 'price_changed',
            oldPrice: src.currentCostPrice,
            newPrice: serviceData.rate,
            productNames: src.productNames || [],
          });
        }
      }

      // latestRates: { providerId: { serviceId: rate } }, avgTimes: { providerId: { serviceId: minutes } }
      const latestRates = {};
      const avgTimes    = {};
      for (const [pid, services] of Object.entries(fetchedServices)) {
        latestRates[pid] = {};
        avgTimes[pid]    = {};
        for (const [sid, data] of Object.entries(services)) {
          latestRates[pid][sid] = data.rate;
          avgTimes[pid][sid]    = data.avgTime;
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'success', changes, latestRates, avgTimes }),
      };
    }

    // 5. 공급처 주문 상태 조회 (Order Status Check)
    if (event.httpMethod === 'POST' && body.action === 'orderStatus') {
      const { providerId, apiUrl, orderIds } = body;
      const envKeyName = `SMM_KEY_${String(providerId).toUpperCase()}`;
      const apiKey = process.env[envKeyName];

      if (!apiKey) {
        return { statusCode: 400, headers, body: JSON.stringify({ status: 'error', message: 'API 키가 설정되지 않았습니다.' }) };
      }

      const formData = new URLSearchParams({
        key: apiKey,
        action: 'status',
        orders: orderIds.join(','),
      });

      console.log('[smm-api] orderStatus 요청 - providerId:', providerId, '| orderIds:', orderIds);
      const fetchResponse = await fetch(String(apiUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });
      const data = await fetchResponse.json();
      console.log('[smm-api] orderStatus 응답:', JSON.stringify(data));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'success', orders: data.orders || data }),
      };
    }

    return {
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