const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_MAPS_GATEWAY = 'https://connector-gateway.lovable.dev/google_maps'

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

async function getGoogleAddressFallback(postcode: string) {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
  const googleMapsKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
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

    const postcodeRegex = /^[A-Z]{1,2}[0-9][0-9A-Z]?[0-9][A-Z]{2}$/
    if (!postcodeRegex.test(normalized)) {
      return new Response(
        JSON.stringify({ error: 'Invalid UK postcode format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const addresses = await getGoogleAddressFallback(normalized)

    if (addresses.length === 0) {
      return new Response(
        JSON.stringify({
          addresses: [],
          message: "We couldn't automatically find your address. Please try again or contact us and we'll check manually.",
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ addresses, source: 'google_places' }),
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