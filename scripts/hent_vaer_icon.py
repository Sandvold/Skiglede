#!/usr/bin/env python3
"""Værhistorikk for ett punkt utenfor MET Nordic fra DWD ICON-D2 (2,2 km, åpne data på opendata.dwd.de, dekker ca. 43,2–58,1 °N og 3,9 °V–20,3 °Ø: Alpene, Tyskland, Polen m.m.).

ICON-D2 er en prognosemodell, og DWD beholder bare de siste døgnene. Vi bruker derfor timene +1 til +3 av hver modellkjøring (hver 3. time) som «analyse», og samler dem i en voksende historikk (som `--vekst` i hent_vaer.py):
et nytt punkt starter med det som ligger åpent (ca. 1 døgn) og vinduet vokser mot --days. Hull fylles så lenge kjøringene fortsatt ligger åpent hos DWD.

Samme utformat som hent_vaer.py (kolonner ts, temp_c, nedbor_mm, rh, vind_ms, sw_j_m2), så oppdater_vaer.py kan bruke begge.

    python3 -I scripts/hent_vaer_icon.py --lat 46.37 --lon 11.66 --json moena.json [--tidligere moena.json]

Kilde: Deutscher Wetterdienst (DWD), opendata.dwd.de. Kreditering: «Quelle: Deutscher Wetterdienst».
Bruk av dataene følger DWDs vilkår (https://www.dwd.de/copyright); jeg har ikke fått lest dem selv, sjekk dem før betalt drift.
Krever eccodes (pip install eccodes).
"""
import argparse, bz2, json, math, os, sys, tempfile, time, urllib.error, urllib.request
from datetime import datetime, timedelta, timezone

import eccodes

BASE = "https://opendata.dwd.de/weather/nwp/icon-d2/grib"
UA = "Skiglede/1.0 (kontakt: sandvold40@gmail.com)"
KOLONNER = ["ts", "temp_c", "nedbor_mm", "rh", "vind_ms", "sw_j_m2"]
VARS = ["t_2m", "tot_prec", "relhum_2m", "u_10m", "v_10m", "aswdir_s", "aswdifd_s"]
STEG = (1, 2, 3)  # timene hver kjøring bidrar med (kjøringene kommer hver 3. time)
DOMENE = (43.18, 58.08, -3.94, 20.34)  # sør, nord, vest, øst for regular-lat-lon-filene


def i_domenet(lat, lon):
    return DOMENE[0] <= lat <= DOMENE[1] and DOMENE[2] <= lon <= DOMENE[3]


def last(url, forsøk=3):
    """Laster ned og pakker ut én bz2-GRIB-fil. None hvis den ikke finnes (kjøringen er ikke ferdig eller har gått ut hos DWD)."""
    for n in range(forsøk):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
                return bz2.decompress(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if n == forsøk - 1:
                raise
        except Exception:
            if n == forsøk - 1:
                raise
        time.sleep(3 * (n + 1))


def verdi(data, lat, lon):
    """Nærmeste rutepunkt (regulær 0,02°-ruter) i en GRIB-melding."""
    with tempfile.NamedTemporaryFile(suffix=".grib2") as f:
        f.write(data)
        f.flush()
        with open(f.name, "rb") as h:
            g = eccodes.codes_grib_new_from_file(h)
            try:
                return eccodes.codes_grib_find_nearest(g, lat, lon)[0]["value"]
            finally:
                eccodes.codes_release(g)


def fil(kjoring, steg, var):
    return f"{BASE}/{kjoring:%H}/{var}/icon-d2_germany_regular-lat-lon_single-level_{kjoring:%Y%m%d%H}_{steg:03d}_2d_{var}.grib2.bz2"


def kjøring_timer(kjoring, lat, lon):
    """Timer (iso → rad) for steg 1–3 av én kjøring, eller None hvis noen av filene mangler."""
    # nedbør og stråling er akkumulert/gjennomsnitt fra kjøringsstart, så vi trenger steget før også
    trengs = sorted(set(STEG) | {min(STEG) - 1})
    v = {}
    for s in trengs:
        for var in VARS:
            if s == 0 and var not in ("tot_prec", "aswdir_s", "aswdifd_s"):
                continue
            d = last(fil(kjoring, s, var))
            if d is None:
                return None
            v[(s, var)] = verdi(d, lat, lon)
    ut = {}
    for s in STEG:
        tid = kjoring + timedelta(hours=s)
        forrige_nedbor = v.get((s - 1, "tot_prec"), 0.0) if s > 0 else 0.0
        nedbor = max(0.0, v[(s, "tot_prec")] - forrige_nedbor)

        def energi(steg):  # J/m² fra kjøringsstart: gjennomsnitt (W/m²) × sekunder
            return (v.get((steg, "aswdir_s"), 0.0) + v.get((steg, "aswdifd_s"), 0.0)) * steg * 3600

        sw = max(0.0, energi(s) - energi(s - 1))
        vind = math.hypot(v[(s, "u_10m")], v[(s, "v_10m")])
        ut[tid.strftime("%Y-%m-%dT%H:%M:%SZ")] = [tid.strftime("%Y-%m-%dT%H:%M:%SZ"), round(v[(s, "t_2m")] - 273.15, 2), round(nedbor, 3), round(v[(s, "relhum_2m")] / 100, 3), round(vind, 2), round(sw)]
    return ut


def modellhoyde(lat, lon):
    """Høyden (m) til ICON-D2-ruta. Temperaturene gjelder denne høyden. None hvis oppslaget feiler."""
    nå = datetime.now(timezone.utc)
    for h in range(0, 36, 3):
        k = (nå - timedelta(hours=h)).replace(minute=0, second=0, microsecond=0)
        k = k.replace(hour=k.hour - k.hour % 3)
        url = f"{BASE}/{k:%H}/hsurf/icon-d2_germany_regular-lat-lon_time-invariant_{k:%Y%m%d%H}_000_0_hsurf.grib2.bz2"
        try:
            d = last(url, 1)
        except Exception:
            continue
        if d is not None:
            return round(verdi(d, lat, lon))
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lat", type=float, required=True)
    ap.add_argument("--lon", type=float, required=True)
    ap.add_argument("--days", type=int, default=14)
    ap.add_argument("--json", required=True, help="skriv historikken hit (samme format som hent_vaer.py)")
    ap.add_argument("--tidligere", help="JSON fra forrige kjøring; nye timer legges til")
    ap.add_argument("--ref-hoyde", type=float, default=0, help="brukes bare hvis modellhøyden ikke kan hentes")
    ap.add_argument("--kjoringer", type=int, default=12, help="hvor mange kjøringer bakover (3 t hver) vi forsøker; DWD har bare ca. 1–2 døgn åpent")
    a = ap.parse_args()
    if not i_domenet(a.lat, a.lon):
        sys.exit(f"{a.lat},{a.lon} ligger utenfor ICON-D2-området {DOMENE}")

    gamle = {}
    hoyde = None
    if a.tidligere and os.path.exists(a.tidligere):
        try:
            g = json.load(open(a.tidligere))
            gamle = {r[0]: r for r in g.get("timer", [])}
            hoyde = g.get("referansehoyde_m")
        except ValueError:
            pass
    if not hoyde:
        hoyde = modellhoyde(a.lat, a.lon) or a.ref_hoyde

    nå = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    siste = nå.replace(hour=nå.hour - nå.hour % 3)
    nye = {}
    for n in range(a.kjoringer):
        k = siste - timedelta(hours=3 * n)
        tider = [(k + timedelta(hours=s)).strftime("%Y-%m-%dT%H:%M:%SZ") for s in STEG]
        if all(t in gamle or t in nye for t in tider):
            continue
        try:
            r = kjøring_timer(k, a.lat, a.lon)
        except Exception as e:
            print(f"kjøring {k:%Y-%m-%d %H}Z feilet ({e}), hopper over", file=sys.stderr)
            continue
        if r is None:
            continue  # ikke ferdig (nyeste) eller utløpt hos DWD (eldste)
        nye.update({t: rad for t, rad in r.items() if datetime.strptime(t, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc) <= nå})
    alle = {**gamle, **nye}
    grense = (nå - timedelta(days=a.days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    timer = [alle[t] for t in sorted(alle) if t >= grense]
    ut = {"celle": [round(a.lat * 100), round(a.lon * 100)], "lat": a.lat, "lon": a.lon, "referansehoyde_m": hoyde, "kolonner": KOLONNER, "timer": timer}
    json.dump(ut, open(a.json, "w"), separators=(",", ":"))
    print(f"{len(nye)} nye timer, {len(timer)} totalt (modellhøyde {hoyde} m)", file=sys.stderr)


if __name__ == "__main__":
    main()
