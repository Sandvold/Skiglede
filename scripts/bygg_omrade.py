#!/usr/bin/env python3
"""Bygger et helt skiområde fra én OSM-fil, uten manuelt arbeid: stedsnavn, startpunkter, rundløyper, hytteturer,
rydding, terreng og kontroll. Skriver src/data/trails-<id>.json og SQL for raden i tabellen `omrade`.
Mal for agentene i Norge-kjøringen: én kjøring per område, egen utfil, rører ikke andre filer.

    python3 -I scripts/bygg_omrade.py --id sjusjoen --navn Sjusjøen --osm osm.json [--steder steder.json] [--antall 12]
        [--workers 5] [--uten-terreng] [--overskriv]

Etterpå (manuelt eller av samle-jobben): kjør SQL-en som skrives ut i Neon, commit og push (opplastingsjobben tar resten).
"""
import argparse, json, math, os, statistics, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

HER = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HER)
import bygg_osm_omrade as bo
import bygg_osm_runder as br

ROT = os.path.join(HER, "..")
MAKS_M = 25000
FELLES = 0.7


def kjør(*args):
    r = subprocess.run([sys.executable, "-I", *args], capture_output=True, text=True, cwd=ROT)
    if r.returncode:
        raise SystemExit(f"feilet: {' '.join(args)[:200]}\n{r.stderr[-1500:]}")
    return r


def bbox_av(osm):
    lo, la = [], []
    for p in json.load(open(osm))["løyper"]:
        for x, y in p["punkter"]:
            lo.append(x); la.append(y)
    return min(la), min(lo), max(la), max(lo)


def hent_steder(osm, ut, radius=3500):
    """Kartverkets stedsnavn i et rutenett over området (aktive navn)."""
    s, w, n, e = bbox_av(osm)
    dla, dlo = radius * 1.4 / 111320, radius * 1.4 / (111320 * math.cos(math.radians((s + n) / 2)))
    pts = []
    la = s
    while la <= n + dla:
        lo = w
        while lo <= e + dlo:
            pts.append((la, lo)); lo += dlo
        la += dla

    def side(p):
        res, nr = [], 1
        while True:
            q = urllib.parse.urlencode(dict(nord=p[0], ost=p[1], koordsys=4326, radius=radius, treffPerSide=500, side=nr, utkoordsys=4326))
            for f in range(4):
                try:
                    d = json.load(urllib.request.urlopen(urllib.request.Request("https://ws.geonorge.no/stedsnavn/v1/punkt?" + q, headers={"User-Agent": "skiglede"}), timeout=40))
                    break
                except Exception:
                    time.sleep(2 * (f + 1))
            else:
                raise SystemExit("stedsnavn feilet")
            res += d["navn"]
            if d["metadata"]["viserTil"] >= d["metadata"]["totaltAntallTreff"]:
                return res
            nr += 1

    alle = {}
    with ThreadPoolExecutor(4) as ex:
        for res in ex.map(side, pts):
            for n_ in res:
                if n_.get("stedstatus") == "aktiv":
                    alle[n_["stedsnummer"]] = dict(navn=n_["stedsnavn"][0]["skrivemåte"], type=n_["navneobjekttype"], lat=n_["representasjonspunkt"]["nord"], lon=n_["representasjonspunkt"]["øst"])
    json.dump(list(alle.values()), open(ut, "w"), ensure_ascii=False)
    print(f"stedsnavn: {len(alle)}")


def rydd(fil):
    """Fjern runder over 25 km og dubletter (over 70 % felles vei begge veier); behold de som ligger nærmest 14 km."""
    from pyproj import Transformer
    T = Transformer.from_crs(4326, 25832, always_xy=True)
    d = [t for t in json.load(open(fil)) if t["lengde_m"] <= MAKS_M]
    pts = lambda t: br.hh.resample([T.transform(p[0], p[1]) for p in t["punkter"]], 50)
    felles = lambda a, b: sum(1 for p in a if any(math.dist(p, q) < 25 for q in b)) / len(a)
    d.sort(key=lambda t: (t.get("type") == "retur", abs(t["lengde_m"] - 14000)))
    ut, P = [], []
    for t in d:
        p = pts(t)
        if any(felles(p, q) > FELLES and felles(q, p) > FELLES for q in P):
            continue
        ut.append(t); P.append(p)
    ut = [t for t in ut if " – punkt " not in t["navn"]]
    ut.sort(key=lambda t: t["navn"])
    json.dump(ut, open(fil, "w"), ensure_ascii=False, separators=(",", ":"))
    return ut


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--id", required=True)
    ap.add_argument("--navn", required=True)
    ap.add_argument("--osm", action="append", required=True)
    ap.add_argument("--steder")
    ap.add_argument("--antall", type=int, default=12)
    ap.add_argument("--workers", type=int, default=5)
    ap.add_argument("--uten-terreng", action="store_true")
    ap.add_argument("--dtm", help="glob til lokale GeoTIFF-høydefiler (DTM10): terreng regnes lokalt i stedet for via API-et")
    ap.add_argument("--overskriv", action="store_true")
    a = ap.parse_args()
    fil = f"src/data/trails-{a.id}.json"
    if os.path.exists(os.path.join(ROT, fil)) and not a.overskriv:
        raise SystemExit(f"{fil} finnes (bruk --overskriv). Eksisterende områder låses mot automatikk.")
    if os.path.exists(os.path.join(ROT, fil)):
        os.remove(os.path.join(ROT, fil))
    osm = [os.path.abspath(o) for o in a.osm]
    osmargs = [x for o in osm for x in ("--osm", o)]
    steder = os.path.abspath(a.steder) if a.steder else os.path.abspath(f"{a.id}-steder.json")
    if not a.steder:
        hent_steder(osm[0], steder)
    r = kjør("scripts/finn_startpunkter.py", *osmargs, "--steder", steder, "--maks-avstand", "600", "--min-avstand", "2500", "--antall", str(a.antall))
    starter = r.stdout.strip().replace('--start "', "").split('" ') if r.stdout.strip() else []
    starter = [s.strip('"') for s in starter]
    if not starter:
        raise SystemExit("fant ingen startpunkter")
    print(f"{len(starter)} startpunkter: " + ", ".join(s.split("=")[0] for s in starter))
    sa = [x for s in starter for x in ("--start", s)]
    kjør("scripts/bygg_auto_ruter.py", *osmargs, "--ut", fil, *sa, "--skriv")
    kjør("scripts/bygg_hytteturer.py", *osmargs, "--steder", steder, "--ut", fil, *sa, "--skriv")
    ut = rydd(os.path.join(ROT, fil))
    print(f"{len(ut)} løyper etter rydding")
    if not ut:
        raise SystemExit("ingen løyper ble igjen")
    if not a.uten_terreng:
        if a.dtm:
            kjør("scripts/hent_terreng_raster.py", "--ut", fil, "--dtm", a.dtm, "--fortsett")
        else:
            kjør("scripts/hent_terreng.py", "--ut", fil, "--workers", str(a.workers), "--pause", "0.2", "--fortsett")
    z = [p[2] for t in ut for p in t["punkter"]]
    lo = statistics.mean(p[0] for t in ut for p in t["punkter"]); la = statistics.mean(p[1] for t in ut for p in t["punkter"])
    karfil = os.path.join(tempfile.gettempdir(), "karantene-" + a.id + ".json")
    k = subprocess.run(["node", "scripts/kontroller-loyper.mjs", "--karantene", karfil], capture_output=True, text=True, cwd=ROT)
    kar = json.load(open(karfil)).get(os.path.basename(fil), [])
    print(k.stdout.strip().splitlines()[-1] if k.stdout.strip() else "", f"| karantene i dette området: {len(kar)}")
    print("\nSQL (kjør i Neon, juster vinter_min/vinter_max, rekkefolge og ref_hoyde_m ved behov):")
    print(f"insert into public.omrade (id, navn, lat, lon, vis_lon, vis_lat, vis_z, vinter_min, vinter_max, ref_hoyde_m, loypefil, vaer, rekkefolge) values "
          f"('{a.id}','{a.navn}',{la:.4f},{lo:.4f},{lo:.2f},{la:.2f},11,-20,1,{round(statistics.mean(z))},'{os.path.basename(fil)}',true,100) on conflict (id) do nothing;")


if __name__ == "__main__":
    main()
