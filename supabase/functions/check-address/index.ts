const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_MAPS_GATEWAY = 'https://connector-gateway.lovable.dev/google_maps'
const ALL_PLANS_NOTE = "Select your exact address and we'll show the available plans in this same panel."
const LOOKUP_TIMEOUT_MS = 3000

function formatPostcode(postcode: string) {
  const normalized = postcode.trim().toUpperCase().replace(/\s+/g, '')
  return normalized.length > 3 ? `${normalized.slice(0, -3)} ${normalized.slice(-3)}` : normalized
}

function compact(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeForCompare(value: unknown) {
  return compact(value).toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function isRealAddress(addr: any, postcode: string) {
  const formatted = compact(addr?.formatted_address || addr?.premises_name)
  if (!formatted) return false

  const normalizedAddress = normalizeForCompare(formatted)
  const normalizedPostcode = normalizeForCompare(postcode)
  const normalizedPremises = normalizeForCompare(addr?.premises_name)
  if (!normalizedAddress.includes(normalizedPostcode)) return false
  if (normalizedPremises === normalizedPostcode) return false

  // Never present the postcode itself as if it were an individual property.
  const withoutPostcode = normalizedAddress.replace(normalizedPostcode, '')
  return withoutPostcode.length >= 3
}

function uniqueAddresses(addresses: any[], postcode: string) {
  const seen = new Set<string>()
  return addresses.filter((addr) => {
    if (!isRealAddress(addr, postcode)) return false
    const key = normalizeForCompare(addr.formatted_address || addr.premises_name)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = LOOKUP_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

function toGoogleAddress(candidate: any, postcode: string) {
  const text = candidate?.placePrediction?.text?.text || candidate?.placePrediction?.structuredFormat?.mainText?.text || ''
  const secondary = candidate?.placePrediction?.structuredFormat?.secondaryText?.text || ''
  const full = [text, secondary].filter(Boolean).join(', ')
  return {
    source: 'google_places',
    google_place_id: candidate?.placePrediction?.placeId || '',
    premises_name: text,
    post_town: secondary,
    postcode,
    formatted_address: full || postcode,
  }
}

function toGooglePlaceAddress(place: any, postcode: string) {
  const formatted = compact(place?.formattedAddress || place?.shortFormattedAddress)
  const display = compact(place?.displayName?.text)
  return {
    source: 'google_places',
    google_place_id: compact(place?.id),
    premises_name: display || formatted,
    post_town: '',
    postcode,
    formatted_address: formatted || display || postcode,
  }
}

// Prefer OCCTA's own Google Maps Platform key when configured: it works for
// every OCCTA domain (including occta.co.uk). Otherwise fall back to the
// managed connector gateway.
function resolveGoogleTransport() {
  const ownKey = Deno.env.get('GOOGLE_API_KEY')
  if (ownKey) {
    return {
      base: 'https://places.googleapis.com/v1',
      headers: {
        'X-Goog-Api-Key': ownKey,
        'Content-Type': 'application/json',
        // OCCTA's key is website-restricted, so identify the calling site.
        'Referer': 'https://www.occta.co.uk/',
      } as Record<string, string>,
    }
  }

  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
  const googleMapsKey = Deno.env.get('GOOGLE_MAPS_API_KEY') ?? Deno.env.get('GOOGLE_MAPS_API_KEY_1')
  if (!lovableApiKey || !googleMapsKey) return null

  return {
    base: `${GOOGLE_MAPS_GATEWAY}/places/v1`,
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'X-Connection-Api-Key': googleMapsKey,
      'Content-Type': 'application/json',
      'Referer': 'https://www.occta.co.uk/',
    } as Record<string, string>,
  }
}

async function getGoogleTextSearchAddresses(postcode: string) {
  const transport = resolveGoogleTransport()
  if (!transport) return []

  try {
    const res = await fetchWithTimeout(`${transport.base}/places:searchText`, {
      method: 'POST',
      headers: {
        ...transport.headers,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.shortFormattedAddress',
      },
      body: JSON.stringify({
        // A direct postcode query is both faster and less noisy than "addresses near ...".
        textQuery: `${postcode}, UK`,
        regionCode: 'gb',
        languageCode: 'en-GB',
      }),
    })

    if (!res.ok) {
      console.error(`Google text address lookup failed (${res.status}):`, await res.text())
      return []
    }

    const data = await res.json()
    return (Array.isArray(data?.places) ? data.places : [])
      .map((place: any) => toGooglePlaceAddress(place, postcode))
      .filter((addr: any) => isRealAddress(addr, postcode))
  } catch (err) {
    console.error('Google text address lookup timed out or failed:', err)
    return []
  }
}

async function getGoogleAddressFallback(postcode: string) {
  const transport = resolveGoogleTransport()
  if (!transport) return []

  try {
    const res = await fetchWithTimeout(`${transport.base}/places:autocomplete`, {
      method: 'POST',
      headers: {
        ...transport.headers,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
      },
      body: JSON.stringify({
        input: postcode,
        includedPrimaryTypes: ['street_address', 'premise', 'subpremise'],
        includedRegionCodes: ['gb'],
        languageCode: 'en-GB',
      }),
    })

    if (!res.ok) {
      console.error(`Google address autocomplete failed (${res.status}):`, await res.text())
      return []
    }

    const data = await res.json()
    return (Array.isArray(data?.suggestions) ? data.suggestions : [])
      .map((suggestion: any) => toGoogleAddress(suggestion, postcode))
      .filter((addr: any) => isRealAddress(addr, postcode))
  } catch (err) {
    console.error('Google address autocomplete timed out or failed:', err)
    return []
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { postcode } = await req.json()

    if (!postcode || typeof postcode !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Postcode is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const normalized = postcode.trim().toUpperCase().replace(/\s+/g, '')
    const displayPostcode = formatPostcode(normalized)

    const postcodeRegex = /^[A-Z]{1,2}[0-9][0-9A-Z]?[0-9][A-Z]{2}$/
    if (!postcodeRegex.test(normalized)) {
      return new Response(
        JSON.stringify({ error: 'Invalid UK postcode format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Run the independent provider calls concurrently. Previously these ran one
    // after the other, so a slow provider doubled the customer's wait time.
    const [textResult, autocompleteResult] = await Promise.allSettled([
      getGoogleTextSearchAddresses(displayPostcode),
      getGoogleAddressFallback(displayPostcode),
    ])

    const addresses = uniqueAddresses([
      ...(textResult.status === 'fulfilled' ? textResult.value : []),
      ...(autocompleteResult.status === 'fulfilled' ? autocompleteResult.value : []),
    ], displayPostcode)

    if (addresses.length === 0) {
      // Do not fabricate a "Use this postcode" row. It is not an address and it
      // made the UI say "1 address found" even when no property was returned.
      return new Response(
        JSON.stringify({
          addresses: [],
          source: 'no_property_addresses',
          message: "We couldn't list individual properties for this postcode. Search for your full address or enter it manually and we'll confirm availability before activation.",
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ addresses, source: addresses[0]?.source || 'address_lookup', message: ALL_PLANS_NOTE }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('check-address error:', err)
    return new Response(
      JSON.stringify({ error: 'An error occurred while looking up addresses.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})