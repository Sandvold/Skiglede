#!/usr/bin/env python3
"""Gir løypene navn fra Turrutebasen (Kartverket, CC BY 4.0) der løypa følger en navngitt skiløype.

For hver løype i filene: punkter hver 50. meter slås opp mot Turrutebasens skiløyper (innen --avstand m). Navnet
som dekker minst halvparten av løypa (--min-andel) blir løypas navn. Dekker to navn til sammen minst 60 % (og begge
minst 20 %), blir det «A / B». Ellers beholdes dagens navn. Id-er endres aldri. Like navn i samme fil får « via <sted>»
fra det gamle navnet («Start – Sted»), ellers (2), (3).

    python -X utf8 scripts/navn_fra_turrutebasen.py src/data/trails-longum.json [flere filer] [--skriv]
    python -X utf8 scripts/navn_fra_turrutebasen.py --alle [--skriv]       # alle src/data/trails-*.json utenom låste områder

Turrutebasen hentes per fil (WFS) og lagres i scripts/ut/turrutebasen/ så den ikke hentes på nytt.
"""
import argparse, collections, glob, json, math, os, sys, urllib.parse, urllib.request
import xml.etree.ElementTree as ET

import numpy as np
from pyproj import Transformer
from scipy.spatial import cKDTree

HER = os.path.dirname(os.path.abspath(__file__))
ROT = os.path.join(HER, "..")
sys.path.insert(0, HER)
import hent_hoyde as hh  # noqa: E402

WFS = "https://wfs.geonorge.no/skwms1/wfs.turogfriluftsruter"
TO = Transformer.from_crs(4326, 25832, always_xy=True)
UTEN_NAVN = {"ukjent", "ukjend", "ikke navngitt", "uten navn", "-"}  # Turrutebasen bruker disse når navn mangler
GENERISK = {"lysløype", "lysløyper", "skiløype", "skiløyper", "løype", "løyper", "turløype", "skitur", "skispor"}  # får startstedet foran
LÅSTE = {"trails-baerumsmarka.json", "trails-nordmarka.json", "trails-sjusjoen.json", "trails.json"}  # bygget med Turrutebasen fra før


def hent_gml(bbox, ut):
    s, w, n, e = bbox
    q = urllib.parse.urlencode({
        "service": "WFS", "version": "2.0.0", "request": "GetFeature", "typeNames": "app:Skiløype",
        "bbox": f"{s},{w},{n},{e},urn:ogc:def:crs:EPSG::4326", "srsName": "urn:ogc:def:crs:EPSG::25832",
    })
    for forsøk in range(3):
        try:
            with urllib.request.urlopen(f"{WFS}?{q}", timeout=120) as r:
                data = r.read()
            os.makedirs(os.path.dirname(ut), exist_ok=True)
            open(ut, "wb").write(data)
            return True
        except Exception as e:  # noqa: BLE001
            print(f"  (henting feilet: {e}; forsøk {forsøk + 1})", file=sys.stderr)
    return False


def les_segmenter(gml):
    ut = []
    for fe in (m for m in ET.parse(gml).getroot().iter() if m.tag.endswith("}Skiløype")):
        nm = pl = None
        for c in fe.iter():
            t = c.tag.split("}")[1]
            if t == "rutenavn":
                nm = (c.text or "").strip() or None
            elif t == "posList":
                pl = c.text
        if pl:
            v = list(map(float, pl.split()))
            ut.append((nm, list(zip(v[0::2], v[1::2]))))
    return ut


def indeks(segs):
    pts, navn = [], []
    for nm, p in segs:
        if not nm or nm.lower() in UTEN_NAVN or len(p) < 2:
            continue
        for q in hh.resample(p, 10):
            pts.append(q)
            navn.append(nm)
    return (cKDTree(np.array(pts)), navn) if pts else (None, [])


def gi(n, trail):
    """Generiske navn («Lysløype») får startstedet foran: «Lysløype Lundseter fjellstove»."""
    if n.lower() in GENERISK and " – " in trail["navn"]:
        return f"{n} {trail['navn'].split(' – ')[0]}"
    return n


def foreslå(trail, tre, navn, avstand, min_andel):
    pr = hh.resample([TO.transform(p[0], p[1]) for p in trail["punkter"]], 50)
    d, i = tre.query(np.array(pr), distance_upper_bound=avstand)
    tell = collections.Counter(navn[k] for dd, k in zip(d, i) if math.isfinite(dd))
    if not tell:
        return None, {}
    andel = {n: c / len(pr) for n, c in tell.most_common()}
    (n1, s1), *rest = list(andel.items())
    if s1 >= min_andel:
        return gi(n1, trail), andel
    if rest and rest[0][1] >= 0.2 and s1 >= 0.2 and s1 + rest[0][1] >= 0.6:
        return f"{n1} / {rest[0][0]}", andel
    return None, andel


def behandle(fil, a):
    trails = json.load(open(fil, encoding="utf-8"))
    if not isinstance(trails, list) or not trails or "punkter" not in trails[0]:
        return None
    lo = [p[0] for t in trails for p in t["punkter"]]
    la = [p[1] for t in trails for p in t["punkter"]]
    m = 0.02
    bbox = (min(la) - m, min(lo) - m, max(la) + m, max(lo) + m)
    gml = os.path.join(a.cache, os.path.basename(fil).replace(".json", ".gml"))
    if not os.path.exists(gml) and not hent_gml(bbox, gml):
        print(f"{os.path.basename(fil)}: kunne ikke hente Turrutebasen, hopper over")
        return None
    segs = les_segmenter(gml)
    tre, navn = indeks(segs)
    n_navngitte = len({nm for nm, _ in segs if nm})
    if tre is None:
        print(f"{os.path.basename(fil)}: Turrutebasen har ingen navngitte skiløyper her ({len(segs)} biter uten navn), navn beholdes")
        return dict(fil=fil, endret=0, totalt=len(trails))
    nye = {}
    for t in trails:
        forslag, _ = foreslå(t, tre, navn, a.avstand, a.min_andel)
        if forslag and forslag != t["navn"]:
            nye[t["id"]] = forslag
    # unike navn i filen
    brukt = collections.Counter(nye.get(t["id"], t["navn"]) for t in trails)
    for t in trails:
        n = nye.get(t["id"])
        if n and brukt[n] > 1:
            sted = t["navn"].split(" – ")[-1] if " – " in t["navn"] else None
            nye[t["id"]] = f"{n} via {sted}" if sted and sted != n else n
    sett = collections.Counter()
    for t in trails:
        n = nye.get(t["id"])
        if not n:
            continue
        sett[n] += 1
        if sett[n] > 1:
            nye[t["id"]] = f"{n} ({sett[n]})"
    for t in trails:
        if t["id"] in nye:
            t["_gammelt"] = t["navn"]
            t["navn"] = nye[t["id"]]
    endret = [(t["_gammelt"], t["navn"]) for t in trails if "_gammelt" in t]
    for t in trails:
        t.pop("_gammelt", None)
    print(f"{os.path.basename(fil)}: {len(endret)} av {len(trails)} løyper fikk navn fra Turrutebasen ({n_navngitte} navngitte løyper i nærheten)")
    for g, n in endret[: a.vis]:
        print(f"    {g}  →  {n}")
    if a.skriv and endret:
        json.dump(trails, open(fil, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    return dict(fil=fil, endret=len(endret), totalt=len(trails))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("filer", nargs="*")
    ap.add_argument("--alle", action="store_true")
    ap.add_argument("--skriv", action="store_true")
    ap.add_argument("--avstand", type=float, default=25)
    ap.add_argument("--min-andel", type=float, default=0.5)
    ap.add_argument("--vis", type=int, default=6)
    ap.add_argument("--cache", default=os.path.join(ROT, "scripts", "ut", "turrutebasen"))
    a = ap.parse_args()
    filer = a.filer
    if a.alle:
        filer = sorted(f for f in glob.glob(os.path.join(ROT, "src", "data", "trails-*.json")) if os.path.basename(f) not in LÅSTE)
    if not filer:
        ap.error("oppgi filer eller --alle")
    res = [r for r in (behandle(f, a) for f in filer) if r]
    print(f"\nTotalt: {sum(r['endret'] for r in res)} av {sum(r['totalt'] for r in res)} løyper i {len(res)} filer fikk nytt navn" + ("" if a.skriv else " (ingenting skrevet, bruk --skriv)"))


if __name__ == "__main__":
    main()
