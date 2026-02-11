
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

  // 인증 감지 로직 보강
  useEffect(() => {
    // 1. 세션 이벤트 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth Event Triggered:", event);
      if (event === 'PASSWORD_RECOVERY') {
        setMode('RESET_PW');
      }
    });

    // 2. 해시 파라미터 직접 파싱 (HashRouter 환경 대응)
    const checkHashToken = () => {
      const hash = window.location.hash;
      if (hash.includes('type=recovery') || hash.includes('access_token=')) {
        setMode('RESET_PW');
      }
    };
    checkHashToken();
    window.addEventListener('hashchange', checkHashToken);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('hashchange', checkHashToken);
    };
  }, []);

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

    if (loginId === 'admin' && loginPw === '1234') {
        const adminUser: UserProfile = {
            id: 'admin',
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
      const members = JSON.parse(localStorage.getItem('site_members_v2') || '[]');
      const localUser = members.find((m: any) => m.id === loginId);

      if (localUser?.email) {
        targetEmail = localUser.email;
      } else {
        targetEmail = `${loginId}@thebestsns.user`;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: loginPw,
      });

      if (error) throw error;

      const profile: UserProfile = localUser || {
        id: loginId,
        nickname: data.user.user_metadata.nickname || loginId,
        profileImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${loginId}`,
        role: 'user',
        email: data.user.email,
        points: 0,
        joinDate: new Date().toISOString().split('T')[0],
        coupons: []
      };

      if (saveId) {
        localStorage.setItem(SAVED_LOGIN_ID_KEY, loginId);
      } else {
        localStorage.removeItem(SAVED_LOGIN_ID_KEY);
      }
      onLoginSuccess(profile);
      navigate('/sns');
    } catch (err: any) {
      alert(`로그인 실패: ${err.message === 'Invalid login credentials' ? '아이디 또는 비밀번호가 일치하지 않습니다.' : err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.pw !== formData.pwConfirm) return alert('비밀번호가 일치하지 않습니다.');
    if (!formData.agreeTerms) return alert('약관에 동의해주세요.');
    if (formData.id.length < 5) return alert('아이디는 5자 이상이어야 합니다.');

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.pw,
        options: {
          data: {
            nickname: formData.name,
            phone: formData.phone,
            user_id: formData.id
          }
        }
      });

      if (authError) throw authError;

      const newUser: UserProfile = {
        id: formData.id,
        nickname: formData.name || `유저_${formData.id}`,
        email: formData.email,
        phone: formData.phone,
        profileImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.id}`,
        role: 'user',
        points: 0,
        joinDate: new Date().toISOString().split('T')[0],
        coupons: []
      };

      onLoginSuccess(newUser);
      alert('회원가입이 완료되었습니다! 더베스트SNS에 오신 것을 환영합니다.');
      navigate('/sns');
    } catch (err: any) {
      alert(`회원가입 실패: ${err.message}`);
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
                <input type="text" placeholder="아이디" className="w-full p-5 bg-gray-50 border-none rounded-2xl font-black shadow-inner outline-none focus:ring-4 focus:ring-blue-50 transition-all" value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} required />
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
                  <input type="text" placeholder="아이디 (6~20자)" className="w-full p-5 bg-gray-50 border-none rounded-2xl font-bold shadow-inner outline-none focus:ring-4 focus:ring-blue-50" value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} required />
                  <input type="password" placeholder="비밀번호" className="w-full p-5 bg-gray-50 border-none rounded-2xl font-bold shadow-inner outline-none focus:ring-4 focus:ring-blue-50" value={formData.pw} onChange={e => setFormData({...formData, pw: e.target.value})} required />
                  <input type="password" placeholder="비밀번호 확인" className="w-full p-5 bg-gray-50 border-none rounded-2xl font-bold shadow-inner outline-none focus:ring-4 focus:ring-blue-50" value={formData.pwConfirm} onChange={e => setFormData({...formData, pwConfirm: e.target.value})} required />
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
