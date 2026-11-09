"""Værhistorikk for ett punkt fra Open-Meteo (modell metno_nordic = MET Nordic, samme grunnlag som MET Nordic Analysis), i ett kall.

Gir samme format som hent_vaer.py skriver (kolonner ts, temp_c, nedbor_mm, rh, vind_ms, sw_j_m2), så oppdater_vaer.py kan bruke begge.
Ett kall for hele perioden (mot ca. 336 kall per område via OPeNDAP). Gratis API-et er til ikke-kommersiell bruk: ved betalende
kunder trengs avtale/abonnement (sett OPEN_METEO_API_KEY og OPEN_METEO_URL, eller bytt kilde).
"""
import json, os, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timezone

KOLONNER = ["ts", "temp_c", "nedbor_mm", "rh", "vind_ms", "sw_j_m2"]
URL = os.environ.get("OPEN_METEO_URL") or "https://api.open-meteo.com/v1/forecast"  # tom hemmelighet i Actions gir tom streng
UA = "Skiglede/1.0 (kontakt: sandvold40@gmail.com)"


def hent(lat, lon, dager=14, forsøk=6):
    q = {"latitude": f"{lat:.4f}", "longitude": f"{lon:.4f}", "hourly": "temperature_2m,precipitation,relative_humidity_2m,wind_speed_10m,shortwave_radiation",
         "past_days": min(92, max(1, dager)), "forecast_days": 1, "models": "metno_nordic", "wind_speed_unit": "ms", "timezone": "UTC"}
    if os.environ.get("OPEN_METEO_API_KEY"):
        q["apikey"] = os.environ["OPEN_METEO_API_KEY"]
    url = f"{URL}?{urllib.parse.urlencode(q)}"
    for n in range(forsøk):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
                j = json.load(r)
            break
        except urllib.error.HTTPError as e:
            if n == forsøk - 1 or e.code not in (429, 500, 502, 503, 504):
                raise
            vent = e.headers.get("Retry-After")
            if vent and vent.isdigit() and int(vent) > 120:
                raise RuntimeError(f"Open-Meteo: grensen er brukt opp (prøv igjen om {int(vent) // 60} min). Delte IP-adresser deler gratisgrensen; et abonnement gir egen kvote")
            time.sleep(float(vent) if vent and vent.isdigit() else min(65, 10 * (n + 1)))  # 429: grensen gjelder per minutt
        except Exception:
            if n == forsøk - 1:
                raise
            time.sleep(3 * (n + 1))
    h = j["hourly"]
    nå = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:00")
    timer = []
    for i, t in enumerate(h["time"]):
        if t > nå:
            break  # fremtiden kommer fra MET-prognosen i appen
        v = [h["temperature_2m"][i], h["precipitation"][i], h["relative_humidity_2m"][i], h["wind_speed_10m"][i], h["shortwave_radiation"][i]]
        if v[0] is None:
            continue
        timer.append([f"{t}:00Z", round(v[0], 2), round(v[1] or 0, 3), round((v[2] or 0) / 100, 3), round(v[3] or 0, 2), round((v[4] or 0) * 3600)])
    return {"celle": [round(j["latitude"] * 100), round(j["longitude"] * 100)], "grid_hoyde_m": j.get("elevation"), "kolonner": KOLONNER, "timer": timer}
