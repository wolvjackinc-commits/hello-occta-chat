const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY = 'https://connector-gateway.lovable.dev/google_maps';

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function err(status: number, message: string) {
  return new Response(JSON.stringify({ error: message, suggestions: [], address: null }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const googleMapsKey =
      Deno.env.get('GOOGLE_MAPS_API_KEY') ?? Deno.env.get('GOOGLE_MAPS_API_KEY_1');
    if (!lovableApiKey || !googleMapsKey) return err(500, 'Address lookup not configured');

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'suggest');
    const headers = {
      'Authorization': `Bearer ${lovableApiKey}`,
      'X-Connection-Api-Key': googleMapsKey,
      'Content-Type': 'application/json',
      'Referer': 'https://www.occta.co.uk/',
    };

    if (action === 'suggest') {
      const input = String(body?.input || '').trim();
      if (input.length < 3) return ok({ suggestions: [] });
      const sessionToken = String(body?.sessionToken || '');
      const res = await fetch(`${GATEWAY}/places/v1/places:autocomplete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          input,
          regionCode: 'gb',
          languageCode: 'en-GB',
          includedRegionCodes: ['gb'],
          ...(sessionToken ? { sessionToken } : {}),
        }),
      });
      if (!res.ok) {
        console.error('autocomplete failed', res.status, await res.text());
        return err(502, 'Lookup failed');
      }
      const data = await res.json();
      const suggestions = (data?.suggestions || [])
        .filter((s: any) => s?.placePrediction)
        .map((s: any) => ({
          placeId: s.placePrediction.placeId,
          mainText: s.placePrediction.structuredFormat?.mainText?.text || s.placePrediction.text?.text || '',
          secondaryText: s.placePrediction.structuredFormat?.secondaryText?.text || '',
          fullText: s.placePrediction.text?.text || '',
        }));
      return ok({ suggestions });
    }

    if (action === 'details') {
      const placeId = String(body?.placeId || '').trim();
      if (!placeId) return err(400, 'Missing placeId');
      const res = await fetch(`${GATEWAY}/places/v1/places/${encodeURIComponent(placeId)}?languageCode=en-GB&regionCode=gb`, {
        method: 'GET',
        headers: { ...headers, 'X-Goog-FieldMask': 'id,formattedAddress,addressComponents,displayName' },
      });
      if (!res.ok) {
        console.error('details failed', res.status, await res.text());
        return err(502, 'Lookup failed');
      }
      const place = await res.json();
      const comps: any[] = place?.addressComponents || [];
      const get = (type: string) => comps.find((c) => (c.types || []).includes(type));
      const longOf = (c: any) => (c ? (c.longText || '') : '');
      const shortOf = (c: any) => (c ? (c.shortText || '') : '');
      const streetNumber = longOf(get('street_number'));
      const route = longOf(get('route'));
      const subpremise = longOf(get('subpremise'));
      const premise = longOf(get('premise'));
      const line1 = [streetNumber, route].filter(Boolean).join(' ') || premise || route || '';
      const line2 = subpremise ? `Flat ${subpremise}` : '';
      const city = longOf(get('postal_town')) || longOf(get('locality')) || longOf(get('administrative_area_level_2')) || '';
      const postcode = (shortOf(get('postal_code')) || longOf(get('postal_code')) || '').toUpperCase();
      return ok({
        address: { line1, line2, city, postcode, formattedAddress: place?.formattedAddress || '' },
      });
    }

    return err(400, 'Unknown action');
  } catch (e) {
    console.error('places-autocomplete error', e);
    return err(500, 'Lookup failed');
  }
});