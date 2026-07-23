# 🎬 AI 쇼츠 스튜디오 (독립 실행형)

장르와 주제만 입력하면 **Claude(Anthropic) AI**가 유튜브 쇼츠 대본을 생성하고,
**세로형(9:16) 영상 파일**까지 브라우저에서 자동으로 만들어 주는 독립 웹앱입니다.
별도 서버나 ffmpeg 없이 브라우저(Canvas + MediaRecorder)에서 동작합니다.

> 이 앱은 `bestsns.com` 본 서비스와 **완전히 분리된** 별도 프로젝트/사이트입니다.

## 주요 기능
- 🎬 장르별(정보·유머·동기부여·뉴스·일상·재테크·먹방·건강·여행·ASMR) 쇼츠 대본 자동 생성
- ✏️ 장면별 자막·길이 편집
- 🖼️ 배경 이미지 업로드 (영상에 실제 합성)
- 🏷️ 브랜드 로고 워터마크 업로드
- 🎵 선택형 배경 앰비언트 사운드 (영상 오디오 트랙에 삽입)
- 🔊 내레이션 TTS 미리듣기, 제목·해시태그 복사
- ⬇️ 완성 영상(mp4/webm) 다운로드 → 유튜브 쇼츠에 바로 업로드

## 로컬 실행
AI 대본 생성은 Netlify Function을 사용하므로 `netlify dev` 로 실행합니다.

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
