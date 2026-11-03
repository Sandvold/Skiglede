#!/usr/bin/env python3
"""Bygger runder automatisk fra OSM-nettet (ingen manuell plukking).

For hver tur-retur-løype (og de angitte spesialtilfellene) tas veien ut til
vendepunktet fra eksisterende løype, og veien tilbake finnes som korteste vei i
OSM-nettet som unngår veien ut (kantene på veien ut får høy kostnad). Er den
nye runden fornuftig (liten overlapp, ikke urimelig lang) erstattes tur-retur
med runden. Små stikkbiter og Hartevatn (brøytes lite) er ikke med i nettet.

    python3 -I scripts/bygg_osm_runder.py --osm osm-loyper.json --ut src/data/trails.json            # bare rapport
    python3 -I scripts/bygg_osm_runder.py --osm osm-loyper.json --ut src/data/trails.json --skriv    # lagrer, henter høyde

Etterpå: hent_terreng.py for endrede løyper og npm run kontroller.
"""
import argparse, heapq, json, math, os, sys
from pyproj import Transformer

sys.path.insert(0, os.path.dirname(__file__))
import hent_hoyde as hh

TO = Transformer.from_crs("EPSG:4326", "EPSG:25832", always_xy=True)
FRA = Transformer.from_crs("EPSG:25832", "EPSG:4326", always_xy=True)
IGNORER = ("Hartevatn",)
KOBLE_M = 12          # endepunkt nær annen bit kobles til
STRAFF = 8.0          # kostnadsfaktor for kanter som allerede er brukt på veien ut
MAKS_OVERLAPP = 25    # % av runden som får gås to ganger
MAKS_LENGDE = 1.8     # runden maks så mange ganger lengden på veien ut x 2


def lengde(p):
    return sum(math.dist(a, b) for a, b in zip(p, p[1:]))


def last_nett(fil):
    d = json.load(open(fil))["løyper"]
    kanter = []
    for p in d:
        if "backcountry" in (p.get("preparering") or ""):
            continue
        if any(i in (p.get("navn") or "") for i in IGNORER):
            continue
        pts = [TO.transform(*q) for q in p["punkter"]]
        kanter.append(pts)
    return kanter


class Nett:
    def __init__(self, biter):
        self.noder, self.idx, self.adj = [], {}, {}
        for pts in biter:
            ids = [self.node(q) for q in pts]
            for a, b in zip(ids, ids[1:]):
                if a != b:
                    self.kant(a, b)
        self.koble_endepunkter(biter)

    def node(self, q):
        k = (round(q[0] / 3), round(q[1] / 3))  # 3 m rutenett: delte OSM-noder faller sammen
        if k not in self.idx:
            self.idx[k] = len(self.noder)
            self.noder.append(q)
            self.adj[len(self.noder) - 1] = {}
        return self.idx[k]

    def kant(self, a, b):
        L = math.dist(self.noder[a], self.noder[b])
        self.adj[a][b] = self.adj[b][a] = L

    def koble_endepunkter(self, biter):
        ender = {self.node(p[0]) for p in biter} | {self.node(p[-1]) for p in biter}
        for e in ender:
            if len(self.adj[e]) >= 2:
                continue
            best = min((math.dist(self.noder[e], self.noder[n]), n) for n in self.adj if n != e and n not in self.adj[e])
            if best[0] <= KOBLE_M:
                self.kant(e, best[1])

    def nærmeste(self, q):
        return min(range(len(self.noder)), key=lambda i: math.dist(self.noder[i], q))

    def vei(self, fra, til, brukt=None):
        d = {fra: 0.0}
        fra_ = {}
        h = [(0.0, fra)]
        while h:
            c, u = heapq.heappop(h)
            if u == til:
                break
            if c > d.get(u, 1e18):
                continue
            for v, L in self.adj[u].items():
                w = L * (STRAFF if brukt and (min(u, v), max(u, v)) in brukt else 1.0)
                if c + w < d.get(v, 1e18):
                    d[v] = c + w
                    fra_[v] = u
                    heapq.heappush(h, (c + w, v))
        if til not in d:
            return None
        sti = [til]
        while sti[-1] != fra:
            sti.append(fra_[sti[-1]])
        return sti[::-1]


def polylinje(nett, sti):
    return [nett.noder[i] for i in sti]


def overlapp_pct(pts):
    """Andel av runden som ligger innen 20 m av en annen del av runden som er langt unna langs løypa."""
    pr = hh.resample(pts, 20)
    dist = [0.0]
    for a, b in zip(pr, pr[1:]):
        dist.append(dist[-1] + math.dist(a, b))
    n = sum(1 for i, a in enumerate(pr) if any(abs(dist[i] - dist[j]) > 300 and math.dist(a, pr[j]) < 20 for j in range(len(pr))))
    return round(100 * n / len(pr))


def bygg_runde(nett, ut_pts, start_pt):
    """ut_pts: veien ut (UTM) fra start til vendepunkt. Returnerer runde (UTM) eller None."""
    s = nett.nærmeste(start_pt)
    t = nett.nærmeste(ut_pts[-1])
    if math.dist(nett.noder[t], ut_pts[-1]) > 40 or math.dist(nett.noder[s], start_pt) > 40:
        return None, "vendepunkt/start ligger langt fra OSM-nettet"
    ut_sti = nett.vei(s, t)
    if not ut_sti:
        return None, "ingen vei ut i nettet"
    brukt = {(min(a, b), max(a, b)) for a, b in zip(ut_sti, ut_sti[1:])}
    # veien ut beholdes fra den eksisterende løypa; kantene den følger straffes
    pr = hh.resample(ut_pts, 8)
    nær = set()
    for p in pr:
        k = (round(p[0] / 25), round(p[1] / 25))
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                nær.add((k[0] + dx, k[1] + dy))
    for a in nett.adj:
        for b in nett.adj[a]:
            m = ((nett.noder[a][0] + nett.noder[b][0]) / 2, (nett.noder[a][1] + nett.noder[b][1]) / 2)
            if min(math.dist(m, p) for p in pr[:: max(1, len(pr) // 400)]) < 22:
                brukt.add((min(a, b), max(a, b)))
    tilbake = nett.vei(t, s, brukt)
    if not tilbake:
        return None, "ingen vei tilbake"
    runde = list(ut_pts) + polylinje(nett, tilbake)[1:]
    if math.dist(runde[-1], runde[0]) > 1:
        runde.append(runde[0])
    return runde, None


def til_trail(t, runde, step=50):
    pr = hh.resample(runde, step)
    hs = hh.hoyder(pr)
    dist = [0.0]
    for a, b in zip(pr, pr[1:]):
        dist.append(dist[-1] + math.dist(a, b))
    punkter = []
    for p, h, d in zip(pr, hs, dist):
        lon, lat = FRA.transform(*p)
        punkter.append([round(lon, 5), round(lat, 5), round(h["z"], 1), round(d), int(h.get("terreng") == "Skog")])
    nyt = {k: v for k, v in t.items() if k not in ("punkter", "terreng", "overlapp_pct")}
    nyt.update(type="sloyfe", lengde_m=round(dist[-1]), punkter=punkter, overlapp_pct=overlapp_pct(pr), kilde_runde="osm")
    return nyt


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--osm", required=True)
    ap.add_argument("--ut", required=True)
    ap.add_argument("--skriv", action="store_true")
    ap.add_argument("--start", action="append", default=[], help="id=lon,lat (felles startpunkt)")
    ap.add_argument("--kun", action="append", default=[])
    a = ap.parse_args()
    nett = Nett(last_nett(a.osm))
    trails = json.load(open(a.ut))
    start_over = {}
    for s in a.start:
        k, v = s.split("=")
        start_over[k] = TO.transform(*map(float, v.split(",")))
    print(f"nett: {len(nett.noder)} noder")
    endret = []
    for t in trails:
        if a.kun and t["id"] not in a.kun:
            continue
        if t["type"] != "retur" and t["id"] not in start_over:
            continue
        pts = [TO.transform(p[0], p[1]) for p in t["punkter"]]
        if t["type"] == "retur":
            half = pts[: len(pts) // 2 + 1]
        else:  # sløyfe med rette koblinger: vendepunkt = lengst fra start
            i = max(range(len(pts)), key=lambda k: math.dist(pts[0], pts[k]))
            half = pts[: i + 1]
        start = start_over.get(t["id"], pts[0])
        if t["id"] in start_over:
            half = [start] + half
        runde, feil = bygg_runde(nett, half, start)
        if not runde:
            print(f"{t['id']:24s} hopper over: {feil}")
            continue
        L, L0 = lengde(runde), lengde(pts)
        ov = overlapp_pct(runde)
        ok = ov <= MAKS_OVERLAPP and L <= MAKS_LENGDE * L0 * (1 if t["type"] == "retur" else 2)
        print(f"{t['id']:24s} {t['type']:6s} {L0 / 1000:5.1f} km -> runde {L / 1000:5.1f} km, overlapp {ov:3d} %  {'OK' if ok else 'forkastet'}")
        if ok:
            endret.append((t, runde))
    if a.skriv:
        for t, runde in endret:
            nyt = til_trail(t, runde)
            trails = [nyt if x["id"] == t["id"] else x for x in trails]
            print(f"skrev {t['id']}: {nyt['lengde_m']} m, overlapp {nyt['overlapp_pct']} %")
        json.dump(trails, open(a.ut, "w"), ensure_ascii=False, separators=(",", ":"))
        print("endret:", " ".join(f'--navn "{t["navn"]}"' for t, _ in endret))


if __name__ == "__main__":
    main()
