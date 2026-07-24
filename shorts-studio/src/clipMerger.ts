/**
 * 클립 짜깁기(머지) 엔진
 * 업로드한 여러 짧은 동영상을 순서대로 이어붙여, 세로형(9:16) 쇼츠 하나로 만듭니다.
 * - 각 클립을 캔버스에 그려 재인코딩하므로 서로 다른 해상도/포맷도 하나로 합쳐집니다.
 * - 원본 클립의 소리를 Web Audio로 섞어 결과 영상에 포함합니다.
 * - 완전히 브라우저에서 동작하며, 외부 API/결제가 필요 없습니다.
 */

const FPS = 30;
const FONT_STACK = "'Pretendard','Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif";

export interface MergeClip {
  url: string;
  name: string;
  duration: number;
  trimStart: number;
  trimEnd: number;
  caption?: string;
}

export interface MergeOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain';
  withAudio?: boolean;
  fade?: boolean;
  onProgress?: (ratio: number) => void;
}

export interface MergeOutput {
  blob: Blob;
  url: string;
  ext: string;
  mime: string;
  durationSec: number;
}

export function isMergeSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const c = document.createElement('canvas');
  return typeof (c as HTMLCanvasElement).captureStream === 'function' && typeof MediaRecorder !== 'undefined';
}

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

/** 파일에서 영상 길이(초)를 읽습니다. */
export function readVideoDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => resolve(Number.isFinite(v.duration) ? v.duration : 0);
    v.onerror = () => resolve(0);
    v.src = url;
  });
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.src = url;
    v.preload = 'auto';
    v.playsInline = true;
    v.onloadedmetadata = () => resolve(v);
    v.onerror = () => reject(new Error('영상을 불러오지 못했습니다.'));
  });
}

function seek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      v.removeEventListener('seeked', done);
      resolve();
    };
    v.addEventListener('seeked', done);
    try {
      v.currentTime = Math.max(0, t);
    } catch {
      v.removeEventListener('seeked', done);
      resolve();
    }
  });
}

function drawClipFrame(
  ctx: CanvasRenderingContext2D,
  v: HTMLVideoElement,
  W: number,
  H: number,
  fit: 'cover' | 'contain',
  alpha: number,
  caption?: string,
) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);

  const vw = v.videoWidth;
  const vh = v.videoHeight;
  if (vw && vh) {
    const scale = fit === 'cover' ? Math.max(W / vw, H / vh) : Math.min(W / vw, H / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    try {
      ctx.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } catch {
      /* 아직 프레임이 준비되지 않은 경우 무시 */
    }
  }

  if (caption) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 64px ${FONT_STACK}`;
    const maxW = W - 140;
    const lines = wrapText(ctx, caption, maxW);
    const lineH = 82;
    const blockH = lines.length * lineH;
    const baseY = H - 260 - blockH;
    // 반투명 배경
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, baseY - 30, W, blockH + 60);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 16;
    lines.forEach((line, i) => {
      ctx.fillText(line, W / 2, baseY + i * lineH + lineH / 2);
    });
    ctx.restore();
  }

  if (alpha < 1) {
    ctx.fillStyle = `rgba(0,0,0,${1 - alpha})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const tokens = text.split(' ');
  let current = '';
  for (const token of tokens) {
    const trial = current ? `${current} ${token}` : token;
    if (ctx.measureText(trial).width <= maxWidth) {
      current = trial;
    } else {
      if (current) lines.push(current);
      if (ctx.measureText(token).width <= maxWidth) {
        current = token;
      } else {
        let piece = '';
        for (const ch of token) {
          if (ctx.measureText(piece + ch).width <= maxWidth) piece += ch;
          else {
            if (piece) lines.push(piece);
            piece = ch;
          }
        }
        current = piece;
      }
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

/**
 * 여러 클립을 순서대로 재생하며 캔버스에 그려 하나의 영상으로 녹화합니다.
 * (실시간 방식 — 전체 재생 시간만큼 소요)
 */
export async function mergeClips(
  canvas: HTMLCanvasElement,
  clips: MergeClip[],
  options: MergeOptions = {},
): Promise<MergeOutput> {
  if (!isMergeSupported()) {
    throw new Error('이 브라우저는 영상 합치기를 지원하지 않습니다. 최신 Chrome/Edge(PC)를 이용해 주세요.');
  }
  if (clips.length === 0) throw new Error('합칠 영상을 먼저 추가해 주세요.');

  const W = options.width || 1080;
  const H = options.height || 1920;
  const fit = options.fit || 'cover';
  const withAudio = options.withAudio !== false;

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스 컨텍스트를 생성할 수 없습니다.');

  const total = clips.reduce((s, c) => s + Math.max(0.05, c.trimEnd - c.trimStart), 0);

  // 오디오 믹싱 준비
  let actx: AudioContext | null = null;
  let dest: MediaStreamAudioDestinationNode | null = null;
  if (withAudio) {
    try {
      const AC: typeof AudioContext =
        (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!;
      if (AC) {
        actx = new AC();
        dest = actx.createMediaStreamDestination();
      }
    } catch {
      actx = null;
    }
  }

  const videoStream = canvas.captureStream(FPS);
  const tracks = [...videoStream.getVideoTracks()];
  if (dest) tracks.push(...dest.stream.getAudioTracks());
  const stream = new MediaStream(tracks);

  const { mime, ext } = pickMimeType();
  const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };
  const stopped = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime || 'video/webm' }));
  });

  recorder.start(200);

  let playedBefore = 0;
  try {
    for (const clip of clips) {
      const clipDur = Math.max(0.05, clip.trimEnd - clip.trimStart);
      const v = await loadVideo(clip.url);

      let srcNode: MediaElementAudioSourceNode | null = null;
      if (withAudio && actx && dest) {
        try {
          srcNode = actx.createMediaElementSource(v);
          srcNode.connect(dest);
          srcNode.connect(actx.destination); // 렌더 중 모니터링(들리게)
        } catch {
          srcNode = null;
        }
        if (actx.state === 'suspended') {
          try {
            await actx.resume();
          } catch {
            /* ignore */
          }
        }
      } else {
        v.muted = true;
      }

      await seek(v, clip.trimStart);

      await new Promise<void>((resolve) => {
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          resolve();
        };
        const step = () => {
          if (finished) return;
          const local = Math.max(0, v.currentTime - clip.trimStart);
          const alpha = options.fade ? Math.min(1, local / 0.3) : 1;
          drawClipFrame(ctx, v, W, H, fit, alpha, clip.caption);
          const played = playedBefore + Math.min(local, clipDur);
          options.onProgress?.(Math.min(0.999, played / total));
          if (v.ended || v.currentTime >= clip.trimEnd - 0.03) {
            finish();
            return;
          }
          requestAnimationFrame(step);
        };
        v.onended = finish;
        v.play()
          .then(() => requestAnimationFrame(step))
          .catch(() => finish());
      });

      try {
        v.pause();
      } catch {
        /* ignore */
      }
      if (srcNode) {
        try {
          srcNode.disconnect();
        } catch {
          /* ignore */
        }
      }
      playedBefore += clipDur;
    }
  } finally {
    options.onProgress?.(1);
    await new Promise((r) => setTimeout(r, 150));
    try {
      if (recorder.state !== 'inactive') recorder.stop();
    } catch {
      /* ignore */
    }
  }

  const blob = await stopped;
  try {
    videoStream.getTracks().forEach((t) => t.stop());
    if (actx) await actx.close();
  } catch {
    /* ignore */
  }

  if (blob.size === 0) throw new Error('영상 데이터가 비어 있습니다. 다시 시도해 주세요.');
  const url = URL.createObjectURL(blob);
  return { blob, url, ext, mime: mime || 'video/webm', durationSec: total };
}
