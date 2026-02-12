<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1h6ZmHY6Rce5wWnaCwgXfiFFaiVtIaIvE

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. Run the app: `npm run dev`

### AI 컨설팅 사용하기

- **로컬:** `.env` 또는 `.env.local`에 `GEMINI_API_KEY=발급받은키` 추가 후, 터미널에서 **`netlify dev`** 로 실행하면 AI 컨설팅이 동작합니다. (일반 `npm run dev`만 쓰면 API 경로가 없어 AI 답변이 나오지 않습니다.)
- **Netlify 배포:** Netlify 대시보드 → Site settings → Environment variables 에 **GEMINI_API_KEY** (또는 API_KEY) 추가.
- API 키 발급: [Google AI Studio](https://aistudio.google.com/apikey)
