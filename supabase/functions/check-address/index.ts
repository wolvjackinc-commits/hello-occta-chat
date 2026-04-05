const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const ICUK_BASE_URL = Deno.env.get('ICUK_BASE_URL') || 'https://api.interdns.co.uk'
const ICUK_API_TOKEN = Deno.env.get('ICUK_API_TOKEN') || ''
const ICUK_API_PLATFORM = Deno.env.get('ICUK_API_PLATFORM') || 'LIVE'

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

    // Normalize: trim, uppercase, strip all spaces
    const normalized = postcode.trim().toUpperCase().replace(/\s+/g, '')

    // Basic UK postcode format check
    const postcodeRegex = /^[A-Z]{1,2}[0-9][0-9A-Z]?[0-9][A-Z]{2}$/
    if (!postcodeRegex.test(normalized)) {
      return new Response(
        JSON.stringify({ error: 'Invalid UK postcode format' }),
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
      _action: 'check_address',
      _max_requests: 10,
      _window_minutes: 5,
    })

    if (allowed === false) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again shortly.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call ICUK address lookup with pre-generated Bearer token
    const icukRes = await fetch(`${ICUK_BASE_URL}/broadband/address/${normalized}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ICUK_API_TOKEN}`,
        'APIPlatform': ICUK_API_PLATFORM,
        'Accept': 'application/json',
      },
    })

    if (!icukRes.ok) {
      const errText = await icukRes.text()
      console.error(`ICUK address lookup failed (${icukRes.status}):`, errText)
      return new Response(
        JSON.stringify({
          addresses: [],
          message: "We couldn't automatically find your address. Contact us and we'll check manually.",
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const rawBody = await icukRes.text()
    console.log('ICUK address raw response:', rawBody.substring(0, 2000))
    
    let addresses: any
    try {
      addresses = JSON.parse(rawBody)
    } catch {
      console.error('Failed to parse ICUK response as JSON')
      return new Response(
        JSON.stringify({ addresses: [], message: "We couldn't automatically find your address. Contact us and we'll check manually." }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // The ICUK response might be an object with an addresses array, or directly an array
    const addressList = Array.isArray(addresses) ? addresses : (addresses?.addresses || addresses?.results || [])
    
    if (!Array.isArray(addressList) || addressList.length === 0) {
      return new Response(
        JSON.stringify({
          addresses: [],
          message: "We couldn't automatically find your address. Contact us and we'll check manually.",
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ addresses }),
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
