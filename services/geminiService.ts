/**
 * AI 컨설팅: Netlify Function(서버)을 호출합니다.
 * API 키는 서버 환경 변수(GEMINI_API_KEY 또는 API_KEY)에만 두고, 브라우저에는 노출되지 않습니다.
 *
 * [설정 방법]
 * - Netlify: Site settings > Environment variables 에 GEMINI_API_KEY 또는 API_KEY 등록
 * - 로컬: netlify dev 실행 시 .env 파일에 GEMINI_API_KEY 또는 API_KEY 추가
 * - Gemini API 키 발급: https://aistudio.google.com/apikey
 */

const AI_CONSULT_URL = '/.netlify/functions/ai-consult';

export const getMarketingConsultation = async (prompt: string): Promise<string> => {
  try {
    const res = await fetch(AI_CONSULT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt.trim() }),
    });

    const data = await res.json().catch(() => ({}));

    if (data.text) return data.text;
    if (data.message) return data.message;

    if (!res.ok) {
      if (res.status === 404) return 'AI 기능을 사용할 수 없습니다. Netlify에서 Functions 배포를 확인해 주세요.';
      if (res.status === 500) return 'AI 서비스 설정이 되어 있지 않습니다. Netlify 환경 변수에 GEMINI_API_KEY를 등록해 주세요.';
      return '현재 AI 상담이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.';
    }

    return '현재 AI 상담이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.';
  } catch (error) {
    console.error('AI 컨설팅 요청 실패:', error);
    return 'AI 서버에 연결할 수 없습니다. 네트워크를 확인하거나 잠시 후 다시 시도해 주세요.';
  }
};
