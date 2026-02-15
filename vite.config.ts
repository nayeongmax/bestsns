import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname)

// Netlify 빌드 시 ../../types resolve 오류 방지
function resolveTypesPlugin() {
  const typesPath = path.resolve(root, 'types.ts')
  return {
    name: 'resolve-project-types',
    enforce: 'pre',
    resolveId(source, importer) {
      const isTypesImport = source === '../../types' || source === '../types' || source === '@/types'
      if (!isTypesImport) return null
      if (importer && importer.includes('node_modules')) return null
      return typesPath
    },
  }
}

// Netlify 빌드 시 profileUtils resolve 오류 방지
function resolveProfileUtilsPlugin() {
  const profileUtilsPath = path.resolve(root, 'profileUtils.ts')
  return {
    name: 'resolve-profile-utils',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source !== './profileUtils' && source !== './profileUtils.ts') return null
      if (importer && !importer.includes('App.tsx')) return null
      return profileUtilsPath
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  base: '/', // 이 부분을 추가해서 경로를 명확하게 잡아줍니다.
  plugins: [resolveTypesPlugin(), resolveProfileUtilsPlugin(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/types': path.resolve(__dirname, 'types.ts'),
      '@/profileUtils': path.resolve(__dirname, 'profileUtils.ts'),
      './components/Header': path.resolve(__dirname, 'components/Header.tsx'),
      './components/LiveNotification': path.resolve(__dirname, 'components/LiveNotification.tsx'),
      './pages': path.resolve(__dirname, 'pages'),
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
