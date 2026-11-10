"""Hvorfor har et område få løyper? Viser OSM-bitene i en boks, hvilke delnett de henger sammen i (ender innen 30 m) og avstanden mellom delnettene.

  python -X utf8 scripts\\diagnose_omrade.py --osm scripts\\ut\\norge\\osm-loyper.json --boks 59.94,10.55,59.99,10.68
  (boks = sør,vest,nord,øst; Fossum/Eiksmarka ligger ved 59.96 N 10.61 E)
"""
import argparse, json, math, sys

def m(a, b):
    return math.hypot((a[0] - b[0]) * math.cos(math.radians(a[1])) * 111320, (a[1] - b[1]) * 111320)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--osm", required=True)
    ap.add_argument("--boks", required=True)
    ap.add_argument("--snap", type=float, default=30)
    a = ap.parse_args()
    s, w, n, e = map(float, a.boks.split(","))
    biter = [p for p in json.load(open(a.osm, encoding="utf-8"))["løyper"] if any(s <= q[1] <= n and w <= q[0] <= e for q in p["punkter"])]
    print(f"{len(biter)} biter i boksen, {sum(p['lengde_m'] for p in biter) / 1000:.1f} km")
    # union-find: biter henger sammen hvis noen av endepunktene (eller noder) ligger innen snap
    forelder = list(range(len(biter)))
    def finn(i):
        while forelder[i] != i:
            forelder[i] = forelder[forelder[i]]; i = forelder[i]
        return i
    noder = [(q, i) for i, p in enumerate(biter) for q in (p["punkter"][0], p["punkter"][-1])]
    for x in range(len(noder)):
        for y in range(x + 1, len(noder)):
            if noder[x][1] != noder[y][1] and m(noder[x][0], noder[y][0]) < a.snap:
                forelder[finn(noder[x][1])] = finn(noder[y][1])
    grupper = {}
    for i in range(len(biter)):
        grupper.setdefault(finn(i), []).append(i)
    nett = sorted(grupper.values(), key=lambda g: -sum(biter[i]["lengde_m"] for i in g))
    for k, g in enumerate(nett):
        km = sum(biter[i]["lengde_m"] for i in g) / 1000
        prep = sum(biter[i]["lengde_m"] for i in g if biter[i].get("preparering")) / 1000
        navn = sorted({biter[i].get("navn") or biter[i].get("ref") or "?" for i in g})[:4]
        print(f"delnett {k}: {len(g)} biter, {km:.1f} km ({prep:.1f} km preparert) {navn}")
    for x in range(len(nett)):
        for y in range(x + 1, len(nett)):
            best = min((m(p, q), p) for i in nett[x] for p in biter[i]["punkter"][::3] for j in nett[y] for q in biter[j]["punkter"][::3])
            if best[0] < 1500:
                print(f"  gap delnett {x} - {y}: {best[0]:.0f} m (ca. {best[1][1]:.4f} N {best[1][0]:.4f} E)")
    print("Ikke-preparerte biter (preparering tom):", [(p.get('navn') or p['osm'], round(p['lengde_m'])) for p in biter if not p.get('preparering')][:15])

if __name__ == "__main__":
    main()
