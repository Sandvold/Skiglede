#!/usr/bin/env python3
"""Henter terrengdata (hellingsretning, helning, horisont i 16 retninger) langs løyper i src/data/trails.json.

For hvert punkt hver 125. meter langs løypa slås høyden opp (Kartverket dtm1) i en liten sirkel (30 m) og langs 16
retninger ut til 3 km. Resultat per punkt: [avstand_m, hellingsretning_°, helning_°, horisont_°[16]] der horisonten
er høydevinkelen (°) til terrenget i retning 0°, 22,5°, … (0° = nord, medsols). Lagres som `terreng` på hver løype.

Eksempel:
    python3 -I scripts/hent_terreng.py --ut src/data/trails.json            # alle løyper
    python3 -I scripts/hent_terreng.py --ut src/data/trails.json --navn Galten
"""
import argparse, json, math, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pyproj import Transformer

REST = "https://ws.geonorge.no/hoydedata/v1/punkt"
AZ = [i * 22.5 for i in range(16)]
RINGER = [50, 100, 200, 400, 800, 1600, 3000]
STEG = 125


def hent(chunk):
    q = urllib.parse.urlencode({"punkter": json.dumps([[round(x, 1), round(y, 1)] for x, y in chunk]), "koordsys": 25832})
    for forsøk in range(3):
        try:
            with urllib.request.urlopen(f"{REST}?{q}", timeout=60) as r:
                return [p.get("z") for p in json.load(r)["punkter"]]
        except Exception:
            if forsøk == 2:
                raise


def punkter_for(x, y):
    """Sentrum, fire punkter 30 m unna (N, Ø, S, V), så ringene i 16 retninger."""
    pts = [(x, y), (x, y + 30), (x + 30, y), (x, y - 30), (x - 30, y)]
    for a in AZ:
        for r in RINGER:
            pts.append((x + r * math.sin(math.radians(a)), y + r * math.cos(math.radians(a))))
    return pts


def tolk(d, z):
    z0, zn, zo, zs, zv = z[:5]
    if None in (z0, zn, zo, zs, zv):
        return None
    dzdx, dzdy = (zo - zv) / 60, (zn - zs) / 60
    helning = math.degrees(math.atan(math.hypot(dzdx, dzdy)))
    retning = (math.degrees(math.atan2(-dzdx, -dzdy)) + 360) % 360  # peker nedover skråningen = hellingsretning
    hor, k = [], 5
    for _ in AZ:
        vinkel = 0.0
        for r in RINGER:
            zz = z[k]; k += 1
            if zz is not None:
                vinkel = max(vinkel, math.degrees(math.atan2(zz - z0, r)))
        hor.append(round(vinkel, 1))
    return [round(d), round(retning), round(helning, 1), hor]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ut", required=True)
    ap.add_argument("--navn", action="append")
    ap.add_argument("--workers", type=int, default=6)
    a = ap.parse_args()
    data = json.load(open(a.ut))
    til = Transformer.from_crs("EPSG:4326", "EPSG:25832", always_xy=True)
    for t in data:
        if a.navn and t["navn"] not in a.navn:
            continue
        valgt, neste = [], 0
        for p in t["punkter"]:
            if p[3] >= neste:
                valgt.append(p); neste = p[3] + STEG
        sett = [punkter_for(*til.transform(p[0], p[1])) for p in valgt]
        flat = [pt for s in sett for pt in s]
        deler = [flat[i:i + 50] for i in range(0, len(flat), 50)]  # API-et tar maks 50 punkter per kall
        with ThreadPoolExecutor(a.workers) as ex:
            zflat = [z for del_ in ex.map(hent, deler) for z in del_]
        n = len(sett[0])
        zs = [zflat[i * n:(i + 1) * n] for i in range(len(sett))]
        t["terreng"] = [r for r in (tolk(p[3], z) for p, z in zip(valgt, zs)) if r]
        print(f'{t["navn"]}: {len(t["terreng"])} av {len(valgt)} punkter', flush=True)
    json.dump(data, open(a.ut, "w"), ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
