const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const ICUK_BASE_URL = Deno.env.get('ICUK_BASE_URL') || 'https://api.interdns.co.uk'
const ICUK_API_USER = Deno.env.get('ICUK_API_USER') || ''
const ICUK_API_KEY = Deno.env.get('ICUK_API_KEY') || ''
const ICUK_API_PLATFORM = Deno.env.get('ICUK_API_PLATFORM') || 'LIVE'

// OCCTA retail card IDs and their technology + speed requirements
const OCCTA_PLAN_MAP = [
  { id: 'essential', techs: ['SOGEA', 'FTTP'], maxDown: 80 },
  { id: 'superfast', techs: ['FTTP'], minDown: 160, maxDown: 330 },
  { id: 'ultrafast', techs: ['FTTP'], minDown: 500, maxDown: 550 },
  { id: 'gigabit', techs: ['FTTP'], minDown: 900, maxDown: 1000 },
]

const TECH_PRIORITY: Record<string, number> = {
  'FTTP': 100,
  'SOGFast': 70,
  'SOGEA': 50,
  'SOADSL': 10,
}

const INVALID_PLACEHOLDERS = [2147483647, -1, 0]

function isValidSpeed(val: unknown): val is number {
  return typeof val === 'number' && !INVALID_PLACEHOLDERS.includes(val) && val > 0
}

async function getOAuthToken(): Promise<string> {
  const basicAuth = btoa(`${ICUK_API_USER}:${ICUK_API_KEY}`)
  const res = await fetch(`${ICUK_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'APIPlatform': ICUK_API_PLATFORM,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OAuth token request failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return data.access_token
}

interface NormalizedProduct {
  id: string
  name: string
  technology: string
  speed: string
  availabilityFlag: string
  likelyDownSpeed: number
  likelyUpSpeed: number
  speedRange: string
  speedRangeUp: string
}

interface AvailabilityResponse {
  available: boolean
  primaryTechnology: string
  maxDownload: number
  maxUpload: number
  technologies: { name: string; maxDown: number; maxUp: number }[]
  normalizedProducts: NormalizedProduct[]
  exchangeInfo: { name: string; code: string; status: string } | null
  rawMessages: string[]
  eligibleOcctaPlans: string[]
}

function normalizeIcukResponse(data: any): AvailabilityResponse {
  const products: NormalizedProduct[] = []
  const techMap = new Map<string, { maxDown: number; maxUp: number }>()
  const messages: string[] = []
  let exchangeInfo = null

  // Extract exchange info if present
  if (data.exchange) {
    exchangeInfo = {
      name: data.exchange.name || '',
      code: data.exchange.code || '',
      status: data.exchange.status || data.exchange.message || '',
    }
  }

  // Extract messages
  if (Array.isArray(data.messages)) {
    messages.push(...data.messages)
  }
  if (data.message) {
    messages.push(data.message)
  }

  // Process products from the ICUK response
  // The ICUK availability response may contain products in various structures
  const rawProducts = data.products || data.broadband_products || []
  const productList = Array.isArray(rawProducts) ? rawProducts : []

  for (const p of productList) {
    const tech = p.technology || p.type || ''
    const downSpeed = p.likely_down_speed ?? p.likelyDownSpeed ?? p.download_speed ?? 0
    const upSpeed = p.likely_up_speed ?? p.likelyUpSpeed ?? p.upload_speed ?? 0
    const availability = p.availability ?? p.availability_flag ?? p.status ?? ''

    if (!isValidSpeed(downSpeed) && !isValidSpeed(upSpeed)) continue

    const validDown = isValidSpeed(downSpeed) ? downSpeed : 0
    const validUp = isValidSpeed(upSpeed) ? upSpeed : 0

    products.push({
      id: p.id?.toString() || p.product_id?.toString() || '',
      name: p.name || p.product_name || '',
      technology: tech,
      speed: `${validDown}/${validUp}`,
      availabilityFlag: availability.toString(),
      likelyDownSpeed: validDown,
      likelyUpSpeed: validUp,
      speedRange: p.speed_range || p.speedRange || `${validDown}Mbps`,
      speedRangeUp: p.speed_range_up || p.speedRangeUp || `${validUp}Mbps`,
    })

    // Track best speeds per technology
    const existing = techMap.get(tech)
    if (!existing || validDown > existing.maxDown) {
      techMap.set(tech, { maxDown: validDown, maxUp: validUp })
    }
  }

  // Build technologies array sorted by priority (FTTP first)
  const technologies = Array.from(techMap.entries())
    .map(([name, speeds]) => ({ name, ...speeds }))
    .sort((a, b) => (TECH_PRIORITY[b.name] || 0) - (TECH_PRIORITY[a.name] || 0))

  // Determine primary technology and max speeds
  const primary = technologies[0]
  const primaryTechnology = primary?.name || 'none'
  const maxDownload = primary?.maxDown || 0
  const maxUpload = primary?.maxUp || 0

  // Map to eligible OCCTA plans
  const availableTechs = new Set(technologies.map(t => t.name))
  const eligibleOcctaPlans: string[] = []

  for (const plan of OCCTA_PLAN_MAP) {
    const hasTech = plan.techs.some(t => availableTechs.has(t))
    if (!hasTech) continue

    // Check if any available product meets the speed requirement
    const meetsSpeed = products.some(p => {
      if (!plan.techs.includes(p.technology)) return false
      if (plan.minDown && p.likelyDownSpeed < plan.minDown) return false
      if (plan.maxDown && p.likelyDownSpeed > plan.maxDown + 50) return false // tolerance
      return true
    })

    if (meetsSpeed || (plan.id === 'essential' && hasTech)) {
      eligibleOcctaPlans.push(plan.id)
    }
  }

  return {
    available: products.length > 0 && eligibleOcctaPlans.length > 0,
    primaryTechnology,
    maxDownload,
    maxUpload,
    technologies,
    normalizedProducts: products,
    exchangeInfo,
    rawMessages: messages,
    eligibleOcctaPlans,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { address } = await req.json()

    if (!address || typeof address !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Full ICUK address object is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rate limiting
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { data: allowed } = await supabase.rpc('check_rate_limit', {
      _identifier: clientIp,
      _action: 'check_availability',
      _max_requests: 5,
      _window_minutes: 5,
    })

    if (allowed === false) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again shortly.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get OAuth token
    const token = await getOAuthToken()

    // Call ICUK availability with the full unchanged address object
    const icukRes = await fetch(`${ICUK_BASE_URL}/broadband/availability`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'APIPlatform': ICUK_API_PLATFORM,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(address),
    })

    if (!icukRes.ok) {
      const errText = await icukRes.text()
      console.error(`ICUK availability check failed (${icukRes.status}):`, errText)
      return new Response(
        JSON.stringify({
          available: false,
          message: "We couldn't check availability for this address. Contact us and we'll check manually.",
          eligibleOcctaPlans: [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const rawData = await icukRes.json()
    const normalized = normalizeIcukResponse(rawData)

    if (!normalized.available) {
      return new Response(
        JSON.stringify({
          ...normalized,
          message: "We don't currently have orderable products at this address. Contact us and we'll check manually.",
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify(normalized),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('check-availability error:', err)
    return new Response(
      JSON.stringify({ error: 'An error occurred while checking availability.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
