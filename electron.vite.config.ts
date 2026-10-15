import { readFileSync } from 'fs'
import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'))

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: { alias: { '@renderer': resolve('src/renderer/src') } },
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    plugins: [react()]
  }
})
