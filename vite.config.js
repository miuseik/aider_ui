import { defineConfig } from 'vite'
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

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    https: httpsConfig,
    open: true,
    proxy: {
      '/api': {
        target: `https://${getLocalIP()}:8443`,
        changeOrigin: true,
        secure: false
      },
      '/ws': {
        target: `wss://${getLocalIP()}:8442`,
        ws: true,
        secure: false
      }
    }
  }
})
