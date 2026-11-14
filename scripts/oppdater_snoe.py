"""Snødybde og skiføre per løype (tabellen public.snoe) fra seNorge (NVE og Meteorologisk institutt), 1 km-rutenett, daglig.
Hele landet leses i ett OPeNDAP-kall per variabel (de tre siste døgnene), og hver løype får verdien i cellen der den starter.
  snow_depth      snødybde i cm (modell, ikke måling)
  snow_condition  NVEs skiføre-klasse: 0 ingen snø, 1 lite/begrenset, 2 våt snø, 3 tørr snø
Kjøres sammen med værjobben; gjør ingenting hvis siste døgn allerede er lagret. Bruker DATABASE_URL (rollen vaer_skriver).

  python3 -I scripts/oppdater_snoe.py [--dager 3] [--tving]
"""
import argparse, os, sys
from datetime import datetime, timedelta
import numpy as np
import psycopg2
import netCDF4
from pyproj import Transformer

B = "https://thredds.met.no/thredds/dodsC/senorge/seNorge_snow/"


def les(ds, var, n):
    d = netCDF4.Dataset(f"{B}{ds}/{ds}_latest.nc")
    t = d.variables["time"]
    tider = netCDF4.num2date(t[-n:], t.units, only_use_cftime_datetimes=False, only_use_python_datetimes=True)
    a = np.ma.filled(d.variables[var][-n:, :, :].astype("float64"), np.nan)
    return [x.date() for x in tider], a, np.array(d.variables["x"][:], dtype=float), np.array(d.variables["y"][:], dtype=float)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dager", type=int, default=3)
    ap.add_argument("--tving", action="store_true")
    a = ap.parse_args()
    con = psycopg2.connect(os.environ["DATABASE_URL"])
    con.autocommit = True
    cur = con.cursor()
    dd = netCDF4.Dataset(f"{B}sd/sd_latest.nc")
    t = dd.variables["time"]
    siste = netCDF4.num2date(t[-1], t.units, only_use_cftime_datetimes=False, only_use_python_datetimes=True).date()
    cur.execute("select max(dato) from public.snoe")
    lagret = cur.fetchone()[0]
    if lagret and lagret >= siste and not a.tving:
        print(f"seNorge {siste} er allerede lagret, ingenting å gjøre")
        return
    dager, sd, xs, ys = les("sd", "snow_depth", a.dager)
    dager2, kl, xs2, ys2 = les("ski", "snow_condition", a.dager)
    if dager != dager2 or not (np.array_equal(xs, xs2) and np.array_equal(ys, ys2)):
        sys.exit(f"sd og ski har ulike tidsrekker eller rutenett ({dager} mot {dager2}), avbryter")
    cur.execute("select omrade, id, start from public.loype")
    rader = cur.fetchall()
    tr = Transformer.from_crs(4326, 32633, always_xy=True)
    dx, dy = xs[1] - xs[0], ys[1] - ys[0]
    ut = []
    utenfor = 0
    for omr, lid, start in rader:
        X, Y = tr.transform(start[0], start[1])
        i, j = int(round((X - xs[0]) / dx)), int(round((Y - ys[0]) / dy))
        if not (0 <= i < len(xs) and 0 <= j < len(ys)):
            utenfor += 1
            continue
        for k, dag in enumerate(dager):
            s, c = sd[k, j, i], kl[k, j, i]
            ut.append((omr, lid, dag, None if np.isnan(s) else round(float(s), 1), None if np.isnan(c) else int(round(float(c)))))
    with con.cursor() as c2:
        psycopg2.extras.execute_values(
            c2,
            """insert into public.snoe (omrade, loype_id, dato, dybde_cm, klasse) values %s
               on conflict (omrade, loype_id, dato) do update set dybde_cm = excluded.dybde_cm, klasse = excluded.klasse, oppdatert = now()""",
            ut, page_size=2000)
        c2.execute("delete from public.snoe where dato < %s", (dager[0] - timedelta(days=0),))
    print(f"{len(rader) - utenfor} løyper x {len(dager)} døgn lagret ({dager[0]}..{dager[-1]}), {utenfor} utenfor rutenettet")


if __name__ == "__main__":
    import psycopg2.extras
    main()
