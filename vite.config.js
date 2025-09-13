import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // 서비스 워커 파일명 지정
      filename: 'service-worker.js',
      // 서비스 워커의 동작 방식 설정
      workbox: {
        // 모든 네트워크 요청을 캐시하지 않고, 네트워크 우선으로 처리
        runtimeCaching: [{
          handler: 'NetworkOnly',
          urlPattern: /.*/,
        }],
      },
      // 푸시 알림을 위한 manifest 설정
      manifest: {
        name: '열차 예매',
        short_name: '열차 예매',
        description: '열차 예매 자동화 앱',
        theme_color: '#ffffff',
        icons: [
          // TODO: 192x192, 512x512 크기의 앱 아이콘을 public 폴더에 추가하세요.
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
})