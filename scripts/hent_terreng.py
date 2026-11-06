#!/usr/bin/env python3
"""Henter terrengdata (hellingsretning, helning, horisont i 16 retninger) langs løyper i src/data/trails.json.

For hvert punkt hver 125. meter langs løypa slås høyden opp (Kartverket dtm1) i en liten sirkel (30 m) og langs 16
retninger ut til 3 km. Resultat per punkt: [avstand_m, hellingsretning_°, helning_°, horisont_°[16]] der horisonten
er høydevinkelen (°) til terrenget i retning 0°, 22,5°, … (0° = nord, medsols). Lagres som `terreng` på hver løype.

Eksempel:
    python3 -I scripts/hent_terreng.py --ut src/data/trails.json            # alle løyper
    python3 -I scripts/hent_terreng.py --ut src/data/trails.json --navn Galten
    python3 -I scripts/hent_terreng.py --ut src/data/trails.json --fortsett      # hopper over løyper som alt har terreng

Fremdrift: filen lagres etter hver ferdige løype (via en midlertidig fil, så den aldri blir halvskrevet), så en avbrutt kjøring
mister bare den løypa den holdt på med. En løype som feiler (etter flere forsøk) beholder gammelt terreng, de andre fortsetter,
og skriptet avslutter med kode 2 og lister hvilke som mangler. Kjør samme kommando med --fortsett for å ta bare dem.
Kallene deles mellom --workers samtidige tråder (delt kø), med valgfri --pause per kall for å være grei mot API-et.
"""
import argparse, json, math, os, sys, threading, time, urllib.error, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pyproj import Transformer

REST = "https://ws.geonorge.no/hoydedata/v1/punkt"
AZ = [i * 22.5 for i in range(16)]
RINGER = [50, 100, 200, 400, 800, 1600, 3000]
STEG = 125


PAUSE = 0.0  # sekunder per kall, settes fra --pause
FORSØK = 5


def hent(chunk):
    q = urllib.parse.urlencode({"punkter": json.dumps([[round(x, 1), round(y, 1)] for x, y in chunk]), "koordsys": 25832})
    for forsøk in range(FORSØK):
        try:
            with urllib.request.urlopen(f"{REST}?{q}", timeout=60) as r:
                z = [p.get("z") for p in json.load(r)["punkter"]]
            if PAUSE:
                time.sleep(PAUSE)
            return z
        except Exception as e:
            if forsøk == FORSØK - 1:
                raise
            # 429/5xx: vent lenge (API-et er overbelastet), ellers kort pause med økende ventetid
            kode = e.code if isinstance(e, urllib.error.HTTPError) else 0
            time.sleep(30 + 30 * forsøk if kode in (429, 502, 503, 504) else 2 * 2**forsøk)


def lagre(data, fil):
    """Atomisk lagring: skriv til midlertidig fil og bytt, så filen aldri blir halvskrevet ved avbrudd."""
    tmp = fil + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, fil)


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
    global PAUSE
    ap = argparse.ArgumentParser()
    ap.add_argument("--ut", required=True)
    ap.add_argument("--navn", action="append")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--pause", type=float, default=0.0, help="sekunder pause per kall i hver tråd")
    ap.add_argument("--fortsett", action="store_true", help="hopp over løyper som alt har terreng")
    a = ap.parse_args()
    PAUSE = a.pause
    data = json.load(open(a.ut))
    til = Transformer.from_crs("EPSG:4326", "EPSG:25832", always_xy=True)
    feilet = []
    for t in data:
        if a.navn and t["navn"] not in a.navn:
            continue
        if a.fortsett and t.get("terreng"):
            continue
        valgt, neste = [], 0
        for p in t["punkter"]:
            if p[3] >= neste:
                valgt.append(p); neste = p[3] + STEG
        sett = [punkter_for(*til.transform(p[0], p[1])) for p in valgt]
        flat = [pt for s in sett for pt in s]
        deler = [flat[i:i + 50] for i in range(0, len(flat), 50)]  # API-et tar maks 50 punkter per kall
        ferdig, lås = [0], threading.Lock()

        def jobb(d):
            z = hent(d)
            with lås:
                ferdig[0] += 1  # teller fullførte (ikke indeks), riktig selv om trådene blir ferdige i ulik rekkefølge
                if ferdig[0] % 40 == 0:
                    print(f'  {t["navn"]}: {ferdig[0]}/{len(deler)} kall', flush=True)
            return z

        try:
            with ThreadPoolExecutor(a.workers) as ex:  # delt kø: hver tråd tar neste kall når den er ferdig
                zflat = [z for del_ in ex.map(jobb, deler) for z in del_]
        except Exception as e:
            print(f'{t["navn"]}: FEILET ({e}), beholder gammelt terreng', flush=True)
            feilet.append(t["navn"])
            continue
        n = len(sett[0])
        zs = [zflat[i * n:(i + 1) * n] for i in range(len(sett))]
        t["terreng"] = [r for r in (tolk(p[3], z) for p, z in zip(valgt, zs)) if r]
        lagre(data, a.ut)  # lagrer etter hver løype
        print(f'{t["navn"]}: {len(t["terreng"])} av {len(valgt)} punkter', flush=True)
    if feilet:
        print("\nFeilet (kjør på nytt med --fortsett):\n  " + "\n  ".join(feilet), file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
