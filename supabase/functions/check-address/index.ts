const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_MAPS_GATEWAY = 'https://connector-gateway.lovable.dev/google_maps'
const ALL_PLANS_NOTE = "Select your exact address and we'll show the available plans in this same panel."

function formatPostcode(postcode: string) {
  const normalized = postcode.trim().toUpperCase().replace(/\s+/g, '')
  return normalized.length > 3 ? `${normalized.slice(0, -3)} ${normalized.slice(-3)}` : normalized
}

function compact(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function uniqueAddresses(addresses: any[]) {
  const seen = new Set<string>()
  return addresses.filter((addr) => {
    const key = compact(addr.formatted_address || addr.premises_name).toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
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

async function getGoogleTextSearchAddresses(postcode: string) {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
  const googleMapsKey =
    Deno.env.get('GOOGLE_MAPS_API_KEY') ?? Deno.env.get('GOOGLE_MAPS_API_KEY_1')
  if (!lovableApiKey || !googleMapsKey) return []

  const res = await fetch(`${GOOGLE_MAPS_GATEWAY}/places/v1/places:searchText`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'X-Connection-Api-Key': googleMapsKey,
      'Content-Type': 'application/json',
      'Referer': 'https://www.occta.co.uk/',
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.shortFormattedAddress',
    },
    body: JSON.stringify({
      textQuery: `addresses near ${postcode}, UK`,
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
    .filter((addr: any) => {
      const norm = (addr.formatted_address || '').toUpperCase().replace(/\s+/g, '')
      return norm.includes(postcode.replace(/\s+/g, ''))
    })
}

async function getGoogleAddressFallback(postcode: string) {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
  const googleMapsKey =
    Deno.env.get('GOOGLE_MAPS_API_KEY') ?? Deno.env.get('GOOGLE_MAPS_API_KEY_1')
  if (!lovableApiKey || !googleMapsKey) return []

  const res = await fetch(`${GOOGLE_MAPS_GATEWAY}/places/v1/places:autocomplete`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'X-Connection-Api-Key': googleMapsKey,
      'Content-Type': 'application/json',
      'Referer': 'https://www.occta.co.uk/',
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
    console.error(`Google address fallback failed (${res.status}):`, await res.text())
    return []
  }

  const data = await res.json()
  return (Array.isArray(data?.suggestions) ? data.suggestions : [])
    .map((suggestion: any) => toGoogleAddress(suggestion, postcode))
    .filter((addr: any) => addr.premises_name || addr.formatted_address)
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

    const addresses = uniqueAddresses([
      ...await getGoogleTextSearchAddresses(displayPostcode),
      ...await getGoogleAddressFallback(displayPostcode),
    ])

    if (addresses.length === 0) {
      const fallback = [{
        source: 'postcode_only',
        google_place_id: '',
        premises_name: displayPostcode,
        post_town: '',
        postcode: displayPostcode,
        formatted_address: `Use this postcode (${displayPostcode})`,
      }]
      return new Response(
        JSON.stringify({
          addresses: fallback,
          source: 'postcode_only',
          message: "We couldn't list individual addresses for this postcode. Continue with the postcode and we'll confirm your address before activation.",
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