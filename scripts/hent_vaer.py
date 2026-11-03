#!/usr/bin/env python3
"""Henter timesverdier fra MET Nordic Analysis (1 km) for ett punkt via OPeNDAP.

Eksempel (Hovden, siste 14 dager, skriver SQL til fil):
    python3 -I scripts/hent_vaer.py --lat 59.5667 --lon 7.3667 --days 14 --sql hovden_vaer.sql

Enheter i utdata: temp_c (°C), precip_mm (mm/time), rh (0-1), wind_ms (m/s),
sw_j_m2 (J/m² integrert over timen).
"""
import argparse, re, sys, urllib.parse, urllib.request
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


def get(url_base, query):
    url = url_base + ".ascii?" + urllib.parse.quote(query, safe=":,_")
    with urllib.request.urlopen(url, timeout=60) as r:
        return r.read().decode()


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
    ap.add_argument("--workers", type=int, default=8)
    a = ap.parse_args()

    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    hours = [now - timedelta(hours=h) for h in range(a.days * 24, -1, -1)]
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

    with ThreadPoolExecutor(a.workers) as ex:
        res = list(ex.map(lambda t: fetch_hour(t, i, j), hours))
    ok = [(t, v) for t, v in res if v]
    print(f"hentet {len(ok)} av {len(hours)} timer", file=sys.stderr)
    for t, v in res:
        if not v:
            print("mangler", t.isoformat(), file=sys.stderr)

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
