#!/usr/bin/env python3
"""Som hent_terreng.py, men leser høyder fra lokale GeoTIFF-filer (Kartverket DTM10 eller DTM1) i stedet for API-et.
Samme utdata (`terreng` per løype: [avstand_m, hellingsretning_°, helning_°, horisont_°[16]]), men uten API-kall:
minutter i stedet for timer, og ingen belastning på Kartverkets tjeneste.

    python3 -I scripts/hent_terreng_raster.py --ut src/data/trails-x.json --dtm "dtm/*.tif" [--navn Navn] [--fortsett] [--oppløsning 10]

Last ned DTM10 (UTM33, CC BY 4.0) fra hoydedata.no / Geonorge for områdene du trenger, med minst 3,5 km margin rundt løypene.
Filene kan ligge i ulike UTM-soner; punktene transformeres til hver fils CRS. Skog (kolonne 5 i punkter) kommer fortsatt fra
høyde-API-et i bygg-trinnet (bare 0,4 kall per km), så den følger med uansett.
"""
import argparse, glob, json, math, os, sys
import numpy as np
import rasterio
from rasterio.merge import merge
from pyproj import Transformer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hent_terreng as ht


class Dem:
    """Høydekart for ett utsnitt, i UTM 32 (EPSG:25832) som resten av skriptene. Bilineær oppslag."""

    def __init__(self, filer, bounds, res):
        dsl = [rasterio.open(f) for f in filer]
        crs = dsl[0].crs
        til_ds = Transformer.from_crs("EPSG:25832", crs, always_xy=True)
        x0, y0 = til_ds.transform(bounds[0], bounds[1]); x1, y1 = til_ds.transform(bounds[2], bounds[3])
        xs = [til_ds.transform(x, y) for x, y in ((bounds[0], bounds[1]), (bounds[0], bounds[3]), (bounds[2], bounds[1]), (bounds[2], bounds[3]))]
        b = (min(p[0] for p in xs), min(p[1] for p in xs), max(p[0] for p in xs), max(p[1] for p in xs))
        treff = [d for d in dsl if not (d.bounds.right < b[0] or d.bounds.left > b[2] or d.bounds.top < b[1] or d.bounds.bottom > b[3])]
        if not treff:
            raise SystemExit("ingen DTM-fil dekker dette området")
        arr, tr = merge(treff, bounds=b, res=res, nodata=-9999)
        self.z = arr[0].astype("float32")
        self.z[self.z <= -9990] = np.nan
        self.tr, self.til = tr, til_ds

    def __call__(self, x, y):
        cx, cy = self.til.transform(x, y)
        col, row = (cx - self.tr.c) / self.tr.a - 0.5, (cy - self.tr.f) / self.tr.e - 0.5
        r0, c0 = math.floor(row), math.floor(col)
        if r0 < 0 or c0 < 0 or r0 + 1 >= self.z.shape[0] or c0 + 1 >= self.z.shape[1]:
            return None
        fr, fc = row - r0, col - c0
        v = self.z[r0:r0 + 2, c0:c0 + 2]
        if np.isnan(v).any():
            return None
        return float((1 - fr) * ((1 - fc) * v[0, 0] + fc * v[0, 1]) + fr * ((1 - fc) * v[1, 0] + fc * v[1, 1]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ut", required=True)
    ap.add_argument("--dtm", required=True, help="glob til GeoTIFF-filer")
    ap.add_argument("--navn", action="append")
    ap.add_argument("--fortsett", action="store_true")
    ap.add_argument("--oppløsning", type=float, default=10)
    a = ap.parse_args()
    filer = sorted(glob.glob(a.dtm))
    if not filer:
        raise SystemExit(f"ingen filer: {a.dtm}")
    data = json.load(open(a.ut))
    til = Transformer.from_crs("EPSG:4326", "EPSG:25832", always_xy=True)
    feilet = []
    for t in data:
        if (a.navn and t["navn"] not in a.navn) or (a.fortsett and t.get("terreng")):
            continue
        valgt, neste = [], 0
        for p in t["punkter"]:
            if p[3] >= neste:
                valgt.append(p); neste = p[3] + ht.STEG
        utm = [til.transform(p[0], p[1]) for p in valgt]
        xs, ys = [u[0] for u in utm], [u[1] for u in utm]
        m = max(ht.RINGER) + 100
        try:
            dem = Dem(filer, (min(xs) - m, min(ys) - m, max(xs) + m, max(ys) + m), a.oppløsning)
        except SystemExit as e:
            print(f'{t["navn"]}: FEILET ({e}), beholder gammelt terreng', flush=True); feilet.append(t["navn"]); continue
        res = []
        for p, (x, y) in zip(valgt, utm):
            z = [dem(*q) for q in ht.punkter_for(x, y)]
            res.append(ht.tolk(p[3], z))
        t["terreng"] = [r for r in res if r]
        ht.lagre(data, a.ut)
        print(f'{t["navn"]}: {len(t["terreng"])} av {len(valgt)} punkter', flush=True)
    if feilet:
        print("\nFeilet:\n  " + "\n  ".join(feilet), file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
