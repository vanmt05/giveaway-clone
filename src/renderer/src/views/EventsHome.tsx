import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../state/eventStore'

export default function EventsHome(): React.JSX.Element {
  const { t } = useTranslation()
  const { list, refreshList, createEvent, openEvent, duplicateEvent, removeEvent } = useStore()
  const [title, setTitle] = useState('')

  useEffect(() => {
    void refreshList()
  }, [refreshList])

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <h1>{t('home.title')}</h1>
      <p className="muted">{t('home.subtitle')}</p>
      <form
        className="card row"
        onSubmit={(e) => {
          e.preventDefault()
          void createEvent(title)
        }}
      >
        <input
          className="input grow"
          type="text"
          placeholder={t('home.eventTitle')}
          aria-label={t('home.eventTitle')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button className="btn primary" type="submit">
          {t('home.create')}
        </button>
      </form>
      {list.length === 0 && <p className="muted">{t('home.empty')}</p>}
      {list.map((e) => (
        <div key={e.id} className="card row">
          <div className="grow">
            <strong>{e.title}</strong>
            <div className="muted">
              {new Date(e.createdAt).toLocaleString()} · {e.groups} {t('home.groups')} · {e.drawn} {t('home.drawn')}
            </div>
          </div>
          <button className="btn primary" onClick={() => void openEvent(e.id)}>
            {t('common.open')}
          </button>
          <button className="btn" onClick={() => void duplicateEvent(e.id)}>
            {t('common.duplicate')}
          </button>
          <button
            className="btn danger"
            onClick={() => {
              if (window.confirm(t('home.confirmDelete'))) void removeEvent(e.id)
            }}
          >
            {t('common.delete')}
          </button>
        </div>
      ))}
    </div>
  )
}
