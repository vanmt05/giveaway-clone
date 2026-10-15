import type { Api } from '../../preload'

declare global {
  interface Window {
    api: Api
  }
  const __APP_VERSION__: string
}
export {}
