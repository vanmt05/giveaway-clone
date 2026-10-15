import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { countdownBeep } from '../lib/audio'
import type { AnimProps } from './types'

export default function Countdown({ durationSec, sound, brandColor, onDone }: AnimProps): React.JSX.Element {
  const { t } = useTranslation()
  const [n, setN] = useState(durationSec)

  useEffect(() => {
    let left = durationSec
    setN(left)
    if (sound) countdownBeep()
    const id = setInterval(() => {
      left -= 1
      setN(left)
      if (left <= 0) {
        clearInterval(id)
        onDone()
      } else if (sound) countdownBeep()
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="stage" aria-live="polite">
      <div className="ring" style={{ borderColor: brandColor, color: brandColor }}>
        {Math.max(n, 0)}
      </div>
      <div className="sub">{t('animate.drawing')}</div>
    </div>
  )
}
