import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile, Coupon } from '@/types';
import { supabase } from '../supabase';
import { updateProfile } from '../profileDb';
import { useConfirm } from '@/contexts/ConfirmContext';

/** 가입 축하 5,000원 웰컴 쿠폰 (이메일/소셜 가입 공통) */
function createWelcomeCoupon(userId: string): Coupon {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);
  const expiryStr = expiry.toISOString().split('T')[0];
  return {
    id: `CPN_welcome_${Date.now()}_${userId}`,
    title: '가입 축하 5,000원 웰컴 쿠폰',
    discount: 5000,
    discountLabel: '5,000원',
    type: '가입 축하 쿠폰',
    expiry: expiryStr,
    color: 'rose',
    status: 'available',
  };
}

const IconUser = () => (<svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>);
const IconEmail = () => (<svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>);
const IconLock = () => (<svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>);
const IconCheck = () => (<svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>);
const IconEye = () => (<svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>);
const IconEyeOff = () => (<svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>);
const IconPhone = () => (<svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>);

interface Props {
  onLoginSuccess: (user: UserProfile) => void;
  /** 모달로 띄울 때 닫기 콜백 (있으면 닫기 버튼 표시) */
  onClose?: () => void;
}

type AuthMode = 'LOGIN' | 'JOIN' | 'FIND_ID' | 'FIND_PW' | 'RESET_PW';

const SAVED_LOGIN_ID_KEY = 'saved_login_id';

/** URL 해시에서 쿼리/프래그먼트 파라미터 추출 (비밀번호 재설정 링크용) */
function getParamFromHash(name: string): string | null {
  const hash = window.location.hash || '';
  const regex = new RegExp(`[#&]${name}=([^&]*)`);
  const m = regex.exec(hash);
  return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null;
}

/** URL 해시에 OAuth 복귀 토큰이 있는지 (로그인 폼 깜빡임 방지용) */
function hasOAuthReturnHash(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hash || '';
  return h.includes('access_token=') && !h.includes('type=recovery');
}

const AuthPage: React.FC<Props> = ({ onLoginSuccess, onClose }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [loading, setLoading] = useState(false);
  /** 구글/카카오 로그인 복귀 시 폼 대신 로딩만 표시해 로그인 화면 깜빡임 제거 */
  const [isProcessingOAuth, setIsProcessingOAuth] = useState(hasOAuthReturnHash);
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

  const [toast, setToast] = useState<{ show: boolean; message: string; success: boolean }>({ show: false, message: '', success: true });
  const [showPwLogin, setShowPwLogin] = useState(false);
  const [showPwJoin, setShowPwJoin] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const toggleTrackRef = useRef<HTMLDivElement>(null);
  const optJoinRef = useRef<HTMLDivElement>(null);
  const optLoginRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const { showAlert } = useConfirm();

  const showToast = (message: string, success = true) => {
    setToast({ show: true, message, success });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 2800);
  };

  const buildProfileFromSession = async (user: { id: string; email?: string; user_metadata?: Record<string, unknown> }) => {
    const meta = user.user_metadata || {};
    const email = (user.email || '').trim().toLowerCase();
    const { data: profileRow } = await supabase.from('profiles').select('id, nickname, profile_image, phone').eq('email', email).maybeSingle();
    // 기존 프로필이 있으면 그 id 유지
    // RLS로 이메일 조회 실패 시: 회원가입 때 저장한 user_metadata.user_id(커스텀 ID) 우선 → 없으면 Auth UUID
    const metaCustomId = (meta.user_id as string) || null;
    const id = (profileRow?.id ?? metaCustomId ?? user.id).toString();
    // 현재 로그인한 사용자(session)와 같은 행일 때만 profileRow 값 사용 → 다른 계정(예: 네이버) 데이터가 섞여 보이는 것 방지
    const isSameUser = profileRow && (profileRow.id === user.id || profileRow.id === id);
    const nickname = ((isSameUser ? (profileRow.nickname || '') : '') || (meta.nickname as string) || (meta.name as string) || (meta.full_name as string) || id).toString();
    const profileImage = ((isSameUser ? (profileRow.profile_image || '') : '') || (meta.avatar_url as string) || (meta.picture as string) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`).toString();
    return {
      id,
      nickname,
      profileImage,
      email: user.email || email,
      phone: (isSameUser && profileRow?.phone ? (profileRow.phone as string) : '') || '',
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
      // 비밀번호 재설정: 해시에 토큰이 있으면 수동으로 setSession 후 RESET_PW 전환 (해시 라우팅 #/login 환경에서 Supabase 자동 파싱이 안 될 수 있음)
      if (hash.includes('type=recovery')) {
        const accessToken = getParamFromHash('access_token');
        const refreshToken = getParamFromHash('refresh_token');
        if (accessToken && refreshToken) {
          supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ data: { session }, error }) => {
            if (!error && session?.user) {
              setMode('RESET_PW');
              if (window.history.replaceState) window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/login');
            } else {
              setMode('RESET_PW');
            }
          }).catch(() => setMode('RESET_PW'));
        } else {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
              setMode('RESET_PW');
              if (window.history.replaceState) window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/login');
            } else {
              const tryAgain = (attempt: number) => {
                supabase.auth.getSession().then(({ data: { session } }) => {
                  if (session?.user) {
                    setMode('RESET_PW');
                    if (window.history.replaceState) window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/login');
                  } else if (attempt < 6) setTimeout(() => tryAgain(attempt + 1), 300);
                  else setMode('RESET_PW');
                });
              };
              setTimeout(() => tryAgain(0), 200);
            }
          });
        }
        return;
      }
      // 소셜 로그인 복귀: 해시의 토큰으로 세션 갱신 후, profiles에 등록된 계정인지 확인
      if (hash.includes('access_token=') && !hash.includes('type=recovery')) {
        const accessToken = getParamFromHash('access_token');
        const refreshToken = getParamFromHash('refresh_token');
        const setSessionThenLogin = async (session: { user: any }) => {
          const userId = session.user?.id;
          if (!userId) {
            try { sessionStorage.removeItem('oauth_intent'); } catch (_) {}
            setIsProcessingOAuth(false);
            return;
          }
          const intent = (() => { try { return sessionStorage.getItem('oauth_intent'); } catch { return null; } })();
          try { sessionStorage.removeItem('oauth_intent'); } catch (_) {}
          const { data: existingProfile } = await supabase.from('profiles').select('id, updated_at').eq('id', userId).maybeSingle();
          if (!existingProfile) {
            // OAuth로 새 user가 생성됐지만 profile 없음(트리거 실패 등). 남기면 users에만 쌓이므로 삭제 후 안내.
            try {
              const token = (session as any).access_token;
              if (token) {
                await fetch(`${window.location.origin}/api/delete-user`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                });
              }
            } catch (_) {}
            await supabase.auth.signOut({ scope: 'local' });
            if (window.history.replaceState) window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/login');
            setIsProcessingOAuth(false);
            setMode('JOIN');
            alert('등록된 계정이 아닙니다. 아래 회원가입에서 구글로 회원가입을 진행해 주세요.');
            return;
          }
          if (intent === 'login') {
            const updatedAt = existingProfile?.updated_at;
            if (updatedAt) {
              const ageMs = Date.now() - new Date(updatedAt).getTime();
              if (ageMs < 120000) {
                // 탈퇴한 계정이 "로그인" 버튼으로 소셜 연동 시 Supabase가 새 user+profile을 만들고 트리거가 profile을 넣음. 그대로 두면 users/profiles에 허공 계정이 쌓이므로 즉시 삭제.
                try {
                  const token = (session as any).access_token;
                  if (token) {
                    await fetch(`${window.location.origin}/api/delete-user`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    });
                  }
                } catch (_) {}
                await supabase.auth.signOut({ scope: 'local' });
                if (window.history.replaceState) window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/login');
                setIsProcessingOAuth(false);
                setMode('JOIN');
                alert('등록된 계정이 아닙니다. 아래 회원가입에서 구글로 회원가입을 진행해 주세요.');
                return;
              }
            }
          }
          buildProfileFromSession(session.user).then(async (profile) => {
              const { error: profileErr } = await supabase.from('profiles').upsert({
                id: profile.id,
                email: profile.email || null,
                nickname: profile.nickname,
                profile_image: profile.profileImage,
                phone: profile.phone || null,
                updated_at: new Date().toISOString()
              }, { onConflict: 'id' });
              if (profileErr) {
                console.error('[BESTSNS] 소셜 로그인 후 profiles 저장 실패:', profileErr);
                console.error('[BESTSNS] 저장 시도한 profile.id:', profile.id, 'email:', profile.email);
                alert('로그인은 완료되었지만, 회원 목록 저장에 실패했습니다.\n\nDEPLOY.md 5-2절 "방법 A(트리거)"를 적용해 보세요. supabase-auth-profiles-trigger.sql 을 SQL Editor에서 실행하면, 다음부터 구글/카카오 가입 시 테이블에 자동으로 추가됩니다.');
              } else {
                console.info('[BESTSNS] 소셜 로그인 후 profiles 저장 성공, id:', profile.id);
              }
              // 소셜 회원가입 시 가입 축하 5,000원 웰컴 쿠폰 발급
              if (intent === 'signup') {
                const welcomeCoupon = createWelcomeCoupon(profile.id);
                profile = { ...profile, coupons: [welcomeCoupon] };
                await updateProfile(profile.id, { coupons: [welcomeCoupon] }).catch((e) => console.warn('가입 쿠폰 DB 반영 실패:', e));
              }
              onLoginSuccess(profile);
              navigate('/sns', { replace: true });
            });
        };
        if (accessToken && refreshToken) {
          supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ data: { session }, error }) => {
            if (!error && session?.user) setSessionThenLogin(session);
            else setIsProcessingOAuth(false);
          }).catch(() => setIsProcessingOAuth(false));
        } else {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) setSessionThenLogin(session);
            else setIsProcessingOAuth(false);
          });
        }
      } else {
        setIsProcessingOAuth(false);
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

  // 슬라이딩 토글 썸 위치 (로그인 / 회원가입)
  const positionThumb = () => {
    const track = toggleTrackRef.current;
    const thumb = thumbRef.current;
    const opt = mode === 'JOIN' ? optJoinRef.current : optLoginRef.current;
    if (!track || !thumb || !opt) return;
    const trackRect = track.getBoundingClientRect();
    const optRect = opt.getBoundingClientRect();
    thumb.style.left = `${optRect.left - trackRect.left}px`;
    thumb.style.width = `${optRect.width}px`;
  };
  useLayoutEffect(() => {
    if (mode === 'LOGIN' || mode === 'JOIN') positionThumb();
  }, [mode]);
  useEffect(() => {
    const t = setTimeout(positionThumb, 150);
    return () => clearTimeout(t);
  }, [mode]);

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
            email: 'admin@bestsns.com',
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
      if (!targetEmail || !targetEmail.includes('@')) {
        showAlert({ title: '로그인 실패', description: '등록된 아이디/이메일을 찾을 수 없습니다. 비밀번호를 잊으신 경우 비밀번호 찾기를 이용해 주세요.' });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail.trim().toLowerCase(),
        password: loginPw,
      });

      if (error) {
        console.warn('Supabase 로그인 응답:', error.message, '(콘솔 400은 이 요청이 거절된 것입니다.)');
        throw error;
      }

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
        localStorage.setItem(SAVED_LOGIN_ID_KEY, loginId);
      } else {
        localStorage.removeItem(SAVED_LOGIN_ID_KEY);
      }
      onLoginSuccess(profile);
      navigate('/sns');
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('Invalid login credentials')) {
        showAlert({ title: '로그인 실패', description: '아이디(또는 이메일) 또는 비밀번호가 일치하지 않습니다. 비밀번호를 잊으신 경우 비밀번호 찾기를 이용해 주세요.' });
      } else {
        showAlert({ title: '로그인 실패', description: `로그인 실패: ${msg}` });
      }
    } finally {
      setLoading(false);
    }
  };

  const providerNames: Record<'google' | 'kakao', string> = { google: '구글', kakao: '카카오' };
  /** isSignUp: true면 회원가입 탭, false면 로그인 탭. 매번 구글/카카오 계정 선택(또는 로그인) 화면이 나오도록 prompt 사용 */
  const handleSocialLogin = async (provider: 'google' | 'kakao', isSignUp: boolean) => {
    try {
      sessionStorage.setItem('oauth_intent', isSignUp ? 'signup' : 'login');
    } catch (_) {}
    setLoading(true);
    try {
      // 로그인 시: 항상 계정 선택 화면 표시(다른 계정으로 로그인 가능, 보안·명시적 동의)
      // 회원가입 시: 구글은 동의 화면(consent), 카카오는 계정 선택(select_account) 또는 로그인(login) 강제
      const queryParams =
        provider === 'google'
          ? { prompt: isSignUp ? 'consent' : 'select_account' }
          : { prompt: isSignUp ? 'select_account' : 'login' };
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/#/login`,
          queryParams,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      alert(`소셜 로그인 설정이 필요할 수 있습니다. Supabase 대시보드에서 ${providerNames[provider]} 로그인을 활성화해 주세요.\n${err?.message || ''}`);
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
    const nameTrim = formData.name.trim();
    const phoneTrim = formData.phone.trim();
    const nickname = nameTrim || `유저_${id}`;

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
            nickname,
            user_id: id,
            phone: phoneTrim || undefined
          }
        }
      });

      if (authError) {
        const msg = authError.message || '';
        // 이메일 발송 rate limit: 가입은 됐을 수 있으므로 로그인 시도 후 안내
        if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('rate_limit')) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: pw });
          if (!signInErr) {
            const welcomeCoupon = createWelcomeCoupon(id);
            const newUser: UserProfile = {
              id,
              nickname,
              email,
              phone: phoneTrim || '',
              profileImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`,
              role: 'user',
              points: 0,
              joinDate: new Date().toISOString().split('T')[0],
              coupons: [welcomeCoupon]
            };
            await updateProfile(id, { coupons: [welcomeCoupon] }).catch((e) => console.warn('가입 쿠폰 DB 반영 실패:', e));
            onLoginSuccess(newUser);
            alert('회원가입이 완료되었습니다! BESTSNS에 오신 것을 환영합니다.');
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

      const welcomeCoupon = createWelcomeCoupon(id);
      const newUser: UserProfile = {
        id,
        nickname,
        email,
        phone: phoneTrim || '',
        profileImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`,
        role: 'user',
        points: 0,
        joinDate: new Date().toISOString().split('T')[0],
        coupons: [welcomeCoupon]
      };

      // 회원 목록 단일 소스: 가입 직후 profiles에 반드시 기록 (이름·휴대폰 포함 → 소셜 로그인 연동 시 동일 프로필 사용)
      const { error: profileErr } = await supabase.from('profiles').upsert({
        id,
        email,
        nickname,
        profile_image: newUser.profileImage,
        phone: phoneTrim || null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
      if (profileErr) {
        console.error('Profiles 저장 실패(회원가입):', profileErr.message, '- supabase-profiles-alter-and-backfill.sql 실행 여부를 확인하세요.');
      }
      // Supabase Auth 트리거가 UUID 기반 중복 프로필 생성 시 제거 (같은 이메일, 다른 ID)
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const { data: dupRows } = await supabase.from('profiles').select('id').eq('email', email).neq('id', id);
      if (dupRows && dupRows.length > 0) {
        const uuidIds = dupRows.map((r: { id: string }) => r.id).filter((rid: string) => uuidPattern.test(rid));
        if (uuidIds.length > 0) {
          await supabase.from('profiles').delete().in('id', uuidIds).catch(() => {});
        }
      }
      await updateProfile(id, { coupons: [welcomeCoupon] }).catch((e) => console.warn('가입 쿠폰 DB 반영 실패:', e));

      onLoginSuccess(newUser);
      alert('회원가입이 완료되었습니다! BESTSNS에 오신 것을 환영합니다.');
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
        alert('서버 보안 정책상 요청이 거부되었습니다.\n현재 사용자님의 접속 환경에서 너무 많은 요청이 발생했습니다.\n\n[해결 방법]\n1. 이미 도착한 메일이 있는지 확인하세요.\n2. 약 5~10분 후 다시 시도해 주세요.\n3. 이미 인증 링크를 클릭하셨다면 메일의 링크로 들어가 새 비밀번호를 설정할 수 있습니다.');
      } else {
        alert(`오류: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // 최종 비밀번호 업데이트 (재설정 메일 링크 클릭 후 이 페이지에서만 유효한 세션 필요)
  const handleFinalPasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.pw.length < 6) return alert('비밀번호는 6자 이상이어야 합니다.');
    if (formData.pw !== formData.pwConfirm) return alert('비밀번호가 일치하지 않습니다.');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      alert('비밀번호 재설정 세션이 없습니다.\n\n메일에서 받은 "비밀번호 재설정" 링크를 **이 브라우저**에서 **방금 클릭**한 뒤, 이 페이지로 돌아와 새 비밀번호를 입력해 주세요.\n\n이미 링크를 눌렀다면 링크가 만료되었을 수 있으니, 아래 [비밀번호 재설정]에서 이메일을 다시 입력해 새 메일을 받아 주세요.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: formData.pw
      });
      if (error) throw error;
      
      alert('비밀번호가 성공적으로 변경되었습니다!\n이메일(또는 아이디)과 새 비밀번호로 로그인해 주세요.');
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

  const isFormMode = mode === 'LOGIN' || mode === 'JOIN';

  // 구글/카카오 로그인 복귀 직후: 폼 대신 로딩만 표시해 로그인 화면 깜빡임 제거
  if (isProcessingOAuth) {
    return (
      <div className={`flex items-center justify-center p-5 font-['Noto_Sans_KR',sans-serif] ${onClose ? '' : 'min-h-screen bg-slate-100'}`}>
        <div className="w-full max-w-[320px] bg-white rounded-2xl shadow-xl p-10 flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#0f172a] font-semibold">로그인 처리 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center min-h-screen w-full p-3 sm:p-4 xl:p-5 font-['Noto_Sans_KR',sans-serif] ${onClose ? 'min-h-0' : 'bg-slate-100'} xl:pb-0 pb-20`}>
      <div className="w-full max-w-[340px] sm:max-w-[380px] md:max-w-[420px] xl:max-w-[920px] max-h-[calc(100vh-6rem)] sm:max-h-[calc(100vh-5rem)] xl:max-h-[780px] xl:h-[780px] bg-white rounded-2xl sm:rounded-[28px] xl:rounded-[28px] shadow-xl xl:shadow-[0_30px_80px_rgba(0,0,0,0.12),0_8px_32px_rgba(0,0,0,0.07)] flex overflow-hidden auth-card-enter relative flex-shrink-0 mx-auto">
        {onClose && (
          <button type="button" onClick={onClose} className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 flex items-center justify-center text-lg font-bold transition-colors xl:w-10 xl:h-10 xl:text-xl" aria-label="닫기">×</button>
        )}
        {/* ─── LEFT PANEL (브랜딩) ─── 데스크톱(xl)에서만 표시, 태블릿에서는 폼만 */}
        <div className="hidden xl:flex w-[420px] flex-shrink-0 flex-col bg-gradient-to-br from-[#1e3a8a] via-[#1d4ed8] to-[#3b82f6] p-11 relative overflow-hidden">
          <div className="absolute w-[340px] h-[340px] rounded-full border border-white/10 -top-[120px] -left-[120px]" />
          <div className="absolute w-[210px] h-[210px] rounded-full border border-white/[0.07] -bottom-[70px] -right-[70px]" />
          <div className="absolute w-[120px] h-[120px] rounded-full border border-white/5 bottom-[130px] -left-[30px]" />
          <div className="flex items-center gap-2.5 relative z-10 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-white/20 border border-white/20 flex items-center justify-center text-[17px]">✦</div>
            <span className="font-['Plus_Jakarta_Sans',sans-serif] text-[17px] font-extrabold text-white tracking-wide">BESTSNS</span>
          </div>
          {/* 로켓: 상단 가로 중앙 */}
          <div className="relative z-10 flex justify-center w-full py-4 shrink-0">
            <span className="text-[100px] leading-none auth-rocket-float block" style={{ filter: 'drop-shadow(0 16px 28px rgba(0,0,0,0.25))' }}>🚀</span>
          </div>
          {/* SNS Marketing Platform ~ 진행하세요! 세로 중앙 */}
          <div className="relative z-10 flex-1 flex flex-col justify-center min-h-0">
            <div className="text-[11px] text-white/55 tracking-[2px] uppercase font-medium mb-3">SNS Marketing Platform</div>
            <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-[36px] font-black text-white leading-tight mb-2 tracking-tight">
              마케팅의 <strong>모든 것!</strong>
            </h2>
            <div className="text-[13px] text-white/65 tracking-wider font-semibold uppercase mb-5 font-['Plus_Jakarta_Sans',sans-serif]">ONE-STOP PLATFORM MARKETING</div>
            <p className="text-[13.5px] text-white/80 leading-relaxed mt-12">
              아직도 마케팅 회사에 돈 주고 맡기시나요?<br />
              <span className="text-white font-bold">마케팅 회사들이 이용하는 BESTSNS!</span><br />
              네이버 블로그·카페, 유튜브, 인스타그램 등<br />
              마케팅을 직접 저렴하게 진행하세요!
            </p>
          </div>
          <div className="relative z-10 text-[11px] text-white/35 shrink-0 pt-4">© 2025 BESTSNS. All rights reserved.</div>
        </div>

        {/* ─── RIGHT PANEL (폼) ─── 모바일: 푸터 안 겹치게 스크롤, 하단 여유 확보 */}
        <div
          className="flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden pt-12 px-5 pb-24 sm:pt-8 sm:px-6 sm:pb-20 md:pt-10 md:px-8 md:pb-20 xl:p-12 xl:pb-12"
          style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {isFormMode && (
            <div className="flex justify-center mb-6 md:mb-8 xl:mb-8">
              <div ref={toggleTrackRef} className="inline-flex bg-[#f1f5f9] rounded-full p-1.5 border border-[#e2e8f0] w-[200px] sm:w-[220px] xl:w-[220px] relative shrink-0">
                <div ref={thumbRef} className="absolute top-1 bottom-1 z-0 bg-[#2563EB] rounded-full transition-all duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)] shadow-[0_2px_12px_rgba(37,99,235,0.28)]" style={{ left: 0, width: 0 }} />
                <div ref={optJoinRef} onClick={() => setMode('JOIN')} className={`relative z-10 flex-1 text-center py-2.5 text-[13px] sm:text-sm xl:text-sm font-semibold rounded-full cursor-pointer select-none transition-colors whitespace-nowrap min-w-0 ${mode === 'JOIN' ? 'text-white' : 'text-slate-500'}`}>회원가입</div>
                <div ref={optLoginRef} onClick={() => setMode('LOGIN')} className={`relative z-10 flex-1 text-center py-2.5 text-[13px] sm:text-sm xl:text-sm font-semibold rounded-full cursor-pointer select-none transition-colors whitespace-nowrap min-w-0 ${mode === 'LOGIN' ? 'text-white' : 'text-slate-500'}`}>로그인</div>
              </div>
            </div>
          )}

          {mode === 'LOGIN' && (
            <div className="flex flex-col items-center min-h-0 py-0.5 xl:py-1">
              <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-[18px] sm:text-[20px] xl:text-[25px] font-extrabold text-[#0f172a] tracking-tight text-center mb-3 xl:mb-3 w-full">로그인</h3>
              <form onSubmit={handleLogin} className="space-y-2.5 xl:space-y-2.5 w-full max-w-[320px] sm:max-w-none mx-auto">
                <div className="relative flex items-center">
                  <span className="absolute left-3 xl:left-3.5 text-[#94a3b8] pointer-events-none"><IconUser /></span>
                  <input type="text" placeholder="아이디 또는 이메일" value={formData.id} onChange={e => setFormData({ ...formData, id: e.target.value })} className="w-full pl-9 xl:pl-10 pr-3 xl:pr-4 py-3 xl:py-4 bg-[#f8faff] border border-[#e2e8f0] rounded-lg xl:rounded-xl text-[#0f172a] text-[14px] xl:text-sm outline-none focus:border-[#2563EB] focus:bg-white focus:ring-2 xl:focus:ring-[3px] focus:ring-[#2563eb1a] transition-all" required />
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-3 xl:left-3.5 text-[#94a3b8] pointer-events-none"><IconLock /></span>
                  <input type={showPwLogin ? 'text' : 'password'} placeholder="비밀번호" value={formData.pw} onChange={e => setFormData({ ...formData, pw: e.target.value })} className="w-full pl-9 xl:pl-10 pr-9 xl:pr-10 py-3 xl:py-4 bg-[#f8faff] border border-[#e2e8f0] rounded-lg xl:rounded-xl text-[#0f172a] text-[14px] xl:text-sm outline-none focus:border-[#2563EB] focus:bg-white focus:ring-2 xl:focus:ring-[3px] focus:ring-[#2563eb1a] transition-all" required />
                  <button type="button" onClick={() => setShowPwLogin(v => !v)} className="absolute right-2.5 xl:right-3 text-[#94a3b8] hover:text-[#0f172a] p-1">{showPwLogin ? <IconEyeOff /> : <IconEye />}</button>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-nowrap sm:justify-between sm:items-center -mt-0.5 mb-0.5">
                  <label className="flex items-center gap-2 cursor-pointer shrink-0"><input type="checkbox" checked={saveId} onChange={e => setSaveId(e.target.checked)} className="w-3.5 h-3.5 xl:w-4 xl:h-4 rounded accent-[#2563EB]" /><span className="text-[12px] xl:text-sm text-[#475569] whitespace-nowrap">아이디 저장</span></label>
                  <div className="flex gap-3 flex-wrap">
                    <button type="button" onClick={() => setMode('FIND_ID')} className="text-[11px] xl:text-xs text-[#94a3b8] hover:text-[#2563EB] whitespace-nowrap">ID 찾기</button>
                    <button type="button" onClick={() => setMode('FIND_PW')} className="text-[11px] xl:text-xs text-[#94a3b8] hover:text-[#2563EB] whitespace-nowrap">비밀번호를 잊으셨나요?</button>
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full py-3 xl:py-3.5 bg-gradient-to-br from-[#2563EB] to-[#1d4ed8] text-white rounded-lg xl:rounded-xl font-bold text-[14px] xl:text-[15px] border-0 shadow-[0_6px_22px_rgba(37,99,235,0.28)] hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(37,99,235,0.38)] active:translate-y-0 disabled:opacity-60 disabled:transform-none transition-all mt-1">로그인</button>
              </form>
              <div className="flex items-center gap-2 xl:gap-2.5 my-2.5 xl:my-3 w-full max-w-[320px] sm:max-w-none mx-auto"><div className="flex-1 h-px bg-[#e2e8f0]" /><span className="text-[10px] xl:text-xs text-[#94a3b8] shrink-0">— OR —</span><div className="flex-1 h-px bg-[#e2e8f0]" /></div>
              <div className="flex flex-col gap-2 xl:gap-2.5 w-full max-w-[320px] sm:max-w-none mx-auto">
                <button type="button" onClick={() => { showToast('구글 로그인 연동 중...', true); handleSocialLogin('google', false); }} disabled={loading} className="w-full flex items-center justify-center gap-2 xl:gap-2.5 py-3 xl:py-3.5 px-3 xl:px-4 rounded-lg xl:rounded-xl border border-[#e2e8f0] bg-white text-[#0f172a] text-[13px] xl:text-[14px] font-semibold hover:border-[#b8c4d4] hover:shadow-md hover:-translate-y-0.5 transition-all disabled:opacity-50">
                  <svg width="20" height="20" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.909-2.258c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/><path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/></svg>
                  구글로 로그인
                </button>
                <button type="button" onClick={() => { showToast('카카오 로그인 연동 중...', true); handleSocialLogin('kakao', false); }} disabled={loading} className="w-full flex items-center justify-center gap-2 xl:gap-2.5 py-3 xl:py-3.5 px-3 xl:px-4 rounded-lg xl:rounded-xl border border-[#FEE500] bg-[#FEE500] text-[#191919] text-[13px] xl:text-[14px] font-semibold hover:opacity-90 hover:-translate-y-0.5 transition-all disabled:opacity-50">
                  <svg width="20" height="20" viewBox="0 0 18 18" fill="none"><path d="M9 1.5C4.86 1.5 1.5 4.1 1.5 7.3c0 2.07 1.35 3.9 3.4 4.96L4.1 15l3.6-2.37c.42.06.85.09 1.3.09 4.14 0 7.5-2.6 7.5-5.82C16.5 4.1 13.14 1.5 9 1.5z" fill="#191919"/></svg>
                  카카오로 로그인
                </button>
              </div>
            </div>
          )}

          {mode === 'JOIN' && (
            <div className="flex flex-col min-h-0 pt-0 xl:py-1">
              <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-[18px] sm:text-[20px] xl:text-[25px] font-extrabold text-[#0f172a] tracking-tight text-center mb-4 xl:mb-3 w-full">회원가입</h3>
              <form onSubmit={handleJoin} className="space-y-2.5 xl:space-y-2.5 w-full max-w-[320px] sm:max-w-none mx-auto pb-4 xl:pb-0">
                <div className="relative flex items-center"><span className="absolute left-3 xl:left-3.5 text-[#94a3b8]"><IconUser /></span><input type="text" placeholder="아이디 (5자 이상)" value={formData.id} onChange={e => setFormData({ ...formData, id: e.target.value })} className="w-full pl-9 xl:pl-10 pr-3 xl:pr-4 py-2.5 xl:py-3 bg-[#f8faff] border border-[#e2e8f0] rounded-lg xl:rounded-xl text-[#0f172a] text-[14px] xl:text-sm outline-none focus:border-[#2563EB] focus:bg-white focus:ring-2 xl:focus:ring-[3px] focus:ring-[#2563eb1a] transition-all" required minLength={5} /></div>
                <div className="relative flex items-center"><span className="absolute left-3 xl:left-3.5 text-[#94a3b8]"><IconLock /></span><input type={showPwJoin ? 'text' : 'password'} placeholder="비밀번호 (8자 이상)" value={formData.pw} onChange={e => setFormData({ ...formData, pw: e.target.value })} className="w-full pl-9 xl:pl-10 pr-9 xl:pr-10 py-2.5 xl:py-3 bg-[#f8faff] border border-[#e2e8f0] rounded-lg xl:rounded-xl text-[#0f172a] text-[14px] xl:text-sm outline-none focus:border-[#2563EB] focus:bg-white focus:ring-2 xl:focus:ring-[3px] focus:ring-[#2563eb1a] transition-all" required minLength={8} autoComplete="new-password" /><button type="button" onClick={() => setShowPwJoin(v => !v)} className="absolute right-2.5 xl:right-3 text-[#94a3b8] hover:text-[#0f172a] p-1">{showPwJoin ? <IconEyeOff /> : <IconEye />}</button></div>
                <div className="relative flex items-center"><span className="absolute left-3 xl:left-3.5 text-[#94a3b8]"><IconCheck /></span><input type={showPwConfirm ? 'text' : 'password'} placeholder="비밀번호 확인" value={formData.pwConfirm} onChange={e => setFormData({ ...formData, pwConfirm: e.target.value })} className="w-full pl-9 xl:pl-10 pr-9 xl:pr-10 py-2.5 xl:py-3 bg-[#f8faff] border border-[#e2e8f0] rounded-lg xl:rounded-xl text-[#0f172a] text-[14px] xl:text-sm outline-none focus:border-[#2563EB] focus:bg-white focus:ring-2 xl:focus:ring-[3px] focus:ring-[#2563eb1a] transition-all" required minLength={8} autoComplete="new-password" /><button type="button" onClick={() => setShowPwConfirm(v => !v)} className="absolute right-2.5 xl:right-3 text-[#94a3b8] hover:text-[#0f172a] p-1">{showPwConfirm ? <IconEyeOff /> : <IconEye />}</button></div>
                <div className="relative flex items-center"><span className="absolute left-3 xl:left-3.5 text-[#94a3b8]"><IconUser /></span><input type="text" placeholder="이름" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full pl-9 xl:pl-10 pr-3 xl:pr-4 py-2.5 xl:py-3 bg-[#f8faff] border border-[#e2e8f0] rounded-lg xl:rounded-xl text-[#0f172a] text-[14px] xl:text-sm outline-none focus:border-[#2563EB] focus:bg-white focus:ring-2 xl:focus:ring-[3px] focus:ring-[#2563eb1a] transition-all" /></div>
                <div className="relative flex items-center"><span className="absolute left-3 xl:left-3.5 text-[#94a3b8]"><IconPhone /></span><input type="tel" placeholder="휴대폰 (010-0000-0000)" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full pl-9 xl:pl-10 pr-3 xl:pr-4 py-2.5 xl:py-3 bg-[#f8faff] border border-[#e2e8f0] rounded-lg xl:rounded-xl text-[#0f172a] text-[14px] xl:text-sm outline-none focus:border-[#2563EB] focus:bg-white focus:ring-2 xl:focus:ring-[3px] focus:ring-[#2563eb1a] transition-all" /></div>
                <div className="relative flex items-center"><span className="absolute left-3 xl:left-3.5 text-[#94a3b8]"><IconEmail /></span><input type="email" placeholder="이메일" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full pl-9 xl:pl-10 pr-3 xl:pr-4 py-2.5 xl:py-3 bg-[#f8faff] border border-[#e2e8f0] rounded-lg xl:rounded-xl text-[#0f172a] text-[14px] xl:text-sm outline-none focus:border-[#2563EB] focus:bg-white focus:ring-2 xl:focus:ring-[3px] focus:ring-[#2563eb1a] transition-all" required /></div>
                <label className="flex items-start gap-2 xl:gap-3 cursor-pointer"><input type="checkbox" checked={formData.agreeTerms} onChange={e => setFormData({ ...formData, agreeTerms: e.target.checked })} className="w-3.5 h-3.5 xl:w-4 xl:h-4 mt-0.5 rounded accent-[#2563EB] shrink-0" /><span className="text-[12px] xl:text-sm text-[#475569] leading-snug">이용약관 및 개인정보 처리방침 동의 (필수)</span></label>
                <button type="submit" disabled={loading} className="w-full py-3 xl:py-3.5 bg-gradient-to-br from-[#2563EB] to-[#1d4ed8] text-white rounded-lg xl:rounded-xl font-bold text-[14px] xl:text-[15px] border-0 shadow-[0_6px_22px_rgba(37,99,235,0.28)] hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(37,99,235,0.38)] active:translate-y-0 disabled:opacity-60 disabled:transform-none transition-all mt-1 xl:mt-1.5">가입하기</button>
              </form>
              <div className="flex items-center gap-2 xl:gap-2.5 my-2.5 xl:my-3 w-full max-w-[320px] sm:max-w-none mx-auto"><div className="flex-1 h-px bg-[#e2e8f0]" /><span className="text-[10px] xl:text-xs text-[#94a3b8] shrink-0">— OR —</span><div className="flex-1 h-px bg-[#e2e8f0]" /></div>
              <div className="flex flex-col gap-2 xl:gap-2.5 w-full max-w-[320px] sm:max-w-none mx-auto pb-10 xl:pb-0">
                <button type="button" onClick={() => { showToast('구글 회원가입 연동 중...', true); handleSocialLogin('google', true); }} disabled={loading} className="w-full flex items-center justify-center gap-2 xl:gap-2.5 py-3 xl:py-3.5 px-3 xl:px-4 rounded-lg xl:rounded-xl border border-[#e2e8f0] bg-white text-[#0f172a] text-[13px] xl:text-[14px] font-semibold hover:border-[#b8c4d4] hover:shadow-md hover:-translate-y-0.5 transition-all disabled:opacity-50">
                  <svg width="20" height="20" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.909-2.258c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/><path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/></svg>
                  구글로 회원가입
                </button>
                <button type="button" onClick={() => { showToast('카카오 회원가입 연동 중...', true); handleSocialLogin('kakao', true); }} disabled={loading} className="w-full flex items-center justify-center gap-2 xl:gap-2.5 py-3 xl:py-3.5 px-3 xl:px-4 rounded-lg xl:rounded-xl border border-[#FEE500] bg-[#FEE500] text-[#191919] text-[13px] xl:text-[14px] font-semibold hover:opacity-90 hover:-translate-y-0.5 transition-all disabled:opacity-50">
                  <svg width="20" height="20" viewBox="0 0 18 18" fill="none"><path d="M9 1.5C4.86 1.5 1.5 4.1 1.5 7.3c0 2.07 1.35 3.9 3.4 4.96L4.1 15l3.6-2.37c.42.06.85.09 1.3.09 4.14 0 7.5-2.6 7.5-5.82C16.5 4.1 13.14 1.5 9 1.5z" fill="#191919"/></svg>
                  카카오로 회원가입
                </button>
              </div>
              <p className="text-center text-[12px] xl:text-sm text-[#94a3b8] mt-1.5 xl:mt-2">이미 계정이 있으신가요? <button type="button" onClick={() => setMode('LOGIN')} className="font-medium text-[#2563EB] hover:underline">로그인</button></p>
            </div>
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

               <button onClick={() => setMode('LOGIN')} className="w-full text-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">로그인으로 돌아가기</button>
            </div>
          )}

          {mode === 'RESET_PW' && (
            <div className="space-y-10 animate-in zoom-in-95 duration-500">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-gray-900">비밀번호 변경</h2>
                <p className="text-sm text-gray-500 mt-1">새 비밀번호를 입력하세요.</p>
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
              <button type="button" onClick={() => setMode('LOGIN')} className="w-full text-center text-sm font-medium text-gray-500 hover:text-gray-900">취소하고 로그인으로</button>
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
               <button onClick={() => setMode('LOGIN')} className="w-full text-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">로그인으로 돌아가기</button>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      <div className={`fixed bottom-7 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full px-5 py-3 bg-[#0f172a] text-white text-[13px] shadow-lg z-[100] transition-transform duration-[0.4s] ease-[cubic-bezier(0.34,1.56,0.64,1)] ${toast.show ? 'translate-y-0' : 'translate-y-20'}`}>
        <div className={`w-2 h-2 rounded-full ${toast.success ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`} />
        <span>{toast.message}</span>
      </div>
    </div>
  );
};

export default AuthPage;
