"""Lager osm.json for et område fra alle OSM-biter innen en radius rundt et punkt (for gamle håndbygde områder som klyngingen ikke traff,
f.eks. Bærumsmarka og Sjusjøen), og sørger for at området står i manifest.json. Bygg så med kjor_norge.py --kun <id>.

  python -X utf8 scripts\\lag_omrade_fra_radius.py --osm scripts\\ut\\norge\\osm-loyper.json --ut scripts\\ut\\omrader --id baerumsmarka --navn Bærumsmarka --lat 59.955 --lon 10.52 --km 8
"""
import argparse, json, math, os

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--osm", required=True)
    ap.add_argument("--ut", required=True)
    ap.add_argument("--id", required=True)
    ap.add_argument("--navn", required=True)
    ap.add_argument("--lat", type=float, required=True)
    ap.add_argument("--lon", type=float, required=True)
    ap.add_argument("--km", type=float, required=True)
    a = ap.parse_args()
    m = lambda q: math.hypot((q[0] - a.lon) * math.cos(math.radians(a.lat)) * 111.32, (q[1] - a.lat) * 111.32)
    biter = [p for p in json.load(open(a.osm, encoding="utf-8"))["løyper"]
             if not any(x in (p.get("preparering") or "") for x in ("backcountry", "scooter")) and any(m(q) <= a.km for q in p["punkter"])]
    mappe = os.path.join(a.ut, a.id)
    os.makedirs(mappe, exist_ok=True)
    json.dump({"kilde": "OpenStreetMap (ODbL)", "løyper": biter}, open(os.path.join(mappe, "osm.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    km = round(sum(p["lengde_m"] for p in biter if p.get("preparering")) / 1000, 1)
    mf = os.path.join(a.ut, "manifest.json")
    man = json.load(open(mf, encoding="utf-8")) if os.path.exists(mf) else []
    man = [g for g in man if g["id"] != a.id] + [dict(id=a.id, navn=a.navn, lat=a.lat, lon=a.lon, km=km, antall=len(biter), kommune=None)]
    json.dump(man, open(mf, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{a.id}: {len(biter)} biter, {km} km preparert -> {mappe}")

if __name__ == "__main__":
    main()
