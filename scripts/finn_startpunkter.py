#!/usr/bin/env python3
"""Velger startpunkter automatisk for et skiområde, til bygg_auto_ruter.py.

Kandidater er stedsnavn av typen hotell, turisthytte, alpinanlegg, idrettsanlegg, hyttefelt og grend (Kartverket) som ligger
nær løypenettet (maks --maks-avstand m). Rangert etter type, deretter valgt grådig med minst --min-avstand m mellom startene.
Skriver argumentene til bygg_auto_ruter.py (--start "Navn=lon,lat").

    python3 -I scripts/finn_startpunkter.py --osm osm.json --steder steder.json [--antall 10] [--min-avstand 3000]
"""
import argparse, json, math, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import bygg_osm_omrade as bo

PRIO = {"Parkering": 1, "Hotell": 0, "Alpinanlegg": 0, "Turisthytte": 1, "Idrettsanlegg": 1, "Hyttefelt": 2, "Grend": 2, "Fjellstue": 0}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--osm", action="append", required=True)
    ap.add_argument("--steder", required=True, help="JSON-liste med {navn, type, lat, lon}")
    ap.add_argument("--antall", type=int, default=10)
    ap.add_argument("--min-avstand", type=float, default=3000)
    ap.add_argument("--maks-avstand", type=float, default=400)
    a = ap.parse_args()
    nett = bo.Rutenett(bo.last(a.osm, uprep=True))
    # Største sammenhengende nett: startpunkter i små, frakoblede biter gir ingen runder
    sett, komp = set(), set()
    for i in range(len(nett.noder)):
        if i not in sett:
            k = set(bo.komponent(nett, i))
            sett |= k
            if len(k) > len(komp):
                komp = k
    kand = []
    for s in json.load(open(a.steder)):
        pr = PRIO.get(s["type"])
        if pr is None:
            continue
        q = bo.TO.transform(s["lon"], s["lat"])
        i = nett.nærmeste(q)
        if i is None or i not in komp:
            continue
        d = math.dist(nett.noder[i], q)
        if d <= a.maks_avstand:
            kand.append((pr, d, s["navn"], s["lon"], s["lat"], q))
    kand.sort()
    valgt = []
    for pr, d, navn, lon, lat, q in kand:
        if any(math.dist(q, v[5]) < a.min_avstand for v in valgt) or any(navn == v[2] for v in valgt):
            continue
        valgt.append((pr, d, navn, lon, lat, q))
        if len(valgt) == a.antall:
            break
    for pr, d, navn, lon, lat, _ in valgt:
        print(f'# {navn} ({int(d)} m fra nettet)', file=sys.stderr)
    print(" ".join(f'--start "{n}={lo:.5f},{la:.5f}"' for _, _, n, lo, la, _ in valgt))


if __name__ == "__main__":
    main()
