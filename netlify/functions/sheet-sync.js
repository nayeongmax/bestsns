const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const code = (event.queryStringParameters?.code || '').trim().toUpperCase();
  if (!code || code.length < 4 || code.length > 20) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: '동기화 코드가 유효하지 않습니다.' }) };
  }

  // GET: 불러오기
  if (event.httpMethod === 'GET') {
    const { data, error } = await supabase
      .from('sheet_sync')
      .select('payload, updated_at')
      .eq('code', code)
      .single();

    if (error || !data) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: '해당 코드의 데이터가 없습니다.' }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ payload: data.payload, updated_at: data.updated_at }) };
  }

  // POST: 저장
  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body); } catch {
      return { statusCode: 400, headers, body: JSON.stringify({ error: '잘못된 요청입니다.' }) };
    }

    const { error } = await supabase
      .from('sheet_sync')
      .upsert({ code, payload: body.payload, updated_at: new Date().toISOString() }, { onConflict: 'code' });

    if (error) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: '저장 실패: ' + error.message }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
