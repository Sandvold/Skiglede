"""Oppdaterer værhistorikken (tabellen public.vaer) for alle områder i public.omrade med vaer = true.
For hvert område: les eksisterende timer fra databasen, hent bare nye timer fra MET (scripts/hent_vaer.py --tidligere), og skriv tilbake.
Bruker DATABASE_URL (rollen vaer_skriver).
"""
import json, os, subprocess, sys, tempfile
import psycopg2

HER = os.path.dirname(os.path.abspath(__file__))
con = psycopg2.connect(os.environ["DATABASE_URL"])
con.autocommit = True
cur = con.cursor()
cur.execute("select id, lat, lon, ref_hoyde_m from public.omrade where vaer order by rekkefolge, id")
feil = 0
with tempfile.TemporaryDirectory() as tmp:
    for omrade, lat, lon, ref in cur.fetchall():
        fil = os.path.join(tmp, f"{omrade}.json")
        cur.execute("select celle, referansehoyde_m, kolonner, timer from public.vaer where omrade = %s", (omrade,))
        r = cur.fetchone()
        if r:
            json.dump({"celle": r[0], "referansehoyde_m": r[1], "kolonner": r[2], "timer": r[3]}, open(fil, "w"), separators=(",", ":"))
        res = subprocess.run([sys.executable, "-I", os.path.join(HER, "hent_vaer.py"), "--lat", str(lat), "--lon", str(lon), "--days", "14",
                              "--ref-hoyde", str(ref), "--tidligere", fil, "--json", fil])
        if res.returncode != 0:
            print(f"{omrade}: henting feilet, hopper over", file=sys.stderr)
            feil += 1
            continue
        d = json.load(open(fil))
        cur.execute(
            """insert into public.vaer (omrade, referansehoyde_m, celle, kolonner, timer, oppdatert)
               values (%s, %s, %s, %s, %s, now())
               on conflict (omrade) do update set referansehoyde_m = excluded.referansehoyde_m, celle = excluded.celle,
                 kolonner = excluded.kolonner, timer = excluded.timer, oppdatert = now()""",
            (omrade, d["referansehoyde_m"], d["celle"], d["kolonner"], json.dumps(d["timer"])),
        )
        print(f"{omrade}: {len(d['timer'])} timer lagret")
sys.exit(1 if feil else 0)
