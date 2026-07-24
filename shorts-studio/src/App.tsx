import { useState } from 'react';
import ClipMerger from './ClipMerger';
import AiShortsStudio from './AiShortsStudio';

type Mode = 'merge' | 'ai';

export default function App() {
  const [mode, setMode] = useState<Mode>('merge');

  const tab = (m: Mode, emoji: string, label: string, sub: string) => (
    <button
      onClick={() => setMode(m)}
      className={`flex-1 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all border-2 ${
        mode === m
          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
          : 'border-transparent bg-gray-50 text-gray-500 hover:bg-gray-100'
      }`}
    >
      <span className="mr-1">{emoji}</span>
      {label}
      <span className="hidden sm:inline text-[10px] font-medium opacity-60"> · {sub}</span>
    </button>
  );

  return (
    <div className="min-h-screen">
      {/* 상단 브랜드 바 + 모드 탭 */}
      <header className="bg-white/90 backdrop-blur border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎬</span>
            <span className="font-black text-gray-900 tracking-tight">쇼츠 스튜디오</span>
          </div>
          <div className="flex gap-2">
            {tab('merge', '🎞️', '영상 짜깁기', '무료')}
            {tab('ai', '✨', 'AI 대본 쇼츠', 'Claude')}
          </div>
        </div>
      </header>

      {mode === 'merge' ? <ClipMerger /> : <AiShortsStudio />}
    </div>
  );
}
