// Neon Function: tar imot RevenueCat-webhook og oppdaterer abonnement + profil (Pro/Premium) i Neon.
// Ingen avhengigheter: SQL går over Neons HTTP-endepunkt med DATABASE_URL.
// Miljø: REVENUECAT_SECRET (samme verdi som Authorization-headeren i RevenueCat-webhooken).

const SQL = async (query, params) => {
  const url = new URL(process.env.DATABASE_URL);
  const r = await fetch(`https://${url.host}/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Neon-Connection-String': process.env.DATABASE_URL },
    body: JSON.stringify({ query, params }),
  });
  if (!r.ok) throw new Error(`SQL ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
};

const tierer = (e) => {
  // Produkt-ID-ene våre heter pro_aar og premium_aar; entitlements heter pro og premium.
  const ider = [...(e.entitlement_ids ?? []), e.entitlement_id, e.product_id].filter(Boolean).map((s) => String(s).toLowerCase());
  const t = new Set();
  if (ider.some((s) => s.includes('premium'))) t.add('premium');
  if (ider.some((s) => s === 'pro' || s.startsWith('pro_') || s.includes('pro'))) t.add('pro');
  return t;
};

export default {
  async fetch(request) {
    if (request.method !== 'POST') return new Response('ok');
    const hemmelig = process.env.REVENUECAT_SECRET;
    const auth = request.headers.get('authorization') ?? '';
    if (!hemmelig || (auth !== hemmelig && auth !== `Bearer ${hemmelig}`)) return new Response('forbidden', { status: 403 });
    let e;
    try {
      e = (await request.json()).event;
    } catch {
      return new Response('bad json', { status: 400 });
    }
    if (!e || !e.app_user_id || e.type === 'TEST') return new Response('ignored');
    const bruker = e.app_user_id;
    if (String(bruker).startsWith('$RCAnonymousID')) return new Response('anonym, ignorert');
    const utløp = e.expiration_at_ms ? new Date(Number(e.expiration_at_ms)).toISOString() : null;
    const t = tierer(e);
    if (utløp && t.size) {
      await SQL(
        `insert into public.abonnement (user_id, pro_utloper, premium_utloper, siste_hendelse, oppdatert)
         values ($1, $2, $3, $4, now())
         on conflict (user_id) do update set
           pro_utloper = case when $5 then $2::timestamptz else abonnement.pro_utloper end,
           premium_utloper = case when $6 then $3::timestamptz else abonnement.premium_utloper end,
           siste_hendelse = $4, oppdatert = now()`,
        [bruker, t.has('pro') ? utløp : null, t.has('premium') ? utløp : null, e.type, t.has('pro'), t.has('premium')],
      );
    }
    // Profilen er det RLS-reglene leser: Pro (dyreste nivå) inkluderer Premium, ikke omvendt. Rader finnes bare for brukere som har logget inn.
    await SQL(
      `update public.profil p set
         premium = coalesce(a.premium_utloper > now(), false) or coalesce(a.pro_utloper > now(), false),
         pro = coalesce(a.pro_utloper > now(), false)
       from public.abonnement a where a.user_id = p.user_id and p.user_id = $1`,
      [bruker],
    );
    return new Response('ok');
  },
};
