import { corsHeaders, jsonResponse, getServiceClient, checkRateLimit, getRequestIp, brutalistEmailShell, escapeHtml } from '../_shared/quoteHelpers.ts'

const PUBLIC_APP_ORIGIN = 'https://www.occta.co.uk'

function normaliseEmail(email: unknown): string {
  return String(email ?? '').trim().toLowerCase()
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function findKnownCustomer(supabase: ReturnType<typeof getServiceClient>, email: string) {
  const [profile, guestOrder, quoteRequest, contractSummary] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email').ilike('email', email).limit(1).maybeSingle(),
    supabase.from('guest_orders').select('full_name, email').ilike('email', email).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('quote_requests').select('full_name, email').ilike('email', email).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('contract_summaries').select('customer_id, customer_name_snapshot, customer_email_snapshot').ilike('customer_email_snapshot', email).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const match = profile.data || guestOrder.data || quoteRequest.data || contractSummary.data
  const fullName =
    profile.data?.full_name ||
    guestOrder.data?.full_name ||
    quoteRequest.data?.full_name ||
    contractSummary.data?.customer_name_snapshot ||
    null

  return { known: Boolean(match), fullName, profileId: profile.data?.id || contractSummary.data?.customer_id || null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const body = await req.json().catch(() => ({}))
  const email = normaliseEmail(body.email)
  if (!validEmail(email)) return jsonResponse({ error: 'invalid_email' }, 400)

  const ip = getRequestIp(req) ?? 'noip'
  const rateKey = `${ip}:${email}`
  if (!(await checkRateLimit(rateKey, 'claim_dashboard_link', 4, 60))) {
    return jsonResponse({ ok: true })
  }

  const supabase = getServiceClient()
  const known = await findKnownCustomer(supabase, email)

  // Anti-enumeration: if we do not recognise the email, still return success.
  if (!known.known) return jsonResponse({ ok: true })

  let userId = known.profileId
  if (!userId) {
    const created = await supabase.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { full_name: known.fullName ?? undefined },
    })
    if (created.error || !created.data?.user) {
      const { data: profiles } = await supabase.from('profiles').select('id').ilike('email', email).limit(1)
      userId = profiles?.[0]?.id ?? null
    } else {
      userId = created.data.user.id
    }
  }

  if (userId) {
    const updates: Record<string, unknown> = { email }
    if (known.fullName) updates.full_name = known.fullName
    await supabase.from('profiles').update(updates).eq('id', userId)
  }

  const link = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${PUBLIC_APP_ORIGIN}/auth?welcome=1&next=%2Fdashboard` },
  })
  const actionLink = link.data?.properties?.action_link
  if (!actionLink) {
    console.error('[claim-dashboard-link] generateLink failed', { email, error: link.error?.message })
    return jsonResponse({ ok: true })
  }

  // Let the managed auth email pipeline send the actual message. It now uses
  // the corrected notify.www.occta.co.uk sender in auth-email-hook.
  const sent = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${PUBLIC_APP_ORIGIN}/auth?welcome=1&next=%2Fdashboard`,
  })
  if (sent.error) {
    console.error('[claim-dashboard-link] recovery email failed', { email, error: sent.error.message })
  }

  return jsonResponse({ ok: true })
})