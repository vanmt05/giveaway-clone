import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function FullscreenButton({ className = 'btn small' }: { className?: string }): React.JSX.Element {
  const { t } = useTranslation()
  const [on, setOn] = useState(false)

  useEffect(() => {
    void window.api.isFullscreen().then(setOn)
    return window.api.onFullscreen(setOn)
  }, [])

  const label = on ? t('common.exitFullscreen') : t('common.fullscreen')
  return (
    <button className={className} onClick={() => void window.api.toggleFullscreen()} title={`${label} (F11)`} aria-label={label} aria-pressed={on}>
      {on ? '🗗' : '⛶'} {label}
    </button>
  )
}
