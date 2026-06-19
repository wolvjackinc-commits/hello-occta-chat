import { sendLovableEmail } from 'npm:@lovable.dev/email-js'
import { corsHeaders, jsonResponse, getServiceClient, checkRateLimit, getRequestIp, brutalistEmailShell, escapeHtml } from '../_shared/quoteHelpers.ts'

const SENDER_DOMAIN = 'notify.www.occta.co.uk'
const FROM_EMAIL = `OCCTA <noreply@${SENDER_DOMAIN}>`
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

  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!apiKey) return jsonResponse({ error: 'server_not_configured' }, 500)

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

  const html = brutalistEmailShell(
    'Activate your OCCTA dashboard',
    `<p>Hi ${escapeHtml(known.fullName || 'there')},</p>
     <p>Use this secure link to choose a password and open your OCCTA dashboard. Your order, Contract Summary and billing details will be synced to this email address.</p>
     <p style="font-size:13px;color:#444;">If you did not ask for this, you can safely ignore it.</p>`,
    { label: 'Set password & open dashboard', url: actionLink },
  )

  try {
    await sendLovableEmail({
      run_id: crypto.randomUUID(),
      to: email,
      from: FROM_EMAIL,
      sender_domain: SENDER_DOMAIN,
      subject: 'Set your OCCTA dashboard password',
      html,
      text: `Set your OCCTA dashboard password: ${actionLink}`,
      purpose: 'transactional',
      label: 'dashboard-claim-link',
      idempotency_key: `dashboard-claim-${email}-${Date.now()}`,
    }, { apiKey })
  } catch (error) {
    console.error('[claim-dashboard-link] email send failed', { email, error: error instanceof Error ? error.message : String(error) })
    return jsonResponse({ ok: true })
  }

  return jsonResponse({ ok: true })
})