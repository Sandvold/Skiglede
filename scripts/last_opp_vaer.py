"""Laster værhistorikk (JSON fra hent_vaer.py) opp til tabellen public.vaer i Neon. Bruker DATABASE_URL (rollen vaer_skriver)."""
import json, os, sys
import psycopg2

url = os.environ["DATABASE_URL"]
filer = dict(a.split("=", 1) for a in sys.argv[1:])  # område=fil.json
with psycopg2.connect(url) as con, con.cursor() as cur:
    for omrade, fil in filer.items():
        d = json.load(open(fil))
        cur.execute(
            """insert into public.vaer (omrade, referansehoyde_m, celle, kolonner, timer, oppdatert)
               values (%s, %s, %s, %s, %s, now())
               on conflict (omrade) do update set referansehoyde_m = excluded.referansehoyde_m, celle = excluded.celle,
                 kolonner = excluded.kolonner, timer = excluded.timer, oppdatert = now()""",
            (omrade, d["referansehoyde_m"], d["celle"], d["kolonner"], json.dumps(d["timer"])),
        )
        print(f"{omrade}: {len(d['timer'])} timer")
