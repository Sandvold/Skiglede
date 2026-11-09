#!/usr/bin/env python3
"""Bygger et helt skiområde fra én OSM-fil, uten manuelt arbeid: stedsnavn, startpunkter, rundløyper, hytteturer,
rydding, terreng og kontroll. Skriver src/data/trails-<id>.json og SQL for raden i tabellen `omrade`.
Mal for agentene i Norge-kjøringen: én kjøring per område, egen utfil, rører ikke andre filer.

    python3 -I scripts/bygg_omrade.py --id sjusjoen --navn Sjusjøen --osm osm.json [--steder steder.json] [--antall 12]
        [--workers 5] [--uten-terreng] [--overskriv]

Etterpå (manuelt eller av samle-jobben): kjør SQL-en som skrives ut i Neon, commit og push (opplastingsjobben tar resten).
"""
import threading, argparse, json, math, os, statistics, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

HER = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HER)
import bygg_osm_omrade as bo
import bygg_osm_runder as br

ROT = os.path.join(HER, "..")
MAKS_M = 25000
FELLES = 0.7


def kjør(*args):
    """Kjører et delskript og skriver utskriften linje for linje mens den kommer (bygg.log vokser underveis, så fremdriften kan følges)."""
    print(f"$ {os.path.basename(args[0])}", flush=True)
    p = subprocess.Popen([sys.executable, "-X", "utf8", *args], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace", cwd=ROT)
    feil = []
    tråd = threading.Thread(target=lambda: feil.extend(p.stderr.readlines()), daemon=True)
    tråd.start()
    ut = []
    for linje in p.stdout:
        ut.append(linje)
        print(linje, end="", flush=True)
    p.wait()
    tråd.join()
    r = subprocess.CompletedProcess(p.args, p.returncode, "".join(ut), "".join(feil))
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
    alle = json.load(open(fil, encoding="utf-8"))
    d = [t for t in alle if t["lengde_m"] <= MAKS_M]
    stat = [f"{len(alle)} lagd", f"{len(d)} under {MAKS_M // 1000} km"]
    pts = lambda t: br.hh.resample([T.transform(p[0], p[1]) for p in t["punkter"]], 50)
    felles = lambda a, b: sum(1 for p in a if any(math.dist(p, q) < 25 for q in b)) / len(a)
    d.sort(key=lambda t: (t.get("type") == "retur", abs(t["lengde_m"] - 14000)))
    ut, P = [], []
    for t in d:
        p = pts(t)
        if any(felles(p, q) > FELLES and felles(q, p) > FELLES for q in P):
            continue
        ut.append(t); P.append(p)
    stat.append(f"{len(ut)} etter dublettfjerning")
    navngitt = [t for t in ut if " – punkt " not in t["navn"]]
    if navngitt:
        ut = navngitt  # løyper uten stedsnavn (« – punkt N») droppes bare når det finnes navngitte
    else:  # ellers beholdes de, med nøytralt navn, i stedet for et tomt område
        for i, t in enumerate(ut, 1):
            t["navn"] = t["navn"].split(" – punkt ")[0] + f" – tur {i}"
            t["id"] = t["id"].split("-punkt")[0] + f"-tur-{i}"
    stat.append(f"{len(ut)} etter navnefilter")
    print("rydding: " + ", ".join(stat))
    ut.sort(key=lambda t: t["navn"])
    json.dump(ut, open(fil, "w"), ensure_ascii=False, separators=(",", ":"))
    return ut


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--id", required=True)
    ap.add_argument("--navn", required=True)
    ap.add_argument("--osm", action="append", required=True)
    ap.add_argument("--steder")
    ap.add_argument("--antall", type=int, default=8)
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
    r = kjør("scripts/finn_startpunkter.py", *osmargs, "--steder", steder, "--maks-avstand", "600", "--min-avstand", "3000", "--antall", str(a.antall))
    starter = r.stdout.strip().replace('--start "', "").split('" ') if r.stdout.strip() else []
    starter = [s.strip('"') for s in starter]
    if not starter:  # ingen hytte/parkering/hotell nær løypene: bruk løypepunktet nærmest midten av nettet
        punkter = [(x, y) for o in osm for p in json.load(open(o, encoding="utf-8"))["løyper"] if p.get("preparering") for x, y in p["punkter"]] or \
                  [(x, y) for o in osm for p in json.load(open(o, encoding="utf-8"))["løyper"] for x, y in p["punkter"]]
        mx, my = sum(q[0] for q in punkter) / len(punkter), sum(q[1] for q in punkter) / len(punkter)
        q = min(punkter, key=lambda q: (q[0] - mx) ** 2 + ((q[1] - my) * 2) ** 2)
        starter = [f"{a.navn.replace('=', ' ').replace(',', ' ')}={q[0]:.5f},{q[1]:.5f}"]
        print("ingen egnede startpunkter; bruker midten av nettet")
    print(f"{len(starter)} startpunkter: " + ", ".join(s.split("=")[0] for s in starter))
    sa = [x for s in starter for x in ("--start", s)]
    kjør("scripts/bygg_auto_ruter.py", *osmargs, "--ut", fil, *sa, "--skriv")
    kjør("scripts/bygg_hytteturer.py", *osmargs, "--steder", steder, "--ut", fil, *sa, "--skriv")
    ut = rydd(os.path.join(ROT, fil))
    print(f"{len(ut)} løyper etter rydding")
    if not ut:
        raise SystemExit("ingen løyper ble igjen")
    try:  # navn fra Turrutebasen der løypa følger en navngitt skiløype (hopper over hvis Kartverket ikke svarer)
        kjør("scripts/navn_fra_turrutebasen.py", fil, "--skriv", "--vis", "20")
    except SystemExit as e:
        print("(navn fra Turrutebasen hoppet over:", str(e)[:200], ")")
    if not a.uten_terreng:
        if a.dtm:
            kjør("scripts/hent_terreng_raster.py", "--ut", fil, "--dtm", a.dtm, "--fortsett")
        else:
            kjør("scripts/hent_terreng.py", "--ut", fil, "--workers", str(a.workers), "--pause", "0.2", "--fortsett")
    z = [p[2] for t in ut for p in t["punkter"]]
    lo = statistics.mean(p[0] for t in ut for p in t["punkter"]); la = statistics.mean(p[1] for t in ut for p in t["punkter"])
    karfil = os.path.join(tempfile.gettempdir(), "karantene-" + a.id + ".json")
    kar, k = [], None
    for forsøk in range(3):  # kontrollen leser alle trails*.json; en fil kan være halvskrevet av et parallelt område
        if os.path.exists(karfil):
            os.remove(karfil)
        k = subprocess.run(["node", "scripts/kontroller-loyper.mjs", "--karantene", karfil], capture_output=True, text=True, encoding="utf-8", errors="replace", cwd=ROT)
        try:
            kar = json.load(open(karfil, encoding="utf-8")).get(os.path.basename(fil), [])
            break
        except Exception:
            time.sleep(3)
    else:
        print("(løypekontrollen kunne ikke kjøres; opplastingsjobben kontrollerer uansett)")
    print(k.stdout.strip().splitlines()[-1] if k and k.stdout.strip() else "", f"| karantene i dette området: {len(kar)}")
    print("\nSQL (vaer=false: værhistorikk hentes ikke før du slår den på, se docs/norge-kjoring.md; kjør i Neon, juster vinter_min/vinter_max, rekkefolge og ref_hoyde_m ved behov):")
    print(f"insert into public.omrade (id, navn, lat, lon, vis_lon, vis_lat, vis_z, vinter_min, vinter_max, ref_hoyde_m, loypefil, vaer, rekkefolge) values "
          f"('{a.id}','{a.navn}',{la:.4f},{lo:.4f},{lo:.2f},{la:.2f},11,-20,1,{round(statistics.mean(z))},'{os.path.basename(fil)}',false,100) on conflict (id) do nothing;")


if __name__ == "__main__":
    main()
