#!/usr/bin/env python3
"""Lager tur-retur-varianter av OSM-rundene (Oslo). Tur-retur er det vanligste i Marka.

For hver sløyfe «Start – Mål» i løypefila: veien ut (til målet) brukes som tur-retur. Tur-retur får
løypas vanlige id og vises i lista; sløyfa beholdes som variant (`variantAv`) og velges i løypevisningen.
Høyde, skog og terreng gjenbrukes (terrenget speiles), så det trengs ingen nye oppslag.

    python3 -I scripts/lag_retur_varianter.py --ut src/data/trails-oslo.json --mal "Ullevålseter=10.7113,60.0094" ...
"""
import argparse, json, math

K = math.cos(math.radians(60))
m = lambda a, b: math.hypot((a[0] - b[0]) * K * 111320, (a[1] - b[1]) * 111320)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ut", required=True)
    ap.add_argument("--mal", action="append", default=[], help="Navn=lon,lat (ellers brukes feltet «mal» på løypa)")
    a = ap.parse_args()
    mal = {s.split("=")[0]: tuple(map(float, s.split("=")[1].split(","))) for s in a.mal}
    trails = json.load(open(a.ut))
    ut = []
    for t in trails:
        if t.get("variantAv") or t["type"] != "sloyfe" or " – " not in t["navn"]:
            continue
        # Hoppes over hvis det allerede finnes en variant
        if any(x.get("variantAv") == t["id"] or x["id"] == t["id"] + "-sloyfe" for x in trails):
            continue
        mål = tuple(t["mal"]) if t.get("mal") else mal.get(t["navn"].split(" – ")[1])
        if not mål:
            continue
        p = t["punkter"]
        i = min(range(len(p)), key=lambda k: m(p[k], mål))
        if m(p[i], mål) > 400:
            print(f"{t['navn']}: målet ligger {m(p[i], mål):.0f} m fra løypa, hopper over")
            continue
        L = p[i][3]
        pun = [list(q) for q in p[: i + 1]] + [[q[0], q[1], q[2], round(2 * L - q[3]), q[4]] for q in reversed(p[:i])]
        terr = t.get("terreng") or []
        ter2 = [list(e) for e in terr if e[0] <= L] + [[round(2 * L - e[0]), *e[1:]] for e in reversed([e for e in terr if e[0] < L])]
        r = {k: v for k, v in t.items() if k not in ("punkter", "terreng", "overlapp_pct")}
        r.update(id=t["id"], type="retur", lengde_m=pun[-1][3], punkter=pun, terreng=ter2, overlapp_pct=100)
        t["id"] = t["id"] + "-sloyfe"
        t["variantAv"] = r["id"]
        ut.append(r)
        print(f"{r['navn']}: tur-retur {r['lengde_m'] / 1000:.1f} km (sløyfe {t['lengde_m'] / 1000:.1f} km)")
    trails += ut
    trails.sort(key=lambda e: (e["navn"], bool(e.get("variantAv"))))
    json.dump(trails, open(a.ut, "w"), ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
