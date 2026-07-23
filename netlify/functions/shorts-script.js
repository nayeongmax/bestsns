// Netlify Serverless Function: 유튜브 쇼츠 대본 생성 (Claude / Anthropic API)
// 장르 + 주제를 받아, 세로형 쇼츠 영상 제작용 시나리오(JSON)를 생성합니다.
// API 키는 서버 환경 변수(ANTHROPIC_API_KEY)에만 두고, 브라우저에는 노출하지 않습니다.
//
// [설정 방법]
// - Netlify: Site settings > Environment variables 에 ANTHROPIC_API_KEY 등록
// - 로컬: netlify dev 실행 시 .env 파일에 ANTHROPIC_API_KEY 추가
// - Anthropic API 키 발급: https://console.anthropic.com/settings/keys

const SYSTEM_INSTRUCTION = `당신은 대한민국 최고의 유튜브 쇼츠(YouTube Shorts) 기획 전문가 'BESTSNS 쇼츠 비서'입니다.
사용자가 준 장르와 주제로, 세로형(9:16) 짧은 영상 한 편을 만들 수 있는 완성된 시나리오를 만듭니다.

## 반드시 지킬 규칙
- 전체 영상 길이는 20~45초 사이가 되도록 장면(scene) 수와 각 장면 길이를 배분합니다.
- 장면(scene)은 6~9개로 구성합니다.
- 첫 장면은 3초 안에 시청자를 사로잡는 강력한 후킹(hook)이어야 합니다.
- 각 장면의 body(자막)는 화면에 크게 표시되므로 한국어 기준 공백 포함 45자 이내로 짧고 임팩트 있게 씁니다.
- narration(내레이션)은 성우가 읽을 대사이며, body보다 자연스럽고 조금 더 길어도 됩니다(문장형).
- 마지막 장면은 구독/좋아요 유도 또는 강력한 마무리 메시지로 끝냅니다.
- emoji는 각 장면 분위기에 맞는 이모지 1개.
- 장르 특성(정보/유머/동기부여/뉴스/일상/재테크 등)을 확실히 살립니다.

## 출력 형식 (매우 중요)
- 아래 JSON 스키마와 정확히 일치하는 JSON "하나만" 출력합니다. 코드펜스(\`\`\`)나 설명 문장을 절대 붙이지 마세요.
{
  "title": "유튜브 업로드용 제목 (40자 이내, 후킹 강하게)",
  "hook": "썸네일/첫 장면용 초강력 한 줄 (20자 내외)",
  "hashtags": ["#해시태그", "..."],           // 5~8개, # 포함
  "description": "유튜브 설명란용 2~3문장",
  "bgmMood": "어울리는 배경음 분위기 (예: 잔잔한 로파이, 신나는 EDM)",
  "scenes": [
    {
      "heading": "장면 소제목 (10자 내외, 선택)",
      "body": "화면 자막 (45자 이내)",
      "narration": "성우 대사 (문장형)",
      "seconds": 3,
      "emoji": "🔥"
    }
  ]
}`;

exports.handler = async (event) => {
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

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        status: 'error',
        message: 'AI 서비스 설정이 되어 있지 않습니다. Netlify 환경 변수에 ANTHROPIC_API_KEY를 등록해 주세요.',
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

  const genre = (body.genre || '').toString().trim();
  const topic = (body.topic || '').toString().trim();

  if (!genre || !topic) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ status: 'error', message: '장르(genre)와 주제(topic)를 모두 입력해 주세요.' }),
    };
  }

  const userPrompt =
    `장르: ${genre}\n주제: ${topic}\n\n` +
    `위 장르와 주제로 유튜브 쇼츠 한 편의 완성된 시나리오를 JSON으로만 만들어 주세요.`;

  const model = process.env.CLAUDE_MODEL || 'claude-opus-4-8';

  const payload = {
    model,
    max_tokens: 2500,
    system: SYSTEM_INSTRUCTION,
    messages: [{ role: 'user', content: userPrompt }],
  };

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = data?.error?.message || res.statusText || 'API 오류';
      console.error('Anthropic API error:', res.status, errMsg);
      let userMsg = '현재 쇼츠 생성이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.';
      if (res.status === 401 || res.status === 403) userMsg = 'API 키가 올바르지 않거나 권한이 없습니다. ANTHROPIC_API_KEY를 확인해 주세요.';
      else if (res.status === 400 && /credit|billing|balance/i.test(errMsg)) userMsg = 'Anthropic 계정의 크레딧/결제 상태를 확인해 주세요.';
      else if (res.status === 429) userMsg = '요청이 많아 잠시 대기가 필요합니다. 잠시 후 다시 시도해 주세요.';
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ status: 'error', message: userMsg }),
      };
    }

    // Claude 응답에서 텍스트 추출 (여러 text 블록을 이어붙임)
    const rawText = Array.isArray(data?.content)
      ? data.content.filter((b) => b?.type === 'text').map((b) => b.text).join('\n').trim()
      : '';

    const scenario = extractJson(rawText);
    if (!scenario || !Array.isArray(scenario.scenes) || scenario.scenes.length === 0) {
      console.error('쇼츠 시나리오 파싱 실패:', rawText.slice(0, 500));
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ status: 'error', message: '대본 생성 결과를 해석하지 못했습니다. 주제를 조금 바꿔 다시 시도해 주세요.' }),
      };
    }

    const normalized = normalizeScenario(scenario, genre, topic);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ status: 'ok', scenario: normalized }),
    };
  } catch (err) {
    console.error('shorts-script error:', err);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        status: 'error',
        message: 'AI 서버에 연결할 수 없습니다. 네트워크를 확인하거나 잠시 후 다시 시도해 주세요.',
      }),
    };
  }
};

// 텍스트에서 첫 번째 완결된 JSON 객체를 추출
function extractJson(text) {
  if (!text) return null;
  // 코드펜스 제거
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // 중괄호 범위로 재시도
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

// 값 방어 및 기본값 보정
function normalizeScenario(s, genre, topic) {
  const clampSeconds = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return 3;
    return Math.min(6, Math.max(2, Math.round(v)));
  };
  const str = (v, fallback = '') => (typeof v === 'string' ? v.trim() : fallback);

  const scenes = s.scenes
    .filter((sc) => sc && (typeof sc.body === 'string' || typeof sc.narration === 'string'))
    .slice(0, 10)
    .map((sc) => ({
      heading: str(sc.heading).slice(0, 24),
      body: str(sc.body || sc.narration).slice(0, 80),
      narration: str(sc.narration || sc.body).slice(0, 200),
      seconds: clampSeconds(sc.seconds),
      emoji: str(sc.emoji).slice(0, 4) || '✨',
    }));

  let hashtags = Array.isArray(s.hashtags) ? s.hashtags.map((h) => str(h)).filter(Boolean) : [];
  hashtags = hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).slice(0, 10);
  if (hashtags.length === 0) hashtags = ['#쇼츠', '#shorts', `#${genre}`];

  return {
    title: str(s.title).slice(0, 60) || `${topic} | ${genre} 쇼츠`,
    hook: str(s.hook).slice(0, 40) || str(scenes[0]?.body).slice(0, 40),
    hashtags,
    description: str(s.description).slice(0, 500),
    bgmMood: str(s.bgmMood).slice(0, 60),
    genre,
    topic,
    scenes,
  };
}
