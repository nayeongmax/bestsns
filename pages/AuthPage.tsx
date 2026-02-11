
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '../types';
import { supabase } from '../supabase';

interface Props {
  onLoginSuccess: (user: UserProfile) => void;
}

type AuthMode = 'LOGIN' | 'JOIN' | 'FIND_ID' | 'FIND_PW' | 'RESET_PW';

const AuthPage: React.FC<Props> = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [loading, setLoading] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);

  const [formData, setFormData] = useState({
    id: '',
    pw: '',
    pwConfirm: '',
    name: '',
    email: '',
    phone: '',
    agreeTerms: false
  });

  // 이메일의 재설정 링크를 클릭하고 들어왔는지 감지하는 핵심 로직
  useEffect(() => {
    // 1. URL에 recovery 토큰이 있는지 확인하거나 세션 이벤트를 리슨합니다.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // 사용자가 메일 링크를 통해 들어오면 즉시 비밀번호 재설정 모드로 전환
        setMode('RESET_PW');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const loginId = formData.id.trim();
    const loginPw = formData.pw;

    // 어드민 예외 처리
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

  const handleResetPwRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) return alert('비밀번호를 재설정할 이메일을 입력해주세요.');
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/#/login`,
      });

      if (error) throw error;

      alert('입력하신 이메일로 비밀번호 재설정 안내 메일을 발송했습니다.\n메일함의 링크를 클릭하여 비밀번호를 변경해 주세요.');
      setMode('LOGIN');
    } catch (err: any) {
      if (err.message.includes('rate limit')) {
        alert('보안 정책상 짧은 시간에 여러 번 요청할 수 없습니다. 약 1분 후에 다시 시도해 주세요.');
      } else {
        alert(`오류 발생: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // 실제 비밀번호 업데이트 수행 (메일 인증을 거쳐 'RESET_PW' 모드로 진입했을 때만 호출됨)
  const handleFinalPasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.pw || !formData.pwConfirm) return alert('모든 항목을 입력해 주세요.');
    if (formData.pw !== formData.pwConfirm) return alert('비밀번호가 일치하지 않습니다.');
    if (formData.pw.length < 6) return alert('비밀번호는 보안을 위해 6자 이상으로 설정해 주세요.');

    setLoading(true);
    try {
      // Supabase의 세션이 유효한 상태에서 비밀번호 업데이트 수행
      const { error } = await supabase.auth.updateUser({
        password: formData.pw
      });

      if (error) throw error;
      
      alert('비밀번호가 성공적으로 변경되었습니다!\n새로운 비밀번호로 로그인해 주세요.');
      setMode('LOGIN');
      setFormData({ ...formData, pw: '', pwConfirm: '' });
    } catch (err: any) {
      alert(`비밀번호 변경 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-12 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-[48px] shadow-2xl border border-gray-100 overflow-hidden relative">
        {(mode === 'LOGIN' || mode === 'JOIN') && (
          <div className="flex border-b border-gray-50">
            <button onClick={() => setMode('LOGIN')} className={`flex-1 py-6 font-black text-sm tracking-widest transition-all ${mode === 'LOGIN' ? 'text-blue-600 border-b-4 border-blue-600 bg-white' : 'text-gray-300 bg-gray-50/50'}`}>LOG IN</button>
            <button onClick={() => setMode('JOIN')} className={`flex-1 py-6 font-black text-sm tracking-widest transition-all ${mode === 'JOIN' ? 'text-blue-600 border-b-4 border-blue-600 bg-white' : 'text-gray-300 bg-gray-50/50'}`}>SIGN UP</button>
          </div>
        )}

        <div className="p-10 md:p-14 space-y-10">
          {/* 로그인 화면 */}
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
                    <input type="checkbox" checked={keepLoggedIn} onChange={e => setKeepLoggedIn(e.target.checked)} className="w-4 h-4 rounded accent-blue-600" />
                    <span className="text-[12px] font-bold text-gray-400 group-hover:text-gray-600 transition-colors">로그인 유지</span>
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

          {/* 회원가입 화면 */}
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

          {/* 메인 요청 사항: 비밀번호 재설정 화면 (메일 링크 클릭 후 자동 진입) */}
          {mode === 'RESET_PW' && (
            <div className="space-y-10 animate-in zoom-in-95 duration-500">
              <div className="text-center space-y-2">
                <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl mx-auto flex items-center justify-center text-4xl mb-6 shadow-inner">🔒</div>
                <h2 className="text-3xl font-black text-gray-900 italic tracking-tighter uppercase">New Password</h2>
                <p className="text-sm font-bold text-gray-400">인증이 확인되었습니다. 새로운 비밀번호를 입력해 주세요.</p>
              </div>

              <form onSubmit={handleFinalPasswordUpdate} className="space-y-4">
                <div className="space-y-1.5">
                   <label className="text-[11px] font-black text-gray-400 px-2 uppercase">New Password</label>
                   <input 
                    type="password" 
                    placeholder="새 비밀번호 (6자 이상)" 
                    className="w-full p-5 bg-gray-50 border-none rounded-2xl font-black shadow-inner outline-none focus:ring-4 focus:ring-blue-50 transition-all" 
                    value={formData.pw} 
                    onChange={e => setFormData({...formData, pw: e.target.value})} 
                    required 
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                   <label className="text-[11px] font-black text-gray-400 px-2 uppercase">Confirm Password</label>
                   <input 
                    type="password" 
                    placeholder="새 비밀번호 확인" 
                    className="w-full p-5 bg-gray-50 border-none rounded-2xl font-black shadow-inner outline-none focus:ring-4 focus:ring-blue-50 transition-all" 
                    value={formData.pwConfirm} 
                    onChange={e => setFormData({...formData, pwConfirm: e.target.value})} 
                    required 
                  />
                </div>
                <button type="submit" disabled={loading} className="w-full py-6 bg-blue-600 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-black transition-all uppercase italic tracking-widest mt-4">
                  {loading ? '변경 처리 중...' : '비밀번호 변경 완료 🚀'}
                </button>
              </form>
              <button onClick={() => setMode('LOGIN')} className="w-full text-center text-sm font-black text-gray-300 hover:text-gray-900 uppercase italic">Cancel and Back to Login</button>
            </div>
          )}

          {/* ID 찾기 / PW 재설정 요청 화면 */}
          {(mode === 'FIND_ID' || mode === 'FIND_PW') && (
            <div className="space-y-8 py-4">
               <div className="text-center">
                 <h2 className="text-2xl font-black text-gray-900 italic uppercase underline decoration-blue-500 underline-offset-8">{mode === 'FIND_ID' ? 'ID 찾기' : 'PW 재설정'}</h2>
                 <p className="text-sm font-bold text-gray-400 mt-4 leading-relaxed">가입 시 등록한 이메일을 입력하세요.</p>
               </div>
               <form onSubmit={mode === 'FIND_ID' ? (e) => { e.preventDefault(); handleFindId(); } : handleResetPwRequest} className="space-y-4">
                 <input type="email" placeholder="이메일 입력" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-5 bg-gray-50 border-none rounded-2xl font-bold shadow-inner outline-none focus:ring-4 focus:ring-blue-50 transition-all" required />
                 <button type="submit" disabled={loading} className="w-full py-5 bg-black text-white rounded-2xl font-black shadow-lg hover:bg-blue-600 transition-all uppercase italic">
                    {loading ? '진행 중...' : mode === 'FIND_ID' ? '아이디 찾기' : '인증 메일 발송'}
                 </button>
               </form>
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
