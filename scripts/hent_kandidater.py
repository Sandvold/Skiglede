#!/usr/bin/env python3
"""Henter alle skiløyper fra Turrutebasen (Kartverket) i et område som kandidater til /rutevelger.
Skriver src/data/kandidater-turrutebasen.json: [{kilde, navn, lengde_m, biter: [[[lon,lat],...], ...]}], én rad per navn.
Bruk: python3 -I scripts/hent_kandidater.py [--bbox sør,vest,nord,øst]"""
import argparse, collections, json, math, os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hent_loyper as hl  # noqa: E402
from pyproj import Transformer  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--bbox", default="59.45,7.15,59.70,7.55")
ap.add_argument("--ut", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "data", "kandidater-turrutebasen.json"))
a = ap.parse_args()
bbox = [float(x) for x in a.bbox.split(",")]
gml = os.path.join(tempfile.mkdtemp(), "k.gml")
hl.hent_gml(bbox, gml)
til = Transformer.from_crs("EPSG:25832", "EPSG:4326", always_xy=True)
per = collections.defaultdict(list)
for navn, pts in hl.les_segmenter(gml):
    per[navn or "Ukjent"].append([[round(x, 5), round(y, 5)] for x, y in (til.transform(*p) for p in pts)])
rader = []
for navn, biter in sorted(per.items()):
    L = sum(hl.lengde([Transformer.from_crs("EPSG:4326", "EPSG:25832", always_xy=True).transform(*p) for p in b]) for b in biter)
    rader.append({"kilde": "turrutebasen", "navn": navn, "lengde_m": round(L), "biter": biter})
json.dump({"bbox": bbox, "kilde": "Turrutebasen, Kartverket (CC BY 4.0)", "kandidater": rader}, open(a.ut, "w"), ensure_ascii=False, separators=(",", ":"))
print(len(rader), "navn,", sum(len(r["biter"]) for r in rader), "biter ->", a.ut, f"({os.path.getsize(a.ut) // 1024} kB)")
for r in sorted(rader, key=lambda r: -r["lengde_m"])[:25]:
    print(f"{r['lengde_m'] / 1000:6.1f} km  {r['navn']}")
