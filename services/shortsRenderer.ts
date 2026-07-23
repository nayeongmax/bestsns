/**
 * 쇼츠 영상 렌더러
 * 대본(ShortsScenario)을 세로형(1080x1920) 캔버스에 장면별로 애니메이션 렌더링하고,
 * MediaRecorder로 녹화하여 유튜브 업로드용 영상 파일(mp4/webm)을 만듭니다.
 *
 * 완전히 브라우저(클라이언트)에서 동작하며, 별도 서버/ffmpeg가 필요 없습니다.
 */

import type { ShortsScenario } from './shortsService';

export interface ShortsPalette {
  key: string;
  label: string;
  emoji: string;
  bgFrom: string;
  bgTo: string;
  accent: string;
  text: string;
  sub: string;
}

// 장르별 색상 테마
export const SHORTS_PALETTES: ShortsPalette[] = [
  { key: 'info',    label: '정보·지식',   emoji: '💡', bgFrom: '#0f172a', bgTo: '#1e3a8a', accent: '#38bdf8', text: '#ffffff', sub: '#93c5fd' },
  { key: 'humor',   label: '유머·밈',     emoji: '😂', bgFrom: '#7c2d12', bgTo: '#f59e0b', accent: '#fde047', text: '#ffffff', sub: '#fed7aa' },
  { key: 'motiv',   label: '동기부여',    emoji: '🔥', bgFrom: '#111827', bgTo: '#b91c1c', accent: '#fca5a5', text: '#ffffff', sub: '#fecaca' },
  { key: 'news',    label: '뉴스·이슈',   emoji: '📰', bgFrom: '#0c4a6e', bgTo: '#0891b2', accent: '#67e8f9', text: '#ffffff', sub: '#a5f3fc' },
  { key: 'life',    label: '일상·라이프', emoji: '🌿', bgFrom: '#064e3b', bgTo: '#10b981', accent: '#6ee7b7', text: '#ffffff', sub: '#a7f3d0' },
  { key: 'money',   label: '재테크·경제', emoji: '💰', bgFrom: '#052e16', bgTo: '#15803d', accent: '#fde047', text: '#ffffff', sub: '#bbf7d0' },
  { key: 'food',    label: '음식·먹방',   emoji: '🍜', bgFrom: '#7f1d1d', bgTo: '#ea580c', accent: '#fed7aa', text: '#ffffff', sub: '#fecaca' },
  { key: 'health',  label: '건강·운동',   emoji: '💪', bgFrom: '#134e4a', bgTo: '#0d9488', accent: '#5eead4', text: '#ffffff', sub: '#99f6e4' },
  { key: 'travel',  label: '여행',        emoji: '✈️', bgFrom: '#1e1b4b', bgTo: '#6366f1', accent: '#a5b4fc', text: '#ffffff', sub: '#c7d2fe' },
  { key: 'heal',    label: 'ASMR·힐링',   emoji: '🕯️', bgFrom: '#1e293b', bgTo: '#7c3aed', accent: '#d8b4fe', text: '#ffffff', sub: '#e9d5ff' },
];

export function paletteForGenre(genreLabel: string): ShortsPalette {
  const found = SHORTS_PALETTES.find((p) => p.label === genreLabel);
  return found || SHORTS_PALETTES[0];
}

const W = 1080;
const H = 1920;
const FPS = 30;

function pickMimeType(): { mime: string; ext: string } {
  const candidates: Array<{ mime: string; ext: string }> = [
    { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' },
    { mime: 'video/mp4', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
  ];
  for (const c of candidates) {
    try {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.mime)) return c;
    } catch {
      /* ignore */
    }
  }
  return { mime: '', ext: 'webm' };
}

export function isRenderSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const c = document.createElement('canvas');
  return typeof (c as HTMLCanvasElement).captureStream === 'function' && typeof MediaRecorder !== 'undefined';
}

// 한국어/영문 혼합 자동 줄바꿈 (공백 우선, 필요 시 글자 단위)
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    if (!para) {
      lines.push('');
      continue;
    }
    const tokens = para.split(' ');
    let current = '';
    for (const token of tokens) {
      const trial = current ? `${current} ${token}` : token;
      if (ctx.measureText(trial).width <= maxWidth) {
        current = trial;
        continue;
      }
      // 현재 줄이 있으면 밀어내고 새 토큰 시작
      if (current) {
        lines.push(current);
        current = '';
      }
      // 토큰 자체가 너무 길면 글자 단위로 쪼갬
      if (ctx.measureText(token).width <= maxWidth) {
        current = token;
      } else {
        let piece = '';
        for (const ch of token) {
          const t2 = piece + ch;
          if (ctx.measureText(t2).width <= maxWidth) {
            piece = t2;
          } else {
            if (piece) lines.push(piece);
            piece = ch;
          }
        }
        current = piece;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const FONT_STACK = "'Pretendard','Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif";

interface FrameCtx {
  scenario: ShortsScenario;
  palette: ShortsPalette;
  times: number[]; // 각 장면 시작 시각(누적)
  total: number;
}

function drawFrame(ctx: CanvasRenderingContext2D, elapsed: number, f: FrameCtx) {
  const { scenario, palette, times, total } = f;
  const scenes = scenario.scenes;

  // 현재 장면 찾기
  let idx = 0;
  for (let i = 0; i < scenes.length; i++) {
    if (elapsed >= times[i]) idx = i;
  }
  const scene = scenes[idx];
  const sceneStart = times[idx];
  const sceneDur = scene.seconds;
  const local = elapsed - sceneStart;

  // ---- 배경 그라디언트 (은은하게 움직임) ----
  const shift = Math.sin(elapsed * 0.35) * 120;
  const grad = ctx.createLinearGradient(0, shift, W, H - shift);
  grad.addColorStop(0, palette.bgFrom);
  grad.addColorStop(1, palette.bgTo);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // ---- 떠다니는 장식 원 ----
  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = palette.accent;
  const cx = W * 0.5 + Math.sin(elapsed * 0.5) * 160;
  const cy = H * 0.32 + Math.cos(elapsed * 0.4) * 120;
  ctx.beginPath();
  ctx.arc(cx, cy, 420, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 등장 애니메이션 (장면 전환 시 0.45초 페이드/슬라이드)
  const appear = easeOut(clamp01(local / 0.45));
  const slide = (1 - appear) * 60;

  // ---- 상단: 제목/후킹 바 ----
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.textAlign = 'center';
  ctx.fillStyle = palette.sub;
  ctx.font = `700 40px ${FONT_STACK}`;
  const topLabel = (scenario.hook || scenario.title || '').slice(0, 28);
  ctx.fillText(topLabel, W / 2, 150);
  // 액센트 라인
  ctx.fillStyle = palette.accent;
  ctx.fillRect(W / 2 - 90, 180, 180, 8);
  ctx.restore();

  // ---- 이모지 (살짝 통통 튀는 느낌) ----
  const pop = 1 + Math.sin(elapsed * 3 + idx) * 0.04;
  ctx.save();
  ctx.globalAlpha = appear;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(300 * pop)}px ${FONT_STACK}`;
  ctx.fillText(scene.emoji || '✨', W / 2, H * 0.34 - slide);
  ctx.restore();

  // ---- 소제목(heading) 알약 ----
  if (scene.heading) {
    ctx.save();
    ctx.globalAlpha = appear;
    ctx.font = `800 44px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(scene.heading).width;
    const pillW = tw + 80;
    const pillH = 84;
    const px = W / 2 - pillW / 2;
    const py = H * 0.5 - pillH / 2 - slide;
    ctx.fillStyle = palette.accent;
    roundRect(ctx, px, py, pillW, pillH, 42);
    ctx.fill();
    ctx.fillStyle = palette.bgFrom;
    ctx.fillText(scene.heading, W / 2, H * 0.5 - slide);
    ctx.restore();
  }

  // ---- 본문 자막(body) ----
  ctx.save();
  ctx.globalAlpha = appear;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `900 76px ${FONT_STACK}`;
  ctx.fillStyle = palette.text;
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 6;
  const lines = wrapText(ctx, scene.body || '', W - 160);
  const lineH = 96;
  const bodyTop = H * 0.6 - slide;
  lines.forEach((line, i) => {
    ctx.fillText(line, W / 2, bodyTop + i * lineH);
  });
  ctx.restore();

  // ---- 하단: 장면 진행 점 ----
  const dotY = H - 210;
  const dotGap = 34;
  const dotStart = W / 2 - ((scenes.length - 1) * dotGap) / 2;
  scenes.forEach((_, i) => {
    ctx.beginPath();
    ctx.fillStyle = i === idx ? palette.accent : 'rgba(255,255,255,0.35)';
    ctx.arc(dotStart + i * dotGap, dotY, i === idx ? 11 : 7, 0, Math.PI * 2);
    ctx.fill();
  });

  // ---- 하단: 워터마크 ----
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 40px ${FONT_STACK}`;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('BESTSNS', W / 2, H - 150);
  ctx.font = `600 30px ${FONT_STACK}`;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('made with AI 쇼츠 스튜디오', W / 2, H - 100);
  ctx.restore();

  // ---- 전체 진행 바 ----
  const prog = clamp01(elapsed / total);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(0, H - 12, W, 12);
  ctx.fillStyle = palette.accent;
  ctx.fillRect(0, H - 12, W * prog, 12);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 은은한 배경 앰비언트 패드(코드) — 녹화 스트림에 오디오 트랙으로 삽입
function buildAmbientAudio(): { dest: MediaStreamAudioDestinationNode; stop: () => void } | null {
  try {
    const AC: typeof AudioContext =
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!;
    if (!AC) return null;
    const actx = new AC();
    if (actx.state === 'suspended') actx.resume().catch(() => {});
    const dest = actx.createMediaStreamDestination();

    const master = actx.createGain();
    master.gain.value = 0.06;
    master.connect(dest);

    // A minor 계열 잔잔한 패드
    const freqs = [220, 277.18, 329.63];
    const oscs = freqs.map((freq, i) => {
      const osc = actx.createOscillator();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      const g = actx.createGain();
      g.gain.value = 0.5 / freqs.length;
      // 느린 트레몰로
      const lfo = actx.createOscillator();
      lfo.frequency.value = 0.15 + i * 0.05;
      const lfoGain = actx.createGain();
      lfoGain.gain.value = 0.25 / freqs.length;
      lfo.connect(lfoGain);
      lfoGain.connect(g.gain);
      osc.connect(g);
      g.connect(master);
      osc.start();
      lfo.start();
      return { osc, lfo };
    });

    const stop = () => {
      try {
        oscs.forEach(({ osc, lfo }) => {
          osc.stop();
          lfo.stop();
        });
        actx.close();
      } catch {
        /* ignore */
      }
    };
    return { dest, stop };
  } catch {
    return null;
  }
}

export interface RenderOptions {
  withAudio?: boolean;
  onProgress?: (ratio: number) => void;
}

export interface RenderOutput {
  blob: Blob;
  url: string;
  ext: string;
  mime: string;
  durationSec: number;
}

/**
 * 대본을 실제 영상 파일로 렌더링합니다. (실시간 녹화 방식 — 영상 길이만큼 소요)
 * @param canvas 화면에 미리보기로 보여줄 캔버스 엘리먼트
 */
export function renderShortsVideo(
  canvas: HTMLCanvasElement,
  scenario: ShortsScenario,
  palette: ShortsPalette,
  options: RenderOptions = {},
): Promise<RenderOutput> {
  return new Promise((resolve, reject) => {
    if (!isRenderSupported()) {
      reject(new Error('이 브라우저는 영상 생성을 지원하지 않습니다. 최신 Chrome/Edge에서 시도해 주세요.'));
      return;
    }
    const scenes = scenario.scenes || [];
    if (scenes.length === 0) {
      reject(new Error('대본 장면이 없습니다.'));
      return;
    }

    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('캔버스 컨텍스트를 생성할 수 없습니다.'));
      return;
    }

    // 장면 시작 시각 누적
    const times: number[] = [];
    let acc = 0;
    for (const s of scenes) {
      times.push(acc);
      acc += s.seconds;
    }
    const total = acc;
    const frameCtx: FrameCtx = { scenario, palette, times, total };

    // 첫 프레임 즉시 그려서 미리보기 표시
    drawFrame(ctx, 0, frameCtx);

    const videoStream = canvas.captureStream(FPS);
    const tracks = [...videoStream.getVideoTracks()];

    let audio: ReturnType<typeof buildAmbientAudio> = null;
    if (options.withAudio) {
      audio = buildAmbientAudio();
      if (audio) tracks.push(...audio.dest.stream.getAudioTracks());
    }
    const stream = new MediaStream(tracks);

    const { mime, ext } = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch (e) {
      audio?.stop();
      reject(new Error('녹화기를 시작할 수 없습니다: ' + (e as Error).message));
      return;
    }

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };

    let rafId = 0;
    let finished = false;
    const startedAt = performance.now();

    const cleanup = () => {
      cancelAnimationFrame(rafId);
      audio?.stop();
      tracks.forEach((t) => t.stop());
    };

    recorder.onstop = () => {
      cleanup();
      const outMime = mime || 'video/webm';
      const blob = new Blob(chunks, { type: outMime });
      if (blob.size === 0) {
        reject(new Error('영상 데이터가 비어 있습니다. 다시 시도해 주세요.'));
        return;
      }
      const url = URL.createObjectURL(blob);
      resolve({ blob, url, ext, mime: outMime, durationSec: total });
    };

    recorder.onerror = () => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(new Error('녹화 중 오류가 발생했습니다.'));
    };

    const loop = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      if (elapsed >= total) {
        drawFrame(ctx, total - 0.001, frameCtx);
        options.onProgress?.(1);
        if (!finished) {
          finished = true;
          // 마지막 프레임 반영 여유
          setTimeout(() => {
            try {
              if (recorder.state !== 'inactive') recorder.stop();
            } catch {
              /* ignore */
            }
          }, 120);
        }
        return;
      }
      drawFrame(ctx, elapsed, frameCtx);
      options.onProgress?.(clamp01(elapsed / total));
      rafId = requestAnimationFrame(loop);
    };

    try {
      recorder.start(200); // 200ms 단위로 청크 수집
      rafId = requestAnimationFrame(loop);
    } catch (e) {
      cleanup();
      reject(new Error('녹화를 시작할 수 없습니다: ' + (e as Error).message));
    }
  });
}
