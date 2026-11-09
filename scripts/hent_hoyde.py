#!/usr/bin/env python3
"""Lager høydeprofil og seksjoner for én løype fra Turrutebasen (GML i EPSG:25832)
med høyder fra Kartverkets høydedata-REST (dtm1).

Eksempel:
    python3 -I scripts/hent_hoyde.py --gml hovden.gml --navn "Lysløype Hovden" \
        --step 25 --section 250 --sql lys.sql

Skriver SQL for trails og trail_sections (se db/schema.sql). aspect_deg lar vi stå
tom foreløpig (krever sideveis terrengprøver); forest_fraction = andel punkter
Kartverket merker som «Skog».
"""
import argparse, json, math, time, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
from pyproj import Transformer

REST = "https://ws.geonorge.no/hoydedata/v1/punkt"


def kjed(segs, tol=15.0):
    """Setter sammen biter som møtes i endepunktene (innen tol meter) til lengste kjede."""
    def lengde(p):
        return sum(math.dist(a, b) for a, b in zip(p, p[1:]))
    rest = sorted(segs, key=lengde, reverse=True)
    kjede = list(rest.pop(0))
    endret = True
    while endret and rest:
        endret = False
        for i, sgm in enumerate(rest):
            for cand in (sgm, sgm[::-1]):
                if math.dist(kjede[-1], cand[0]) <= tol:
                    kjede += cand[1:]
                elif math.dist(kjede[0], cand[-1]) <= tol:
                    kjede = cand[:-1] + kjede
                else:
                    continue
                rest.pop(i)
                endret = True
                break
            if endret:
                break
    return kjede


def lengste_segment(gml, navn, kjeding=True):
    segs, ref = [], None
    for fe in (m for m in ET.parse(gml).getroot().iter() if m.tag.endswith("}Skiløype")):
        nm, pl, lid = None, None, None
        for c in fe.iter():
            tag = c.tag.split("}")[1]
            if tag == "rutenavn":
                nm = c.text
            elif tag == "lokalId" and lid is None:
                lid = c.text
            elif tag == "posList":
                pl = c.text
        if nm == navn and pl:
            v = list(map(float, pl.split()))
            segs.append((list(zip(v[0::2], v[1::2])), lid))
    if not segs:
        raise SystemExit(f"fant ikke {navn}")
    lengste = max(segs, key=lambda s: len(s[0]))
    pts = kjed([s[0] for s in segs]) if kjeding else lengste[0]
    return pts, lengste[1]


def resample(pts, step):
    out, acc_prev = [pts[0]], 0.0
    carry = 0.0
    for a, b in zip(pts, pts[1:]):
        d = math.dist(a, b)
        pos = step - carry
        while pos <= d:
            f = pos / d
            out.append((a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])))
            pos += step
        carry = d - (pos - step)
    if math.dist(out[-1], pts[-1]) > 1:
        out.append(pts[-1])
    return out


def hoyder(pts, batch=50, workers=3):
    """Høyder for punktene (maks 50 per kall). Parallelt (få tråder) og med lange ventetider ved 429/5xx/tidsavbrudd, som hent_terreng."""
    import random
    from concurrent.futures import ThreadPoolExecutor
    deler = [[[round(x, 2), round(y, 2)] for x, y in pts[i:i + batch]] for i in range(0, len(pts), batch)]

    def hent(chunk):
        q = urllib.parse.urlencode({"punkter": json.dumps(chunk), "koordsys": 25832})
        for forsøk in range(8):
            try:
                with urllib.request.urlopen(f"{REST}?{q}", timeout=90) as r:
                    return json.load(r)["punkter"]
            except Exception:
                if forsøk == 7:
                    raise
                time.sleep(min(30 + 30 * forsøk, 180) * random.uniform(0.8, 1.3))

    with ThreadPoolExecutor(workers) as ex:
        return [p for d in ex.map(hent, deler) for p in d]  # map beholder rekkefølgen


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gml", required=True)
    ap.add_argument("--navn", required=True)
    ap.add_argument("--step", type=float, default=25)
    ap.add_argument("--section", type=float, default=250)
    ap.add_argument("--sql")
    ap.add_argument("--json")
    a = ap.parse_args()

    pts, ref = lengste_segment(a.gml, a.navn)
    pr = resample(pts, a.step)
    hs = hoyder(pr)
    z = [p["z"] for p in hs]
    skog = [p.get("terreng") == "Skog" for p in hs]
    dist = [0.0]
    for p, q in zip(pr, pr[1:]):
        dist.append(dist[-1] + math.dist(p, q))
    total = dist[-1]
    up = sum(max(0, b - a_) for a_, b in zip(z, z[1:]))
    print(f"{len(pr)} punkter, {total:.0f} m, høyde {min(z):.0f}-{max(z):.0f} m, stigning {up:.0f} m")

    secs, start = [], 0
    while start < len(pr) - 1:
        end = start
        while end < len(pr) - 1 and dist[end] - dist[start] < a.section:
            end += 1
        L = dist[end] - dist[start]
        if L < a.section / 3 and secs:  # slå en kort hale sammen med forrige
            secs[-1]["end"] = end
        else:
            secs.append({"start": start, "end": end})
        start = end
    for s in secs:
        i, j = s["start"], s["end"]
        L = dist[j] - dist[i]
        s.update(start_m=dist[i], end_m=dist[j], e0=z[i], e1=z[j],
                 slope=math.degrees(math.atan2(z[j] - z[i], L)) if L else 0,
                 forest=sum(skog[i:j + 1]) / (j - i + 1))

    if a.json:
        to4326 = Transformer.from_crs("EPSG:25832", "EPSG:4326", always_xy=True)
        json.dump({"navn": a.navn, "ref": ref, "lengde_m": total,
                   "punkter": [[*to4326.transform(*p), h, d, int(k)] for p, h, d, k in zip(pr, z, dist, skog)]}, open(a.json, "w"))

    if a.sql:
        to4326 = Transformer.from_crs("EPSG:25832", "EPSG:4326", always_xy=True)
        ll = [to4326.transform(x, y) for x, y in pr]
        wkt = lambda idx: "LINESTRING(" + ",".join(f"{ll[k][0]:.6f} {ll[k][1]:.6f}" for k in idx) + ")"
        with open(a.sql, "w") as f:
            f.write("WITH t AS (INSERT INTO trails (name, source, source_ref, geom, length_m) VALUES "
                    f"('{a.navn}','turrutebasen','{ref}',ST_GeomFromText('{wkt(range(len(pr)))}',4326),{total:.0f}) "
                    "ON CONFLICT (source,source_ref) DO UPDATE SET geom=EXCLUDED.geom, length_m=EXCLUDED.length_m "
                    "RETURNING id)\nINSERT INTO trail_sections (trail_id,seq,geom,start_m,end_m,elev_start_m,elev_end_m,slope_deg,forest_fraction) VALUES\n")
            rows = []
            for n, s in enumerate(secs):
                rows.append(f"((SELECT id FROM t),{n},ST_GeomFromText('{wkt(range(s['start'], s['end'] + 1))}',4326),"
                            f"{s['start_m']:.0f},{s['end_m']:.0f},{s['e0']:.1f},{s['e1']:.1f},{s['slope']:.2f},{s['forest']:.2f})")
            f.write(",\n".join(rows))
            f.write("\nON CONFLICT (trail_id,seq) DO UPDATE SET geom=EXCLUDED.geom,start_m=EXCLUDED.start_m,end_m=EXCLUDED.end_m,"
                    "elev_start_m=EXCLUDED.elev_start_m,elev_end_m=EXCLUDED.elev_end_m,slope_deg=EXCLUDED.slope_deg,"
                    "forest_fraction=EXCLUDED.forest_fraction;\n")
        print(f"{len(secs)} seksjoner -> {a.sql}")


if __name__ == "__main__":
    main()
