"""Laster værhistorikk (JSON fra hent_vaer.py) opp til tabellen public.vaer i Neon. Bruker DATABASE_URL (rollen vaer_skriver)."""
import json, os, sys
import psycopg2

url = os.environ["DATABASE_URL"]
args = sys.argv[1:]
hent = bool(args and args[0] == "--hent")  # --hent: skriv eksisterende data fra databasen til filene i stedet for å laste opp
filer = dict(a.split("=", 1) for a in (args[1:] if hent else args))  # område=fil.json
if hent:
    with psycopg2.connect(url) as con, con.cursor() as cur:
        for omrade, fil in filer.items():
            cur.execute("select celle, referansehoyde_m, kolonner, timer from public.vaer where omrade = %s", (omrade,))
            r = cur.fetchone()
            if r:
                json.dump({"celle": r[0], "referansehoyde_m": r[1], "kolonner": r[2], "timer": r[3]}, open(fil, "w"), separators=(",", ":"))
                print(f"{omrade}: hentet {len(r[3])} timer fra databasen")
    sys.exit(0)
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
