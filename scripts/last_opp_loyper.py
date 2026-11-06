"""Laster løypefilene (src/data/trails*.json) opp til tabellen public.loype i Neon, så appen kan hente løyper når de blir sett på.
Bruker DATABASE_URL (rollen vaer_skriver).

Trygghet:
  - Bare løyper som har endret innhold (hash) skrives, og bare de får ny `oppdatert`, så klientenes lokale kopier ugyldiggjøres ikke unødig.
  - Én transaksjon per område: feil i ett område stopper ikke de andre.
  - Løyper som kontrollen har satt i karantene (--karantene fil.json) lastes ikke opp.
  - Løyper som er borte fra filen slettes, men ikke hvis filen har under halvparten av dagens antall (feil/halvskrevet fil). Bruk --tillat-sletting for å overstyre.

  python3 -I scripts/last_opp_loyper.py [--karantene scripts/ut/karantene.json] [--tillat-sletting]
"""
import argparse, hashlib, json, os, sys
import psycopg2

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


def rad_for(t):
    data = {k: v for k, v in t.items() if k in ("punkter", "terreng")}
    r = (t["id"], t["navn"], t.get("type"), t["lengde_m"], t.get("variantAv"), json.dumps(t["punkter"][0][:3]),
         json.dumps(oversikt(t["punkter"]), separators=(",", ":")), json.dumps(data, separators=(",", ":")))
    return r, hashlib.sha1(json.dumps(r, sort_keys=True).encode()).hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--karantene")
    ap.add_argument("--tillat-sletting", action="store_true")
    a = ap.parse_args()
    karantene = json.load(open(a.karantene)) if a.karantene and os.path.exists(a.karantene) else {}
    feilet = []
    with psycopg2.connect(os.environ["DATABASE_URL"]) as con:
        with con.cursor() as cur:
            cur.execute("select id, loypefil from public.omrade where loypefil is not null order by rekkefolge, id")
            områder = cur.fetchall()
        con.commit()
        for omrade, fil in områder:
            try:
                if not os.path.exists(os.path.join(Rot, fil)):
                    print(f"{omrade}: finner ikke {fil}, hopper over")
                    continue
                trails = json.load(open(os.path.join(Rot, fil)))
                bad = set(karantene.get(fil, []))
                if bad:
                    print(f"{omrade}: {len(bad)} løyper i karantene, lastes ikke opp: {', '.join(sorted(bad))}")
                gyldige = [t for t in trails if t["id"] not in bad]
                with con.cursor() as cur:
                    cur.execute("select id, innhold_hash from public.loype where omrade = %s", (omrade,))
                    nå = dict(cur.fetchall())
                    nye = endret = 0
                    for t in gyldige:
                        r, h = rad_for(t)
                        if nå.get(t["id"]) == h:
                            continue
                        nye += t["id"] not in nå
                        endret += 1
                        cur.execute(
                            """insert into public.loype (omrade, id, navn, type, lengde_m, variant_av, start, oversikt, data, innhold_hash, oppdatert)
                               values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, now())
                               on conflict (omrade, id) do update set navn=excluded.navn, type=excluded.type, lengde_m=excluded.lengde_m,
                                 variant_av=excluded.variant_av, start=excluded.start, oversikt=excluded.oversikt, data=excluded.data,
                                 innhold_hash=excluded.innhold_hash, oppdatert=now()""",
                            (omrade, *r, h),
                        )
                    # Slett det som er borte fra filen (karantene-løyper beholdes som de er)
                    ønsket = [t["id"] for t in trails]
                    borte = [i for i in nå if i not in ønsket]
                    if borte and not a.tillat_sletting and len(nå) > 3 and len(ønsket) < len(nå) / 2:
                        print(f"{omrade}: filen har {len(ønsket)} løyper mot {len(nå)} i databasen, sletter ikke (bruk --tillat-sletting)")
                        borte = []
                    if borte:
                        cur.execute("delete from public.loype where omrade = %s and id = any(%s)", (omrade, borte))
                con.commit()
                print(f"{omrade}: {len(gyldige)} løyper, {endret} endret ({nye} nye), {len(borte)} slettet")
            except Exception as e:
                con.rollback()
                print(f"{omrade}: FEILET ({e})", file=sys.stderr)
                feilet.append(omrade)
    if feilet:
        sys.exit(1)


if __name__ == "__main__":
    main()
