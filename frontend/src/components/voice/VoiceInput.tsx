import { useEffect, useRef, useState } from 'react'
import { Check, Mic, MicOff, Square, X } from 'lucide-react'
import { useVoiceSettings } from '../../lib/voice-settings'
import { recognitionErrorMessage, recognitionSupported } from '../../lib/speech'

type RecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
  onend: (() => void) | null
}

export function VoiceInput({
  onConfirm,
  label = 'Speak',
  hint,
  confirmLabel = 'Use this text',
  className = '',
}: {
  onConfirm: (text: string) => void | Promise<void>
  label?: string
  hint?: string
  confirmLabel?: string
  className?: string
}) {
  const { voiceLanguage, voiceEnabled } = useVoiceSettings()
  const supported = recognitionSupported()
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const [typing, setTyping] = useState(!supported)
  const [busy, setBusy] = useState(false)
  const recRef = useRef<RecognitionLike | null>(null)
  const finalRef = useRef('')

  useEffect(() => () => {
    try { recRef.current?.abort() } catch { /* ignore */ }
  }, [])

  const stopListening = () => {
    try { recRef.current?.stop() } catch { /* ignore */ }
    setListening(false)
    setInterim('')
  }

  const startListening = () => {
    setError('')
    if (!voiceEnabled) {
      setError('Voice controls are turned off. Turn them on in Voice settings, or type your request below.')
      return
    }
    if (!supported) {
      setTyping(true)
      setError('Voice input is not supported in this browser. Please type below.')
      return
    }
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    try {
      const recognition: RecognitionLike = new Ctor()
      recognition.lang = voiceLanguage
      recognition.continuous = false
      recognition.interimResults = true
      recognition.maxAlternatives = 1
      finalRef.current = transcript
      recognition.onresult = (event: any) => {
        let finalText = ''
        let interimText = ''
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i]
          if (result.isFinal) finalText += result[0]?.transcript || ''
          else interimText += result[0]?.transcript || ''
        }
        if (finalText) {
          finalRef.current = `${finalRef.current} ${finalText}`.trim()
          setTranscript(finalRef.current)
        }
        setInterim(interimText)
      }
      recognition.onerror = (event: any) => {
        const message = recognitionErrorMessage(event?.error)
        if (message) setError(message)
      }
      recognition.onend = () => {
        setListening(false)
        setInterim('')
      }
      recRef.current = recognition
      recognition.start()
      setListening(true)
    } catch {
      setError('The browser could not start the microphone. Please type instead.')
      setTyping(true)
    }
  }

  const cancel = () => {
    stopListening()
    setTranscript('')
    setInterim('')
    setError('')
    setTyping(false)
  }

  const confirm = async () => {
    const text = transcript.trim()
    if (!text) return
    setBusy(true)
    try {
      await onConfirm(text)
    } finally {
      setBusy(false)
    }
  }

  const showEditor = typing || listening || transcript.length > 0 || Boolean(error)

  return (
    <div className={`rounded-2xl border border-line bg-white p-3 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        {!listening ? (
          <button
            type="button"
            onClick={startListening}
            disabled={!voiceEnabled}
            title={!voiceEnabled ? 'Voice controls are turned off in Voice settings.' : undefined}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold min-h-11 ${supported && voiceEnabled ? 'bg-farm text-white hover:bg-farm-dark' : 'bg-cream text-muted border border-line'} disabled:cursor-not-allowed`}
            aria-label={`${label} with the microphone`}
          >
            {supported && voiceEnabled ? <Mic size={17} /> : <MicOff size={17} />}
            {!voiceEnabled ? 'Voice is off' : supported ? label : 'Voice unavailable'}
          </button>
        ) : (
          <button
            type="button"
            onClick={stopListening}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white min-h-11"
          >
            <Square size={16} /> Stop listening
          </button>
        )}
        <button
          type="button"
          onClick={() => { setTyping((v) => !v); setError('') }}
          className="text-sm font-semibold text-farm underline-offset-2 hover:underline min-h-11 px-2"
        >
          {typing ? 'Hide typing' : 'Type instead'}
        </button>
        {listening && (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600" aria-live="assertive">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" /> Listening…
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-muted mt-1.5">{hint}</p>}
      {!voiceEnabled && (
        <p className="text-xs text-amber-800 mt-1.5">
          Voice controls are turned off. Turn them on in Voice settings, or type your request below.
        </p>
      )}
      {voiceEnabled && !supported && (
        <p className="text-xs text-amber-800 mt-1.5">
          Speech recognition needs a supported browser such as Chrome or Edge. You can still type every request.
        </p>
      )}
      {error && <p className="text-sm text-red-700 mt-2" role="alert">{error}</p>}
      {interim && <p className="text-sm text-muted italic mt-2" aria-live="polite">{interim}</p>}
      {showEditor && (
        <div className="mt-2.5">
          <label className="label" htmlFor={`voice-text-${label.replace(/\s+/g, '-')}`}>
            Recognised text — edit before using
          </label>
          <textarea
            id={`voice-text-${label.replace(/\s+/g, '-')}`}
            value={transcript}
            onChange={(e) => { setTranscript(e.target.value); finalRef.current = e.target.value }}
            rows={2}
            className="input"
            placeholder="Your spoken request appears here. You can correct it before continuing."
            readOnly={listening}
          />
          <div className="flex flex-wrap gap-2 mt-2">
            <button type="button" onClick={confirm} disabled={!transcript.trim() || busy}
              className="btn-primary !px-4 !py-2 text-sm min-h-11">
              <Check size={15} /> {busy ? 'Working…' : confirmLabel}
            </button>
            <button type="button" onClick={cancel} className="btn-secondary !px-4 !py-2 text-sm min-h-11">
              <X size={15} /> Cancel
            </button>
          </div>
          <p className="text-[11px] text-muted mt-1.5">
            Nothing is submitted just by speaking. Review the text, then confirm the action.
          </p>
        </div>
      )}
    </div>
  )
}
