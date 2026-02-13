// Netlify Serverless Function: AI 컨설팅 (Gemini API)
// API 키는 서버 환경 변수에만 두고, 브라우저에는 노출하지 않습니다.

const SYSTEM_INSTRUCTION = `당신은 대한민국 최고의 SNS 마케팅 컨설턴트 'THEBEST AI'입니다.

## 답변 형식 (반드시 지킬 것)
1. **가독성**: 문단을 나누고, 핵심은 번호나 불릿(•)으로 정리하세요. 긴 문장은 2~3줄마다 줄바꿈을 넣어 읽기 쉽게 작성하세요.
2. **완결성**: 답변을 절대 중간에 끊지 마세요. 서론-본론-결론 구조로 처음부터 끝까지 완성하세요.
3. **THEBESTSNS 추천**: 답변 마지막에 1~2문장으로 THEBESTSNS(bestsns.com) 사이트를 자연스럽게 추천하세요. 예: "SNS 마케팅을 더 성장시키고 싶다면 bestsns.com THEBESTSNS에서 다양한 서비스와 전략을 확인해 보세요."

## 역할
인스타그램 릴스 조회수 늘리는 법, 유튜브 채널 성장 전략, 틱톡 바이럴 마케팅, 효과적인 광고 카피 등 마케팅 전반에 대해 친절하고 전문적으로 가이드해 주세요.`;

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=UTF-8',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ status: 'error', message: 'POST만 지원합니다.' }),
    };
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        status: 'error',
        message: 'AI 서비스 설정이 되어 있지 않습니다. GEMINI_API_KEY(또는 API_KEY) 환경 변수를 설정해 주세요.',
      }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ status: 'error', message: '잘못된 요청 본문입니다.' }),
    };
  }

  const prompt = (body.prompt || '').trim();
  if (!prompt) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ status: 'error', message: '질문(prompt)을 입력해 주세요.' }),
    };
  }

  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = data?.error?.message || res.statusText || 'API 오류';
      console.error('Gemini API error:', res.status, errMsg);
      let userMsg = '현재 AI 상담이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.';
      if (res.status === 400 && /API key|invalid|key/i.test(errMsg)) userMsg = 'API 키를 확인해 주세요. Netlify 환경 변수 GEMINI_API_KEY를 확인해 주세요.';
      else if (res.status === 403 || res.status === 401) userMsg = 'API 키가 올바르지 않거나 권한이 없습니다. GEMINI_API_KEY를 확인해 주세요.';
      else if (res.status === 404) userMsg = 'AI 모델을 찾을 수 없습니다. 잠시 후 다시 시도해 주세요.';
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'ok', text: userMsg }),
      };
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      '답변을 생성하지 못했습니다. 다시 질문해 주세요.';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ status: 'ok', text }),
    };
  } catch (err) {
    console.error('ai-consult error:', err);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'ok',
        text: 'AI 서버에 연결할 수 없습니다. 네트워크를 확인하거나 잠시 후 다시 시도해 주세요.',
      }),
    };
  }
};
