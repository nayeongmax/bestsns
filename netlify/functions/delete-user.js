// 회원 탈퇴: profiles 삭제 + auth.users(Users) 삭제 (Netlify에서만 배포하면 됨, Supabase CLI 불필요)
// Auth 삭제는 Supabase GoTrue REST API 직접 호출 (SDK 없이 service_role로 DELETE 요청)
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=UTF-8',
};

function json(body) {
  return { statusCode: 200, headers, body: JSON.stringify(body) };
}
function err(status, message) {
  return { statusCode: status, headers, body: JSON.stringify({ error: message }) };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers, body: '' };
    }
    if (event.httpMethod !== 'POST') {
      return err(405, 'POST만 지원합니다.');
    }

    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return err(401, '로그인이 필요합니다.');
    }

    // Functions 런타임에서는 VITE_* 변수가 없을 수 있음 → SUPABASE_URL 반드시 별도 설정 권장
    const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return err(500, '서버 설정이 없습니다. Netlify 환경 변수에 SUPABASE_URL과 SUPABASE_SERVICE_KEY(서비스 역할 키)를 **둘 다** 넣어 주세요. (Functions는 VITE_SUPABASE_URL을 사용하지 못할 수 있습니다.)');
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey || '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return err(401, '세션이 만료되었거나 유효하지 않습니다.');
    }

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
      return err(400, `Auth(Users) 삭제 실패: ${errMsg}`);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: deleteProfileError } = await supabaseAdmin.from('profiles').delete().eq('id', user.id);
    if (deleteProfileError) {
      console.warn('profiles 삭제 실패 (auth는 삭제됨):', deleteProfileError.message);
    }

    return json({ success: true });
  } catch (e) {
    return err(500, String(e && (e.message || e)) || '함수 실행 중 오류가 발생했습니다.');
  }
};
