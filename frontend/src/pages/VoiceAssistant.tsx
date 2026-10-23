import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  AlertTriangle, ArrowRight, CheckCircle2, Languages, ListChecks, Mic, Search, Settings2, ShoppingBasket,
  Truck, Volume2,
} from 'lucide-react'
import { api, apiError } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { useVoiceSettings, VOICE_LANGUAGES } from '../lib/voice-settings'
import { languageLooksSupported, recognitionSupported, speechSynthesisSupported, useSpeechState } from '../lib/speech'
import { parseListingDraft, parseSearchCommand, parseTrackingCommand } from '../lib/voice-parser'
import { VoiceInput } from '../components/voice/VoiceInput'
import { SpeakButton } from '../components/voice/SpeakButton'
import { ErrorBox, StatusBadge } from '../components/common/ui'

function fmt(value?: string) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

export default function VoiceAssistant() {
  const nav = useNavigate()
  const { user } = useAuth()
  const { voiceLanguage, voiceEnabled, setVoiceLanguage, setVoiceEnabled, voices, voicesLoading } = useVoiceSettings()
  const speechState = useSpeechState()
  const [draft, setDraft] = useState<ReturnType<typeof parseListingDraft> | null>(null)
  const [searchSummary, setSearchSummary] = useState<string | null>(null)
  const [trackingKind, setTrackingKind] = useState<'order' | 'shipment' | null>(null)

  const orders = useQuery({
    queryKey: ['orders'],
    queryFn: async () => (await api.get('/orders')).data,
    enabled: !!user,
  })
  const shipments = useQuery({
    queryKey: ['shipments-mine'],
    queryFn: async () => (await api.get('/transport/shipments/mine')).data,
    enabled: !!user,
  })

  const languageName = VOICE_LANGUAGES.find((l) => l.tag === voiceLanguage)?.label || voiceLanguage
  const matchingVoices = useMemo(() => voices.filter((v) => v.lang?.toLowerCase().startsWith(voiceLanguage.split('-')[0].toLowerCase())), [voices, voiceLanguage])
  const voiceInstalled = languageLooksSupported(voiceLanguage)
  const isSeller = user?.role === 'seller'

  const latestOrder = useMemo(() => {
    const list = Array.isArray(orders.data) ? orders.data : []
    if (!list.length) return null
    return [...list].sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0]
  }, [orders.data])

  const latestShipment = useMemo(() => {
    const list = Array.isArray(shipments.data) ? shipments.data : []
    if (!list.length) return null
    return list[0]
  }, [shipments.data])

  const trackingResult = trackingKind === 'order' ? latestOrder : trackingKind === 'shipment' ? latestShipment : null

  const handleSearch = (text: string) => {
    const command = parseSearchCommand(text)
    const hasStructuredFilter = Boolean(command.location) || command.nearMe || command.maxPrice != null
    const nextQ = command.q || (hasStructuredFilter ? '' : text)
    const params = new URLSearchParams()
    if (nextQ) params.set('q', nextQ)
    if (command.location) params.set('loc', command.location)
    if (command.maxPrice != null) params.set('max', String(command.maxPrice))
    if (command.nearMe) params.set('near', '1')
    setSearchSummary(
      `Searching${nextQ ? ` for ${nextQ}` : ''}${command.location ? ` in ${command.location}` : ''}${command.maxPrice != null ? ` under ${command.maxPrice} rupees` : ''}${command.nearMe ? ' near your location' : ''}.`,
    )
    nav(`/market?${params.toString()}`)
  }

  const handleDraft = (text: string) => {
    const parsed = parseListingDraft(text)
    setDraft(parsed)
    if (!parsed.name && parsed.quantity == null && parsed.price == null) {
      toast('I could not pick out enough details. Review the text and fill the listing form manually.')
    }
  }

  const handleTracking = (text: string) => {
    const command = parseTrackingCommand(text)
    if (command.kind === 'unknown') {
      toast('Please say “my latest order” or “my shared shipment”.')
      return
    }
    setTrackingKind(command.kind)
  }

  const draftSummary = draft
    ? [
        draft.name ? `Produce: ${draft.name}.` : '',
        draft.quantity != null ? `Quantity: ${draft.quantity} ${draft.unit || ''}.` : '',
        draft.price != null ? `Price: ${draft.price} rupees.` : '',
        draft.availableDate ? `Available: ${draft.availableDate}.` : '',
        draft.pickupLocation ? `Pickup: ${draft.pickupLocation}.` : '',
      ].filter(Boolean).join(' ')
    : ''

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      <section className="rounded-3xl bg-gradient-to-br from-forest to-pine text-white p-6 sm:p-8">
        <span className="badge bg-lime/20 text-lime border border-lime/30"><Mic size={13} /> FarmLink Voice Assistant</span>
        <h1 className="font-display font-black text-3xl sm:text-4xl mt-3">Speak, review, then act.</h1>
        <p className="text-white/75 text-sm mt-2 max-w-2xl">
          Use your browser's speech tools to search, start a listing, or hear your order and shipment updates.
          Nothing is submitted just by speaking — you review the recognised text and confirm every action.
        </p>
        <div className="flex flex-wrap gap-3 mt-4 text-xs text-white/65">
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={13} /> No audio stored by FarmLink</span>
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={13} /> Microphone never starts automatically</span>
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={13} /> Works with typing fallback</span>
        </div>
      </section>

      <div className="grid lg:grid-cols-[1.15fr_.85fr] gap-5 mt-5">
        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="font-display font-bold text-xl flex items-center gap-2"><Search size={19} className="text-farm" /> Voice product search</h2>
            <p className="text-sm text-muted mt-1">Example: “Show tomatoes in Erode under 40 rupees” or “Find rice near me”.</p>
            <VoiceInput className="mt-3" label="Speak product search" confirmLabel="Search products"
              hint="Recognised words are editable. Search does not change any data."
              onConfirm={handleSearch} />
            {searchSummary && <p className="text-sm text-farm font-semibold mt-2" aria-live="polite">{searchSummary}</p>}
          </section>

          {isSeller && (
            <section className="card p-5">
              <h2 className="font-display font-bold text-xl flex items-center gap-2"><ListChecks size={19} className="text-farm" /> Start a product listing</h2>
              <p className="text-sm text-muted mt-1">Example: “I have 100 kilograms of tomatoes available tomorrow for 30 rupees per kg, pickup from Erode.”</p>
              <VoiceInput className="mt-3" label="Speak listing details" confirmLabel="Extract listing details"
                hint="Only values you actually say are extracted. You still review and publish the listing yourself."
                onConfirm={handleDraft} />
              {draft && (
                <div className="rounded-xl border border-line bg-cream/60 p-3 mt-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-sm">Extracted details</div>
                    <SpeakButton text={draftSummary || 'No details could be extracted.'} label="Read details" compact />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mt-2">
                    {[['Produce', draft.name], ['Quantity', draft.quantity != null ? `${draft.quantity} ${draft.unit || ''}` : undefined],
                      ['Price', draft.price != null ? `₹${draft.price}` : undefined], ['Available date', draft.availableDate],
                      ['Pickup', draft.pickupLocation]].map(([label, value]) => (
                      <div key={label as string}><dt className="text-muted inline">{label}: </dt><dd className="inline font-semibold">{value || 'Not heard — add it in the form'}</dd></div>
                    ))}
                  </dl>
                  <p className="text-[11px] text-muted mt-2">Missing values are intentionally left blank. FarmLink will not invent a price, quantity or date.</p>
                  <button className="btn-primary !py-2.5 text-sm mt-3"
                    onClick={() => nav('/seller/products/new', { state: { voiceDraft: draft } })}>
                    Review in listing form <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </section>
          )}

          <section className="card p-5">
            <h2 className="font-display font-bold text-xl flex items-center gap-2"><Truck size={19} className="text-farm" /> Hear an order or shipment update</h2>
            <p className="text-sm text-muted mt-1">Say “What is my latest order status?” or “Tell me my latest shared shipment”.</p>
            <VoiceInput className="mt-3" label="Ask for status" confirmLabel="Look up status"
              hint="Read-only: asking for a status does not change anything."
              onConfirm={handleTracking} />
            {(orders.isError || shipments.isError) && <div className="mt-3"><ErrorBox message={apiError(orders.error || shipments.error)} /></div>}
            {trackingKind && (
              <div className="rounded-xl border border-line bg-cream/60 p-3 mt-3" aria-live="polite">
                {trackingKind === 'order' && !latestOrder && (
                  <p className="text-sm">No orders were found for your account. <Link to="/market" className="text-farm font-semibold">Browse produce</Link></p>
                )}
                {trackingKind === 'shipment' && !latestShipment && (
                  <p className="text-sm">No shared shipments were found. <Link to="/transport" className="text-farm font-semibold">Find a shared load</Link></p>
                )}
                {trackingKind === 'order' && latestOrder && (
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <b>{latestOrder.order_number}</b><StatusBadge status={latestOrder.status} />
                      <span className="ml-auto font-bold">₹{Number(latestOrder.total_amount).toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-muted mt-1">Estimated {latestOrder.fulfillment_type === 'pickup' ? 'pickup' : 'delivery'}: {fmt(latestOrder.estimated_delivery)}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Link to={`/orders/${latestOrder.id}`} className="btn-secondary !px-3 !py-2 text-sm">Open order</Link>
                      <SpeakButton compact text={`Order ${latestOrder.order_number}. Status ${latestOrder.status}. Total ${latestOrder.total_amount} rupees. Estimated ${latestOrder.fulfillment_type === 'pickup' ? 'pickup' : 'delivery'} ${fmt(latestOrder.estimated_delivery)}.`} />
                    </div>
                  </div>
                )}
                {trackingKind === 'shipment' && latestShipment && (
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <b>{latestShipment.title}</b><StatusBadge status={latestShipment.status} />
                    </div>
                    <p className="text-xs text-muted mt-1">{latestShipment.pickup_area} → {latestShipment.delivery_area} · {latestShipment.remaining_capacity} {latestShipment.capacity_unit} left</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Link to={`/transport/${latestShipment.id}`} className="btn-secondary !px-3 !py-2 text-sm">Open shipment</Link>
                      <SpeakButton compact text={`Shared shipment ${latestShipment.title}. Status ${latestShipment.status.replace(/_/g, ' ')}. From ${latestShipment.pickup_area} to ${latestShipment.delivery_area}. ${latestShipment.remaining_capacity} ${latestShipment.capacity_unit} capacity remaining.`} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="card p-5">
            <h2 className="font-display font-bold text-xl flex items-center gap-2"><ShoppingBasket size={19} className="text-farm" /> More places to use voice</h2>
            <div className="grid sm:grid-cols-2 gap-2 mt-3 text-sm">
              <Link to="/market" className="rounded-xl border border-line p-3 hover:border-farm">Marketplace search <span className="text-muted">— speak a product or near-me request</span></Link>
              <Link to="/rescue" className="rounded-xl border border-line p-3 hover:border-farm">Harvest Rescue <span className="text-muted">— hear listing details and deadlines</span></Link>
              <Link to="/orders" className="rounded-xl border border-line p-3 hover:border-farm">Orders <span className="text-muted">— listen to live status</span></Link>
              <Link to="/notifications" className="rounded-xl border border-line p-3 hover:border-farm">Notifications <span className="text-muted">— have updates read aloud</span></Link>
            </div>
            <p className="text-xs text-muted mt-3">
              Product pages, order tracking, notifications, rescue listings and shipment pages also include listen buttons.
              Error messages include a read-aloud control where speech output is supported.
            </p>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="card p-5">
            <h2 className="font-display font-bold text-xl flex items-center gap-2"><Settings2 size={18} className="text-farm" /> Voice settings</h2>
            <div className="mt-3">
              <label className="label" htmlFor="voice-language"><Languages size={14} className="inline mr-1" /> Language and accent</label>
              <select id="voice-language" className="input" value={voiceLanguage}
                onChange={(e) => { setVoiceLanguage(e.target.value); toast.success('Voice language saved to your profile') }}>
                {VOICE_LANGUAGES.map((l) => <option key={l.tag} value={l.tag}>{l.label}</option>)}
              </select>
            </div>
            <label className="flex items-start gap-2.5 text-sm font-semibold mt-3 rounded-xl bg-cream/60 p-3">
              <input type="checkbox" checked={voiceEnabled} onChange={(e) => { setVoiceEnabled(e.target.checked); toast.success('Voice preference saved') }} className="accent-[#28784A] w-4 h-4 mt-0.5" />
              <span>Enable read-aloud and voice input controls
                <span className="block text-xs font-normal text-muted">Turning this off disables listen and microphone buttons.</span>
              </span>
            </label>
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex items-center gap-1.5">
                {speechSynthesisSupported() ? <CheckCircle2 size={13} className="text-green-700" /> : <AlertTriangle size={13} className="text-amber-700" />}
                Read-aloud {speechSynthesisSupported() ? 'supported by this browser' : 'is not supported — all information remains on screen'}.
              </div>
              <div className="flex items-center gap-1.5">
                {recognitionSupported() ? <CheckCircle2 size={13} className="text-green-700" /> : <AlertTriangle size={13} className="text-amber-700" />}
                Speech input {recognitionSupported() ? 'supported by this browser' : 'is not supported — use the typing fallback'}.
              </div>
              <div className="flex items-center gap-1.5">
                {voicesLoading ? <span className="w-3 h-3 rounded-full border-2 border-line border-t-farm animate-spin" /> : voiceInstalled ? <CheckCircle2 size={13} className="text-green-700" /> : <AlertTriangle size={13} className="text-amber-700" />}
                {voicesLoading ? 'Checking installed voices…' : voiceInstalled ? `${matchingVoices.length} voice${matchingVoices.length === 1 ? '' : 's'} found for ${languageName}` : `No installed ${languageName} voice found`}
              </div>
            </div>
            <div className="mt-3">
              <SpeakButton text={`Voice settings. Language ${languageName}. Read aloud is ${voiceEnabled ? 'on' : 'off'}. This is a test of your browser's speech output.`} label="Test this voice" />
            </div>
            {speechState.status !== 'idle' && <p className="text-xs text-muted mt-2">Playback controls are attached to the test button while it reads.</p>}
            {!voiceInstalled && !voicesLoading && (
              <p className="text-xs text-amber-800 mt-2">
                Your browser may fall back to another installed voice. Install a system voice for {languageName} for better pronunciation.
              </p>
            )}
          </section>

          <section className="card p-5">
            <h2 className="font-display font-bold text-lg flex items-center gap-2"><Volume2 size={17} className="text-farm" /> What to expect</h2>
            <ul className="text-xs text-muted mt-2 space-y-2 list-disc list-inside">
              <li>Speech recognition availability varies by browser. Chrome and Edge generally provide it; typing always works.</li>
              <li>Recognition accuracy varies with language, accent, background noise and microphone quality. Always review the text.</li>
              <li>This implementation does not auto-start the microphone, read passwords, or store audio.</li>
              <li>Your browser's speech service may process audio under its own provider policy; FarmLink receives only the transcribed text you confirm.</li>
            </ul>
          </section>

          <section className="card p-5 border-amber-200 bg-amber-50/60">
            <h2 className="font-bold text-sm flex items-center gap-2 text-amber-900"><AlertTriangle size={16} /> Safety and privacy</h2>
            <p className="text-xs text-amber-900/80 mt-2">
              Use voice in a quiet place and avoid reading sensitive information aloud. For payments, prices and public listings,
              check the on-screen values before confirming. Voice never bypasses the normal confirmation steps.
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}
