import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import os from 'os'
import fs from 'fs'
import path from 'path'

// 获取局域网 IP
function getLocalIP() {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return 'localhost'
}

// 读取 SSL 证书
const certPath = path.resolve(__dirname, 'cert.pem')
const keyPath = path.resolve(__dirname, 'key.pem')

let httpsConfig = true
if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  httpsConfig = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  }
}

export default defineConfig(({ mode }) => {
  // 仅加载 VITE_ 前缀变量，避免空前缀扫描到 .env.production 等其它环境文件
  const env = loadEnv(mode, path.resolve(__dirname, 'env'), 'VITE_')
  
  return {
    plugins: [vue()],
    envDir: path.resolve(__dirname, 'env'),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler'
        }
      }
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      https: httpsConfig,
      open: true,
      proxy: {
        '/api': {
          target: env.VITE_API_URL,
          changeOrigin: true,
          secure: false
        },
        // WebSocket 代理 — 所有 /ws/* 路径统一转发
        // target 只取 origin，不拼路径（路径由请求自行携带）
        '/ws': {
          target: env.VITE_WS_URL ? new URL(env.VITE_WS_URL).origin : 'wss://localhost:8442',
          ws: true,
          changeOrigin: true,
          secure: false
        }
      }
    },
    preview: {
      host: '0.0.0.0',
      port: 3000,
      https: httpsConfig
    }
  }
})

