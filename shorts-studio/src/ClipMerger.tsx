import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  mergeClips,
  readVideoDuration,
  isMergeSupported,
  type MergeClip,
} from './clipMerger';

interface Clip {
  id: string;
  file: File;
  url: string;
  name: string;
  duration: number;
  trimStart: number;
  trimEnd: number;
  caption: string;
}

let idSeq = 0;
const nextId = () => `clip_${Date.now()}_${idSeq++}`;

const fmt = (s: number) => `${s.toFixed(1)}초`;

export default function ClipMerger() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [fit, setFit] = useState<'cover' | 'contain'>('cover');
  const [withAudio, setWithAudio] = useState(true);
  const [fade, setFade] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoExt, setVideoExt] = useState('webm');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const clipsRef = useRef<Clip[]>([]);
  clipsRef.current = clips;

  const supported = isMergeSupported();

  const total = useMemo(
    () => clips.reduce((s, c) => s + Math.max(0, c.trimEnd - c.trimStart), 0),
    [clips],
  );

  // 언마운트 시 URL 정리
  useEffect(
    () => () => {
      clipsRef.current.forEach((c) => URL.revokeObjectURL(c.url));
    },
    [],
  );

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError('');
    setLoadingFiles(true);
    const vids = Array.from(files).filter((f) => f.type.startsWith('video/'));
    if (vids.length === 0) {
      setError('영상 파일만 추가할 수 있습니다.');
      setLoadingFiles(false);
      return;
    }
    const newClips: Clip[] = [];
    for (const file of vids) {
      const url = URL.createObjectURL(file);
      const duration = await readVideoDuration(url);
      newClips.push({
        id: nextId(),
        file,
        url,
        name: file.name,
        duration: duration || 0,
        trimStart: 0,
        trimEnd: duration || 0,
        caption: '',
      });
    }
    setClips((prev) => [...prev, ...newClips]);
    setLoadingFiles(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeClip = (id: string) => {
    setClips((prev) => {
      const target = prev.find((c) => c.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((c) => c.id !== id);
    });
  };

  const move = (index: number, dir: -1 | 1) => {
    setClips((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const update = (id: string, patch: Partial<Clip>) => {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const handleMerge = async () => {
    if (!canvasRef.current || clips.length === 0 || rendering) return;
    setRendering(true);
    setError('');
    setProgress(0);
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }
    const payload: MergeClip[] = clips.map((c) => ({
      url: c.url,
      name: c.name,
      duration: c.duration,
      trimStart: Math.max(0, Math.min(c.trimStart, c.duration || c.trimStart)),
      trimEnd: Math.max(c.trimStart + 0.1, Math.min(c.trimEnd, c.duration || c.trimEnd)),
      caption: c.caption.trim() || undefined,
    }));
    try {
      const out = await mergeClips(canvasRef.current, payload, {
        fit,
        withAudio,
        fade,
        onProgress: (r) => setProgress(r),
      });
      setVideoUrl(out.url);
      setVideoExt(out.ext);
    } catch (e) {
      setError((e as Error).message || '영상 합치기에 실패했습니다.');
    } finally {
      setRendering(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-6 pb-24 space-y-6">
      {/* 히어로 */}
      <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-cyan-900 rounded-[28px] sm:rounded-[36px] p-6 sm:p-8 text-white relative overflow-hidden">
        <div className="absolute -right-10 -top-10 text-[160px] opacity-10 select-none">🎞️</div>
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-tight">영상 짜깁기 · 쇼츠 합치기</h1>
          <p className="text-sm sm:text-base text-cyan-100 font-medium mt-2 max-w-2xl leading-relaxed">
            짧은 동영상 여러 개를 올리면, 순서대로 이어붙여 <b className="text-white">세로형(9:16) 쇼츠 한 편</b>으로 만들어 드립니다.
            <b className="text-white"> 결제·API 없이 무료</b>로 브라우저에서 바로 완성됩니다.
          </p>
        </div>
      </div>

      {!supported && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl px-5 py-4 text-sm font-bold">
          ⚠️ 현재 브라우저는 영상 합치기를 지원하지 않습니다. 최신 <b>Chrome / Edge</b>(PC 권장)에서 이용해 주세요.
        </div>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 왼쪽: 클립 목록 */}
        <div className="bg-white rounded-[28px] shadow-sm border border-gray-100 p-5 sm:p-7 space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 bg-blue-600 text-white rounded-xl flex items-center justify-center font-black text-sm">1</span>
            <h2 className="text-lg sm:text-xl font-black text-gray-900">동영상 추가</h2>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loadingFiles}
            className="w-full border-2 border-dashed border-blue-200 rounded-2xl py-8 text-center hover:border-blue-400 hover:bg-blue-50/40 transition-all"
          >
            <div className="text-4xl mb-2">📥</div>
            <p className="text-sm font-black text-gray-700">{loadingFiles ? '불러오는 중…' : '동영상 파일 선택 (여러 개 가능)'}</p>
            <p className="text-[11px] text-gray-400 font-medium mt-1">mp4, mov, webm 등 · 클릭해서 추가</p>
          </button>

          {clips.length > 0 && (
            <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 px-1">
              <span>총 {clips.length}개 클립</span>
              <span>⏱️ 약 {total.toFixed(1)}초</span>
            </div>
          )}

          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {clips.map((c, i) => (
              <div key={c.id} className="border border-gray-100 rounded-2xl p-3.5 bg-white">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-black text-xs shrink-0">{i + 1}</span>
                  <p className="text-xs font-bold text-gray-700 truncate flex-1">{c.name}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="w-7 h-7 rounded-lg bg-gray-50 text-gray-500 disabled:opacity-30 hover:bg-gray-100 text-xs font-black" aria-label="위로">▲</button>
                    <button onClick={() => move(i, 1)} disabled={i === clips.length - 1} className="w-7 h-7 rounded-lg bg-gray-50 text-gray-500 disabled:opacity-30 hover:bg-gray-100 text-xs font-black" aria-label="아래로">▼</button>
                    <button onClick={() => removeClip(c.id)} className="w-7 h-7 rounded-lg bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 text-xs font-black" aria-label="삭제">✕</button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-bold text-gray-400 w-8">구간</span>
                  <input
                    type="number" min={0} max={c.duration || undefined} step={0.1} value={c.trimStart}
                    onChange={(e) => update(c.id, { trimStart: Math.max(0, Math.min(Number(e.target.value) || 0, c.trimEnd - 0.1)) })}
                    className="w-16 px-2 py-1 rounded-lg bg-slate-50 border border-gray-200 text-xs font-bold text-center outline-none focus:border-blue-400"
                  />
                  <span className="text-[11px] text-gray-400">~</span>
                  <input
                    type="number" min={0} max={c.duration || undefined} step={0.1} value={c.trimEnd}
                    onChange={(e) => update(c.id, { trimEnd: Math.min(c.duration || Number(e.target.value), Math.max(Number(e.target.value) || 0, c.trimStart + 0.1)) })}
                    className="w-16 px-2 py-1 rounded-lg bg-slate-50 border border-gray-200 text-xs font-bold text-center outline-none focus:border-blue-400"
                  />
                  <span className="text-[11px] text-gray-400 ml-auto">원본 {fmt(c.duration)}</span>
                </div>
                <input
                  type="text" value={c.caption}
                  onChange={(e) => update(c.id, { caption: e.target.value.slice(0, 60) })}
                  placeholder="이 장면 자막 (선택)"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-transparent focus:border-blue-300 focus:bg-white text-xs font-bold text-gray-700 outline-none"
                />
              </div>
            ))}
            {clips.length === 0 && (
              <p className="text-center text-xs text-gray-400 font-bold py-6">아직 추가된 영상이 없어요. 위 버튼으로 동영상을 추가하세요.</p>
            )}
          </div>
        </div>

        {/* 오른쪽: 옵션 + 합치기 */}
        <div className="bg-white rounded-[28px] shadow-sm border border-gray-100 p-5 sm:p-7 space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 bg-blue-600 text-white rounded-xl flex items-center justify-center font-black text-sm">2</span>
            <h2 className="text-lg sm:text-xl font-black text-gray-900">합치기 · 완성</h2>
          </div>

          <div className="flex justify-center">
            <div className="relative rounded-2xl overflow-hidden shadow-lg bg-slate-900" style={{ width: 216, height: 384 }}>
              <canvas ref={canvasRef} className="w-full h-full block" />
              {!rendering && !videoUrl && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60 text-xs font-bold gap-2 pointer-events-none">
                  <span className="text-3xl">🎞️</span>
                  <span>9:16 미리보기</span>
                </div>
              )}
              {rendering && (
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white gap-2">
                  <span className="text-xs font-black">합치는 중… {Math.round(progress * 100)}%</span>
                  <div className="w-2/3 h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-white transition-all" style={{ width: `${progress * 100}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 화면 맞춤 */}
          <div>
            <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">화면 맞춤</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setFit('cover')} className={`px-3 py-3 rounded-2xl text-xs font-black border-2 transition-all ${fit === 'cover' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 bg-gray-50 text-gray-500'}`}>
                꽉 채우기<span className="block text-[10px] font-medium opacity-70 mt-0.5">가장자리 잘림</span>
              </button>
              <button onClick={() => setFit('contain')} className={`px-3 py-3 rounded-2xl text-xs font-black border-2 transition-all ${fit === 'contain' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 bg-gray-50 text-gray-500'}`}>
                전체 보이기<span className="block text-[10px] font-medium opacity-70 mt-0.5">위아래 여백</span>
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-50 cursor-pointer select-none">
            <input type="checkbox" checked={withAudio} onChange={(e) => setWithAudio(e.target.checked)} className="w-4 h-4 accent-blue-600" />
            <span className="text-sm font-bold text-gray-700">원본 영상 소리 포함</span>
          </label>
          <label className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-50 cursor-pointer select-none">
            <input type="checkbox" checked={fade} onChange={(e) => setFade(e.target.checked)} className="w-4 h-4 accent-blue-600" />
            <span className="text-sm font-bold text-gray-700">장면 전환 페이드 효과</span>
          </label>

          <button
            onClick={handleMerge}
            disabled={rendering || clips.length === 0 || !supported}
            className="w-full px-4 py-4 rounded-2xl bg-blue-600 text-white font-black text-sm hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 transition-all shadow-lg shadow-blue-100"
          >
            {rendering ? `합치는 중 ${Math.round(progress * 100)}%` : '🎬 영상 합치기'}
          </button>
          <p className="text-[11px] text-gray-400 font-medium text-center leading-relaxed">
            합치기는 전체 재생 시간(약 {total.toFixed(1)}초)만큼 소요됩니다. 진행 중에는 탭을 활성화 상태로 두세요.
          </p>

          {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-2xl px-4 py-3 text-sm font-bold">{error}</div>}

          {videoUrl && (
            <div className="space-y-3 pt-1">
              <div className="rounded-2xl overflow-hidden bg-black">
                <video src={videoUrl} controls playsInline className="w-full max-h-[420px] mx-auto" />
              </div>
              <a
                href={videoUrl}
                download={`shorts-merged.${videoExt}`}
                className="flex items-center justify-center gap-2 w-full px-4 py-4 rounded-2xl bg-green-600 text-white font-black text-sm hover:bg-green-700 transition-all shadow-lg shadow-green-100"
              >
                ⬇️ 합쳐진 영상 다운로드 (.{videoExt})
              </a>
              <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 text-[12px] text-blue-700 font-medium leading-relaxed">
                다운로드한 파일을 <b>YouTube {'>'} 만들기 {'>'} 동영상 업로드</b>에 올리면 끝! (세로 9:16 · 60초 미만은 자동으로 쇼츠 처리됩니다)
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
