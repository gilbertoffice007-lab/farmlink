import { useEffect, useId } from 'react'
import { Pause, Play, Square, Volume2, VolumeX } from 'lucide-react'
import { useVoiceSettings } from '../../lib/voice-settings'
import {
  pauseSpeech, resumeSpeech, speakText, speechSynthesisSupported, stopSpeech, useSpeechState,
} from '../../lib/speech'

export function SpeakButton({
  text,
  label = 'Listen',
  compact = false,
  className = '',
}: {
  text: string
  label?: string
  compact?: boolean
  className?: string
}) {
  const id = useId()
  const { voiceLanguage, voiceEnabled } = useVoiceSettings()
  const state = useSpeechState()
  const supported = speechSynthesisSupported()
  const active = state.id === id

  useEffect(() => () => stopSpeech(id), [id])

  if (!supported) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs text-muted ${className}`} title="Text-to-speech is not supported in this browser. The text is available on screen.">
        <VolumeX size={15} aria-hidden="true" /> Speech unavailable — read the text on screen
      </span>
    )
  }

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => speakText(id, text, voiceLanguage)}
        disabled={!voiceEnabled || !text.trim()}
        className={`inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold hover:border-farm disabled:opacity-50 ${compact ? 'min-h-9' : 'min-h-11'} ${className}`}
        aria-label={`${label}: read this information aloud`}
        title={!voiceEnabled ? 'Voice output is turned off in Voice settings.' : `${label} in ${voiceLanguage}`}
      >
        <Volume2 size={16} aria-hidden="true" /> {label}
      </button>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} role="group" aria-label="Speech playback controls">
      <span className="text-xs font-semibold text-farm inline-flex items-center gap-1" aria-live="polite">
        <Volume2 size={14} className="animate-pulse" aria-hidden="true" />
        {state.status === 'paused' ? 'Paused' : 'Reading…'}
      </span>
      <button
        type="button"
        onClick={() => (state.status === 'paused' ? resumeSpeech() : pauseSpeech())}
        className="p-2.5 rounded-xl border border-line bg-white hover:border-farm"
        aria-label={state.status === 'paused' ? 'Resume reading' : 'Pause reading'}
      >
        {state.status === 'paused' ? <Play size={16} /> : <Pause size={16} />}
      </button>
      <button
        type="button"
        onClick={() => stopSpeech(id)}
        className="p-2.5 rounded-xl border border-line bg-white hover:border-farm text-red-600"
        aria-label="Stop reading"
      >
        <Square size={16} />
      </button>
    </span>
  )
}
