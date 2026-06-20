const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ICUK_BASE_URL = (Deno.env.get('ICUK_BASE_URL') || 'https://api.interdns.co.uk').replace(/\/$/, '')
const ICUK_PLATFORM = Deno.env.get('ICUK_API_PLATFORM') || 'LIVE'

async function getIcukAuthCandidates() {
  const user = Deno.env.get('ICUK_API_USER')
  const key = Deno.env.get('ICUK_API_KEY')
  const token = Deno.env.get('ICUK_API_TOKEN')
  const candidates: string[] = []
  const credentialPairs = [
    [user, token],
    [user, key],
    [key, token],
  ].filter(([username, password]) => username && password) as [string, string][]

  if (credentialPairs.length === 0 && !token && !key) {
    throw new Error('ICUK credentials are not configured')
  }

  for (const [username, password] of credentialPairs) {
    const tokenRes = await fetch(`${ICUK_BASE_URL}/oauth/token?grant_type=client_credentials`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
        'ApiPlatform': ICUK_PLATFORM,
        'Accept': 'application/json',
        'Content-Length': '0',
      },
    })

    if (!tokenRes.ok) continue

    const tokenData = await tokenRes.json()
    if (tokenData?.access_token) candidates.push(tokenData.access_token as string)
  }

  for (const raw of [token, key]) {
    if (raw && !candidates.includes(raw)) candidates.push(raw)
  }

  return candidates
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

    const authCandidates = await getIcukAuthCandidates()
    let data: any = null
    let lastStatus = 0

    for (const token of authCandidates) {
      const res = await fetch(`${ICUK_BASE_URL}/broadband/address/${normalized}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ApiPlatform': ICUK_PLATFORM,
        },
      })

      lastStatus = res.status
      if (!res.ok) continue

      data = await res.json()
      break
    }

    if (!data) {
      console.error(`ICUK check-address failed with all configured auth candidates. Last status: ${lastStatus}`)
      return new Response(
        JSON.stringify({
          addresses: [],
          message: "We couldn't automatically find your address. Please try again or contact us and we'll check manually.",
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('ICUK check-address response keys:', Object.keys(data))

    const addressList = Array.isArray(data) ? data : (data?.addresses || data?.results || [])

    if (!Array.isArray(addressList) || addressList.length === 0) {
      return new Response(
        JSON.stringify({
          addresses: [],
          message: data?.message || "We couldn't automatically find your address. Contact us and we'll check manually.",
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ addresses: addressList }),
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