const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// No external availability check — return the full OCCTA plan set so customers
// can continue. Final line-by-line verification happens during onboarding.
const ALL_PLANS = ['essential', 'superfast', 'ultrafast', 'gigabit']

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

    return new Response(
      JSON.stringify({
        available: true,
        primaryTechnology: 'FTTP',
        maxDownload: 1000,
        maxUpload: 1000,
        technologies: [],
        normalizedProducts: [],
        exchangeInfo: null,
        rawMessages: [],
        eligibleOcctaPlans: ALL_PLANS,
      }),
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
