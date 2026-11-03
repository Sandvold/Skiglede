#!/usr/bin/env python3
"""Henter skiløyper fra Turrutebasen (Kartverket WFS), kjeder bitene, legger på høyde og
skogflagg fra Kartverkets høydedata, og oppdaterer appens løypefil (src/data/trails.json).

  # 1) se hvilke løypenavn som finnes i et område (bbox: sør,vest,nord,øst i WGS84)
  python3 -I scripts/hent_loyper.py --bbox 59.45,7.20,59.70,7.60 --liste

  # 2) legg til/oppdater løyper (kjør igjen for å oppdatere; id = navn uten mellomrom/æøå)
  python3 -I scripts/hent_loyper.py --bbox 59.45,7.20,59.70,7.60 \
      --navn "Storenut" --navn "Galten" --ut src/data/trails.json

  # alle navn med minst 4 km sammenhengende løype
  python3 -I scripts/hent_loyper.py --bbox ... --min-km 4 --ut src/data/trails.json

Kjent begrensning: Turrutebasen har løypene i biter og mangler ofte preparering.
Kontroller resultatet i kartet i appen før en løype regnes som ferdig.
"""
import argparse, collections, json, math, os, sys, urllib.parse, urllib.request
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hent_hoyde as hh  # noqa: E402
from pyproj import Transformer  # noqa: E402

WFS = "https://wfs.geonorge.no/skwms1/wfs.turogfriluftsruter"


def hent_gml(bbox, ut):
    s, w, n, e = bbox
    q = urllib.parse.urlencode({
        "service": "WFS", "version": "2.0.0", "request": "GetFeature", "typeNames": "app:Skiløype",
        "bbox": f"{s},{w},{n},{e},urn:ogc:def:crs:EPSG::4326", "srsName": "urn:ogc:def:crs:EPSG::25832",
    })
    with urllib.request.urlopen(f"{WFS}?{q}", timeout=120) as r:
        data = r.read()
    open(ut, "wb").write(data)


def navneliste(gml):
    lengder, antall = collections.defaultdict(float), collections.Counter()
    for fe in (m for m in ET.parse(gml).getroot().iter() if m.tag.endswith("}Skiløype")):
        nm = pl = None
        for c in fe.iter():
            t = c.tag.split("}")[1]
            if t == "rutenavn":
                nm = c.text
            elif t == "posList":
                pl = c.text
        if pl:
            v = list(map(float, pl.split()))
            p = list(zip(v[0::2], v[1::2]))
            lengder[nm] += sum(math.dist(a, b) for a, b in zip(p, p[1:]))
            antall[nm] += 1
    return lengder, antall


def lag_id(navn):
    return navn.lower().replace(" ", "-").replace("å", "a").replace("ø", "o").replace("æ", "ae")


def bygg(gml, navn, step, utdelt):
    pts, ref = hh.lengste_segment(gml, navn)
    pr = hh.resample(pts, step)
    hs = hh.hoyder(pr)
    z = [p["z"] for p in hs]
    skog = [p.get("terreng") == "Skog" for p in hs]
    dist = [0.0]
    for a, b in zip(pr, pr[1:]):
        dist.append(dist[-1] + math.dist(a, b))
    to = Transformer.from_crs("EPSG:25832", "EPSG:4326", always_xy=True)
    punkter = []
    for p, h, d, k in zip(pr, z, dist, skog):
        lon, lat = to.transform(*p)
        punkter.append([round(lon, 5), round(lat, 5), round(h, 1), round(d), int(k)])
    return {"id": lag_id(navn), "navn": navn, "ref": ref, "lengde_m": round(dist[-1]), "punkter": punkter}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bbox", help="sør,vest,nord,øst (WGS84)")
    ap.add_argument("--gml", help="bruk en lagret GML (EPSG:25832) i stedet for å hente")
    ap.add_argument("--liste", action="store_true", help="skriv ut navn og lengder og avslutt")
    ap.add_argument("--navn", action="append", default=[])
    ap.add_argument("--min-km", type=float, help="ta med alle navn med minst så mange km")
    ap.add_argument("--step", type=float, default=50, help="punktavstand i meter")
    ap.add_argument("--ut", help="løypefil som oppdateres, f.eks. src/data/trails.json")
    a = ap.parse_args()

    gml = a.gml
    if not gml:
        if not a.bbox:
            sys.exit("trenger --bbox eller --gml")
        gml = "/tmp/turrutebasen_skiloype.gml"
        hent_gml([float(x) for x in a.bbox.split(",")], gml)
    lengder, antall = navneliste(gml)
    if a.liste:
        for n, L in sorted(lengder.items(), key=lambda x: -x[1]):
            print(f"{L / 1000:6.1f} km  {antall[n]:3d} biter  {n}")
        return
    navn = list(a.navn)
    if a.min_km:
        navn += [n for n, L in lengder.items() if L / 1000 >= a.min_km and n and n not in navn and not n.startswith("Ukjent")]
    if not navn or not a.ut:
        sys.exit("angi --navn eller --min-km, og --ut")
    eks = json.load(open(a.ut)) if os.path.exists(a.ut) else []
    for n in navn:
        t = bygg(gml, n, a.step, None)
        eks = [e for e in eks if e["id"] != t["id"]] + [t]
        hs = [p[2] for p in t["punkter"]]
        print(f"{n}: {t['lengde_m'] / 1000:.1f} km, {min(hs):.0f}-{max(hs):.0f} m, {len(t['punkter'])} punkter")
    eks.sort(key=lambda e: e["navn"])
    json.dump(eks, open(a.ut, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"skrev {len(eks)} løyper til {a.ut}")


if __name__ == "__main__":
    main()
