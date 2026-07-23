import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// AI 쇼츠 스튜디오 - 독립 실행형 Vite 설정
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5180,
  },
});
