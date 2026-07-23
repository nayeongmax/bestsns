import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SEO from '@/components/SEO';
import ServiceSchema from '@/components/SEO/ServiceSchema';
import WebPageSchema from '@/components/SEO/WebPageSchema';
import OrganizationSchema from '@/components/SEO/OrganizationSchema';
import type { UserProfile } from '@/types';
import { generateShortsScript, type ShortsScenario, type ShortsScene } from '../services/shortsService';
import {
  renderShortsVideo,
  renderPreviewFrame,
  isRenderSupported,
  SHORTS_PALETTES,
  paletteForGenre,
  type ShortsPalette,
} from '../services/shortsRenderer';

interface Props {
  user?: UserProfile | null;
}

const TOPIC_SUGGESTIONS = [
  '월급 200으로 1년 안에 1000 모으는 법',
  '아침 5분 루틴으로 인생 바뀐 이야기',
  '2026년 뜨는 부업 TOP 5',
  'MZ세대가 열광하는 카페 인테리어',
  '집에서 하는 초간단 홈트 3가지',
];

const ShortsStudio: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const [genreKey, setGenreKey] = useState<string>('info');
  const [topic, setTopic] = useState('');
  const [loadingScript, setLoadingScript] = useState(false);
  const [scriptError, setScriptError] = useState('');
  const [scenario, setScenario] = useState<ShortsScenario | null>(null);

  const [withAudio, setWithAudio] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderError, setRenderError] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoExt, setVideoExt] = useState('webm');
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [copied, setCopied] = useState('');

  // 배경 이미지 / 로고 에셋
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [bgName, setBgName] = useState('');
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  const [logoName, setLogoName] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgUrlRef = useRef<string | null>(null);
  const logoUrlRef = useRef<string | null>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const palette: ShortsPalette = useMemo(
    () => SHORTS_PALETTES.find((p) => p.key === genreKey) || SHORTS_PALETTES[0],
    [genreKey],
  );

  const scenarioPalette: ShortsPalette = useMemo(
    () => (scenario ? paletteForGenre(scenario.genre) : palette),
    [scenario, palette],
  );

  const totalDuration = useMemo(
    () => (scenario ? scenario.scenes.reduce((s, sc) => s + (sc.seconds || 0), 0) : 0),
    [scenario],
  );

  const supported = isRenderSupported();

  // 대본/에셋 변경 시 정지 미리보기 갱신
  useEffect(() => {
    if (!scenario || rendering || !canvasRef.current) return;
    renderPreviewFrame(canvasRef.current, scenario, scenarioPalette, { background: bgImage, logo: logoImage });
  }, [scenario, scenarioPalette, bgImage, logoImage, rendering]);

  // 언마운트 시 objectURL 정리
  useEffect(
    () => () => {
      if (bgUrlRef.current) URL.revokeObjectURL(bgUrlRef.current);
      if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
    },
    [],
  );

  const loadImageFile = (file: File | undefined | null, kind: 'bg' | 'logo') => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setRenderError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (kind === 'bg') {
        if (bgUrlRef.current) URL.revokeObjectURL(bgUrlRef.current);
        bgUrlRef.current = url;
        setBgImage(img);
        setBgName(file.name);
      } else {
        if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
        logoUrlRef.current = url;
        setLogoImage(img);
        setLogoName(file.name);
      }
      setRenderError('');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setRenderError('이미지를 불러오지 못했습니다. 다른 파일로 시도해 주세요.');
    };
    img.src = url;
  };

  const clearBg = () => {
    if (bgUrlRef.current) URL.revokeObjectURL(bgUrlRef.current);
    bgUrlRef.current = null;
    setBgImage(null);
    setBgName('');
    if (bgInputRef.current) bgInputRef.current.value = '';
  };

  const clearLogo = () => {
    if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
    logoUrlRef.current = null;
    setLogoImage(null);
    setLogoName('');
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handleGenerate = async () => {
    if (!topic.trim() || loadingScript) return;
    setLoadingScript(true);
    setScriptError('');
    setRenderError('');
    // 이전 결과 정리
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setScenario(null);

    const res = await generateShortsScript(palette.label, topic);
    if (res.ok && res.scenario) {
      setScenario(res.scenario);
    } else {
      setScriptError(res.error || '대본 생성에 실패했습니다.');
    }
    setLoadingScript(false);
  };

  const updateScene = (index: number, field: keyof ShortsScene, value: string | number) => {
    setScenario((prev) => {
      if (!prev) return prev;
      const scenes = prev.scenes.map((sc, i) => (i === index ? { ...sc, [field]: value } : sc));
      return { ...prev, scenes };
    });
  };

  const removeScene = (index: number) => {
    setScenario((prev) => {
      if (!prev || prev.scenes.length <= 3) return prev;
      return { ...prev, scenes: prev.scenes.filter((_, i) => i !== index) };
    });
  };

  const handleRender = async () => {
    if (!scenario || !canvasRef.current || rendering) return;
    stopTts();
    setRendering(true);
    setRenderError('');
    setRenderProgress(0);
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }
    try {
      const out = await renderShortsVideo(canvasRef.current, scenario, scenarioPalette, {
        withAudio,
        background: bgImage,
        logo: logoImage,
        onProgress: (r) => setRenderProgress(r),
      });
      setVideoUrl(out.url);
      setVideoExt(out.ext);
    } catch (e) {
      setRenderError((e as Error).message || '영상 생성에 실패했습니다.');
    } finally {
      setRendering(false);
    }
  };

  const stopTts = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setTtsPlaying(false);
  };

  const handleTtsPreview = () => {
    if (!scenario) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setRenderError('이 브라우저는 음성 미리듣기를 지원하지 않습니다.');
      return;
    }
    if (ttsPlaying) {
      stopTts();
      return;
    }
    window.speechSynthesis.cancel();
    const lines = scenario.scenes.map((s) => s.narration || s.body).filter(Boolean);
    if (lines.length === 0) return;
    setTtsPlaying(true);
    lines.forEach((line, i) => {
      const u = new SpeechSynthesisUtterance(line);
      u.lang = 'ko-KR';
      u.rate = 1.05;
      if (i === lines.length - 1) {
        u.onend = () => setTtsPlaying(false);
      }
      window.speechSynthesis.speak(u);
    });
  };

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      /* ignore */
    }
  };

  const downloadName = useMemo(() => {
    const base = (scenario?.title || 'bestsns-shorts').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 40);
    return `${base || 'shorts'}.${videoExt}`;
  }, [scenario, videoExt]);

  return (
    <>
      <SEO
        title="AI 유튜브 쇼츠 자동 생성기 | BESTSNS"
        description="주제만 입력하면 Claude AI가 장르별 쇼츠 대본을 만들고, 세로형(9:16) 영상 파일까지 자동으로 생성합니다. 유튜브 쇼츠에 바로 업로드하세요."
        image="https://bestsns.com/og-image.jpg"
        canonical="https://bestsns.com/shorts"
      />
      <OrganizationSchema
        name="더베스트(THEBEST)"
        alternateName="BESTSNS"
        url="https://bestsns.com"
        logo="https://bestsns.com/og-image.jpg"
        description="AI 기반 마케팅·콘텐츠 자동화 플랫폼 BESTSNS."
        knowsAbout={['AI 쇼츠 생성', '유튜브 쇼츠', '숏폼 콘텐츠', 'AI 콘텐츠 자동화', 'SNS 마케팅']}
      />
      <ServiceSchema
        name="AI 유튜브 쇼츠 자동 생성"
        description="Claude AI로 장르별 쇼츠 대본과 세로형 영상 파일을 자동 생성하는 서비스."
        url="https://bestsns.com"
        providerName="더베스트(THEBEST)"
        serviceType="AI 숏폼 콘텐츠 생성"
        areaServed="대한민국"
        serviceId="shorts"
      />
      <WebPageSchema name="AI 유튜브 쇼츠 자동 생성기 | BESTSNS" url="https://bestsns.com" mainEntityId="https://bestsns.com#service-shorts" />

      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 pb-24 space-y-6">
        {/* 헤더 */}
        <div className="bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 rounded-[28px] sm:rounded-[36px] p-6 sm:p-8 text-white relative overflow-hidden">
          <div className="absolute -right-10 -top-10 text-[160px] opacity-10 select-none">🎬</div>
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest mb-3">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /> Powered by Claude AI
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-tight">
              AI 유튜브 쇼츠 자동 생성기
            </h1>
            <p className="text-sm sm:text-base text-indigo-100 font-medium mt-2 max-w-2xl leading-relaxed">
              장르와 주제만 고르면 <b className="text-white">클로드 비서</b>가 대본을 쓰고,
              세로형(9:16) 영상 파일까지 자동으로 만들어 드립니다. 만들어진 파일을 그대로 유튜브 쇼츠에 올리세요.
            </p>
          </div>
        </div>

        {!supported && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl px-5 py-4 text-sm font-bold">
            ⚠️ 현재 브라우저는 영상 파일 생성을 지원하지 않습니다. 대본 생성은 가능하며, 영상 만들기는 최신 <b>Chrome / Edge</b>(PC 권장)에서 이용해 주세요.
          </div>
        )}

        {/* 1단계: 입력 */}
        <section className="bg-white rounded-[28px] shadow-sm border border-gray-100 p-5 sm:p-7 space-y-5">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-sm">1</span>
            <h2 className="text-lg sm:text-xl font-black text-gray-900">장르와 주제 선택</h2>
          </div>

          {/* 장르 */}
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2.5">장르</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {SHORTS_PALETTES.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setGenreKey(p.key)}
                  className={`px-2 py-3 rounded-2xl text-xs font-black transition-all border-2 flex flex-col items-center gap-1 ${
                    genreKey === p.key
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                      : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'
                  }`}
                >
                  <span className="text-xl">{p.emoji}</span>
                  <span className="leading-tight text-center">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 주제 */}
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2.5">주제 / 아이디어</label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                placeholder="예) 직장인 점심시간 5분 재테크 꿀팁"
                maxLength={80}
                className="flex-1 px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white outline-none text-[15px] font-bold transition-all"
              />
              <button
                onClick={handleGenerate}
                disabled={!topic.trim() || loadingScript}
                className="px-7 py-4 rounded-2xl bg-indigo-600 text-white font-black text-[15px] hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 transition-all shadow-lg shadow-indigo-100 whitespace-nowrap"
              >
                {loadingScript ? '대본 생성 중…' : '✨ AI 대본 생성'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {TOPIC_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setTopic(s)}
                  className="px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-[11px] font-bold text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {scriptError && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-2xl px-4 py-3 text-sm font-bold">{scriptError}</div>
          )}
        </section>

        {/* 2단계: 대본 + 미리보기/생성 */}
        {scenario && (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 왼쪽: 대본 편집 */}
            <div className="bg-white rounded-[28px] shadow-sm border border-gray-100 p-5 sm:p-7 space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-sm">2</span>
                <h2 className="text-lg sm:text-xl font-black text-gray-900">대본 확인 · 편집</h2>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[15px] font-black text-gray-900 leading-snug">{scenario.title}</p>
                  <button onClick={() => copyText(scenario.title, 'title')} className="shrink-0 text-[11px] font-black text-indigo-500 hover:text-indigo-700">
                    {copied === 'title' ? '복사됨' : '복사'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 font-medium leading-relaxed">{scenario.description}</p>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <p className="text-[11px] text-indigo-500 font-bold break-all">{scenario.hashtags.join(' ')}</p>
                  <button onClick={() => copyText(scenario.hashtags.join(' '), 'tags')} className="shrink-0 text-[11px] font-black text-indigo-500 hover:text-indigo-700">
                    {copied === 'tags' ? '복사됨' : '복사'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400 font-bold pt-1">
                  <span>🎞️ {scenario.scenes.length}장면</span>
                  <span>⏱️ 약 {totalDuration}초</span>
                  {scenario.bgmMood && <span>🎵 {scenario.bgmMood}</span>}
                </div>
              </div>

              <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                {scenario.scenes.map((sc, i) => (
                  <div key={i} className="border border-gray-100 rounded-2xl p-3.5 bg-white hover:border-indigo-100 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{sc.emoji}</span>
                      <span className="text-[11px] font-black text-gray-400 uppercase tracking-wider">장면 {i + 1}</span>
                      <div className="ml-auto flex items-center gap-2">
                        <label className="text-[11px] font-bold text-gray-400">길이</label>
                        <input
                          type="number"
                          min={2}
                          max={6}
                          value={sc.seconds}
                          onChange={(e) => updateScene(i, 'seconds', Math.min(6, Math.max(2, Number(e.target.value) || 2)))}
                          className="w-12 px-2 py-1 rounded-lg bg-slate-50 border border-gray-200 text-xs font-bold text-center outline-none focus:border-indigo-400"
                        />
                        <span className="text-[11px] text-gray-400">초</span>
                        {scenario.scenes.length > 3 && (
                          <button onClick={() => removeScene(i)} className="text-gray-300 hover:text-red-500 text-sm font-black" aria-label="장면 삭제">✕</button>
                        )}
                      </div>
                    </div>
                    <input
                      type="text"
                      value={sc.heading}
                      onChange={(e) => updateScene(i, 'heading', e.target.value.slice(0, 24))}
                      placeholder="소제목 (선택)"
                      className="w-full mb-2 px-3 py-2 rounded-lg bg-slate-50 border border-transparent focus:border-indigo-300 focus:bg-white text-xs font-bold text-gray-600 outline-none"
                    />
                    <textarea
                      value={sc.body}
                      onChange={(e) => updateScene(i, 'body', e.target.value.slice(0, 80))}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-transparent focus:border-indigo-300 focus:bg-white text-sm font-bold text-gray-800 outline-none resize-none"
                    />
                    <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">🎙️ {sc.narration}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 오른쪽: 미리보기 + 생성 */}
            <div className="bg-white rounded-[28px] shadow-sm border border-gray-100 p-5 sm:p-7 space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-sm">3</span>
                <h2 className="text-lg sm:text-xl font-black text-gray-900">영상 만들기</h2>
              </div>

              {/* 캔버스 미리보기 */}
              <div className="flex justify-center">
                <div className="relative rounded-2xl overflow-hidden shadow-lg bg-slate-900" style={{ width: 216, height: 384 }}>
                  <canvas ref={canvasRef} className="w-full h-full block" />
                  {rendering && (
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white gap-2">
                      <span className="text-xs font-black">녹화 중… {Math.round(renderProgress * 100)}%</span>
                      <div className="w-2/3 h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-white transition-all" style={{ width: `${renderProgress * 100}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 꾸미기: 배경 이미지 / 로고 업로드 */}
              <div className="space-y-2">
                <input
                  ref={bgInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => loadImageFile(e.target.files?.[0], 'bg')}
                />
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => loadImageFile(e.target.files?.[0], 'logo')}
                />
                <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-50">
                  <span className="text-lg">🖼️</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-700 leading-tight">배경 이미지</p>
                    <p className="text-[11px] text-gray-400 font-medium truncate">{bgName || '없음 (장르 색상 배경 사용)'}</p>
                  </div>
                  <button onClick={() => bgInputRef.current?.click()} className="shrink-0 text-[11px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100">
                    {bgImage ? '변경' : '업로드'}
                  </button>
                  {bgImage && (
                    <button onClick={clearBg} className="shrink-0 text-[11px] font-black text-gray-400 hover:text-red-500" aria-label="배경 제거">✕</button>
                  )}
                </div>
                <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-50">
                  <span className="text-lg">🏷️</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-700 leading-tight">브랜드 로고 워터마크</p>
                    <p className="text-[11px] text-gray-400 font-medium truncate">{logoName || '없음 (BESTSNS 로고 표시)'}</p>
                  </div>
                  <button onClick={() => logoInputRef.current?.click()} className="shrink-0 text-[11px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100">
                    {logoImage ? '변경' : '업로드'}
                  </button>
                  {logoImage && (
                    <button onClick={clearLogo} className="shrink-0 text-[11px] font-black text-gray-400 hover:text-red-500" aria-label="로고 제거">✕</button>
                  )}
                </div>
              </div>

              {/* 옵션 */}
              <label className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-50 cursor-pointer select-none">
                <input type="checkbox" checked={withAudio} onChange={(e) => setWithAudio(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
                <span className="text-sm font-bold text-gray-700">배경 앰비언트 사운드 넣기</span>
                <span className="ml-auto text-[11px] text-gray-400 font-medium">{scenarioPalette.label}</span>
              </label>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={handleTtsPreview}
                  className="px-4 py-3.5 rounded-2xl bg-white border-2 border-gray-200 text-gray-700 font-black text-sm hover:border-indigo-300 hover:text-indigo-600 transition-all"
                >
                  {ttsPlaying ? '⏹ 미리듣기 정지' : '🔊 내레이션 미리듣기'}
                </button>
                <button
                  onClick={handleRender}
                  disabled={rendering || !supported}
                  className="px-4 py-3.5 rounded-2xl bg-indigo-600 text-white font-black text-sm hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 transition-all shadow-lg shadow-indigo-100"
                >
                  {rendering ? `생성 중 ${Math.round(renderProgress * 100)}%` : '🎬 영상 생성'}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 font-medium text-center leading-relaxed">
                영상 생성은 실제 재생 시간({totalDuration}초)만큼 소요됩니다. 생성 중에는 탭을 활성화 상태로 두세요.
              </p>

              {renderError && (
                <div className="bg-red-50 border border-red-200 text-red-600 rounded-2xl px-4 py-3 text-sm font-bold">{renderError}</div>
              )}

              {/* 완성 영상 */}
              {videoUrl && (
                <div className="space-y-3 pt-1">
                  <div className="rounded-2xl overflow-hidden bg-black">
                    <video src={videoUrl} controls playsInline className="w-full max-h-[420px] mx-auto" />
                  </div>
                  <a
                    href={videoUrl}
                    download={downloadName}
                    className="flex items-center justify-center gap-2 w-full px-4 py-4 rounded-2xl bg-green-600 text-white font-black text-sm hover:bg-green-700 transition-all shadow-lg shadow-green-100"
                  >
                    ⬇️ 영상 파일 다운로드 (.{videoExt})
                  </a>
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 text-[12px] text-blue-700 font-medium leading-relaxed">
                    다운로드한 파일을 <b>YouTube {'>'} 만들기 {'>'} 동영상 업로드</b>에서 올리고,
                    복사한 제목·해시태그를 붙여넣으면 쇼츠 업로드 완료! (세로 영상 60초 미만은 자동으로 쇼츠 처리됩니다)
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {!scenario && !loadingScript && (
          <div className="text-center py-10 text-gray-400">
            <div className="text-5xl mb-3">🎬</div>
            <p className="text-sm font-bold">위에서 장르와 주제를 고르고 <b className="text-indigo-500">AI 대본 생성</b>을 눌러보세요.</p>
          </div>
        )}

        {!user && (
          <div className="text-center">
            <button onClick={() => navigate('/login')} className="text-xs font-bold text-gray-400 hover:text-indigo-500 underline underline-offset-2">
              로그인하고 더 많은 기능 이용하기
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default ShortsStudio;
