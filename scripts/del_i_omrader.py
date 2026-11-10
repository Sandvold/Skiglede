#!/usr/bin/env python3
"""Deler en stor OSM-løypefil (f.eks. hele Norge fra hent_osm_loyper.mjs) i skiområder, klart for bygg_omrade.py.

  1. DBSCAN på punkter langs løypene (--eps m) gir sammenhengende nett.
  2. Nett med større utstrekning enn --maks-diameter m deles med KMeans til hver del er under grensen.
  3. Nett med under --min-km preparert løype droppes (rapporteres).
  4. Områder som ligger innen radius av et eksisterende (låst) område hoppes over: (ingen lenger).
  5. Hvert område får navn fra Kartverkets stedsnavn (Tettsted/Grend/Fjell/… nærmest sentrum), kommune som suffiks ved kollisjon,
     og en stabil id (slug). Finnes manifestet fra før, beholdes id og navn for områder med sentrum innen 3 km av et gammelt.
  6. Hvert område får sin egen osm.json (egne biter + biter innen --buffer m, så runder kan krysse grensen).

    python3 -I scripts/del_i_omrader.py --osm norge.json --ut scripts/ut/omrader [--manifest scripts/ut/omrader/manifest.json]
Utdata: <ut>/<id>/osm.json og <ut>/manifest.json (id, navn, lat, lon, km, antall, kommune).
"""
import argparse, json, math, os, re, sys, time, unicodedata, urllib.parse, urllib.request
import numpy as np
from pyproj import Transformer
from scipy.spatial import cKDTree
from sklearn.cluster import DBSCAN, KMeans

HER = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HER)
import bygg_auto_ruter as ba

TO = Transformer.from_crs(4326, 25832, always_xy=True)
FRA = Transformer.from_crs(25832, 4326, always_xy=True)
LÅST = [("hovden", 59.5667, 7.3667, 12000)]  # Hovden har håndlagde løyper (logger/renn henger på id-ene) og beholdes; Nordmarka, Bærumsmarka og Sjusjøen bygges med landspipelinen
# Bærumsmarka og Nordmarka var håndbygde og låst; nå bygges de med landspipelinen. Gammel id og navn gjenbrukes for nettet nærmest (innen 3 km),
# så de nye løypene erstatter de gamle i stedet for å bli et område til ved siden av.
FASTE = [dict(id="baerumsmarka", navn="Bærumsmarka", lat=59.955, lon=10.52, km=0, antall=0, kommune=None),
         dict(id="nordmarka", navn="Nordmarka", lat=59.98, lon=10.65, km=0, antall=0, kommune=None),
         dict(id="sjusjoen", navn="Sjusjøen", lat=61.1725, lon=10.7031, km=0, antall=0, kommune=None)]


def slug(s):
    s = unicodedata.normalize("NFKD", s.lower().replace("ø", "o").replace("å", "a").replace("æ", "ae"))
    return re.sub(r"-+", "-", "".join(c if c.isalnum() else "-" for c in s if ord(c) < 128)).strip("-")


def get(url, forsøk=3):
    for f in range(forsøk):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "skiglede"}), timeout=30))
        except Exception:
            time.sleep(2 * (f + 1))
    return None


def kommune(lon, lat):
    d = get("https://ws.geonorge.no/kommuneinfo/v1/punkt?" + urllib.parse.urlencode({"nord": lat, "ost": lon, "koordsys": 4326}))
    return (d or {}).get("kommunenavn")


def deles(pts, maks):
    """Rekursiv KMeans-deling til hver del har diameter (bbox-diagonal) under maks."""
    if len(pts) < 2 or math.dist(pts.min(0), pts.max(0)) <= maks:
        return [np.arange(len(pts))]
    k = max(2, math.ceil(math.dist(pts.min(0), pts.max(0)) / maks))
    lab = KMeans(k, n_init=5, random_state=0).fit_predict(pts)
    ut = []
    for i in range(k):
        idx = np.where(lab == i)[0]
        ut += [idx[j] for j in deles(pts[idx], maks)]
    return ut


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--osm", required=True)
    ap.add_argument("--ut", required=True)
    ap.add_argument("--manifest")
    ap.add_argument("--eps", type=float, default=2000)
    ap.add_argument("--maks-diameter", type=float, default=30000)
    ap.add_argument("--min-km", type=float, default=15)
    ap.add_argument("--buffer", type=float, default=1500)
    ap.add_argument("--ikke-lås", action="store_true")
    ap.add_argument("--uten-navn", action="store_true", help="hopp over nettoppslag (test)")
    a = ap.parse_args()
    biter = [p for p in json.load(open(a.osm))["løyper"] if not any(x in (p.get("preparering") or "") for x in ("backcountry", "scooter"))]
    pts, eier = [], []
    for i, p in enumerate(biter):
        u = np.array([TO.transform(*q) for q in p["punkter"]])
        seg = np.hypot(*np.diff(u, axis=0).T) if len(u) > 1 else np.array([0])
        d = np.concatenate([[0], np.cumsum(seg)])
        for t in np.arange(0, d[-1] + 1, 200):  # ett punkt per 200 m
            pts.append(u[min(np.searchsorted(d, t), len(u) - 1)]); eier.append(i)
    pts, eier = np.array(pts), np.array(eier)
    lab = DBSCAN(eps=a.eps, min_samples=2).fit_predict(pts)
    print(f"{len(biter)} biter, {len(pts)} punkter, {len(set(lab) - {-1})} nett")
    grupper = []
    for k in sorted(set(lab) - {-1}):
        idx = np.where(lab == k)[0]
        for del_ in deles(pts[idx], a.maks_diameter):
            grupper.append(idx[del_])
    tre = cKDTree(pts)
    gammel = json.load(open(a.manifest)) if a.manifest and os.path.exists(a.manifest) else []
    gammel += [f for f in FASTE if f["id"] not in {g["id"] for g in gammel}]
    manifest, brukt_id, brukt_navn = [], {g["id"] for g in gammel}, {g["navn"] for g in gammel}
    hoppet = []
    for idx in grupper:
        mine = set(eier[idx])
        km = sum(biter[i]["lengde_m"] for i in mine if biter[i].get("preparering")) / 1000
        c = pts[idx].mean(0)
        lon, lat = FRA.transform(*c)
        if km < a.min_km:
            hoppet.append((round(lat, 3), round(lon, 3), round(km, 1), "for lite preparert løype")); continue
        if not a.ikke_lås and any(math.dist(c, TO.transform(lo, la)) < r for _, la, lo, r in LÅST):
            hoppet.append((round(lat, 3), round(lon, 3), round(km, 1), "låst område")); continue
        gml = next((g for g in gammel if math.dist(c, TO.transform(g["lon"], g["lat"])) < 3000), None)
        kom = None
        if gml:
            id_, navn = gml["id"], gml["navn"]
        else:
            navn = None if a.uten_navn else ba.stedsnavn((lon, lat), set(), radius=3000)
            navn = navn or f"Skiområde {lat:.2f} {lon:.2f}"
            if navn in brukt_navn:
                kom = kommune(lon, lat)
                navn = f"{navn} ({kom})" if kom and f"{navn} ({kom})" not in brukt_navn else f"{navn} {lat:.2f} {lon:.2f}"
            id_ = slug(navn)
            n = 2
            while id_ in brukt_id:
                id_ = f"{slug(navn)}-{n}"; n += 1
        brukt_id.add(id_); brukt_navn.add(navn)
        # egne biter + biter innen buffer (nær noen av områdets punkter)
        naer = set()
        for j in tre.query_ball_point(pts[idx], a.buffer):
            naer.update(eier[j])
        valgt = sorted(mine | naer)
        mappe = os.path.join(a.ut, id_)
        os.makedirs(mappe, exist_ok=True)
        json.dump({"kilde": "OpenStreetMap (ODbL)", "løyper": [biter[i] for i in valgt]}, open(os.path.join(mappe, "osm.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        manifest.append(dict(id=id_, navn=navn, lat=round(lat, 4), lon=round(lon, 4), km=round(km, 1), antall=len(valgt), kommune=kom))
        print(f"{id_:28s} {navn:30s} {km:6.1f} km, {len(valgt)} biter")
    for h in hoppet:
        print("hoppet over", h)
    json.dump(manifest + [g for g in gammel if g["id"] not in {m["id"] for m in manifest}], open(os.path.join(a.ut, "manifest.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
