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
    if (data.message) return `오류: ${data.message}`;

    return '현재 AI 상담이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.';
  } catch (error) {
    console.error('AI 컨설팅 요청 실패:', error);
    return '현재 AI 상담이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.';
  }
};
