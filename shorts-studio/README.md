# 🎬 쇼츠 스튜디오 (독립 실행형)

브라우저에서 바로 **세로형(9:16) 유튜브 쇼츠 영상 파일**을 만들어 주는 독립 웹앱입니다.
서버나 ffmpeg 없이 Canvas + MediaRecorder로 동작하며, 두 가지 모드를 제공합니다.

> 이 앱은 `bestsns.com` 본 서비스와 **완전히 분리된** 별도 프로젝트/사이트입니다.

## 🎞️ 모드 1 — 영상 짜깁기 (무료 · API 불필요)
짧은 동영상 여러 개를 올리면 순서대로 이어붙여 쇼츠 한 편으로 만듭니다. **결제/키가 전혀 필요 없습니다.**
- 여러 클립 업로드 → 순서 변경 · 구간(트림) 조절 · 장면별 자막
- 화면 맞춤(꽉 채우기 / 전체 보이기), 원본 소리 포함, 장면 전환 페이드
- 서로 다른 해상도·포맷도 하나의 9:16 영상으로 재인코딩
- ⬇️ 완성 영상(mp4/webm) 다운로드 → 유튜브 쇼츠 업로드

## ✨ 모드 2 — AI 대본 쇼츠 (Claude · 크레딧 필요)
장르와 주제만 입력하면 **Claude(Anthropic) AI**가 대본을 쓰고 자막 영상을 만듭니다.
- 장르별 대본 자동 생성 + 장면 편집
- 배경 이미지·로고 워터마크·앰비언트 사운드·TTS 미리듣기
- 이 모드만 `ANTHROPIC_API_KEY` 및 Anthropic 크레딧이 필요합니다.

## 로컬 실행
- **영상 짜깁기 모드**는 서버 함수가 필요 없어 `npm run dev` (http://localhost:5180) 만으로 완전히 동작합니다.
- **AI 대본 모드**는 Netlify Function을 사용하므로 `netlify dev` 로 실행해야 합니다.

```bash
cd shorts-studio
npm install
npm install -g netlify-cli      # 최초 1회

# 이 폴더에 .env 생성 후 키 입력
echo "ANTHROPIC_API_KEY=sk-ant-본인_키" > .env

netlify dev                     # http://localhost:8888
```

> 프론트만 빠르게 확인하려면 `npm run dev` (http://localhost:5180) — 단, 이 경우 AI 대본 생성은 동작하지 않습니다.

## Netlify 배포 (별도 사이트)
1. Netlify에서 **Add new site → Import an existing project** → 이 저장소 선택
2. **Base directory** 를 `shorts-studio` 로 지정
   - Build command: `npm run build` · Publish directory: `dist` (netlify.toml에 이미 설정됨)
3. **Site configuration → Environment variables** 에 `ANTHROPIC_API_KEY` 등록
4. 배포 완료 후 발급된 주소로 접속

## 환경 변수
| 변수 | 필수 | 설명 |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Claude API 키 (https://console.anthropic.com/settings/keys) |
| `CLAUDE_MODEL` | ⬜ | 사용할 모델. 기본값 `claude-opus-4-8` |

## 참고
- 영상 생성은 **PC의 최신 Chrome/Edge** 를 권장합니다(`MediaRecorder` 기반).
- 생성은 영상 길이(약 20~45초)만큼 실시간 녹화되므로 그동안 탭을 켜 두세요.
- 음성 내레이션의 파일 직접 삽입은 브라우저 Web Speech API 제약으로, 현재는 TTS 미리듣기 + 앰비언트 사운드 방식입니다. 실제 음성 임베딩은 서버 TTS 연동이 필요합니다.
