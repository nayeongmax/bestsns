
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '../types';
import { supabase } from '../supabase';

interface Props {
  onLoginSuccess: (user: UserProfile) => void;
}

type AuthMode = 'LOGIN' | 'JOIN' | 'FIND_ID' | 'FIND_PW' | 'RESET_PW';

const SAVED_LOGIN_ID_KEY = 'saved_login_id';

const AuthPage: React.FC<Props> = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [loading, setLoading] = useState(false);
  const [saveId, setSaveId] = useState(() => !!localStorage.getItem(SAVED_LOGIN_ID_KEY));
  const [resendCooldown, setResendCooldown] = useState(0);

  const [formData, setFormData] = useState({
    id: localStorage.getItem(SAVED_LOGIN_ID_KEY) || '',
    pw: '',
    pwConfirm: '',
    name: '',
    email: '',
    phone: '',
    agreeTerms: false
  });

  const [showEmailLogin, setShowEmailLogin] = useState(false);

  const buildProfileFromSession = async (user: { id: string; email?: string; user_metadata?: Record<string, unknown> }) => {
    const meta = user.user_metadata || {};
    const email = (user.email || '').trim().toLowerCase();
    const { data: profileRow } = await supabase.from('profiles').select('id, nickname, profile_image, phone').eq('email', email).maybeSingle();
    const id = (profileRow?.id || (meta.user_id as string) || (meta.sub as string) || email.split('@')[0] || user.id).toString();
    const nickname = (profileRow?.nickname || (meta.nickname as string) || (meta.name as string) || (meta.full_name as string) || id).toString();
    const profileImage = (profileRow?.profile_image || (meta.avatar_url as string) || (meta.picture as string) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`).toString();
    return {
      id,
      nickname,
      profileImage,
      email: user.email || email,
      phone: (profileRow?.phone as string) || '',
      role: 'user' as const,
      points: 0,
      joinDate: new Date().toISOString().split('T')[0],
      coupons: [] as any[]
    } as UserProfile;
  };

  // 로그인 페이지에서는 기존 세션으로 자동 로그인하지 않음. OAuth 복귀 시에만 세션으로 로그인 처리.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('RESET_PW');
      // SIGNED_IN은 페이지 로드 시 기존 세션 복원에서도 발생하므로 여기서 리다이렉트하지 않음.
      // 이메일/소셜 로그인은 각각 폼 제출·OAuth 복귀 처리에서만 로그인 완료함.
    });

    const checkHashToken = () => {
      const hash = window.location.hash;
      if (hash.includes('type=recovery')) setMode('RESET_PW');
      // 소셜 로그인 복귀: URL에 access_token이 있을 때만 세션 확인 후 로그인 (자동 로그인 아님)
      if (hash.includes('access_token=')) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            buildProfileFromSession(session.user).then(profile => {
              onLoginSuccess(profile);
              navigate('/sns', { replace: true });
            });
          }
        });
      }
    };
    checkHashToken();
    window.addEventListener('hashchange', checkHashToken);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('hashchange', checkHashToken);
    };
  }, [mode]);

  // 재전송 쿨다운 타이머
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const loginId = formData.id.trim();
    const loginPw = formData.pw;

    const adminId = (import.meta.env.VITE_ADMIN_ID || 'admin').trim();
    const adminPw = import.meta.env.VITE_ADMIN_PASSWORD;
    if (adminPw && loginId === adminId && loginPw === adminPw) {
        const adminUser: UserProfile = {
            id: adminId,
            nickname: '마케터김',
            profileImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=admin`,
            role: 'admin',
            email: 'admin@thebestsns.com',
            phone: '010-0000-0000',
            points: 999999,
            joinDate: '2024-01-01',
            coupons: []
        };
        onLoginSuccess(adminUser);
        navigate('/sns');
        setLoading(false);
        return;
    }

    try {
      let targetEmail = '';
      let resolvedId = loginId;
      const idLower = loginId.trim().toLowerCase();
      const members = JSON.parse(localStorage.getItem('site_members_v2') || '[]');
      let localUser = members.find((m: any) => m.id?.toLowerCase() === idLower || m.id === loginId);

      const isEmailInput = loginId.includes('@');

      if (isEmailInput) {
        targetEmail = loginId.trim().toLowerCase();
        const byEmail = members.find((m: any) => m.email?.toLowerCase() === targetEmail);
        if (byEmail) localUser = byEmail;
      } else if (localUser?.email) {
        targetEmail = localUser.email;
      } else {
        // profiles 조회: 먼저 소문자 id로, 없으면 대소문자 무시(ilike)로 (기존 가입자 호환)
        let profileRow = (await supabase.from('profiles').select('id, email, nickname, profile_image, phone').eq('id', idLower).maybeSingle()).data;
        if (!profileRow?.email) {
          const ilikeRes = await supabase.from('profiles').select('id, email, nickname, profile_image, phone').ilike('id', loginId.trim()).limit(1).maybeSingle();
          profileRow = ilikeRes.data;
        }
        if (profileRow?.email) {
          targetEmail = profileRow.email;
          resolvedId = profileRow.id;
          localUser = {
            id: profileRow.id,
            nickname: profileRow.nickname || profileRow.id,
            profileImage: profileRow.profile_image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profileRow.id}`,
            email: profileRow.email,
            phone: profileRow.phone || '',
            role: 'user',
            points: 0,
            joinDate: new Date().toISOString().split('T')[0],
            coupons: []
          } as UserProfile;
        } else {
          const { data: byEmailRow } = await supabase.from('profiles').select('id, email, nickname, profile_image, phone').eq('email', idLower).maybeSingle();
          if (byEmailRow?.email) {
            targetEmail = byEmailRow.email;
            resolvedId = byEmailRow.id;
            localUser = {
              id: byEmailRow.id,
              nickname: byEmailRow.nickname || byEmailRow.id,
              profileImage: byEmailRow.profile_image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${byEmailRow.id}`,
              email: byEmailRow.email,
              phone: byEmailRow.phone || '',
              role: 'user',
              points: 0,
              joinDate: new Date().toISOString().split('T')[0],
              coupons: []
            } as UserProfile;
          }
        }
      }

      // 이메일을 찾지 못하면 가짜 이메일로 시도하지 않음 (Supabase Auth에 없는 계정이라 실패함)
      if (!targetEmail) {
        alert('등록된 아이디/이메일을 찾을 수 없습니다.\n\n가입 시 사용한 이메일로 로그인하려면 아래 "비밀번호 재설정했는데 로그인이 안 되나요?"를 눌러 이메일+비밀번호로 로그인해 보세요.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: loginPw,
      });

      if (error) throw error;

      let profile: UserProfile;
      if (localUser) {
        profile = { ...localUser, email: data.user?.email || localUser.email };
      } else {
        const { data: profileRow } = await supabase.from('profiles').select('id, nickname, profile_image, phone').eq('email', (data.user?.email || targetEmail).toLowerCase()).maybeSingle();
        const meta = data.user?.user_metadata || {};
        if (profileRow) {
          profile = {
            id: profileRow.id,
            nickname: profileRow.nickname || profileRow.id,
            profileImage: profileRow.profile_image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profileRow.id}`,
            phone: profileRow.phone || '',
            role: 'user',
            email: data.user?.email || targetEmail,
            points: 0,
            joinDate: new Date().toISOString().split('T')[0],
            coupons: []
          };
        } else {
          const fallbackId = meta.user_id || resolvedId || (data.user?.email || '').split('@')[0] || loginId;
          profile = {
            id: fallbackId,
            nickname: meta.nickname || fallbackId,
            profileImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${fallbackId}`,
            role: 'user',
            email: data.user?.email || targetEmail,
            points: 0,
            joinDate: new Date().toISOString().split('T')[0],
            coupons: []
          };
        }
      }

      if (saveId) {
        localStorage.setItem(SAVED_LOGIN_ID_KEY, profile.id);
      } else {
        localStorage.removeItem(SAVED_LOGIN_ID_KEY);
      }
      onLoginSuccess(profile);
      navigate('/sns');
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('Invalid login credentials')) {
        alert('아이디(또는 이메일) 또는 비밀번호가 일치하지 않습니다.\n비밀번호를 재설정하셨다면 아래 "이메일로 로그인"을 사용해 보세요.');
      } else {
        alert(`로그인 실패: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoginWithEmailOnly = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = formData.email.trim();
    const pw = formData.pw;
    if (!email || !pw) return alert('이메일과 비밀번호를 입력하세요.');
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) throw error;
      const profile = await buildProfileFromSession(data.user);
      if (saveId) localStorage.setItem(SAVED_LOGIN_ID_KEY, profile.id);
      else localStorage.removeItem(SAVED_LOGIN_ID_KEY);
      onLoginSuccess(profile);
      navigate('/sns');
    } catch (err: any) {
      if ((err?.message || '').includes('Invalid login credentials')) {
        alert('이메일 또는 비밀번호가 일치하지 않습니다. 비밀번호 재설정 메일의 링크를 클릭해 새 비밀번호를 설정한 뒤, 그 비밀번호로 다시 시도해 주세요.');
      } else {
        alert(`로그인 실패: ${err?.message || err}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'kakao' | 'naver') => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/#/login` }
      });
      if (error) throw error;
    } catch (err: any) {
      alert(`소셜 로그인 설정이 필요할 수 있습니다. Supabase 대시보드에서 ${provider === 'kakao' ? '카카오' : '네이버'} 로그인을 활성화해 주세요.\n${err?.message || ''}`);
    } finally {
      setLoading(false);
    }
  };

  // 이메일 형식 검증 (보안·유효성)
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const idRaw = formData.id.trim();
    const id = idRaw.toLowerCase(); // 로그인 시 대소문자 구분 없이 조회하기 위해 소문자로 저장
    const email = formData.email.trim().toLowerCase();
    const pw = formData.pw;
    const pwConfirm = formData.pwConfirm;
    const name = formData.name.trim();
    const phone = formData.phone.trim();

    if (idRaw.length < 5) return alert('아이디는 5자 이상이어야 합니다.');
    if (!isValidEmail(email)) return alert('올바른 이메일 주소를 입력해 주세요.');
    if (pw.length < 8) return alert('비밀번호는 8자 이상이어야 합니다.');
    if (pw !== pwConfirm) return alert('비밀번호가 일치하지 않습니다.');
    if (!formData.agreeTerms) return alert('약관에 동의해주세요.');

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: pw,
        options: {
          data: {
            nickname: name,
            phone,
            user_id: id
          }
        }
      });

      if (authError) {
        const msg = authError.message || '';
        // 이메일 발송 rate limit: 가입은 됐을 수 있으므로 로그인 시도 후 안내
        // 이메일 발송 한도(rate limit): 가입은 됐을 수 있으므로 로그인 시도. 실패 시 대시보드 설정 안내.
        if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('rate_limit')) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: pw });
          if (!signInErr) {
            const newUser: UserProfile = {
              id,
              nickname: name || `유저_${id}`,
              email,
              phone,
              profileImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`,
              role: 'user',
              points: 0,
              joinDate: new Date().toISOString().split('T')[0],
              coupons: []
            };
            onLoginSuccess(newUser);
            alert('회원가입이 완료되었습니다! 더베스트SNS에 오신 것을 환영합니다.');
            navigate('/sns');
            setLoading(false);
            return;
          }
          alert(
            '가입 시 이메일 발송 한도에 걸렸습니다. 관리자가 Supabase 대시보드에서 [Authentication → Providers → Email]의 "Confirm email"을 끄면, 이메일 없이 바로 가입할 수 있어 제한이 없습니다. (DEPLOY.md 참고)'
          );
          setLoading(false);
          return;
        }
        if (msg.includes('already registered') || msg.includes('already exists')) {
          alert('이미 사용 중인 이메일입니다.');
          setLoading(false);
          return;
        }
        throw authError;
      }

      const newUser: UserProfile = {
        id,
        nickname: name || `유저_${id}`,
        email,
        phone,
        profileImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`,
        role: 'user',
        points: 0,
        joinDate: new Date().toISOString().split('T')[0],
        coupons: []
      };

      const { error: profileErr } = await supabase.from('profiles').upsert({
        id,
        email,
        nickname: name || `유저_${id}`,
        profile_image: newUser.profileImage,
        phone: phone || null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
      if (profileErr) console.error('Profiles 저장 실패(회원가입):', profileErr.message, '- Table Editor에서 profiles 테이블에 id, email, nickname 컬럼이 있는지 확인하세요.');

      onLoginSuccess(newUser);
      alert('회원가입이 완료되었습니다! 더베스트SNS에 오신 것을 환영합니다.');
      navigate('/sns');
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('already registered') || msg.includes('already exists')) {
        alert('이미 사용 중인 이메일입니다.');
      } else {
        alert('회원가입에 실패했습니다. 입력 내용을 확인한 뒤 다시 시도해 주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFindId = async () => {
    if (!formData.email) return alert('가입하신 이메일을 입력해주세요.');
    setLoading(true);
    try {
      const members = JSON.parse(localStorage.getItem('site_members_v2') || '[]');
      const found = members.find((m: any) => m.email === formData.email);

      if (found) {
        alert(`찾으시는 회원님의 아이디는 [ ${found.id} ] 입니다.`);
        setMode('LOGIN');
      } else {
        alert('해당 이메일로 등록된 정보가 없습니다.');
      }
    } catch (err) {
      alert('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 인증 메일 발송
  const handleResetPwRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resendCooldown > 0) return;
    if (!formData.email) return alert('이메일을 입력해 주세요.');
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/#/login`, 
      });

      if (error) throw error;

      alert('비밀번호 재설정 메일을 발송했습니다.\n이미 발송된 메일이 있는지 메일함(스팸함 포함)을 꼭 확인해 보세요!');
      setResendCooldown(60); // 60초 대기 강제
    } catch (err: any) {
      if (err.message.includes('rate limit')) {
        alert('서버 보안 정책상 요청이 거부되었습니다.\n현재 사용자님의 접속 환경에서 너무 많은 요청이 발생했습니다.\n\n[해결 방법]\n1. 이미 도착한 메일이 있는지 확인하세요.\n2. 약 5~10분 후 다시 시도해 주세요.\n3. 이미 인증 링크를 누르셨다면 아래 [변경창 열기] 버튼을 활용해 보세요.');
      } else {
        alert(`오류: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // 최종 비밀번호 업데이트
  const handleFinalPasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.pw.length < 6) return alert('비밀번호는 6자 이상이어야 합니다.');
    if (formData.pw !== formData.pwConfirm) return alert('비밀번호가 일치하지 않습니다.');

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: formData.pw
      });
      if (error) throw error;
      
      alert('비밀번호가 성공적으로 변경되었습니다!\n이제 새로운 비밀번호로 로그인해 주세요.');
      setMode('LOGIN');
      setFormData({ ...formData, pw: '', pwConfirm: '' });
      navigate('/login', { replace: true });
    } catch (err: any) {
      alert(`변경 실패: ${err.message}\n인증 세션이 만료되었을 수 있습니다. 다시 메일 발송부터 시도해 주세요.`);
      setMode('LOGIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-12 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-[48px] shadow-2xl border border-gray-100 overflow-hidden relative">
        {(mode === 'LOGIN' || mode === 'JOIN' || mode === 'RESET_PW') && (
          <div className="flex border-b border-gray-50">
            <button onClick={() => setMode('LOGIN')} className={`flex-1 py-6 font-black text-sm tracking-widest transition-all ${mode === 'LOGIN' ? 'text-blue-600 border-b-4 border-blue-600 bg-white' : 'text-gray-300 bg-gray-50/50'}`}>LOG IN</button>
            <button onClick={() => setMode('JOIN')} className={`flex-1 py-6 font-black text-sm tracking-widest transition-all ${mode === 'JOIN' ? 'text-blue-600 border-b-4 border-blue-600 bg-white' : 'text-gray-300 bg-gray-50/50'}`}>SIGN UP</button>
          </div>
        )}

        <div className="p-10 md:p-14 space-y-10">
          {mode === 'LOGIN' && (
            <>
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-black text-gray-900 italic tracking-tighter uppercase">Welcome</h2>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">대한민국 마케팅 원천 사이트</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <input type="text" placeholder="아이디 또는 이메일" className="w-full p-5 bg-gray-50 border-none rounded-2xl font-black shadow-inner outline-none focus:ring-4 focus:ring-blue-50 transition-all" value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} required />
                <input type="password" placeholder="비밀번호" className="w-full p-5 bg-gray-50 border-none rounded-2xl font-black shadow-inner outline-none focus:ring-4 focus:ring-blue-50 transition-all" value={formData.pw} onChange={e => setFormData({...formData, pw: e.target.value})} required />
                <div className="flex justify-between items-center px-2">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={saveId} onChange={e => setSaveId(e.target.checked)} className="w-4 h-4 rounded accent-blue-600" />
                    <span className="text-[12px] font-bold text-gray-400 group-hover:text-gray-600 transition-colors">아이디 저장</span>
                  </label>
                  <div className="flex gap-4">
                    <button type="button" onClick={() => setMode('FIND_ID')} className="text-[12px] font-black text-gray-400 hover:text-blue-600 transition-colors">ID 찾기</button>
                    <button type="button" onClick={() => setMode('FIND_PW')} className="text-[12px] font-black text-gray-400 hover:text-blue-600 transition-colors">PW 재설정</button>
                  </div>
                </div>
                <button type="submit" disabled={loading} className={`w-full py-5 bg-black text-white rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95 uppercase italic tracking-widest ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}`}>
                  {loading ? '인증 처리 중...' : 'LOG IN'}
                </button>
              </form>

              {!showEmailLogin && (
                <p className="text-center">
                  <button type="button" onClick={() => setShowEmailLogin(true)} className="text-[12px] font-bold text-gray-500 hover:text-blue-600 underline underline-offset-2">
                    비밀번호 재설정했는데 로그인이 안 되나요? (이메일로 로그인)
                  </button>
                </p>
              )}

              {showEmailLogin && (
                <form onSubmit={handleLoginWithEmailOnly} className="space-y-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-[12px] font-bold text-gray-600">가입 시 사용한 이메일과 새 비밀번호로 로그인하세요.</p>
                  <input type="email" placeholder="이메일 주소" className="w-full p-4 bg-white border border-gray-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
                  <input type="password" placeholder="비밀번호" className="w-full p-4 bg-white border border-gray-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500" value={formData.pw} onChange={e => setFormData({ ...formData, pw: e.target.value })} required />
                  <div className="flex gap-2">
                    <button type="submit" disabled={loading} className={`flex-1 py-4 bg-blue-600 text-white rounded-xl font-black text-sm uppercase ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}>
                      이메일로 로그인
                    </button>
                    <button type="button" onClick={() => setShowEmailLogin(false)} className="py-4 px-4 text-gray-500 font-bold text-sm hover:text-gray-800">
                      취소
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3 pt-2">
                <p className="text-center text-[11px] font-bold text-gray-400 uppercase tracking-widest">소셜 로그인</p>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => handleSocialLogin('naver')} disabled={loading} className="flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm bg-[#03C75A] text-white hover:opacity-90 disabled:opacity-50 transition-all">
                    <span className="font-black">N</span> 네이버 로그인
                  </button>
                  <button type="button" onClick={() => handleSocialLogin('kakao')} disabled={loading} className="flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm bg-[#FEE500] text-[#191919] hover:opacity-90 disabled:opacity-50 transition-all">
                    <span className="font-black">K</span> 카카오 로그인
                  </button>
                </div>
              </div>
            </>
          )}

          {mode === 'JOIN' && (
            <>
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-black text-gray-900 italic tracking-tighter uppercase">Create Account</h2>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">안전한 슈파베이스 보안 가입</p>
              </div>

              <form onSubmit={handleJoin} className="space-y-4">
                <div className="space-y-3">
                  <input type="text" placeholder="아이디 (5자 이상)" className="w-full p-5 bg-gray-50 border-none rounded-2xl font-bold shadow-inner outline-none focus:ring-4 focus:ring-blue-50" value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} required minLength={5} />
                  <input type="password" placeholder="비밀번호 (8자 이상)" className="w-full p-5 bg-gray-50 border-none rounded-2xl font-bold shadow-inner outline-none focus:ring-4 focus:ring-blue-50" value={formData.pw} onChange={e => setFormData({...formData, pw: e.target.value})} required minLength={8} autoComplete="new-password" />
                  <input type="password" placeholder="비밀번호 확인" className="w-full p-5 bg-gray-50 border-none rounded-2xl font-bold shadow-inner outline-none focus:ring-4 focus:ring-blue-50" value={formData.pwConfirm} onChange={e => setFormData({...formData, pwConfirm: e.target.value})} required minLength={8} autoComplete="new-password" />
                  <input type="text" placeholder="이름 (닉네임)" className="w-full p-5 bg-gray-50 border-none rounded-2xl font-bold shadow-inner outline-none focus:ring-4 focus:ring-blue-50" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                  <input type="email" placeholder="이메일 주소 (필수)" className="w-full p-5 bg-gray-50 border-none rounded-2xl font-bold shadow-inner outline-none focus:ring-4 focus:ring-blue-50" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
                  <input type="text" placeholder="휴대폰 번호 (- 제외)" className="w-full p-5 bg-gray-50 border-none rounded-2xl font-bold shadow-inner outline-none focus:ring-4 focus:ring-blue-50" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required />
                </div>

                <div className="bg-gray-50 p-6 rounded-2xl">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={formData.agreeTerms} onChange={e => setFormData({...formData, agreeTerms: e.target.checked})} className="w-5 h-5 accent-blue-600" />
                    <span className="text-[13px] font-bold text-gray-600">이용약관 및 개인정보 처리방침 동의 (필수)</span>
                  </label>
                </div>

                <button type="submit" disabled={loading} className={`w-full py-6 bg-blue-600 text-white rounded-2xl font-black text-xl shadow-2xl transition-all active:scale-95 uppercase italic tracking-widest ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-black'}`}>
                  {loading ? '가입 신청 중...' : 'JOIN NOW'}
                </button>
              </form>
            </>
          )}

          {mode === 'FIND_PW' && (
            <div className="space-y-8 py-4 animate-in slide-in-from-top-2">
               <div className="text-center">
                 <h2 className="text-2xl font-black text-gray-900 italic uppercase underline decoration-blue-500 underline-offset-8">비밀번호 재설정</h2>
                 <p className="text-sm font-bold text-gray-400 mt-4 leading-relaxed">가입 시 등록한 이메일을 입력하세요.<br/>인증 링크가 포함된 메일을 보내드립니다.</p>
               </div>
               <form onSubmit={handleResetPwRequest} className="space-y-4">
                 <input 
                  type="email" 
                  placeholder="이메일 주소 입력" 
                  value={formData.email} 
                  onChange={e => setFormData({...formData, email: e.target.value})} 
                  className="w-full p-5 bg-gray-50 border-none rounded-2xl font-bold shadow-inner outline-none focus:ring-4 focus:ring-blue-50 transition-all" 
                  required
                 />
                 <button 
                   type="submit" 
                   disabled={loading || resendCooldown > 0} 
                   className={`w-full py-5 text-white rounded-2xl font-black shadow-lg transition-all uppercase italic ${loading || resendCooldown > 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-black hover:bg-blue-600'}`}
                 >
                    {loading ? '메일 발송 중...' : resendCooldown > 0 ? `${resendCooldown}초 후 재시도 가능` : '인증 메일 발송'}
                 </button>
               </form>
               
               <div className="pt-6 border-t border-gray-50 text-center space-y-4">
                  <p className="text-[11px] text-gray-400 font-bold uppercase">메일이 발송되지 않거나 차단되었나요?</p>
                  <button 
                    onClick={() => setMode('RESET_PW')} 
                    className="text-[12px] font-black text-blue-600 hover:underline underline-offset-4 decoration-2"
                  >
                    이미 메일 링크를 누르셨나요? 변경창 강제 열기 →
                  </button>
               </div>

               <button onClick={() => setMode('LOGIN')} className="w-full text-center text-sm font-black text-gray-300 hover:text-gray-900 uppercase italic transition-colors">Back to Login</button>
            </div>
          )}

          {mode === 'RESET_PW' && (
            <div className="space-y-10 animate-in zoom-in-95 duration-500">
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-black text-gray-900 italic tracking-tighter uppercase">Welcome</h2>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">비밀번호 재설정</p>
              </div>

              <form onSubmit={handleFinalPasswordUpdate} className="space-y-4">
                <input 
                  type="password" 
                  placeholder="새 비밀번호 입력" 
                  className="w-full p-5 bg-gray-50 border-none rounded-2xl font-black shadow-inner outline-none focus:ring-4 focus:ring-blue-50 transition-all" 
                  value={formData.pw} 
                  onChange={e => setFormData({...formData, pw: e.target.value})} 
                  required 
                  autoFocus
                  minLength={6}
                />
                <input 
                  type="password" 
                  placeholder="새 비밀번호 확인" 
                  className="w-full p-5 bg-gray-50 border-none rounded-2xl font-black shadow-inner outline-none focus:ring-4 focus:ring-blue-50 transition-all" 
                  value={formData.pwConfirm} 
                  onChange={e => setFormData({...formData, pwConfirm: e.target.value})} 
                  required 
                />
                <button type="submit" disabled={loading} className={`w-full py-5 bg-black text-white rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95 uppercase italic tracking-widest ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}`}>
                  {loading ? '변경 중...' : '비밀번호 변경 완료'}
                </button>
              </form>
              <button type="button" onClick={() => setMode('LOGIN')} className="w-full text-center text-sm font-black text-gray-300 hover:text-gray-900 uppercase italic">취소하고 로그인으로</button>
            </div>
          )}

          {mode === 'FIND_ID' && (
            <div className="space-y-8 py-4">
               <div className="text-center">
                 <h2 className="text-2xl font-black text-gray-900 italic uppercase underline decoration-blue-500 underline-offset-8">ID 찾기</h2>
                 <p className="text-sm font-bold text-gray-400 mt-4 leading-relaxed">가입 시 등록한 이메일을 입력하세요.</p>
               </div>
               <div className="space-y-4">
                 <input type="email" placeholder="이메일 입력" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-5 bg-gray-50 border-none rounded-2xl font-bold shadow-inner outline-none focus:ring-4 focus:ring-blue-50 transition-all" />
                 <button onClick={handleFindId} disabled={loading} className="w-full py-5 bg-black text-white rounded-2xl font-black shadow-lg hover:bg-blue-600 transition-all uppercase italic">
                    {loading ? '조회 중...' : '아이디 찾기'}
                 </button>
               </div>
               <button onClick={() => setMode('LOGIN')} className="w-full text-center text-sm font-black text-gray-300 hover:text-gray-900 uppercase italic transition-colors">Back to Login</button>
            </div>
          )}
        </div>
      </div>
      <p className="text-center mt-10 text-[11px] font-bold text-gray-300 uppercase tracking-[0.3em] italic">The Best SNS Marketing Platform © 2026</p>
    </div>
  );
};

export default AuthPage;
