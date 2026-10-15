import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import confetti from 'canvas-confetti'
import { useStore } from '../state/eventStore'
import Countdown from '../animations/Countdown'
import NameSpinner from '../animations/NameSpinner'
import Wheel from '../animations/Wheel'
import { fanfare } from '../lib/audio'

export function fireConfetti(): void {
  const end = Date.now() + 1800
  const frame = (): void => {
    void confetti({ particleCount: 5, angle: 60, spread: 70, origin: { x: 0 } })
    void confetti({ particleCount: 5, angle: 120, spread: 70, origin: { x: 1 } })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}

export default function AnimationStep({ groupId }: { groupId: string }): React.JSX.Element | null {
  const { t } = useTranslation()
  const { event, go } = useStore()
  const [sound, setSound] = useState(true)
  const group = event?.groups.find((g) => g.id === groupId)
  const result = group?.result

  // reveal: confetti + fanfare once the animation reports done, then continue automatically
  const [finished, setFinished] = useState(false)
  useEffect(() => {
    if (!finished) return
    fireConfetti()
    if (sound) fanfare()
    const id = setTimeout(() => go({ name: 'result', groupId }), 2600)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished])

  if (!event || !group || !result) return null
  const common = {
    winners: result.winners,
    candidates: group.entries.map((e) => ({ name: e.name, subgroup: e.subgroup })),
    durationSec: result.settingsUsed.durationSec,
    sound,
    brandColor: event.branding.color,
    onDone: () => setFinished(true)
  }
  const kind = result.settingsUsed.animation

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <label className="check">
          <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />
          {t('settings.sound')}
        </label>
        <button className="btn" onClick={() => go({ name: 'result', groupId })}>
          {t('animate.skip')}
        </button>
      </div>
      <div style={{ flex: 1 }}>
        {finished ? (
          <div className="stage">
            <h1 style={{ color: event.branding.color }}>🎉 {group.name}</h1>
          </div>
        ) : kind === 'spinner' ? (
          <NameSpinner {...common} />
        ) : kind === 'wheel' ? (
          <Wheel {...common} />
        ) : (
          <Countdown {...common} />
        )}
      </div>
    </div>
  )
}
