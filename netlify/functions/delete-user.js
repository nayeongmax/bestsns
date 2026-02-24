/**
 * 회원 탈퇴: auth.users에서 사용자 삭제
 * - Supabase service_role key로 admin API 호출 (클라이언트에서 직접 호출 불가)
 * - 탈퇴 시 DB 트리거(supabase-auth-profiles-trigger.sql)가 profiles도 자동 삭제
 *
 * 환경변수 (Netlify 대시보드에서 설정):
 *   SUPABASE_URL         - https://xxxxx.supabase.co
 *   SUPABASE_SERVICE_KEY - Supabase service_role key (Settings > API > service_role)
 */
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // 요청자의 access token 검증
  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!accessToken) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || '';

  if (!supabaseUrl || !serviceKey) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: 'Server not configured: SUPABASE_URL or SUPABASE_SERVICE_KEY missing' }),
    };
  }

  // access token으로 현재 유저 정보 조회 (본인 확인)
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'apikey': serviceKey,
    },
  });

  if (!userRes.ok) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) };
  }

  const userData = await userRes.json();
  const userId = userData?.id;

  if (!userId) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Could not identify user' }) };
  }

  // service_role key로 auth.users 삭제 (트리거가 profiles도 자동 삭제)
  const deleteRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
    },
  });

  if (!deleteRes.ok) {
    const errBody = await deleteRes.text();
    console.error('[delete-user] auth.users 삭제 실패:', errBody);
    return {
      statusCode: deleteRes.status,
      headers,
      body: JSON.stringify({ error: 'Failed to delete user', detail: errBody }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true }),
  };
};
