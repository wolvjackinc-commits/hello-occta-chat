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

// A customer-selectable row must be an actual property, never a postcode,
// town, locality or bare street.
const BANNED_TYPES = new Set([
  'postal_code',
  'postal_code_prefix',
  'postal_code_suffix',
  'postal_town',
  'locality',
  'sublocality',
  'neighborhood',
  'administrative_area_level_1',
  'administrative_area_level_2',
  'administrative_area_level_3',
  'country',
  'political',
  'route',
  'intersection',
]);

const PROPERTY_TYPES = new Set([
  'street_address',
  'premise',
  'subpremise',
  'street_number',
  'establishment',
  'point_of_interest',
]);

function isPropertySuggestion(prediction: any) {
  const types: string[] = Array.isArray(prediction?.types) ? prediction.types : [];
  if (types.length === 0) return false;
  if (types.some((t) => BANNED_TYPES.has(t))) return false;
  return types.some((t) => PROPERTY_TYPES.has(t));
}

function samePostcode(a: string, b: string) {
  const norm = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return norm(a) === norm(b);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    // Prefer OCCTA's own Google Maps Platform key when configured: it is valid
    // for every OCCTA domain (including occta.co.uk). Otherwise fall back to
    // the managed connector gateway.
    const ownKey = Deno.env.get('GOOGLE_API_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const googleMapsKey =
      Deno.env.get('GOOGLE_MAPS_API_KEY') ?? Deno.env.get('GOOGLE_MAPS_API_KEY_1');
    if (!ownKey && (!lovableApiKey || !googleMapsKey)) return err(500, 'Address lookup not configured');

    const base = ownKey ? 'https://places.googleapis.com/v1' : `${GATEWAY}/places/v1`;
    const headers: Record<string, string> = ownKey
      ? {
          'X-Goog-Api-Key': ownKey,
          'Content-Type': 'application/json',
          // OCCTA's key is website-restricted, so identify the calling site.
          'Referer': 'https://www.occta.co.uk/',
        }
      : {
          'Authorization': `Bearer ${lovableApiKey}`,
          'X-Connection-Api-Key': googleMapsKey!,
          'Content-Type': 'application/json',
          'Referer': 'https://www.occta.co.uk/',
        };

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'suggest');

    if (action === 'suggest') {
      const input = String(body?.input || '').trim();
      if (input.length < 3) return ok({ suggestions: [] });
      const sessionToken = String(body?.sessionToken || '');
      // The checked postcode is used only as hidden bias, never shown/prefilled.
      const expectedPostcode = String(body?.expectedPostcode || '').trim();
      const res = await fetch(`${base}/places:autocomplete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          input: expectedPostcode && !input.toUpperCase().includes(expectedPostcode.toUpperCase().replace(/\s+/g, ''))
            ? `${input}, ${expectedPostcode}`
            : input,
          regionCode: 'gb',
          languageCode: 'en-GB',
          includedRegionCodes: ['gb'],
          includedPrimaryTypes: ['street_address', 'premise', 'subpremise'],
          ...(sessionToken ? { sessionToken } : {}),
        }),
      });
      if (!res.ok) {
        console.error('autocomplete failed', res.status, await res.text());
        return err(502, 'Lookup failed');
      }
      const data = await res.json();
      const suggestions = (data?.suggestions || [])
        .filter((s: any) => s?.placePrediction && isPropertySuggestion(s.placePrediction))
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
      const res = await fetch(`${base}/places/${encodeURIComponent(placeId)}?languageCode=en-GB&regionCode=gb`, {
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