import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import es from './es.json'
import en from './en.json'

export type Lang = 'es' | 'en'

function initialLang(): Lang {
  try {
    const v = localStorage.getItem('lang')
    if (v === 'en' || v === 'es') return v
  } catch {
    /* storage unavailable */
  }
  return 'es'
}

void i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: initialLang(),
  fallbackLng: 'es',
  interpolation: { escapeValue: false }
})

export function setLang(l: Lang): void {
  void i18n.changeLanguage(l)
  try {
    localStorage.setItem('lang', l)
  } catch {
    /* ignore */
  }
}

export const currentLang = (): Lang => (i18n.language === 'en' ? 'en' : 'es')

export default i18n
