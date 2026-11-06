"""Laster løypefilene (src/data/trails*.json) opp til tabellen public.loype i Neon, så appen kan hente løyper når de blir sett på.
Bruker DATABASE_URL (rollen vaer_skriver). Løyper som er borte fra filen slettes fra databasen.

  python3 -I scripts/last_opp_loyper.py
"""
import json, os
import psycopg2

FILER = {"hovden": "trails.json", "nordmarka": "trails-nordmarka.json", "baerumsmarka": "trails-baerumsmarka.json"}
Rot = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "data")


def oversikt(punkter, steg=150):
    """Forenklet strek til oversiktskartet: ett punkt per ~150 m (avstand er kolonne 3), pluss siste punkt."""
    ut, neste = [], 0
    for p in punkter:
        if p[3] >= neste:
            ut.append([round(p[0], 5), round(p[1], 5)])
            neste = p[3] + steg
    last = [round(punkter[-1][0], 5), round(punkter[-1][1], 5)]
    if ut[-1] != last:
        ut.append(last)
    return ut


with psycopg2.connect(os.environ["DATABASE_URL"]) as con, con.cursor() as cur:
    for omrade, fil in FILER.items():
        trails = json.load(open(os.path.join(Rot, fil)))
        for t in trails:
            data = {k: v for k, v in t.items() if k in ("punkter", "terreng")}
            cur.execute(
                """insert into public.loype (omrade, id, navn, type, lengde_m, variant_av, start, oversikt, data, oppdatert)
                   values (%s,%s,%s,%s,%s,%s,%s,%s,%s, now())
                   on conflict (omrade, id) do update set navn=excluded.navn, type=excluded.type, lengde_m=excluded.lengde_m,
                     variant_av=excluded.variant_av, start=excluded.start, oversikt=excluded.oversikt, data=excluded.data, oppdatert=now()""",
                (omrade, t["id"], t["navn"], t.get("type"), t["lengde_m"], t.get("variantAv"), json.dumps(t["punkter"][0][:3]),
                 json.dumps(oversikt(t["punkter"]), separators=(",", ":")), json.dumps(data, separators=(",", ":"))),
            )
        cur.execute("delete from public.loype where omrade = %s and not (id = any(%s))", (omrade, [t["id"] for t in trails]))
        print(f"{omrade}: {len(trails)} løyper")
