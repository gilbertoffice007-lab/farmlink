import { createContext, useContext, useState, ReactNode } from 'react'
import en from '../locales/en.json'
import ta from '../locales/ta.json'

const dicts: Record<string, Record<string, string>> = { en, ta }
type Lang = 'en' | 'ta'

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string }>({
  lang: 'en', setLang: () => {}, t: (k) => k
})

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('farmlink_lang') as Lang) || 'en')
  const set = (l: Lang) => { setLang(l); localStorage.setItem('farmlink_lang', l) }
  const t = (k: string) => dicts[lang][k] ?? (dicts.en as any)[k] ?? k
  return <Ctx.Provider value={{ lang, setLang: set, t }}>{children}</Ctx.Provider>
}

export const useLang = () => useContext(Ctx)
