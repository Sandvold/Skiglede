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

HER = os.path.dirname(os.path.abspath(__file__))
TIMEOUT_S = 900


def område(rad, tmp):
    omrade, lat, lon, ref = rad
    fil = os.path.join(tmp, f"{omrade}.json")
    con = psycopg2.connect(os.environ["DATABASE_URL"])
    con.autocommit = True
    try:
        cur = con.cursor()
        cur.execute("select celle, referansehoyde_m, kolonner, timer from public.vaer where omrade = %s", (omrade,))
        r = cur.fetchone()
        if r:
            json.dump({"celle": r[0], "referansehoyde_m": r[1], "kolonner": r[2], "timer": r[3]}, open(fil, "w"), separators=(",", ":"))
        try:
            res = subprocess.run([sys.executable, "-I", os.path.join(HER, "hent_vaer.py"), "--lat", str(lat), "--lon", str(lon), "--days", "14",
                                  "--ref-hoyde", str(ref), "--tidligere", fil, "--json", fil, "--workers", "4"], timeout=TIMEOUT_S)
        except subprocess.TimeoutExpired:
            print(f"{omrade}: tidsavbrudd, hopper over", file=sys.stderr)
            return False
        if res.returncode != 0:
            print(f"{omrade}: henting feilet, hopper over", file=sys.stderr)
            return False
        d = json.load(open(fil))
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
        if r:
            json.dump({"celle": r[0], "referansehoyde_m": r[1], "kolonner": r[2], "timer": r[3]}, open(fil, "w"), separators=(",", ":"))
        try:
            res = subprocess.run([sys.executable, "-I", os.path.join(HER, "hent_vaer.py"), "--lat", str(lat), "--lon", str(lon), "--days", str(dager),
                                  "--ref-hoyde", str(ref), "--tidligere", fil, "--json", fil, "--workers", "4"], timeout=TIMEOUT_S)
        except subprocess.TimeoutExpired:
            print(f"rute {rute_id}: tidsavbrudd, hopper over", file=sys.stderr)
            return False
        if res.returncode != 0:
            print(f"rute {rute_id}: henting feilet, hopper over", file=sys.stderr)
            return False
        d = json.load(open(fil))
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
    a = ap.parse_args()
    con = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = con.cursor()
    cur.execute("select id, lat, lon, ref_hoyde_m from public.omrade where vaer order by rekkefolge, id")
    rader = cur.fetchall()
    cur.execute("select id, lat, lon, ref_hoyde_m, opprettet from public.delte_ruter_for_vaer()")
    ruter = cur.fetchall()
    con.close()
    with tempfile.TemporaryDirectory() as tmp, ThreadPoolExecutor(a.samtidig) as ex:
        ok = list(ex.map(lambda r: område(r, tmp), rader))
        ok_r = list(ex.map(lambda r: rute(r, tmp), ruter))
    print(f"{sum(ok)} av {len(ok)} områder og {sum(ok_r)} av {len(ok_r)} delte ruter oppdatert")
    ok = ok + ok_r
    sys.exit(0 if all(ok) else 1)


if __name__ == "__main__":
    main()
