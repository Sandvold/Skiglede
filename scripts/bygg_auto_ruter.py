#!/usr/bin/env python3
"""Lager runder automatisk fra parkeringer/startpunkter i et OSM-nett (brukt for Bærumsmarka).

For hvert startpunkt velges vendepunkt i ulike retninger og avstander (ca. 5, 9 og 14 km ut langs nettet).
Hver runde bygges som i bygg_osm_omrade.py (ut på korteste vei, tilbake på en annen). Vendepunktet får navn
fra OpenStreetMap-stedsnavn (Nominatim) og runden heter «Start – Sted». Runder som ligner hverandre
(over 70 % felles vei) droppes.

    python3 -I scripts/bygg_auto_ruter.py --osm a.json --osm b.json --ut src/data/trails-baerumsmarka.json \
        --start "Fossum=10.6245,59.9605" [--skriv]
"""
import argparse, json, math, os, sys, time, urllib.parse, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import bygg_osm_omrade as bo
import bygg_osm_runder as br
import bygg_lysloyper as bl

TO, FRA = bo.TO, bo.FRA
BANDER = [(2000, 4000), (4000, 7000), (7000, 11000), (11000, 16000)]  # ut-avstand (m) for vendepunkt


def stedsnavn(lonlat, brukt):
    url = "https://nominatim.openstreetmap.org/reverse?" + urllib.parse.urlencode({"lat": lonlat[1], "lon": lonlat[0], "zoom": 15, "format": "jsonv2", "accept-language": "nb"})
    try:
        r = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "skiglede"}), timeout=20))
    except Exception:
        return None
    time.sleep(1.1)
    ad = r.get("address", {})
    for k in ("name",):
        if r.get(k):
            return r[k]
    for k in ("natural", "water", "tourism", "leisure", "neighbourhood", "hamlet", "locality", "suburb", "village", "road"):
        if ad.get(k) and ad[k] not in brukt:
            return ad[k]
    return None


def felles(a, b, tol=25):
    pa = br.hh.resample(a, 50)
    pb = br.hh.resample(b, 50)
    return sum(1 for p in pa if any(math.dist(p, q) < tol for q in pb)) / len(pa)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--osm", action="append", required=True)
    ap.add_argument("--ut", required=True)
    ap.add_argument("--start", action="append", required=True)
    ap.add_argument("--skriv", action="store_true")
    ap.add_argument("--per-start", type=int, default=4)
    a = ap.parse_args()
    nett = bo.Rutenett(bo.last(a.osm, uprep=True))
    valgt = []
    brukt_navn = set()
    for sd in a.start:
        sn, c = sd.split("=")
        q = TO.transform(*map(float, c.split(",")))
        s = nett.nærmeste(q)
        if s is None:
            print(f"{sn}: ingen løype innen 800 m, hopper over")
            continue
        avst = bl.avstander(nett, s)
        komp = bo.komponent(nett, s)
        print(f"{sn}: start {math.dist(nett.noder[s], q):.0f} m fra punktet, nett med {len(komp)} noder")
        kand = []
        for lo, hi in BANDER:
            nodes = [i for i in komp if lo <= avst.get(i, 0) <= hi]
            nodes = nodes[:: max(1, len(nodes) // 40)]
            sc = []
            for t in nodes:
                pts, L, ov = bl.runde(nett, s, t)
                up = 1 - bl.runde.belyst  # andel upreparert/bro
                if ov <= br.MAKS_OVERLAPP and up <= 0.25 and 3000 <= L <= 26000:
                    sc.append((L * (1 - ov / 100) ** 2, pts, L, ov, t))
            sc.sort(key=lambda x: -x[0])
            kand.append(sc[:8])
        tatt = []
        for band in kand:  # én runde per lengdebånd, den beste som ikke ligner de som er valgt
            for sc, pts, L, ov, t in band:
                if any(felles(pts, p2) > 0.7 for _, p2, *_ in tatt):
                    continue
                tatt.append((sc, pts, L, ov, t))
                break
        for sc, pts, L, ov, t in tatt:
            lonlat = FRA.transform(*nett.noder[t])
            navn = stedsnavn(lonlat, brukt_navn | {sn}) or f"punkt {len(valgt) + 1}"
            brukt_navn.add(navn)
            print(f"  {sn} – {navn}: {L / 1000:.1f} km, overlapp {ov} %")
            valgt.append((f"{sn} – {navn}", pts, lonlat))
    if a.skriv:
        eks = json.load(open(a.ut)) if os.path.exists(a.ut) else []
        for navn, pts, mal in valgt:
            t = br.til_trail({"id": bo.id_av(navn), "navn": navn}, pts)
            t.pop("kilde_runde", None)
            t.update(kilde="osm", mal=[round(mal[0], 5), round(mal[1], 5)])
            eks = [e for e in eks if e["id"] != t["id"]] + [t]
        eks.sort(key=lambda e: (e["navn"], bool(e.get("variantAv"))))
        json.dump(eks, open(a.ut, "w"), ensure_ascii=False, separators=(",", ":"))
        print("terreng:", " ".join(f'--navn "{n}"' for n, _, _ in valgt))


if __name__ == "__main__":
    main()
