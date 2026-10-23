import { useEffect, useState } from 'react'

export type SpeechStatus = 'idle' | 'speaking' | 'paused'
export interface SpeechState {
  id: string | null
  status: SpeechStatus
}

let state: SpeechState = { id: null, status: 'idle' }
const listeners = new Set<(next: SpeechState) => void>()

function setState(next: SpeechState) {
  state = next
  listeners.forEach((listener) => listener(state))
}

function subscribe(listener: (next: SpeechState) => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useSpeechState(): SpeechState {
  const [current, setCurrent] = useState(state)
  useEffect(() => subscribe(setCurrent), [])
  return current
}

export function speechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

export function recognitionSupported(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
}

export function getVoices(): SpeechSynthesisVoice[] {
  if (!speechSynthesisSupported()) return []
  try {
    return window.speechSynthesis.getVoices()
  } catch {
    return []
  }
}

export function voicesForLanguage(language: string): SpeechSynthesisVoice[] {
  const base = language.split('-')[0].toLowerCase()
  return getVoices().filter((voice) => voice.lang?.toLowerCase().startsWith(base))
}

export function languageLooksSupported(language: string): boolean {
  return voicesForLanguage(language).length > 0
}

function pickVoice(language: string): SpeechSynthesisVoice | null {
  const voices = getVoices()
  if (!voices.length) return null
  const exact = voices.find((voice) => voice.lang?.toLowerCase() === language.toLowerCase())
  if (exact) return exact
  const base = language.split('-')[0].toLowerCase()
  return voices.find((voice) => voice.lang?.toLowerCase().startsWith(base)) || null
}

export function speakText(id: string, text: string, language: string): { ok: boolean; reason?: string } {
  if (!speechSynthesisSupported()) return { ok: false, reason: 'Speech output is not supported in this browser.' }
  const clean = (text || '').trim()
  if (!clean) return { ok: false, reason: 'There is no text to read.' }
  try {
    stopSpeech()
    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.lang = language
    const voice = pickVoice(language)
    if (voice) utterance.voice = voice
    utterance.rate = 0.98
    utterance.pitch = 1
    utterance.onstart = () => setState({ id, status: 'speaking' })
    utterance.onend = () => {
      if (state.id === id) setState({ id: null, status: 'idle' })
    }
    utterance.onerror = () => {
      if (state.id === id) setState({ id: null, status: 'idle' })
    }
    setState({ id, status: 'speaking' })
    window.speechSynthesis.speak(utterance)
    return { ok: true }
  } catch {
    setState({ id: null, status: 'idle' })
    return { ok: false, reason: 'The browser could not start speech output.' }
  }
}

export function pauseSpeech() {
  if (!speechSynthesisSupported()) return
  try {
    window.speechSynthesis.pause()
    if (state.id) setState({ id: state.id, status: 'paused' })
  } catch {
    /* ignore */
  }
}

export function resumeSpeech() {
  if (!speechSynthesisSupported()) return
  try {
    window.speechSynthesis.resume()
    if (state.id) setState({ id: state.id, status: 'speaking' })
  } catch {
    /* ignore */
  }
}

export function stopSpeech(id?: string) {
  if (!speechSynthesisSupported()) return
  if (id && state.id && state.id !== id) return
  try {
    window.speechSynthesis.cancel()
  } catch {
    /* ignore */
  }
  setState({ id: null, status: 'idle' })
}

export function stopAllSpeech() {
  stopSpeech()
}

/* Minimal SpeechRecognition typings for browsers that expose it. */
export interface RecognitionErrorLike {
  error?: string
}

export function recognitionErrorMessage(code?: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone permission was denied. Allow microphone access in the browser settings, or type your request below.'
    case 'no-speech':
      return 'No speech was detected. Try again or type your request below.'
    case 'audio-capture':
      return 'No microphone was found. Check your device or type your request below.'
    case 'network':
      return 'Speech recognition needs a network connection that is currently unavailable. Please type instead.'
    case 'aborted':
      return ''
    case 'language-not-supported':
      return 'This browser does not support speech recognition for the selected language. Please type instead or choose another language.'
    default:
      return 'Speech recognition stopped unexpectedly. Please try again or type your request below.'
  }
}
