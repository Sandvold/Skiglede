#!/usr/bin/env python3
"""Lager tur-retur-løyper til turisthytter (type «retur»): en tur til en hytte trenger ikke å være en runde.

For hver turisthytte nær nettet (maks --maks-avstand m) tas korteste vei fra nærmeste av startpunktene som gir en tur på
--min-km til --maks-km (en vei), og turen går samme vei tilbake. Tar de samme --start-argumentene som bygg_auto_ruter.py.

    python3 -I scripts/bygg_hytteturer.py --osm osm.json --steder steder.json --ut src/data/trails-x.json --start "Navn=lon,lat" … [--skriv]
"""
import argparse, json, math, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import bygg_osm_omrade as bo
import bygg_osm_runder as br
import bygg_auto_ruter as ba


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--osm", action="append", required=True)
    ap.add_argument("--steder", required=True)
    ap.add_argument("--ut", required=True)
    ap.add_argument("--start", action="append", required=True)
    ap.add_argument("--min-km", type=float, default=2.5, help="minste lengde én vei")
    ap.add_argument("--maks-km", type=float, default=12.5, help="lengste én vei (tur-retur blir det dobbelte)")
    ap.add_argument("--maks-avstand", type=float, default=300)
    ap.add_argument("--skriv", action="store_true")
    a = ap.parse_args()
    bo.Rutenett.min_noder = 30  # som i bygg_auto_ruter: standard 300 kaster små nett (lysløyper rundt tettsteder)
    nett = bo.Rutenett(bo.last(a.osm, uprep=True))
    starter = []
    for sd in a.start:
        sn, c = sd.split("=")
        i = nett.nærmeste(bo.TO.transform(*map(float, c.split(","))))
        if i is not None:
            starter.append((sn, i))
    funnet = []
    for h in json.load(open(a.steder)):
        if h["type"] != "Turisthytte":
            continue
        q = bo.TO.transform(h["lon"], h["lat"])
        t = nett.nærmeste(q)
        if t is None or math.dist(nett.noder[t], q) > a.maks_avstand:
            continue
        best = None
        for sn, s in starter:
            sti = nett.vei(s, t)
            if not sti:
                continue
            ut = br.polylinje(nett, sti)
            L = br.lengde(ut) / 1000
            if a.min_km <= L <= a.maks_km and (best is None or L < best[0]) and nett.andel_uprep(sti) <= 0.15:
                best = (L, sn, ut)
        if best:
            L, sn, ut = best
            print(f"{sn} – {h['navn']}: {L:.1f} km hver vei ({2 * L:.1f} km tur-retur)")
            funnet.append((f"{sn} – {h['navn']}", ut + ut[::-1][1:]))
    if a.skriv:
        eks = json.load(open(a.ut)) if os.path.exists(a.ut) else []
        ids = {e["id"] for e in eks}
        for navn, pts in funnet:
            t = br.til_trail({"id": bo.id_av(navn), "navn": navn}, pts)
            t.pop("kilde_runde", None)
            t.update(type="retur", kilde="osm")
            t.pop("overlapp_pct", None)
            if t["id"] in ids:
                continue
            eks.append(t)
        eks.sort(key=lambda e: (e["navn"], bool(e.get("variantAv"))))
        json.dump(eks, open(a.ut, "w"), ensure_ascii=False, separators=(",", ":"))
        print("terreng:", " ".join(f'--navn "{n}"' for n, _ in funnet))


if __name__ == "__main__":
    main()
