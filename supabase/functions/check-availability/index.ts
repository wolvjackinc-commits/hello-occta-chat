const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BACKEND_BASE = 'https://caleb-unfronted-contumeliously.ngrok-free.dev'

const OCCTA_PLAN_MAP = [
  { id: 'essential', techs: ['SOGEA', 'SoGEA', 'FTTP'], minLineSpeed: 0, maxLineSpeed: 80 },
  { id: 'superfast', techs: ['FTTP'], minLineSpeed: 160, maxLineSpeed: 330 },
  { id: 'ultrafast', techs: ['FTTP'], minLineSpeed: 500, maxLineSpeed: 550 },
  { id: 'gigabit', techs: ['FTTP'], minLineSpeed: 900, maxLineSpeed: 1000 },
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
  message?: string
}

function normalizeIcukResponse(data: any): AvailabilityResponse {
  const products: NormalizedProduct[] = []
  const techMap = new Map<string, { maxDown: number; maxUp: number }>()
  const messages: string[] = []
  let exchangeInfo = null

  if (data.exchange) {
    exchangeInfo = {
      name: data.exchange.name || '',
      code: data.exchange.code || '',
      status: data.exchange.status || data.exchange.message || '',
    }
  }

  if (Array.isArray(data.messages)) {
    messages.push(...data.messages)
  }
  if (data.message) {
    messages.push(data.message)
  }

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

    const existing = techMap.get(tech)
    if (!existing || validDown > existing.maxDown) {
      techMap.set(tech, { maxDown: validDown, maxUp: validUp })
    }
  }

  const technologies = Array.from(techMap.entries())
    .map(([name, speeds]) => ({ name, ...speeds }))
    .sort((a, b) => (TECH_PRIORITY[b.name] || 0) - (TECH_PRIORITY[a.name] || 0))

  const primary = technologies[0]
  const primaryTechnology = primary?.name || 'none'
  const maxDownload = primary?.maxDown || 0
  const maxUpload = primary?.maxUp || 0

  const availableTechs = new Set(technologies.map(t => t.name))
  const eligibleOcctaPlans: string[] = []

  // For each OCCTA plan, check if the line supports it based on max line speed
  for (const plan of OCCTA_PLAN_MAP) {
    const hasTech = plan.techs.some(t => availableTechs.has(t))
    if (!hasTech) continue

    // Check if the max line speed for any matching tech can support this plan
    const canSupport = technologies.some(t => {
      if (!plan.techs.includes(t.name)) return false
      // The line's max speed must be >= the plan's minimum requirement
      return t.maxDown >= plan.minLineSpeed
    })

    if (canSupport) {
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
        JSON.stringify({ error: 'Full address object is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const res = await fetch(`${BACKEND_BASE}/check-availability`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(address),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error(`Backend check-availability failed (${res.status}):`, errText)
      return new Response(
        JSON.stringify({
          available: false,
          message: "We couldn't check availability for this address. Contact us and we'll check manually.",
          eligibleOcctaPlans: [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const rawData = await res.json()
    console.log('Backend check-availability response:', JSON.stringify(rawData).substring(0, 2000))
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
