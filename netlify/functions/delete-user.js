// 회원 탈퇴: profiles 삭제 + auth.users(Users) 삭제 (Netlify에서만 배포하면 됨, Supabase CLI 불필요)
// ESM 프로젝트라 require() 사용 시 Netlify에서 실패함 → handler 안에서 import() 사용
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

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: '서버 설정이 없습니다. Netlify에 SUPABASE_URL(또는 VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY(또는 SUPABASE_SERVICE_KEY) 를 넣어 주세요.',
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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) auth.users 삭제를 먼저 수행 (실패 시 profiles는 건드리지 않음)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteAuthError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: deleteAuthError.message,
          code: 'AUTH_DELETE_FAILED',
        }),
      };
    }

    // 2) auth 삭제 성공 후 profiles 삭제
    const { error: deleteProfileError } = await supabaseAdmin.from('profiles').delete().eq('id', user.id);
    if (deleteProfileError) {
      // auth는 이미 삭제됨 — profiles만 실패. 클라이언트에는 성공으로 처리해도 됨
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
