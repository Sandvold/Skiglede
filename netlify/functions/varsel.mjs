// Henter timesvarsel fra MET (Yr, locationforecast) og sender det videre i kompakt form.
// MET krever identifiserbar User-Agent (nettlesere kan ikke sette den) og ber om cache, derfor går alt via her.
// Data: MET Norway, CC BY 4.0 / NLOD. Vis kreditering i appen.
// Stedet kommer som lat, lon og hoyde fra appen (områdene ligger i Neon). Avrundes til 2 desimaler så cachen treffer, og må ligge i Norge.
const UA = 'Skiglede/0.1 (https://skiglede.netlify.app; sandvold40@gmail.com)';

export default async (req) => {
  const q = new URL(req.url).searchParams;
  const sted = { lat: Math.round(Number(q.get('lat')) * 100) / 100, lon: Math.round(Number(q.get('lon')) * 100) / 100, hoyde: Math.round(Number(q.get('hoyde')) || 0) };
  if (!(sted.lat >= 57 && sted.lat <= 72 && sted.lon >= 4 && sted.lon <= 32 && sted.hoyde >= 0 && sted.hoyde <= 2500)) return new Response('ugyldig sted', { status: 400 });
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${sted.lat}&lon=${sted.lon}&altitude=${sted.hoyde}`;
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) return new Response(`MET svarte ${r.status}`, { status: 502 });
  const d = await r.json();
  const timer = [];
  for (const t of d.properties.timeseries) {
    const n1 = t.data.next_1_hours; // bare de første ca. 2,5 døgnene har timesverdier
    if (!n1) continue;
    const i = t.data.instant.details;
    timer.push([t.time, i.air_temperature, n1.details.precipitation_amount ?? 0, (i.relative_humidity ?? 0) / 100, i.wind_speed ?? 0, i.cloud_area_fraction ?? 0]);
  }
  return new Response(JSON.stringify({ oppdatert: d.properties.meta.updated_at, hoyde_m: sted.hoyde, kolonner: ['ts', 'temp_c', 'nedbor_mm', 'rh', 'vind_ms', 'sky_pst'], timer }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300, s-maxage=1800' },
  });
};
