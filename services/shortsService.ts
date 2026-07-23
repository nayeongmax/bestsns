/**
 * 유튜브 쇼츠 대본 생성: Netlify Function(서버)을 통해 Claude(Anthropic) API를 호출합니다.
 * API 키는 서버 환경 변수(ANTHROPIC_API_KEY)에만 두고, 브라우저에는 노출되지 않습니다.
 *
 * [설정 방법]
 * - Netlify: Site settings > Environment variables 에 ANTHROPIC_API_KEY 등록
 * - 로컬: netlify dev 실행 시 .env 파일에 ANTHROPIC_API_KEY 추가
 * - Anthropic API 키 발급: https://console.anthropic.com/settings/keys
 */

const SHORTS_URL = '/api/shorts-script';

export interface ShortsScene {
  heading: string;
  body: string;
  narration: string;
  seconds: number;
  emoji: string;
}

export interface ShortsScenario {
  title: string;
  hook: string;
  hashtags: string[];
  description: string;
  bgmMood: string;
  genre: string;
  topic: string;
  scenes: ShortsScene[];
}

export interface ShortsResult {
  ok: boolean;
  scenario?: ShortsScenario;
  error?: string;
}

export const generateShortsScript = async (genre: string, topic: string): Promise<ShortsResult> => {
  try {
    const res = await fetch(SHORTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ genre: genre.trim(), topic: topic.trim() }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data?.scenario) {
      return { ok: true, scenario: data.scenario as ShortsScenario };
    }

    if (res.status === 404) {
      const isLocal =
        typeof window !== 'undefined' && /localhost|127\.0\.0\.1/.test(window.location?.hostname || '');
      return {
        ok: false,
        error: isLocal
          ? '로컬에서는 AI 대본 기능이 동작하지 않습니다. 터미널에서 "netlify dev"로 실행하거나 배포된 사이트에서 이용해 주세요.'
          : 'AI 기능을 사용할 수 없습니다. Netlify Functions에 shorts-script가 배포되었는지 확인해 주세요.',
      };
    }

    return { ok: false, error: data?.message || '대본 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.' };
  } catch (error) {
    console.error('쇼츠 대본 생성 요청 실패:', error);
    return { ok: false, error: 'AI 서버에 연결할 수 없습니다. 네트워크를 확인하거나 잠시 후 다시 시도해 주세요.' };
  }
};
