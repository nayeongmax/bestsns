import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '../types';
import { supabase } from '../supabase';

interface Props {
  onLoginSuccess: (user: UserProfile) => void;
  passwordRecoveryMode?: boolean;
  onRecoveryComplete?: () => void;
}

type AuthMode = 'LOGIN' | 'JOIN' | 'FIND_ID' | 'FIND_PW' | 'RESET_PW_CONFIRM';

const AuthPage: React.FC<Props> = ({ onLoginSuccess, passwordRecoveryMode, onRecoveryComplete }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [loading, setLoading] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [newPwForm, setNewPwForm] = useState({ pw: '', pwConfirm: '' });

  // Supabase 복구 토큰 감지 시 비밀번호 재설정 화면으로 전환
  useEffect(() => {
    if (passwordRecoveryMode) {
      setMode('RESET_PW_CONFIRM');
    }
  }, [passwordRecoveryMode]);

  const handleConfirmNewPassword = async () => {
    if (!newPwForm.pw || !newPwForm.pwConfirm) return alert('새 비밀번호를 입력해주세요.');
    if (newPwForm.pw.length < 6) return alert('비밀번호는 6자 이상이어야 합니다.');
    if (newPwForm.pw !== newPwForm.pwConfirm) return alert('비밀번호가 일치하지 않습니다.');

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPwForm.pw });
      if (error) throw error;

      alert('비밀번호가 성공적으로 변경되었습니다! 새 비밀번호로 로그인해주세요.');
      setNewPwForm({ pw: '', pwConfirm: '' });
      setMode('LOGIN');
      onRecoveryComplete?.();
      // 복구 세션 정리
      await supabase.auth.signOut();
    } catch (err: any) {
      alert(`비밀번호 변경 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const [formData, setFormData] = useState({
    id: '',
    pw: '',
    pwConfirm: '',
    name: '',
    email: '',
    phone: '',
    agreeTerms: false
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const loginId = formData.id.trim();
    const loginPw = formData.pw;

    // 관리자 마스터 계정 (테스트용)
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
      // 1. 아이디로 이메일 조회: localStorage → Supabase profiles 순서로 탐색
      let targetEmail = formData.email || '';

      if (!targetEmail) {
        // localStorage에서 먼저 조회
        const members = JSON.parse(localStorage.getItem('site_members_v2') || '[]');
        const localUser = members.find((m: any) => m.id === loginId);

        if (localUser?.email) {
          targetEmail = localUser.email;
        } else {
          // Supabase profiles 테이블에서 조회
          const { data: profileData } = await supabase
            .from('profiles')
            .select('raw_json')
            .eq('id', loginId)
            .single();

          if (profileData?.raw_json?.email) {
            targetEmail = profileData.raw_json.email;
          } else {
            targetEmail = `${loginId}@thebestsns.user`;
          }
        }
      }

      // 2. Supabase Auth 로그인 수행
      const { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: loginPw,
      });

      if (error) throw error;

      // 3. 프로필 데이터 구성 (profiles 테이블에서 추가 정보 로드)
      const { data: dbProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', loginId)
        .single();

      const profile: UserProfile = {
        id: loginId,
        nickname: dbProfile?.nickname || data.user.user_metadata.nickname || loginId,
        profileImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${loginId}`,
        role: dbProfile?.role || 'user',
        email: data.user.email || '',
        phone: dbProfile?.raw_json?.phone || '',
        points: dbProfile?.points || 0,
        joinDate: dbProfile?.join_date || new Date().toISOString().split('T')[0],
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
      // 1. Supabase Auth 회원가입 (메타데이터 포함)
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

      // 2. 가입 성공 시, SQL Editor로 만든 'profiles' 테이블에 데이터 입력
      const { error: dbError } = await supabase
        .from('profiles')
        .insert([
          {
            id: formData.id,
            nickname: formData.name || `유저_${formData.id}`,
            role: 'user',
            points: 0,
            join_date: new Date().toISOString().split('T')[0],
            raw_json: { email: formData.email, phone: formData.phone }
          }
        ]);

      if (dbError) {
        console.error('DB 저장 에러:', dbError);
      }

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
      // localStorage에서 이메일로 검색
      const members = JSON.parse(localStorage.getItem('site_members_v2') || '[]');
      const found = members.find((m: any) => m.email === formData.email);

      if (found) {
        alert(`찾으시는 회원님의 아이디는 [ ${found.id} ] 입니다.`);
        setMode('LOGIN');
        return;
      }

      // Supabase profiles 테이블에서 검색
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, raw_json')
        .limit(100);

      const dbFound = profiles?.find((p: any) => p.raw_json?.email === formData.email);

      if (dbFound) {
        alert(`찾으시는 회원님의 아이디는 [ ${dbFound.id} ] 입니다.`);
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

  const handleResetPw = async () => {
    if (!formData.email) return alert('비밀번호를 재설정할 이메일을 입력해주세요.');
    setLoading(true);
    try {
      // Supabase 이메일 재설정 시도
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/#/login`,
      });

      if (error) {
        // Supabase 이메일 서비스 미설정 시 localStorage 기반 임시 재설정
        const members = JSON.parse(localStorage.getItem('site_members_v2') || '[]');
        const found = members.find((m: any) => m.email === formData.email);

        if (found) {
          const newPw = prompt(`[${found.id}] 계정의 새 비밀번호를 입력하세요:`);
          if (newPw && newPw.length >= 6) {
            found.password = newPw;
            localStorage.setItem('site_members_v2', JSON.stringify(members));
            alert('비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해주세요.');
            setMode('LOGIN');
          } else if (newPw) {
            alert('비밀번호는 6자 이상이어야 합니다.');
          }
        } else {
          alert('해당 이메일로 등록된 정보가 없습니다.');
        }
        return;
      }

      alert('입력하신 이메일로 비밀번호 재설정 안내 메일을 발송했습니다.');
      setMode('LOGIN');
    } catch (err: any) {
      alert(`오류 발생: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-12 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-[48px] shadow-2xl border border-gray-100 overflow-hidden relative">
        <div className="flex border-b border-gray-50">
          <button onClick={() => setMode('LOGIN')} className={`flex-1 py-6 font-black text-sm tracking-widest transition-all ${mode === 'LOGIN' ? 'text-blue-600 border-b-4 border-blue-600 bg-white' : 'text-gray-300 bg-gray-50/50'}`}>LOG IN</button>
          <button onClick={() => setMode('JOIN')} className={`flex-1 py-6 font-black text-sm tracking-widest transition-all ${mode === 'JOIN' ? 'text-blue-600 border-b-4 border-blue-600 bg-white' : 'text-gray-300 bg-gray-50/50'}`}>SIGN UP</button>
        </div>

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

          {(mode === 'FIND_ID' || mode === 'FIND_PW') && (
            <div className="space-y-8 py-4">
               <div className="text-center">
                 <h2 className="text-2xl font-black text-gray-900 italic uppercase underline decoration-blue-500 underline-offset-8">{mode === 'FIND_ID' ? 'ID 찾기' : 'PW 재설정'}</h2>
                 <p className="text-sm font-bold text-gray-400 mt-4 leading-relaxed">가입 시 등록한 이메일을 입력하세요.</p>
               </div>
               <div className="space-y-4">
                 <input type="email" placeholder="이메일 입력" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-5 bg-gray-50 border-none rounded-2xl font-bold shadow-inner outline-none focus:ring-4 focus:ring-blue-50 transition-all" />
                 <button onClick={mode === 'FIND_ID' ? handleFindId : handleResetPw} disabled={loading} className="w-full py-5 bg-black text-white rounded-2xl font-black shadow-lg hover:bg-blue-600 transition-all uppercase italic">
                    {loading ? '진행 중...' : mode === 'FIND_ID' ? '아이디 찾기' : '인증 메일 발송'}
                 </button>
               </div>
               <button onClick={() => setMode('LOGIN')} className="w-full text-center text-sm font-black text-gray-300 hover:text-gray-900 uppercase italic transition-colors">Back to Login</button>
            </div>
          )}

          {mode === 'RESET_PW_CONFIRM' && (
            <div className="space-y-8 py-4">
               <div className="text-center space-y-3">
                 <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                   <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                 </div>
                 <h2 className="text-2xl font-black text-gray-900 italic uppercase">New Password</h2>
                 <p className="text-sm font-bold text-gray-400 leading-relaxed">새로운 비밀번호를 입력해주세요.</p>
               </div>
               <div className="space-y-4">
                 <input type="password" placeholder="새 비밀번호 (6자 이상)" value={newPwForm.pw} onChange={e => setNewPwForm({...newPwForm, pw: e.target.value})} className="w-full p-5 bg-gray-50 border-none rounded-2xl font-bold shadow-inner outline-none focus:ring-4 focus:ring-blue-50 transition-all" />
                 <input type="password" placeholder="새 비밀번호 확인" value={newPwForm.pwConfirm} onChange={e => setNewPwForm({...newPwForm, pwConfirm: e.target.value})} className="w-full p-5 bg-gray-50 border-none rounded-2xl font-bold shadow-inner outline-none focus:ring-4 focus:ring-blue-50 transition-all" />
                 <button onClick={handleConfirmNewPassword} disabled={loading} className={`w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95 uppercase italic tracking-widest ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-black'}`}>
                    {loading ? '변경 중...' : '비밀번호 변경하기'}
                 </button>
               </div>
               <button onClick={() => { setMode('LOGIN'); onRecoveryComplete?.(); }} className="w-full text-center text-sm font-black text-gray-300 hover:text-gray-900 uppercase italic transition-colors">Back to Login</button>
            </div>
          )}
        </div>
      </div>
      <p className="text-center mt-10 text-[11px] font-bold text-gray-300 uppercase tracking-[0.3em] italic">The Best SNS Marketing Platform © 2026</p>
    </div>
  );
};

export default AuthPage;
