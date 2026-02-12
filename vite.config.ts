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
      // Netlify 빌드 시 "./components/Header" 해석 오류 방지 (어디서 요청해도 동일 파일로)
      './components/Header': path.resolve(__dirname, 'components/Header.tsx'),
      './components/LiveNotification': path.resolve(__dirname, 'components/LiveNotification.tsx'),
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
