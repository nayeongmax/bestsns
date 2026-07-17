import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { SITEMAP_ROUTES } from './sitemapRoutes'

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

// 빌드 시 dist/sitemap.xml 자동 생성 — sitemapRoutes.ts를 수정하면 자동 반영
function sitemapPlugin(baseUrl: string) {
  return {
    name: 'vite-plugin-sitemap',
    closeBundle() {
      const today = new Date().toISOString().slice(0, 10);
      const urls = SITEMAP_ROUTES.map(({ path: routePath, priority = 0.8, changefreq = 'weekly' }) => {
        const loc = routePath === '/' ? baseUrl : `${baseUrl}${routePath}`;
        return [
          '  <url>',
          `    <loc>${loc}</loc>`,
          `    <lastmod>${today}</lastmod>`,
          `    <changefreq>${changefreq}</changefreq>`,
          `    <priority>${priority.toFixed(1)}</priority>`,
          '  </url>',
        ].join('\n');
      }).join('\n');

      const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        urls,
        '</urlset>',
      ].join('\n');

      const outPath = path.resolve(__dirname, 'dist/sitemap.xml');
      fs.writeFileSync(outPath, xml, 'utf-8');
      console.log(`[sitemap] dist/sitemap.xml 생성 완료 (${SITEMAP_ROUTES.length}개 URL)`);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: '/', // 이 부분을 추가해서 경로를 명확하게 잡아줍니다.
  plugins: [resolveTypesPlugin(), resolveProfileUtilsPlugin(), react(), sitemapPlugin('https://bestsns.com')],
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
