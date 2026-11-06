#!/usr/bin/env python3
"""Leser en OSM-fil (.osm.pbf, f.eks. norway-latest fra Geofabrik) og lager de samme to filene som resten av pipelinen bruker:
  <ut>/osm-loyper.json   løypebiter (som hent_osm_loyper.mjs: osm, relasjon, navn, ref, preparering, lengde_m, punkter)
  <ut>/steder.json       stedsnavn til startpunkter og områdenavn ({navn, type, lat, lon}) fra samme fil, uten Kartverket-kall

Hele Norge på noen minutter i stedet for timer med Overpass. Krever `pip install osmium` (hjul finnes for Windows, Mac og Linux).

    python3 scripts/pbf_til_loyper.py --pbf norway-latest.osm.pbf --ut scripts/ut/norge
    (Last ned: https://download.geofabrik.de/europe/norway-latest.osm.pbf, ca. 1–1,5 GB)
"""
import argparse, itertools, json, math, os, sys, time
import osmium

# OSM-merker som gir startpunkt/navn, oversatt til Kartverkets navnetyper som resten av pipelinen bruker
def steds_type(t):
    p, tur, fr, am, nat = t.get("place"), t.get("tourism"), t.get("leisure"), t.get("amenity"), t.get("natural")
    if p in ("city", "town"): return "Tettsted"
    if p in ("village", "hamlet", "suburb", "neighbourhood", "locality"): return "Grend"
    if tur == "hotel" or tur == "guest_house": return "Hotell"
    if tur in ("alpine_hut", "wilderness_hut"): return "Turisthytte"
    if t.get("landuse") == "winter_sports" or t.get("aerialway") == "station": return "Alpinanlegg"
    if fr in ("sports_centre", "stadium", "pitch") and t.get("sport") in (None, "skiing", "nordic_skiing", "cross_country_skiing", "ski_jumping"): return "Idrettsanlegg"
    if am == "parking" and t.get("name"): return "Parkering"
    if nat in ("peak", "hill"): return "Fjell"
    if nat in ("water",) : return "Vann"
    return None


def lengde(g):
    r = math.pi / 180
    return sum(math.hypot((b[0] - a[0]) * math.cos(a[1] * r) * 111320, (b[1] - a[1]) * 111320) for a, b in zip(g, g[1:]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pbf", required=True)
    ap.add_argument("--ut", required=True)
    ap.add_argument("--bbox", help="sør,vest,nord,øst (valgfritt utsnitt)")
    a = ap.parse_args()
    os.makedirs(a.ut, exist_ok=True)
    bb = [float(x) for x in a.bbox.split(",")] if a.bbox else None
    inni = lambda lon, lat: not bb or (bb[0] <= lat <= bb[2] and bb[1] <= lon <= bb[3])
    t0 = time.time()

    # Pass 1: relasjoner med nordic-løyper, så medlemsveiene får relasjonens navn
    rel = {}
    for o in osmium.FileProcessor(a.pbf, osmium.osm.RELATION).with_filter(osmium.filter.TagFilter(("piste:type", "nordic"))):
        for m in o.members:
            if m.type == "w":
                rel[m.ref] = dict(o.tags)
    print(f"{len(rel)} veier i løypeforhold ({time.time() - t0:.0f} s)", file=sys.stderr)

    # Pass 2: veier med geometri og steder (noder). Ett pass med posisjonsindeks.
    biter, steder, sett = [], {}, set()
    fp = osmium.FileProcessor(a.pbf, osmium.osm.NODE | osmium.osm.WAY).with_locations().with_filter(osmium.filter.KeyFilter("piste:type", "name"))
    # medlemsveier i løype-relasjoner trenger ikke selv ha piste:type: egen filtrering på id
    fp2 = osmium.FileProcessor(a.pbf, osmium.osm.NODE | osmium.osm.WAY).with_locations().with_filter(osmium.filter.IdFilter(list(rel)))
    for o in itertools.chain(fp, fp2):
        t = o.tags
        if o.is_node():
            ty = steds_type(t)
            if ty and t.get("name") and o.location.valid() and inni(o.location.lon, o.location.lat):
                steder[(t["name"], ty, round(o.location.lat, 3), round(o.location.lon, 3))] = dict(navn=t["name"], type=ty, lat=round(o.location.lat, 5), lon=round(o.location.lon, 5))
            continue
        nordic = t.get("piste:type") == "nordic"
        if not nordic and o.id not in rel:
            continue
        if o.id in sett:
            continue
        try:
            g = [[round(n.lon, 5), round(n.lat, 5)] for n in o.nodes if n.location.valid()]
        except Exception:
            continue
        if len(g) < 2 or not any(inni(*p) for p in g[:: max(1, len(g) // 5)]):
            continue
        sett.add(o.id)
        r = rel.get(o.id, {})
        biter.append(dict(
            osm=f"way/{o.id}", relasjon=None, navn=t.get("name") or t.get("piste:name") or r.get("name") or r.get("piste:name"), ref=t.get("ref") or r.get("ref"),
            lysløype=t.get("lit"), preparering=t.get("piste:grooming") or r.get("piste:grooming"), vanskelighet=t.get("piste:difficulty") or r.get("piste:difficulty"),
            lengde_m=round(lengde(g)), punkter=g))
    json.dump(dict(hentet=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), kilde="OpenStreetMap (ODbL)", løyper=biter), open(os.path.join(a.ut, "osm-loyper.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    json.dump(list(steder.values()), open(os.path.join(a.ut, "steder.json"), "w"), ensure_ascii=False)
    print(f"{len(biter)} løypebiter, {len(steder)} steder ({time.time() - t0:.0f} s)", file=sys.stderr)


if __name__ == "__main__":
    main()
