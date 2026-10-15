import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from './state/eventStore'
import { currentLang, setLang } from './i18n'
import EventsHome from './views/EventsHome'
import EventEditor from './views/EventEditor'
import ReviewStep from './steps/ReviewStep'
import AnimationStep from './steps/AnimationStep'
import ResultStep from './steps/ResultStep'
import SummaryView from './views/SummaryView'
import VerifyView from './views/VerifyView'
import PresentView from './views/PresentView'
import FullscreenButton from './components/FullscreenButton'

function Shell(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const view = useStore((s) => s.view)
  const event = useStore((s) => s.event)
  const closeEvent = useStore((s) => s.closeEvent)

  // keep the document language in sync for accessibility
  useEffect(() => {
    document.documentElement.lang = currentLang()
  }, [i18n.language])

  return (
    <div className="app">
      <div className="topbar">
        <span className="logo">Sorteos</span>
        {event && <strong>{event.title}</strong>}
        <span className="spacer" />
        {event && view.name !== 'home' && (
          <button className="btn small" onClick={closeEvent}>
            ⌂ {t('common.back')}
          </button>
        )}
        <FullscreenButton />
        <select
          className="input"
          style={{ width: 90 }}
          aria-label={t('common.language')}
          value={currentLang()}
          onChange={(e) => setLang(e.target.value as 'es' | 'en')}
        >
          <option value="es">ES</option>
          <option value="en">EN</option>
        </select>
      </div>
      <div className="content">
        {view.name === 'home' && <EventsHome />}
        {view.name === 'event' && <EventEditor />}
        {view.name === 'review' && <ReviewStep groupId={view.groupId} />}
        {view.name === 'animate' && <AnimationStep groupId={view.groupId} />}
        {view.name === 'result' && <ResultStep groupId={view.groupId} />}
        {view.name === 'summary' && <SummaryView />}
        {view.name === 'verify' && <VerifyView />}
      </div>
    </div>
  )
}

export default function App(): React.JSX.Element {
  return window.location.hash === '#present' ? <PresentView /> : <Shell />
}
