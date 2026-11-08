#!/usr/bin/env python3
"""Kjører kjor_norge.py for ett eller flere fylker om gangen (manifestet fra del_i_omrader.py).

Fylke for hvert område slås opp én gang mot Kartverket (sentrum av området) og lagres i <mappe>/fylker.json.

  Oversikt (fylker, antall områder, km, hvor mange som er ferdige):
    python -X utf8 scripts/kjor_fylke.py
  Test med to områder i et fylke:
    python -X utf8 scripts/kjor_fylke.py --fylke Telemark --maks 2
  Kjør ett fylke (kan avbrytes med Ctrl+C og startes igjen; ferdige områder hoppes over):
    python -X utf8 scripts/kjor_fylke.py --fylke Telemark
  Flere fylker: --fylke Telemark,Agder.   Med lokal høydemodell: --dtm "data\\dtm\\*.tif"
"""
import argparse, json, os, subprocess, sys, time, urllib.error, urllib.parse, urllib.request

HER = os.path.dirname(os.path.abspath(__file__))
ROT = os.path.join(HER, "..")


def fylke_for(lon, lat):
    url = "https://ws.geonorge.no/kommuneinfo/v1/punkt?" + urllib.parse.urlencode({"nord": lat, "ost": lon, "koordsys": 4326})
    for f in range(4):
        try:
            d = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "skiglede"}), timeout=30))
            return d.get("fylkesnavn") or "Ukjent"
        except urllib.error.HTTPError as e:
            if e.code in (400, 404):  # punktet ligger utenfor kommunekartet (grensen, sjøen, utlandet)
                return "Ukjent"
            time.sleep(2 * (f + 1))
        except Exception:
            time.sleep(2 * (f + 1))
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fylke", help="ett eller flere fylkesnavn, kommaseparert (utelat for oversikt)")
    ap.add_argument("--mappe", default=os.path.join("scripts", "ut", "omrader"))
    ap.add_argument("--steder", default=os.path.join("scripts", "ut", "norge", "steder.json"))
    ap.add_argument("--dtm")
    ap.add_argument("--samtidig", type=int, default=4)
    ap.add_argument("--maks", type=int)
    a = ap.parse_args()

    man = json.load(open(os.path.join(a.mappe, "manifest.json"), encoding="utf-8"))
    fp = os.path.join(a.mappe, "fylker.json")
    fylker = json.load(open(fp, encoding="utf-8")) if os.path.exists(fp) else {}
    mangler = [m for m in man if m["id"] not in fylker]
    if mangler:
        print(f"Slår opp fylke for {len(mangler)} områder ...", flush=True)
    for m in mangler:
        f = fylke_for(m["lon"], m["lat"])
        if f is None:
            print(f"  ({m['id']}: oppslag feilet, prøv igjen senere)")
            continue
        fylker[m["id"]] = f
        json.dump(fylker, open(fp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        time.sleep(0.1)

    sp = os.path.join(a.mappe, "status.json")
    status = json.load(open(sp, encoding="utf-8")) if os.path.exists(sp) else {}
    per = {}
    for m in man:
        f = fylker.get(m["id"])
        if not f:
            continue
        p = per.setdefault(f, dict(n=0, km=0.0, ferdig=0, feilet=0))
        p["n"] += 1
        p["km"] += m.get("km", 0)
        s = status.get(m["id"])
        if s and s.get("ok"):
            p["ferdig"] += 1
        elif s:
            p["feilet"] += 1

    if not a.fylke:
        print(f"{'Fylke':20s} {'områder':>8s} {'km':>8s} {'ferdige':>8s} {'feilet':>7s}")
        for f, p in sorted(per.items()):
            print(f"{f:20s} {p['n']:8d} {p['km']:8.0f} {p['ferdig']:8d} {p['feilet']:7d}")
        print("\nKjør ett fylke:  python -I scripts/kjor_fylke.py --fylke <navn>")
        return

    ønsket = {x.strip().lower() for x in a.fylke.split(",") if x.strip()}
    ukjente = ønsket - {f.lower() for f in per}
    if ukjente:
        sys.exit("Fant ikke fylke: " + ", ".join(sorted(ukjente)) + ". Tilgjengelige: " + ", ".join(sorted(per)))
    ids = [m["id"] for m in man if fylker.get(m["id"], "").lower() in ønsket]
    print(f"{len(ids)} områder i {a.fylke}", flush=True)
    cmd = [sys.executable, "-X", "utf8", os.path.join(HER, "kjor_norge.py"), "--mappe", a.mappe, "--steder", a.steder, "--samtidig", str(a.samtidig), "--kun", ",".join(ids)]
    if a.dtm:
        cmd += ["--dtm", a.dtm]
    if a.maks:
        cmd += ["--maks", str(a.maks)]
    sys.exit(subprocess.call(cmd, cwd=ROT))


if __name__ == "__main__":
    main()
