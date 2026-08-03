import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (nickname.trim().length < 2) return setError('닉네임은 2자 이상 입력해주세요.');
    if (password.length < 4) return setError('비밀번호는 4자 이상 입력해주세요.');
    setBusy(true);
    try {
      await signup(email, nickname.trim(), password);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h1 className="text-xl font-black text-slate-800 mb-5">회원가입</h1>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일"
            required
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 ring-indigo-300"
          />
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="닉네임"
            required
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 ring-indigo-300"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 (4자 이상)"
            required
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 ring-indigo-300"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            disabled={busy}
            className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy ? '가입 중…' : '가입하고 시작하기'}
          </button>
        </form>
        <p className="text-sm text-slate-500 mt-4 text-center">
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="text-indigo-600 font-semibold">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
