#!/usr/bin/env python3
"""Legger løyper valgt i /rutevelger inn i src/data/trails.json (fra OSM eller Turrutebasen).
Henter høyde og skogflagg fra Kartverket (dtm1), setter punktavstand til 50 m og beregner avstand.
Etterpå: hent_terreng.py for de nye løypene, og kontroller-loyper.mjs.

Bruk: python3 -I scripts/importer_valgte.py valgte-loyper.json [--ut src/data/trails.json] [--step 50]
Innfil: {"valgt": [{"kilde", "navn", "id", "type": "retur"|"sloyfe", "biter": [[[lon,lat],...], ...]}]}
- biter kjedes sammen (15 m toleranse; OSM-biter 25 m).
- sloyfe: hull mellom endene lukkes med rett linje hvis hullet er under 600 m, ellers stopper skriptet for den løypa.
- retur: ut og tilbake samme vei."""
import argparse, json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hent_hoyde as hh  # noqa: E402
from pyproj import Transformer  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("fil")
ap.add_argument("--ut", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "data", "trails.json"))
ap.add_argument("--step", type=float, default=50)
a = ap.parse_args()

til_utm = Transformer.from_crs("EPSG:4326", "EPSG:25832", always_xy=True)
til_ll = Transformer.from_crs("EPSG:25832", "EPSG:4326", always_xy=True)
trails = json.load(open(a.ut))
valgt = json.load(open(a.fil))["valgt"]


def lag_id(navn):
    return navn.lower().replace(" ", "-").replace("å", "a").replace("ø", "o").replace("æ", "ae")


for v in valgt:
    navn, typ = v["navn"], v.get("type", "retur")
    biter = [[til_utm.transform(lon, lat) for lon, lat in b] for b in v["biter"] if len(b) > 1]
    if not biter:
        print(f"HOPPER OVER {navn}: ingen biter")
        continue
    tol = 25.0 if v.get("kilde") == "osm" else 15.0
    pts = hh.kjed(biter, tol)
    total = sum(math.dist(p, q) for b in biter for p, q in zip(b, b[1:]))
    brukt = sum(math.dist(p, q) for p, q in zip(pts, pts[1:]))
    if brukt < 0.9 * total:
        print(f"ADVARSEL {navn}: bare {brukt / 1000:.1f} av {total / 1000:.1f} km av bitene henger i én kjede og kommer med. Resten forgrener seg eller henger ikke sammen. Del opp i flere løyper i Rutevelgeren, eller velg færre biter.")
    if typ == "sloyfe":
        gap = math.dist(pts[0], pts[-1])
        if gap > 600:
            print(f"HOPPER OVER {navn}: endene er {gap:.0f} m fra hverandre (maks 600 m for sløyfe). Velg tur-retur eller legg inn koblingen først.")
            continue
        if gap > 1:
            pts = pts + [pts[0]]
    else:
        pts = pts + pts[::-1][1:]
    pr = hh.resample(pts, a.step)
    hs = hh.hoyder(pr)
    dist = [0.0]
    for p, q in zip(pr, pr[1:]):
        dist.append(dist[-1] + math.dist(p, q))
    punkter = []
    for p, h, d in zip(pr, hs, dist):
        lon, lat = til_ll.transform(*p)
        punkter.append([round(lon, 5), round(lat, 5), round(h["z"], 1), round(d), int(h.get("terreng") == "Skog")])
    ny = {"id": v.get("id") or lag_id(navn), "navn": navn, "type": typ, "lengde_m": round(dist[-1]), "punkter": punkter, "kilde": v.get("kilde")}
    trails = [t for t in trails if t["id"] != ny["id"]] + [ny]
    s = math.dist(pr[0], pr[-1])
    print(f"{navn}: {typ}, {dist[-1] / 1000:.1f} km, {min(p[2] for p in punkter):.0f}-{max(p[2] for p in punkter):.0f} moh, start-slutt {s:.0f} m, kilde {v.get('kilde')}")

json.dump(trails, open(a.ut, "w"), ensure_ascii=False)
print("Ferdig. Neste: python3 -I scripts/hent_terreng.py --ut src/data/trails.json --navn \"<navn>\" og node scripts/kontroller-loyper.mjs")
