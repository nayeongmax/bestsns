import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 커뮤니티 플랫폼 - 독립 실행형 Vite 설정
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5190,
  },
});
