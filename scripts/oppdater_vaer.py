"""Oppdaterer værhistorikken (tabellen public.vaer) for alle områder i public.omrade med vaer = true.
For hvert område: les eksisterende timer fra databasen, hent bare nye timer fra MET (scripts/hent_vaer.py --tidligere), og skriv tilbake.
Områdene tas parallelt (--samtidig, standard 4), hver med egen databaseforbindelse og tidsavbrudd, så ett tregt eller hengt område
ikke stopper de andre. Bruker DATABASE_URL (rollen vaer_skriver).

  python3 -I scripts/oppdater_vaer.py [--samtidig 4]
"""
import argparse, json, os, subprocess, sys, tempfile
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
import psycopg2

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vaer_openmeteo

HER = os.path.dirname(os.path.abspath(__file__))
TIMEOUT_S = 240  # normalt tar ett område sekunder; hang MET, tar vi det neste i stedet for å vente 15 min per område
KILDE = "met"  # MET Nordic via OPeNDAP (gratis; data samles fra nå, se --vekst i hent_vaer.py) eller "openmeteo" (ett kall for hele vinduet; kommersiell bruk krever abonnement)


def hent(lat, lon, ref, dager, fil, navn):
    """Henter værhistorikk for ett punkt. Open-Meteo: ett kall, og referansehøyden er modellens høyde (temperaturene gjelder den). MET: som før via hent_vaer.py."""
    if KILDE == "openmeteo":
        try:
            d = vaer_openmeteo.hent(lat, lon, dager)
        except Exception as e:
            print(f"{navn}: henting feilet ({e}), hopper over", file=sys.stderr)
            return None
        if len(d["timer"]) < dager * 24 * 0.9:
            print(f"{navn}: for få timer ({len(d['timer'])}), hopper over", file=sys.stderr)
            return None
        d["referansehoyde_m"] = d.pop("grid_hoyde_m") or ref
        return d
    try:
        res = subprocess.run([sys.executable, "-I", os.path.join(HER, "hent_vaer.py"), "--lat", str(lat), "--lon", str(lon), "--days", str(dager),
                              "--ref-hoyde", str(ref), "--tidligere", fil, "--json", fil, "--workers", "4", "--vekst"], timeout=TIMEOUT_S)
    except subprocess.TimeoutExpired:
        print(f"{navn}: tidsavbrudd, hopper over", file=sys.stderr)
        return None
    if res.returncode != 0:
        print(f"{navn}: henting feilet, hopper over", file=sys.stderr)
        return None
    return json.load(open(fil))


def område(rad, tmp):
    omrade, lat, lon, ref = rad
    fil = os.path.join(tmp, f"{omrade}.json")
    con = psycopg2.connect(os.environ["DATABASE_URL"])
    con.autocommit = True
    try:
        cur = con.cursor()
        cur.execute("select celle, referansehoyde_m, kolonner, timer from public.vaer where omrade = %s", (omrade,))
        r = cur.fetchone()
        if r:  # lat/lon legges inn så hent_vaer gjenbruker lagret værcelle (flyttes et område, må raden i `vaer` slettes)
            json.dump({"celle": r[0], "lat": lat, "lon": lon, "referansehoyde_m": r[1], "kolonner": r[2], "timer": r[3]}, open(fil, "w"), separators=(",", ":"))
        d = hent(lat, lon, ref, 14, fil, omrade)
        if d is None:
            return False
        cur.execute(
            """insert into public.vaer (omrade, referansehoyde_m, celle, kolonner, timer, oppdatert)
               values (%s, %s, %s, %s, %s, now())
               on conflict (omrade) do update set referansehoyde_m = excluded.referansehoyde_m, celle = excluded.celle,
                 kolonner = excluded.kolonner, timer = excluded.timer, oppdatert = now()""",
            (omrade, d["referansehoyde_m"], d["celle"], d["kolonner"], json.dumps(d["timer"])),
        )
        print(f"{omrade}: {len(d['timer'])} timer lagret", flush=True)
        return True
    except Exception as e:
        print(f"{omrade}: FEILET ({e})", file=sys.stderr)
        return False
    finally:
        con.close()


def rute(rad, tmp):
    """Delt rute: samme som et område, men lagres i rute_vaer og vinduet vokser fra opplastingstidspunktet (minst 14 døgn, høyst 90)."""
    rute_id, lat, lon, ref, opprettet = rad
    dager = max(14, min(90, (datetime.now(timezone.utc) - opprettet).days + 2))
    fil = os.path.join(tmp, f"rute-{rute_id}.json")
    con = psycopg2.connect(os.environ["DATABASE_URL"])
    con.autocommit = True
    try:
        cur = con.cursor()
        cur.execute("select celle, referansehoyde_m, kolonner, timer from public.rute_vaer where rute_id = %s", (str(rute_id),))
        r = cur.fetchone()
        if r:  # lat/lon legges inn så hent_vaer gjenbruker lagret værcelle (flyttes et område, må raden i `vaer` slettes)
            json.dump({"celle": r[0], "lat": lat, "lon": lon, "referansehoyde_m": r[1], "kolonner": r[2], "timer": r[3]}, open(fil, "w"), separators=(",", ":"))
        d = hent(lat, lon, ref, dager, fil, f"rute {rute_id}")
        if d is None:
            return False
        cur.execute(
            """insert into public.rute_vaer (rute_id, referansehoyde_m, celle, kolonner, timer, oppdatert)
               values (%s, %s, %s, %s, %s, now())
               on conflict (rute_id) do update set referansehoyde_m = excluded.referansehoyde_m, celle = excluded.celle,
                 kolonner = excluded.kolonner, timer = excluded.timer, oppdatert = now()""",
            (str(rute_id), d["referansehoyde_m"], d["celle"], d["kolonner"], json.dumps(d["timer"])),
        )
        print(f"rute {rute_id}: {len(d['timer'])} timer lagret ({dager} døgn)", flush=True)
        return True
    except Exception as e:
        print(f"rute {rute_id}: FEILET ({e})", file=sys.stderr)
        return False
    finally:
        con.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--samtidig", type=int, default=4)
    ap.add_argument("--kilde", choices=["openmeteo", "met"], default="met")
    a = ap.parse_args()
    global KILDE
    KILDE = a.kilde
    con = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = con.cursor()
    cur.execute("select id, lat, lon, ref_hoyde_m from public.omrade where vaer order by rekkefolge, id")
    rader = cur.fetchall()
    cur.execute("select id, lat, lon, ref_hoyde_m, opprettet from public.delte_ruter_for_vaer()")
    ruter = cur.fetchall()
    con.close()
    with tempfile.TemporaryDirectory() as tmp, ThreadPoolExecutor(a.samtidig) as ex:
        ok = list(ex.map(lambda r: område(r, tmp), rader))
        # Én ny runde (parallelt) for de som feilet, typisk et kort MET-avbrudd. Feilet mer enn 25 %, er MET nede: da hjelper det ikke å prøve igjen nå.
        feilet = [i for i, x in enumerate(ok) if not x]
        if feilet and len(feilet) <= 0.25 * len(ok):
            for i, x in zip(feilet, ex.map(lambda i: område(rader[i], tmp), feilet)):
                ok[i] = x
        elif feilet:
            print(f"{len(feilet)} av {len(ok)} områder feilet, MET ser ut til å være nede: hopper over ny runde", file=sys.stderr)
        ok_r = list(ex.map(lambda r: rute(r, tmp), ruter))
    print(f"{sum(ok)} av {len(ok)} områder og {sum(ok_r)} av {len(ok_r)} delte ruter oppdatert")
    ok = ok + ok_r
    sys.exit(0 if all(ok) else 1)


if __name__ == "__main__":
    main()
