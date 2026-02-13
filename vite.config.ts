import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/', // 이 부분을 추가해서 경로를 명확하게 잡아줍니다.
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      // 어디서 요청하든 항상 프로젝트 루트 기준으로 해석 (Netlify 빌드 오류 방지)
      './components/Header': path.resolve(__dirname, 'components/Header.tsx'),
      './components/LiveNotification': path.resolve(__dirname, 'components/LiveNotification.tsx'),
      './pages': path.resolve(__dirname, 'pages'),
      // './types' alias 제거: Supabase 패키지가 자체 ./types를 쓰므로 덮어쓰면 FunctionRegion 오류 발생
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
    },
  },
  server: {
    port: 5173,
  },
})
