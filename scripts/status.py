"""Statusrapport for Skiglede-databasen: hvor mange områder, hvilke som mangler løyper eller vær, og om værjobben henger.
Bruker DATABASE_URL (rollen vaer_skriver holder, den leser bare).

  python3 -I scripts/status.py            (PowerShell: $env:DATABASE_URL="..."; python -X utf8 scripts\\status.py)
"""
import glob, os, sys
import psycopg2

GRENSE_DØGN = 4  # samme grense som appen (VÆR_FERSK_DØGN): eldre vær gir ikke smøreråd
Rot = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "data")


def vis(tittel, rader, maks=15):
    print(f"{tittel}: {len(rader)}")
    for r in rader[:maks]:
        print("   ", r)
    if len(rader) > maks:
        print(f"    … og {len(rader) - maks} til")


def main():
    if not os.environ.get("DATABASE_URL"):
        sys.exit("Sett DATABASE_URL først (samme som i GitHub-hemmeligheten).")
    with psycopg2.connect(os.environ["DATABASE_URL"]) as con, con.cursor() as cur:
        cur.execute("select count(*), count(*) filter (where vaer) from public.omrade")
        n, med_vaer = cur.fetchone()
        cur.execute("select count(distinct omrade), count(*) from public.loype")
        omr_loyper, loyper = cur.fetchone()
        print(f"Områder: {n} ({med_vaer} med vær slått på)\nLøyper: {loyper} fordelt på {omr_loyper} områder\n")

        cur.execute("select o.id from public.omrade o where not exists (select 1 from public.loype l where l.omrade = o.id) order by o.id")
        uten_loyper = [r[0] for r in cur.fetchall()]
        vis("Områder uten løyper i databasen", uten_loyper)
        # filer som finnes lokalt (etter git pull) men ikke er lastet opp
        filer = {os.path.basename(f)[len("trails-"):-len(".json")] for f in glob.glob(os.path.join(Rot, "trails-*.json"))}
        vis("Områder uten løyper som har løypefil i repoet (ikke lastet opp ennå?)", sorted(set(uten_loyper) & filer))

        cur.execute("""select o.id from public.omrade o where o.vaer and not exists (select 1 from public.vaer v where v.omrade = o.id) order by o.id""")
        vis("Områder med vær=true men uten værdata", [r[0] for r in cur.fetchall()])
        cur.execute("select omrade, round(extract(epoch from now() - oppdatert) / 86400.0, 1) from public.vaer where oppdatert < now() - interval '%s days' order by 2 desc" % GRENSE_DØGN)
        vis(f"Værdata eldre enn {GRENSE_DØGN} døgn (appen viser løypeinfo uten smøreråd)", [f"{o}: {d} døgn" for o, d in cur.fetchall()])
        cur.execute("select max(oppdatert), min(oppdatert) from public.vaer")
        nyest, eldst = cur.fetchone()
        print(f"\nVærjobben sist: {nyest}  (eldste rad: {eldst})")


if __name__ == "__main__":
    main()
