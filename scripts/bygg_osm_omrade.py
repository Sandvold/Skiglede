#!/usr/bin/env python3
"""Bygger runder for et helt område fra OSM, uten eksisterende løyper (brukt for Oslo).

Nettet er alle preparerte OSM-biter (classic/skating/lysløype; uten backcountry og scooter).
For hvert par (start, mål) tas korteste vei ut og korteste vei tilbake som unngår veien ut.
Runder med for stor overlapp eller utenfor lengdeområdet forkastes. Løypa får navn «Start – Mål».

    python3 -I scripts/bygg_osm_omrade.py --osm a.json --osm b.json --ut src/data/trails-oslo.json \
        --start "Sognsvann=10.729,59.9733" --mal "Ullevålseter=10.7113,60.0094" [--skriv]

Etterpå: hent_terreng.py for hver løype og npm run kontroller.
"""
import argparse, json, math, os, sys, unicodedata
from pyproj import Transformer

sys.path.insert(0, os.path.dirname(__file__))
import hent_hoyde as hh
import bygg_osm_runder as br

TO, FRA = br.TO, br.FRA
MIN_KM, MAKS_KM = 5.0, 25.0
UPREP_FAKTOR = 4.0     # upreparerte biter brukes bare når det ikke finnes preparert vei
MAKS_UPREP = 0.15      # maks andel upreparert i en runde


def last(filer, uprep=False):
    biter = []
    sett = set()
    for f in filer:
        for p in json.load(open(f))["løyper"]:
            pr = p.get("preparering") or ""
            # eldre filer ga alle medlemmer i en relasjon samme osm-id: nøkkelen inkluderer derfor start og lengde
            nøkkel = (p["osm"], tuple(p["punkter"][0]), tuple(p["punkter"][-1]), p["lengde_m"])
            if "backcountry" in pr or "scooter" in pr or nøkkel in sett:
                continue
            if not pr and not (uprep and p["lengde_m"] >= 150):
                continue
            sett.add(nøkkel)
            biter.append(([TO.transform(*q) for q in p["punkter"]], not pr))
    return biter


class Rutenett(br.Nett):
    """Som Nett, men med romlig indeks (nettet har titusenvis av noder)."""

    def __init__(self, biter):
        self.noder, self.idx, self.adj = [], {}, {}
        self.uprep = set()
        for pts, ikke_prep in biter:
            ids = [self.node(q) for q in pts]
            for a, b in zip(ids, ids[1:]):
                if a != b:
                    self.kant(a, b)
                    if ikke_prep:
                        self.uprep.add((min(a, b), max(a, b)))
        self.rutenett, self.skjult = {}, set()
        for i, q in enumerate(self.noder):
            self.rutenett.setdefault((int(q[0] // 50), int(q[1] // 50)), []).append(i)
        for e in [i for i in self.adj if len(self.adj[i]) == 1]:
            best = self.nær(self.noder[e], self.koble_m, utenom={e} | set(self.adj[e]))
            if best is not None:
                self.kant(e, best)
        self.fjern_smaa()
        self.bygg_broer()

    min_noder = 300
    bro_m = 350  # hull mellom nett som kobles (som upreparert strekk, dyrt å bruke)
    koble_m = br.KOBLE_M

    def fjern_smaa(self, min_noder=None):
        min_noder = self.min_noder if min_noder is None else min_noder
        """Dropper løse biter som ikke henger sammen med et større nett."""
        sett = set()
        for i in self.adj:
            if i in sett:
                continue
            k = komponent(self, i)
            sett |= k
            if len(k) < min_noder:
                for n in k:
                    self.rutenett[(int(self.noder[n][0] // 50), int(self.noder[n][1] // 50))].remove(n)
                    for v in list(self.adj[n]):
                        del self.adj[v][n]
                    self.adj[n] = {}
                    self.skjult.add(n)

    def bygg_broer(self):
        """OSM har ofte hull mellom løypenett (tagging, veikryssinger). Kobler nærmeste noder i ulike nett hvis de er innen bro_m."""
        gjenstår, komp = set(i for i in self.adj if i not in self.skjult), []
        while gjenstår:
            k = komponent(self, next(iter(gjenstår)))
            gjenstår -= k
            komp.append(k)
        komp.sort(key=len)
        for k in komp[:-1]:
            best = None
            for i in list(k)[:: max(1, len(k) // 400)]:
                n = self.nær(self.noder[i], self.bro_m, utenom=k | self.skjult)
                if n is not None:
                    d = math.dist(self.noder[i], self.noder[n])
                    if best is None or d < best[0]:
                        best = (d, i, n)
            if best:
                self.kant(best[1], best[2])
                self.uprep.add((min(best[1], best[2]), max(best[1], best[2])))

    def vei(self, fra, til, brukt=None):
        import heapq
        d, forrige, h = {fra: 0.0}, {}, [(0.0, fra)]
        while h:
            c, u = heapq.heappop(h)
            if u == til:
                break
            if c > d.get(u, 1e18):
                continue
            for v, L in self.adj[u].items():
                k = (min(u, v), max(u, v))
                w = L * (br.STRAFF if brukt and k in brukt else 1.0) * (UPREP_FAKTOR if k in self.uprep else 1.0)
                if c + w < d.get(v, 1e18):
                    d[v], forrige[v] = c + w, u
                    heapq.heappush(h, (c + w, v))
        if til not in d:
            return None
        sti = [til]
        while sti[-1] != fra:
            sti.append(forrige[sti[-1]])
        return sti[::-1]

    def andel_uprep(self, sti):
        tot = sum(self.adj[a][b] for a, b in zip(sti, sti[1:])) or 1
        return sum(self.adj[a][b] for a, b in zip(sti, sti[1:]) if (min(a, b), max(a, b)) in self.uprep) / tot

    def nær(self, q, r, utenom=()):
        k = (int(q[0] // 50), int(q[1] // 50))
        rr = int(r // 50) + 1
        best = None
        for dx in range(-rr, rr + 1):
            for dy in range(-rr, rr + 1):
                for i in self.rutenett.get((k[0] + dx, k[1] + dy), ()):
                    if i in utenom:
                        continue
                    d = math.dist(self.noder[i], q)
                    if d <= r and (best is None or d < best[0]):
                        best = (d, i)
        return best[1] if best else None

    def nærmeste(self, q):
        for r in (50, 150, 400, 800):
            n = self.nær(q, r)
            if n is not None:
                return n
        return None


def komponent(nett, s):
    sett, kø = {s}, [s]
    while kø:
        u = kø.pop()
        for v in nett.adj[u]:
            if v not in sett:
                sett.add(v)
                kø.append(v)
    return sett


def id_av(navn):
    s = unicodedata.normalize("NFKD", navn.lower().replace("ø", "o").replace("å", "a").replace("æ", "ae"))
    s = "".join(c if c.isalnum() else "-" for c in s if ord(c) < 128)
    return "-".join(x for x in s.split("-") if x)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--osm", action="append", required=True)
    ap.add_argument("--ut", required=True)
    ap.add_argument("--start", action="append", required=True, help="Navn=lon,lat")
    ap.add_argument("--mal", action="append", required=True, help="Navn=lon,lat")
    ap.add_argument("--par", action="append", default=[], help="Start>Mål: bare disse parene")
    ap.add_argument("--maks-km", type=float, default=MAKS_KM)
    ap.add_argument("--skriv", action="store_true")
    a = ap.parse_args()
    nett = Rutenett(last(a.osm, uprep=True))
    print(f"nett: {len(nett.noder)} noder")
    pt = lambda s: (s.split("=")[0], TO.transform(*map(float, s.split("=")[1].split(","))))
    starter, maal = [pt(s) for s in a.start], [pt(s) for s in a.mal]
    noder = {}
    for n, q in starter + maal:
        i = nett.nærmeste(q)
        noder[n] = i
        print(f"  {n:16s} nærmeste løype {math.dist(nett.noder[i], q) if i is not None else float('nan'):.0f} m, del av nett med {len(komponent(nett, i)) if i is not None else 0} noder")
    funnet = []
    for sn, _ in starter:
        for mn, _ in maal:
            if sn == mn or (a.par and f"{sn}>{mn}" not in a.par):
                continue
            s, t = noder.get(sn), noder.get(mn)
            if s is None or t is None:
                continue
            ut = nett.vei(s, t)
            if not ut:
                print(f"{sn} – {mn}: ingen vei")
                continue
            brukt = {(min(x, y), max(x, y)) for x, y in zip(ut, ut[1:])}
            tilbake = nett.vei(t, s, brukt)
            runde = br.polylinje(nett, ut) + br.polylinje(nett, tilbake)[1:]
            L, ov = br.lengde(runde) / 1000, br.overlapp_pct(runde)
            up = nett.andel_uprep(ut) * len(ut) / (len(ut) + len(tilbake)) + nett.andel_uprep(tilbake) * len(tilbake) / (len(ut) + len(tilbake))
            ok = MIN_KM <= L <= a.maks_km and ov <= br.MAKS_OVERLAPP and up <= MAKS_UPREP
            print(f"{sn} – {mn}: {L:5.1f} km, overlapp {ov:3d} %, upreparert ca. {up * 100:.0f} %  {'OK' if ok else 'forkastet'}")
            if ok:
                funnet.append((sn, mn, runde))
    if a.skriv:
        eks = json.load(open(a.ut)) if os.path.exists(a.ut) else []
        for sn, mn, runde in funnet:
            navn = f"{sn} – {mn}"
            t = br.til_trail({"id": id_av(navn), "navn": navn}, runde)
            t.pop("kilde_runde", None)
            t["kilde"] = "osm"
            eks = [e for e in eks if e["id"] != t["id"]] + [t]
            print(f"skrev {navn}: {t['lengde_m']} m, overlapp {t['overlapp_pct']} %")
        eks.sort(key=lambda e: e["navn"])
        json.dump(eks, open(a.ut, "w"), ensure_ascii=False, separators=(",", ":"))
        print("terreng:", " ".join(f'--navn "{f[0]} – {f[1]}"' for f in funnet))


if __name__ == "__main__":
    main()
