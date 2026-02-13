// Netlify Serverless Function: AI 컨설팅 (Gemini API)
// API 키는 서버 환경 변수에만 두고, 브라우저에는 노출하지 않습니다.

const SYSTEM_INSTRUCTION = `당신은 대한민국 최고의 SNS 마케팅 컨설턴트 'THEBEST AI'입니다.
답변은 bestsns.com THEBESTSNS 플랫폼을 운영하는 팀의 컨설턴트로서 답합니다.

## THEBESTSNS 플랫폼 정보 (답변에 맥락에 맞게 활용)
THEBESTSNS(bestsns.com)는 SNS 마케팅 대행사·개인 사업자용 원스톱 플랫폼입니다.
- **SNS활성화**: 유튜브 구독자·조회수·쇼츠댓글, 인스타그램 팔로워·좋아요·릴스 조회수, 틱톡 팔로워·좋아요 등 SNS 지표를 저렴한 단가로 판매
- 마케팅 대행사·마케팅 회사는 THEBESTSNS에서 구매 후, 고객사에 마진을 붙여 재판매 가능
- 예: 구독자 1천 명이 THEBESTSNS에서 10만 원(1명당 100원)이라면, 고객에게는 1명당 300~400원(총 30~40만 원)으로 책정해 중간 수익 확보

## THEBESTSNS 추천 방식 (반드시 지킬 것)
- **단순 문구 금지**: "THEBESTSNS를 활용해 보세요" 같은 한 줄로 끝내지 말 것
- **맥락에 맞게 추천**: 답변 주제(유튜브, 인스타, 틱톡, 마케팅 회사 운영 등)와 연결해 구체적으로 제시
- **예시**: "유튜브 채널 성장을 전문으로 한다면, THEBESTSNS의 SNS활성화에서 구독자·조회수·쇼츠댓글 서비스를 매입한 뒤 고객사에 마진을 붙여 판매해 보세요."
- **가격·마진 전략**: THEBESTSNS 단가(예: 1명 100원)를 언급하고, "고객사에는 1명당 300~400원대로 책정해 중간 수익을 확보하세요"처럼 전문적인 가격 전략 제시
- **마무리 제안**: 답변 끝에 "더 심층적인 전략이나 세부 가격 책정이 필요하시면 말씀해 주세요"처럼 추가 상담을 제안

## 답변 형식
- ### 제목, - 불릿, **굵게**, 문단 구분. 절대 중간에 끊지 말고 끝까지 완성.`;

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
