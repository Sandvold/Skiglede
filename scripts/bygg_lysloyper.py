#!/usr/bin/env python3
"""Legger inn lysløyper (OSM lit=yes) og navngitte soner i Oslo som egne runder.

- Lysløype-klynger (sammenhengende belyste biter): en sløyfe gjennom klyngen fra et startpunkt.
- Konkurranseløypa: alt preparert syd for Frognerseteren mot Holmenkollen.
- Sprintløype: nettet ved Holmenkollen stadion, ca. 3 km.
Runden = korteste vei ut til et fjernt punkt og tilbake på en annen vei (som bygg_osm_omrade.py).

    python3 -I scripts/bygg_lysloyper.py --osm fil.json --ut src/data/trails-oslo.json [--skriv]
"""
import argparse, heapq, json, math, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import bygg_osm_omrade as bo
import bygg_osm_runder as br

TO = bo.TO
STADION = (10.6665, 59.9645)
FROGN = (10.6766, 59.9791)


class Lite(bo.Rutenett):
    min_noder = 30
    koble_m = 45  # belyste biter har ofte små hull i OSM


def stykker(filer, filter_, straff=lambda p, pr: not pr):
    out, sett = [], set()
    for f in filer:
        for p in json.load(open(f))["løyper"]:
            pr = p.get("preparering") or ""
            nøkkel = (p["osm"], tuple(p["punkter"][0]), tuple(p["punkter"][-1]), p["lengde_m"])
            if "backcountry" in pr or "scooter" in pr or nøkkel in sett or not filter_(p, pr):
                continue
            sett.add(nøkkel)
            out.append(([TO.transform(*q) for q in p["punkter"]], straff(p, pr)))
    return out


def avstander(nett, s):
    d, h = {s: 0.0}, [(0.0, s)]
    while h:
        c, u = heapq.heappop(h)
        if c > d[u]:
            continue
        for v, L in nett.adj[u].items():
            if c + L < d.get(v, 1e18):
                d[v] = c + L
                heapq.heappush(h, (c + L, v))
    return d


def runde(nett, s, t):
    ut = nett.vei(s, t)
    brukt = {(min(a, b), max(a, b)) for a, b in zip(ut, ut[1:])}
    tilbake = nett.vei(t, s, brukt)
    pts = br.polylinje(nett, ut) + br.polylinje(nett, tilbake)[1:]
    sti = ut + tilbake[1:]
    tot = sum(nett.adj[a][b] for a, b in zip(sti, sti[1:])) or 1
    ikke = sum(nett.adj[a][b] for a, b in zip(sti, sti[1:]) if (min(a, b), max(a, b)) in nett.uprep)
    runde.belyst = 1 - ikke / tot
    return pts, br.lengde(pts), br.overlapp_pct(pts)


def beste(nett, s, noder, mål_m=None):
    """Prøver mange vendepunkt og velger runden med minst overlapp (og lengde nær mål_m hvis oppgitt)."""
    d = avstander(nett, s)
    kand = [i for i in noder if d.get(i, 0) > 400]
    kand = kand[:: max(1, len(kand) // 80)]
    best = None
    for t in kand:
        pts, L, ov = runde(nett, s, t)
        score = (-abs(L - mål_m) / 100 - ov * 0.4) if mål_m else L * (1 - ov / 100) ** 3 * runde.belyst
        if best is None or score > best[0]:
            best = (score, pts, L, ov)
    return best[1:]


def i_boks(p, b):
    m = p["punkter"][len(p["punkter"]) // 2]
    return b[0] <= m[0] <= b[2] and b[1] <= m[1] <= b[3]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--osm", action="append", required=True)
    ap.add_argument("--ut", required=True)
    ap.add_argument("--skriv", action="store_true")
    a = ap.parse_args()
    eks = json.load(open(a.ut))
    funn = []

    # 1. Lysløype-klynger: (navn, punkt som ligger i klyngen, ønsket startpunkt)
    bo.UPREP_FAKTOR = 1.6  # ikke-belyste preparerte biter brukes som koblinger, men belyst foretrekkes
    lit = Lite(stykker(a.osm, lambda p, pr: p["lysløype"] == "yes"))
    kompl = []
    seen = set()
    for i in lit.adj:
        if i not in seen and i not in lit.skjult:
            k = bo.komponent(lit, i)
            seen |= k
            kompl.append(k)
    KLYNGER = [
        ("Lysløype Frognerseteren nord", (10.667, 59.989), FROGN),
        ("Lysløype Fossum", (10.607, 59.962), (10.6245, 59.9605)),
        ("Lysløype Eineåsen", (10.484, 59.939), None),
    ]
    for navn, anker, onsket in KLYNGER:
        q = TO.transform(*anker)
        k = min(kompl, key=lambda k: min(math.dist(lit.noder[i], q) for i in k))
        xs = [lit.noder[i] for i in k]
        bb = (min(x[0] for x in xs) - 600, min(x[1] for x in xs) - 600, max(x[0] for x in xs) + 600, max(x[1] for x in xs) + 600)
        def nær_boks(p, pr, bb=bb):
            return any(bb[0] <= q[0] <= bb[2] and bb[1] <= q[1] <= bb[3] for q in (TO.transform(*p["punkter"][len(p["punkter"]) // 2]),))
        kombi = Lite(stykker(a.osm, lambda p, pr: (p["lysløype"] == "yes") or (bool(pr) and nær_boks(p, pr)), lambda p, pr: p["lysløype"] != "yes"))
        s = kombi.nærmeste(TO.transform(*(onsket or anker)))
        pts, L, ov = beste(kombi, s, [i for i in kombi.adj if any(math.dist(kombi.noder[i], lit.noder[j]) < 8 for j in list(k)[::3])] or sorted(k))
        print(f"{navn}: {L / 1000:.1f} km, overlapp {ov} %, klynge {len(k)} noder, start {math.dist(kombi.noder[s], TO.transform(*(onsket or anker))):.0f} m fra ønsket punkt")
        funn.append((navn, pts, ov))

    # 2. Konkurranseløypa: alt preparert syd for Frognerseteren (og nord for stadion)
    kb = (10.655, 59.9635, 10.70, 59.9795)
    kn = Lite(stykker(a.osm, lambda p, pr: bool(pr) and i_boks(p, kb)))
    s, t = kn.nærmeste(TO.transform(*FROGN)), kn.nærmeste(TO.transform(*STADION))
    if s is not None and t is not None:
        pts, L, ov = runde(kn, s, t)
        pts, L, ov = max([(pts, L, ov), beste(kn, s, sorted(bo.komponent(kn, s)))], key=lambda x: x[1] * (1 - x[2] / 100) ** 3)
        print(f"Konkurranseløypa: {L / 1000:.1f} km, overlapp {ov} %")
        funn.append(("Konkurranseløypa", pts, ov))

    # 3. Sprintløype: nettet ved stadion, rundt 3 km
    sb = (10.655, 59.958, 10.69, 59.972)
    sn = Lite(stykker(a.osm, lambda p, pr: (bool(pr) or p["lysløype"] == "yes") and i_boks(p, sb)))
    s = sn.nærmeste(TO.transform(*STADION))
    pts, L, ov = beste(sn, s, sorted(bo.komponent(sn, s)), mål_m=3000)
    print(f"Sprintløype: {L / 1000:.1f} km, overlapp {ov} %")
    funn.append(("Sprintløype Holmenkollen", pts, ov))

    if a.skriv:
        import unicodedata
        for navn, pts, ov in funn:
            t = br.til_trail({"id": bo.id_av(navn), "navn": navn}, pts)
            t.pop("kilde_runde", None)
            t["kilde"] = "osm"
            eks = [e for e in eks if e["id"] != t["id"]] + [t]
            print(f"skrev {navn}: {t['lengde_m']} m, overlapp {t['overlapp_pct']} %")
        eks.sort(key=lambda e: (e["navn"], bool(e.get("variantAv"))))
        json.dump(eks, open(a.ut, "w"), ensure_ascii=False, separators=(",", ":"))
        print("terreng:", " ".join(f'--navn "{n}"' for n, _, _ in funn))


if __name__ == "__main__":
    main()
