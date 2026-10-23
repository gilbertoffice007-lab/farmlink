import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { useAuth } from './auth-context'
import { useLang } from './i18n'
import { getVoices, recognitionSupported, speechSynthesisSupported, voicesForLanguage } from './speech'

export const VOICE_LANGUAGES = [
  { tag: 'en-IN', label: 'English (India)' },
  { tag: 'ta-IN', label: 'தமிழ் — Tamil' },
  { tag: 'hi-IN', label: 'हिन्दी — Hindi' },
  { tag: 'te-IN', label: 'తెలుగు — Telugu' },
  { tag: 'kn-IN', label: 'ಕನ್ನಡ — Kannada' },
  { tag: 'ml-IN', label: 'മലയാളം — Malayalam' },
  { tag: 'mr-IN', label: 'मराठी — Marathi' },
  { tag: 'bn-IN', label: 'বাংলা — Bengali' },
  { tag: 'gu-IN', label: 'ગુજરાતી — Gujarati' },
  { tag: 'pa-IN', label: 'ਪੰਜਾਬੀ — Punjabi' },
] as const

const STORAGE_LANGUAGE = 'farmlink_voice_lang'
const STORAGE_ENABLED = 'farmlink_voice_enabled'

interface VoiceSettingsState {
  voiceLanguage: string
  voiceEnabled: boolean
  setVoiceLanguage: (language: string) => Promise<void>
  setVoiceEnabled: (enabled: boolean) => Promise<void>
  speechAvailable: boolean
  recognitionAvailable: boolean
  languageSupported: boolean
  voices: SpeechSynthesisVoice[]
  voicesLoading: boolean
}

const Ctx = createContext<VoiceSettingsState>({
  voiceLanguage: 'en-IN',
  voiceEnabled: true,
  setVoiceLanguage: async () => {},
  setVoiceEnabled: async () => {},
  speechAvailable: false,
  recognitionAvailable: false,
  languageSupported: false,
  voices: [],
  voicesLoading: true,
})

export function VoiceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { lang } = useLang()
  const [voiceLanguage, setLanguageState] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_LANGUAGE)
    if (saved) return saved
    return lang === 'ta' ? 'ta-IN' : 'en-IN'
  })
  const [voiceEnabled, setEnabledState] = useState<boolean>(() => localStorage.getItem(STORAGE_ENABLED) !== '0')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => getVoices())
  const [voicesLoading, setVoicesLoading] = useState<boolean>(() => getVoices().length === 0)

  useEffect(() => {
    if (!speechSynthesisSupported()) { setVoicesLoading(false); return }
    const refresh = () => {
      setVoices(getVoices())
      setVoicesLoading(false)
    }
    refresh()
    window.speechSynthesis.addEventListener?.('voiceschanged', refresh)
    const timer = window.setTimeout(refresh, 600)
    return () => {
      window.clearTimeout(timer)
      window.speechSynthesis.removeEventListener?.('voiceschanged', refresh)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    const storedLanguage = localStorage.getItem(STORAGE_LANGUAGE)
    const profileLanguage = (user as any).voice_language as string | undefined
    if (!storedLanguage && profileLanguage) setLanguageState(profileLanguage)
    const storedEnabled = localStorage.getItem(STORAGE_ENABLED)
    const profileEnabled = (user as any).voice_enabled as boolean | undefined
    if (storedEnabled === null && typeof profileEnabled === 'boolean') setEnabledState(profileEnabled)
  }, [user?.id])

  const persist = async (language: string, enabled: boolean) => {
    localStorage.setItem(STORAGE_LANGUAGE, language)
    localStorage.setItem(STORAGE_ENABLED, enabled ? '1' : '0')
    if (user) {
      try {
        await api.patch('/auth/settings/voice', { voice_language: language, voice_enabled: enabled })
      } catch {
        // Keep the local preference; the server can be retried from settings.
      }
    }
  }

  const setVoiceLanguage = async (language: string) => {
    setLanguageState(language)
    await persist(language, voiceEnabled)
  }

  const setVoiceEnabled = async (enabled: boolean) => {
    setEnabledState(enabled)
    await persist(voiceLanguage, enabled)
  }

  const languageSupported = useMemo(
    () => voicesForLanguage(voiceLanguage).length > 0,
    [voiceLanguage, voices],
  )

  return (
    <Ctx.Provider value={{
      voiceLanguage,
      voiceEnabled,
      setVoiceLanguage,
      setVoiceEnabled,
      speechAvailable: speechSynthesisSupported(),
      recognitionAvailable: recognitionSupported(),
      languageSupported,
      voices,
      voicesLoading,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useVoiceSettings = () => useContext(Ctx)
