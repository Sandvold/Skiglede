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

  # form og startpunkt per løype: navn[:type][:start=ANNEN_LØYPE]
  #   type = auto (standard) | retur | sloyfe
  #   retur  = tur-retur fra laveste ende. sloyfe = lukket runde, hull lukkes via løypenettet.
  #   start=X = felles startpunkt: laveste ende av løype X; sløyfa får et stikk dit og tilbake.
  python3 -I scripts/hent_loyper.py --bbox ... --navn "Lundane:retur" --navn "Galten:sloyfe:start=Lundane" --ut ...

Alle løyper starter og slutter på samme sted: auto velger sløyfe hvis hullet kan lukkes med
under 600 m løype fra nettet, ellers tur-retur fra laveste ende.

Kjent begrensning: Turrutebasen har løypene i biter og mangler ofte preparering.
Kontroller resultatet i kartet i appen før en løype regnes som ferdig.
"""
import argparse, collections, heapq, json, math, os, sys, urllib.parse, urllib.request
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


def les_segmenter(gml):
    ut = []
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
            ut.append((nm, list(zip(v[0::2], v[1::2]))))
    return ut


def lengde(p):
    return sum(math.dist(a, b) for a, b in zip(p, p[1:]))


class Nett:
    """Løypenettet: knutepunkter der endepunkter møtes (15 m), kanter = biter."""

    def __init__(self, segs, tol=15.0):
        self.segs, self.tol, self.noder = segs, tol, []
        self.adj = collections.defaultdict(list)
        for k, (_, p) in enumerate(segs):
            a, b, L = self.node(p[0]), self.node(p[-1]), lengde(p)
            self.adj[a].append((b, L, k, False))
            self.adj[b].append((a, L, k, True))

    def node(self, pt):
        for i, n in enumerate(self.noder):
            if math.dist(n, pt) <= self.tol:
                return i
        self.noder.append(pt)
        return len(self.noder) - 1

    def korteste(self, fra, til):
        """Korteste vei fra knute `fra` til nærmeste i mengden `til`. Returnerer (lengde, knute, polylinje)."""
        d, prev, q = {fra: 0.0}, {}, [(0.0, fra)]
        while q:
            c, u = heapq.heappop(q)
            if c > d.get(u, 1e18):
                continue
            if u in til:
                biter, x = [], u
                while x in prev:
                    px, k, rev = prev[x]
                    g = self.segs[k][1]
                    biter.append(g[::-1] if rev else g)
                    x = px
                lin = []
                for g in biter[::-1]:
                    lin += g if not lin else g[1:]
                return c, u, lin
            for v, L, k, rev in self.adj[u]:
                if c + L < d.get(v, 1e18):
                    d[v] = c + L
                    prev[v] = (u, k, rev)
                    heapq.heappush(q, (c + L, v))
        return None


def laveste_ende(kjede):
    h = hh.hoyder([kjede[0], kjede[-1]])
    return kjede if h[0]["z"] <= h[1]["z"] else kjede[::-1]


def sett_sammen(kjede_navn, nett, gml_segs, type_, start_fra):
    """Returnerer (polylinje i EPSG:25832, type) der start = slutt."""
    kj = hh.kjed([p for nm, p in gml_segs if nm == kjede_navn])
    ende = laveste_ende(kj)
    trailhead = None
    if start_fra:
        tr = hh.kjed([p for nm, p in gml_segs if nm == start_fra])
        trailhead = laveste_ende(tr)[0]
    if type_ == "auto":
        hull = math.dist(kj[0], kj[-1])
        if hull <= nett.tol:
            type_ = "sloyfe"
        else:
            r = nett.korteste(nett.node(kj[0]), {nett.node(kj[-1])})
            type_ = "sloyfe" if r and r[0] <= 600 else "retur"
    if type_ == "retur":
        sti = ende if not trailhead else min([kj, kj[::-1]], key=lambda c: math.dist(c[0], trailhead))
        return sti + sti[::-1][1:], "retur"
    # sløyfe: lukk hullet via nettet
    sl = list(kj)
    if math.dist(kj[0], kj[-1]) > nett.tol:
        r = nett.korteste(nett.node(kj[-1]), {nett.node(kj[0])})
        if not r:
            raise SystemExit(f"{kjede_navn}: finner ikke vei som lukker sløyfa")
        sl += r[2][1:]
    # startpunkt: stikk fra felles start, ellers laveste ende
    if trailhead:
        # mål = knutepunkter i nettet som ligger på sløyfa (også kryss midt i runden, ikke bare endene)
        mal = {i for i, n in enumerate(nett.noder) if nett.adj[i] and min(math.dist(n, v) for v in sl) <= nett.tol}
        r = nett.korteste(nett.node(trailhead), mal)
        if not r:
            raise SystemExit(f"{kjede_navn}: finner ikke vei fra {start_fra}")
        stikk, J = r[2], nett.noder[r[1]]
    else:
        stikk, J = [], ende[0]
    i = min(range(len(sl)), key=lambda k: math.dist(sl[k], J))
    ring = sl[i:] + sl[1:i + 1]
    ring[-1] = ring[0]
    return (stikk + ring[1:] + stikk[::-1][1:]) if stikk else ring, "sloyfe"


def bygg(gml_segs, nett, navn, type_, start_fra, step):
    pts, typ = sett_sammen(navn, nett, gml_segs, type_, start_fra)
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
    return {"id": lag_id(navn), "navn": navn, "type": typ, "lengde_m": round(dist[-1]), "punkter": punkter}


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
        navn += [n for n, L in lengder.items() if L / 1000 >= a.min_km and n and n not in [x.split(":")[0] for x in navn] and not n.startswith("Ukjent")]
    if not navn or not a.ut:
        sys.exit("angi --navn eller --min-km, og --ut")
    eks = json.load(open(a.ut)) if os.path.exists(a.ut) else []
    segs = les_segmenter(gml)
    nett = Nett(segs)
    for spec in navn:
        deler = spec.split(":")
        n = deler[0]
        typ = deler[1] if len(deler) > 1 else "auto"
        start = next((d[6:] for d in deler[2:] if d.startswith("start=")), None)
        t = bygg(segs, nett, n, typ, start, a.step)
        eks = [e for e in eks if e["id"] != t["id"]] + [t]
        hs = [p[2] for p in t["punkter"]]
        ende = math.dist(t["punkter"][0][:2], t["punkter"][-1][:2])
        print(f"{n}: {t['type']}, {t['lengde_m'] / 1000:.1f} km, {min(hs):.0f}-{max(hs):.0f} m, start={t['punkter'][0][2]:.0f} m, avstand start-slutt {ende * 111000:.0f} m")
    eks.sort(key=lambda e: e["navn"])
    json.dump(eks, open(a.ut, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"skrev {len(eks)} løyper til {a.ut}")


if __name__ == "__main__":
    main()
