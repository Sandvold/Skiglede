#!/usr/bin/env python3
"""Bygger en rennløype (enkeltvei, ikke runde) fra OSM-biter i rekkefølge: høyde, skog og terreng som vanlige løyper.

    python3 -I scripts/bygg_renn.py --osm scripts/ut/osm-loyper.json --id hovden-tour --navn "Hovden Tour" --way way/136332236 --way way/138146491 --ut src/data/renn-hovden-tour.json
    python3 -I scripts/hent_terreng.py --ut src/data/renn-hovden-tour.json   (terreng, som for andre løyper)

Rennløypa går i filen `renn-<id>.json` (ikke `trails*.json`, så den ikke lastes opp som vanlig løype og kontrolleres som runde).
"""
import argparse, json, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bygg_osm_runder as br

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--osm", required=True)
    ap.add_argument("--id", required=True)
    ap.add_argument("--navn", required=True)
    ap.add_argument("--way", action="append", required=True, help="OSM-bit (way/<id>) i kjørerekkefølge")
    ap.add_argument("--ut", required=True)
    a = ap.parse_args()
    d = {p["osm"]: p for p in json.load(open(a.osm))["løyper"]}
    pts = []
    for w in a.way:
        p = list(d[w]["punkter"])
        if pts:
            # snu biten hvis den henger sammen bakfra; sjekk at endene møtes (maks 60 m)
            m = lambda x, y: math.hypot((x[0] - y[0]) * math.cos(math.radians(x[1])) * 111320, (x[1] - y[1]) * 111320)
            if m(pts[-1], p[0]) > m(pts[-1], p[-1]):
                p.reverse()
            if m(pts[-1], p[0]) > 60:
                sys.exit(f"{w} henger ikke sammen med forrige bit ({m(pts[-1], p[0]):.0f} m)")
        pts += p
    utm = [br.TO.transform(x[0], x[1]) for x in pts]
    t = br.til_trail({"id": a.id, "navn": a.navn}, utm)
    t.update(type="enkel", kilde_runde="osm-bit", overlapp_pct=0)
    json.dump([t], open(a.ut, "w"), ensure_ascii=False)
    print(f"{a.navn}: {t['lengde_m']} m, {len(t['punkter'])} punkter, høyde {min(p[2] for p in t['punkter'])}–{max(p[2] for p in t['punkter'])} m")

if __name__ == "__main__":
    main()
