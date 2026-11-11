#!/usr/bin/env python3
"""Henter timesverdier fra MET Nordic Analysis (1 km) for ett punkt via OPeNDAP.

Eksempel (Hovden, siste 14 dager, skriver SQL til fil):
    python3 -I scripts/hent_vaer.py --lat 59.5667 --lon 7.3667 --days 14 --sql hovden_vaer.sql

Enheter i utdata: temp_c (°C), precip_mm (mm/time), rh (0-1), wind_ms (m/s),
sw_j_m2 (J/m² integrert over timen).
"""
import argparse, re, sys, time, urllib.error, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import numpy as np
from pyproj import Transformer

ROOT = "https://thredds.met.no/thredds/dodsC"
FILE = "met_analysis_1_0km_nordic_{ts}.nc"
LCC = "+proj=lcc +lat_0=63 +lon_0=15 +lat_1=63 +lat_2=63 +no_defs +R=6.371e+06"
VARS = [
    "air_temperature_2m",
    "precipitation_amount",
    "relative_humidity_2m",
    "wind_speed_10m",
    "integral_of_surface_downwelling_shortwave_flux_in_air_wrt_time",
]


UA = "Skiglede/1.0 (kontakt: sandvold40@gmail.com)"  # MET krever identifiserende User-Agent og kaster ut anonyme klienter med mye trafikk


def get(url_base, query):
    """Ett kall mot MET. 404 (filen finnes ikke) går rett videre; 429/5xx/tidsavbrudd prøves på nytt med økende ventetid (og Retry-After)."""
    url = url_base + ".ascii?" + urllib.parse.quote(query, safe=":,_")
    for n in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
                return r.read().decode()
        except urllib.error.HTTPError as e:
            if e.code not in (429, 500, 502, 503, 504) or n == 4:
                raise
            ra = e.headers.get("Retry-After")
            time.sleep(min(120, float(ra)) if ra and ra.isdigit() else 5 * 3**n)
        except (TimeoutError, urllib.error.URLError):
            if n == 4:
                raise
            time.sleep(3 * (n + 1))


def candidates(t):
    ts = t.strftime("%Y%m%dT%HZ")
    f = FILE.format(ts=ts)
    return [
        f"{ROOT}/metpparchive/{t:%Y}/{t:%m}/{t:%d}/{f}",
        f"{ROOT}/metpplatest/{f}",
    ]


def grid_cell(lat, lon, ref):
    def arr(name):
        txt = get(ref, name).split("-" * 45)[-1]
        return np.array([float(v) for v in txt.split("\n", 2)[-1].replace("\n", " ").split(",")])
    x, y = arr("x"), arr("y")
    X, Y = Transformer.from_crs("EPSG:4326", LCC, always_xy=True).transform(lon, lat)
    return int(np.abs(x - X).argmin()), int(np.abs(y - Y).argmin())


def celle_hoyde(i, j):
    """Høyden (m) til 1 km-cella i MET sin modell. Temperaturene i analysen gjelder denne høyden, ikke løypenes snitthøyde. None hvis oppslaget feiler."""
    try:
        txt = get(f"{ROOT}/metpplatest/met_analysis_1_0km_nordic_latest.nc", f"altitude[{j}:1:{j}][{i}:1:{i}]")
        m = re.search(r"altitude\.altitude\[1\]\[1\]\n\[0\], (\S+)", txt)
        v = float(m.group(1)) if m else None
        return round(v) if v is not None and v == v else None
    except Exception as e:
        print(f"fikk ikke celle-høyde ({e}), bruker --ref-hoyde", file=sys.stderr)
        return None


def fetch_hour(t, i, j):
    q = ",".join(f"{v}[0:1:0][{j}:1:{j}][{i}:1:{i}]" for v in VARS)
    for base in candidates(t):
        try:
            txt = get(base, q)
        except Exception:
            continue
        vals = dict(re.findall(r"^(\w+)\.\1\[1\]\[1\]\[1\]\n\[0\]\[0\], (\S+)", txt, re.M))
        if len(vals) == len(VARS):
            return t, {k: float(v) for k, v in vals.items()}
    return t, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lat", type=float, required=True)
    ap.add_argument("--lon", type=float, required=True)
    ap.add_argument("--days", type=int, default=14)
    ap.add_argument("--sql", help="skriv INSERT-setninger til denne filen")
    ap.add_argument("--json", help="skriv timesverdier som JSON (formatet src/data/vaer-hovden.json)")
    ap.add_argument("--ref-hoyde", type=float, default=838, help="høyde (m) for temperaturene, lagres i JSON")
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--vekst", action="store_true", help="samle data fra nå: nytt punkt starter med de siste 12 timene, og vinduet vokser mot --days (ingen tung første fylling)")
    ap.add_argument("--tidligere", help="JSON fra forrige kjøring: henter bare nye timer og de siste 6 (færre kall mot MET)")
    a = ap.parse_args()

    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    hours = [now - timedelta(hours=h) for h in range(a.days * 24, -1, -1)]
    # Forrige JSON: gir gamle timer, og værcellen kan gjenbrukes (rutenettet endrer seg ikke) så vi sparer referansefil + x/y-kall
    g = {}
    if a.tidligere:
        import json, os
        if os.path.exists(a.tidligere):
            try:
                g = json.load(open(a.tidligere))
            except ValueError:
                g = {}
    if g.get("celle") and g.get("lat") is not None and abs(g["lat"] - a.lat) < 1e-6 and abs(g.get("lon", 0) - a.lon) < 1e-6:
        i, j = g["celle"]
        print(f"gjenbruker rute i={i} j={j}", file=sys.stderr)
    else:
        # referansefil: en nylig time i metpplatest for å finne rutenettet
        ref = None
        for h in range(1, 12):
            c = f"{ROOT}/metpplatest/" + FILE.format(ts=(now - timedelta(hours=h)).strftime("%Y%m%dT%HZ"))
            try:
                get(c, "x[0:1:0]"); ref = c; break
            except Exception:
                continue
        if ref is None:
            sys.exit("fant ingen referansefil")
        i, j = grid_cell(a.lat, a.lon, ref)
        print(f"rute i={i} j={j}", file=sys.stderr)

    gamle = {}
    if g.get("celle") == [i, j]:  # samme værcelle = samme historikk, også om referansehøyden er endret
        gamle = {r[0]: r for r in g["timer"]}
    iso = lambda t: t.strftime("%Y-%m-%dT%H:%M:%SZ")
    if a.vekst:
        # Vinduet starter ved eldste lagrede time (eller 12 timer tilbake for et nytt punkt) og vokser til --days. Hull fylles, eldre historikk hentes ikke.
        eldste = min(gamle) if gamle else iso(now - timedelta(hours=12))
        hours = [t for t in hours if iso(t) >= eldste]
    # Gamle timer beholdes; bare manglende timer og de siste 6 (kan bli revidert) hentes på nytt
    skal_hentes = [t for t in hours if iso(t) not in gamle or t >= now - timedelta(hours=6)]
    print(f"henter {len(skal_hentes)} av {len(hours)} timer", file=sys.stderr)
    with ThreadPoolExecutor(a.workers) as ex:
        res = list(ex.map(lambda t: fetch_hour(t, i, j), skal_hentes))
    ok = [(t, v) for t, v in res if v]
    print(f"hentet {len(ok)} av {len(hours)} timer", file=sys.stderr)
    for t, v in res:
        if not v:
            print("mangler", t.isoformat(), file=sys.stderr)

    if a.json:
        import json
        # Referansehøyde = høyden til værcella (dit temperaturene hører hjemme); motoren korrigerer 0,6 °C per 100 m mot løypa
        ref_h = celle_hoyde(i, j)
        if ref_h is None:
            ref_h = a.ref_hoyde
        timer = [[t.strftime("%Y-%m-%dT%H:%M:%SZ"), round(v["air_temperature_2m"] - 273.15, 2), round(v["precipitation_amount"], 3),
                  round(v["relative_humidity_2m"], 3), round(v["wind_speed_10m"], 2),
                  round(v["integral_of_surface_downwelling_shortwave_flux_in_air_wrt_time"])] for t, v in ok]
        ny = {r[0] for r in timer}
        vindu = {iso(t) for t in hours}
        timer = sorted(timer + [r for k, r in gamle.items() if k in vindu and k not in ny], key=lambda r: r[0])
        if len(timer) < len(hours) * 0.9 or not timer:
            sys.exit(f"for få timer ({len(timer)} av {len(hours)}), skriver ikke {a.json}")
        with open(a.json, "w") as f:
            json.dump({"celle": [i, j], "lat": a.lat, "lon": a.lon, "referansehoyde_m": ref_h,
                       "kolonner": ["ts", "temp_c", "nedbor_mm", "rh", "vind_ms", "sw_j_m2"], "timer": timer}, f, separators=(",", ":"))
        print(f"skrev {len(timer)} timer til {a.json}", file=sys.stderr)

    if a.sql:
        rows = []
        for t, v in ok:
            rows.append("({i},{j},'{ts}',{tc:.2f},{p:.3f},{rh:.3f},{w:.2f},{sw:.0f})".format(
                i=i, j=j, ts=t.strftime("%Y-%m-%d %H:%M:%S+00"),
                tc=v["air_temperature_2m"] - 273.15, p=v["precipitation_amount"],
                rh=v["relative_humidity_2m"], w=v["wind_speed_10m"],
                sw=v["integral_of_surface_downwelling_shortwave_flux_in_air_wrt_time"]))
        with open(a.sql, "w") as f:
            f.write("INSERT INTO weather_hours (cell_i,cell_j,ts,temp_c,precip_mm,rh,wind_ms,sw_j_m2) VALUES\n")
            f.write(",\n".join(rows))
            f.write("\nON CONFLICT (cell_i,cell_j,ts) DO UPDATE SET temp_c=EXCLUDED.temp_c, precip_mm=EXCLUDED.precip_mm, "
                    "rh=EXCLUDED.rh, wind_ms=EXCLUDED.wind_ms, sw_j_m2=EXCLUDED.sw_j_m2;\n")
        print(f"skrev {len(rows)} rader til {a.sql}", file=sys.stderr)


if __name__ == "__main__":
    main()
