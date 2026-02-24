// 회원 탈퇴: profiles 삭제 + auth.users(Users) 삭제 (Netlify에서만 배포하면 됨, Supabase CLI 불필요)
// Auth 삭제는 Supabase GoTrue REST API 직접 호출 (SDK 없이 service_role로 DELETE 요청)
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=UTF-8',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'POST만 지원합니다.' }),
    };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: '로그인이 필요합니다.' }),
    };
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: '서버 설정이 없습니다. Netlify Production 환경 변수에 SUPABASE_URL(또는 VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY(또는 SUPABASE_SERVICE_KEY) 를 넣어 주세요. Functions에는 Production 키가 적용됩니다.',
      }),
    };
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey || '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: '세션이 만료되었거나 유효하지 않습니다.' }),
      };
    }

    // 1) Supabase Auth Admin API 직접 호출 — auth.users(Users) 완전 삭제 (soft delete 아님)
    const authAdminUrl = `${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(user.id)}`;
    const authDeleteRes = await fetch(authAdminUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
      },
      body: JSON.stringify({ should_soft_delete: false }),
    });

    if (!authDeleteRes.ok) {
      const errText = await authDeleteRes.text();
      let errMsg = errText;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.msg || errJson.message || errJson.error_description || errText;
      } catch (_) {}
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: `Auth(Users) 삭제 실패: ${errMsg}`,
          code: 'AUTH_DELETE_FAILED',
          status: authDeleteRes.status,
        }),
      };
    }

    // 2) auth 삭제 성공 후 profiles 삭제
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: deleteProfileError } = await supabaseAdmin.from('profiles').delete().eq('id', user.id);
    if (deleteProfileError) {
      console.warn('profiles 삭제 실패 (auth는 삭제됨):', deleteProfileError.message);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: String(e.message || e) }),
    };
  }
};
