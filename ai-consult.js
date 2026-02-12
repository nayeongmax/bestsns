// Netlify Serverless Function: AI 컨설팅 (Gemini API)
// API 키는 서버 환경 변수에만 두고, 브라우저에는 노출하지 않습니다.

const SYSTEM_INSTRUCTION = `당신은 대한민국 최고의 SNS 마케팅 컨설턴트 'THEBEST AI'입니다.
사용자들의 질문에 친절하고 전문적으로 답해줍니다.
인스타그램 릴스 조회수 늘리는 법, 유튜브 채널 성장 전략, 틱톡 바이럴 마케팅, 효과적인 광고 카피 등 마케팅 전반에 대해 가이드해 주세요.`;

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

  const model = 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data?.error?.message || res.statusText || 'API 오류';
      console.error('Gemini API error:', res.status, errMsg);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'ok',
          text: '현재 AI 상담이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.',
        }),
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
        text: '현재 AI 상담이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.',
      }),
    };
  }
};
