/** Deterministic, conservative parsers for spoken FarmLink commands.
 * They only extract values that are explicitly present; missing values stay
 * undefined so the user is asked to fill them in. */

export interface ListingDraft {
  name?: string
  quantity?: number
  unit?: string
  availableDate?: string
  price?: number
  pickupLocation?: string
}

export interface SearchCommand {
  q?: string
  location?: string
  maxPrice?: number
  nearMe: boolean
}

export interface TrackingCommand {
  kind: 'order' | 'shipment' | 'unknown'
  latest: boolean
  reference?: string
}

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  hundred: 100,
}

const UNIT_ALIASES: Array<[RegExp, string]> = [
  [/^(kilograms?|kgs?|kilo|kilos?)$/i, 'kg'],
  [/^(grams?|gms?|g)$/i, 'g'],
  [/^(quintals?)$/i, 'quintal'],
  [/^(tons?|tonnes?)$/i, 'ton'],
  [/^(dozens?)$/i, 'dozen'],
  [/^(pieces?|pcs?)$/i, 'piece'],
  [/^(litres?|liters?|l)$/i, 'litre'],
  [/^(bags?|sacks?)$/i, 'bag'],
]

function unitFor(raw: string): string | undefined {
  for (const [pattern, unit] of UNIT_ALIASES) {
    if (pattern.test(raw)) return unit
  }
  return undefined
}

function numberFrom(raw: string): number | undefined {
  const digits = Number(raw)
  if (Number.isFinite(digits)) return digits
  const word = WORD_NUMBERS[raw.toLowerCase()]
  return word
}

export function parseQuantity(text: string): { quantity?: number; unit?: string } {
  const unitPattern = '(kilograms?|kgs?|kilos?|grams?|gms?|g|quintals?|tons?|tonnes?|dozens?|pieces?|pcs?|litres?|liters?|bags?|sacks?)'
  const digit = text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unitPattern}\\b`, 'i'))
  if (digit) return { quantity: Number(digit[1]), unit: unitFor(digit[2]) }
  const word = text.match(new RegExp(`\\b(a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\\s+${unitPattern}\\b`, 'i'))
  if (word) {
    const n = numberFrom(word[1])
    return n === undefined ? {} : { quantity: n, unit: unitFor(word[2]) }
  }
  return {}
}

function toIsoDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDate(text: string, now = new Date()): string | undefined {
  const explicit = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  if (explicit) return explicit[1]
  const lower = text.toLowerCase()
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (/\bday after tomorrow\b/.test(lower)) {
    base.setDate(base.getDate() + 2)
    return toIsoDate(base)
  }
  if (/\btomorrow\b/.test(lower)) {
    base.setDate(base.getDate() + 1)
    return toIsoDate(base)
  }
  if (/\btoday\b/.test(lower)) return toIsoDate(base)
  const inDays = lower.match(/\bin\s+(\d+|one|two|three|four|five|six|seven)\s+days?\b/)
  if (inDays) {
    const n = numberFrom(inDays[1])
    if (n !== undefined) {
      base.setDate(base.getDate() + n)
      return toIsoDate(base)
    }
  }
  return undefined
}

export function parsePrice(text: string): number | undefined {
  const patterns = [
    /(?:₹|rs\.?|rupees?)\s*(\d+(?:\.\d+)?)/i,
    /(?:at|for|asking|price(?:\s+of)?)\s+(?:₹|rs\.?)?\s*(\d+(?:\.\d+)?)\s*(?:rupees?|rs\.?|per\s+\w+)?/i,
    /(\d+(?:\.\d+)?)\s*(?:rupees?|rs\.?)\b/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const value = Number(match[1])
      if (Number.isFinite(value) && value > 0) return value
    }
  }
  return undefined
}

function cleanName(raw?: string): string | undefined {
  if (!raw) return undefined
  const cleaned = raw
    .replace(/\b(available|ready|for sale|please|some|fresh|the|a|an)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[,.!?]+$/, '')
  if (cleaned.length < 2) return undefined
  return cleaned
}

export function parseProductName(text: string): string | undefined {
  const patterns = [
    /\bof\s+([a-zA-Z][a-zA-Z\s]+?)(?=\s+(?:available|ready|for|at|from|in|tomorrow|today|next|this|₹|rs\.?)\b|[,.]|$)/i,
    /\b(?:have|harvested|selling|listing|list|add)\s+(?:\d+(?:\.\d+)?\s*\w+\s*)?(?:of\s+)?([a-zA-Z][a-zA-Z\s]+?)(?=\s+(?:available|for|at|from|in|tomorrow|today)\b|[,.]|$)/i,
    /^(?:show|find|search|look for|get)\s+(?:me\s+)?(?:for\s+)?(?:some\s+)?([a-zA-Z][a-zA-Z\s]+?)(?=\s+(?:near|around|in|under|below|available|with|at|for)\b|[,.]|$)/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    const name = cleanName(match?.[1])
    if (name) return name
  }
  return undefined
}

export function parsePickupLocation(text: string): string | undefined {
  const match = text.match(/\b(?:pickup|pick up)\s+(?:from|at|in)\s+([a-zA-Z][a-zA-Z .]+?)(?=\s+(?:tomorrow|today|at|for|by|before|available)\b|[,.]|$)/i)
  return cleanName(match?.[1])
}

export function parseListingDraft(text: string): ListingDraft {
  const { quantity, unit } = parseQuantity(text)
  return {
    name: parseProductName(text),
    quantity,
    unit,
    availableDate: parseDate(text),
    price: parsePrice(text),
    pickupLocation: parsePickupLocation(text),
  }
}

export function parseSearchCommand(text: string): SearchCommand {
  const lower = text.toLowerCase()
  const nearMe = /\bnear\s+me\b|\bnearby\b|\baround\s+me\b/.test(lower)
  let location: string | undefined
  if (!nearMe) {
    const loc = text.match(/\b(?:in|near|around)\s+([a-zA-Z][a-zA-Z .]+?)(?=\s+(?:under|below|available|with|for|less)\b|[,.]|$)/i)
    location = cleanName(loc?.[1])
  }
  const budget = text.match(/\b(?:under|below|less than|within|budget of)\s*(?:₹|rs\.?)?\s*(\d+(?:\.\d+)?)/i)
  return {
    q: parseProductName(text),
    location,
    maxPrice: budget ? Number(budget[1]) : undefined,
    nearMe,
  }
}

export function parseTrackingCommand(text: string): TrackingCommand {
  const lower = text.toLowerCase()
  const latest = /\b(latest|last|recent|newest|current)\b/.test(lower)
  const reference = text.match(/\bFL\d{6,}[A-Z0-9]*\b/i)?.[0]
  if (/\b(shipment|transport|delivery run|truck)\b/.test(lower)) {
    return { kind: 'shipment', latest, reference }
  }
  if (/\b(order|purchase|delivery)\b/.test(lower)) {
    return { kind: 'order', latest, reference }
  }
  return { kind: 'unknown', latest, reference }
}
