#!/usr/bin/env python3
"""Lager runder automatisk fra parkeringer/startpunkter i et OSM-nett (brukt for Bærumsmarka).

For hvert startpunkt velges vendepunkt i ulike retninger og avstander (ca. 5, 9 og 14 km ut langs nettet).
Hver runde bygges som i bygg_osm_omrade.py (ut på korteste vei, tilbake på en annen). Vendepunktet får navn
fra OpenStreetMap-stedsnavn (Nominatim) og runden heter «Start – Sted». Runder som ligner hverandre
(over 70 % felles vei) droppes.

    python3 -I scripts/bygg_auto_ruter.py --osm a.json --osm b.json --ut src/data/trails-baerumsmarka.json \
        --start "Fossum=10.6245,59.9605" [--skriv]
"""
import argparse, json, math, os, sys, time, urllib.parse, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import bygg_osm_omrade as bo
import bygg_osm_runder as br
import bygg_lysloyper as bl

TO, FRA = bo.TO, bo.FRA
BANDER = [(2000, 4000), (4000, 7000), (7000, 11000), (11000, 16000)]  # ut-avstand (m) for vendepunkt


# Navnetyper fra Kartverkets stedsnavn, i prioritert rekkefølge (lavere tall = bedre navn på en løype). Adressenavn, gårder, jorder, bekker osv. brukes ikke.
NAVNETYPER = {
    "Tettsted": 0, "Grend": 0, "Turisthytte": 1, "Hotell": 1, "Alpinanlegg": 1, "Idrettsanlegg": 1, "Hyttefelt": 1,
    "Fjell": 2, "Topp": 2, "Høyde": 2, "Ås": 2, "Tjern": 3, "Vann": 3, "Seter/støl": 3, "Setervoll": 3, "Dal": 3, "Skogområde": 3,
}


def stedsnavn(lonlat, brukt, radius=1500):
    """Naturlig navn på et punkt: nærmeste stedsnavn av en egnet type fra Kartverket (ingen Nominatim, tåler parallelle kjøringer)."""
    q = urllib.parse.urlencode({"nord": lonlat[1], "ost": lonlat[0], "koordsys": 4326, "radius": radius, "treffPerSide": 200, "side": 1, "utkoordsys": 4326})
    for forsøk in range(3):
        try:
            d = json.load(urllib.request.urlopen(urllib.request.Request("https://ws.geonorge.no/stedsnavn/v1/punkt?" + q, headers={"User-Agent": "skiglede"}), timeout=30))
            break
        except Exception:
            time.sleep(2 * (forsøk + 1))
    else:
        return None
    kand = []
    for n in d.get("navn", []):
        t = NAVNETYPER.get(n.get("navneobjekttype"))
        navn = n["stedsnavn"][0]["skrivemåte"]
        if t is None or n.get("stedstatus") != "aktiv" or navn in brukt:
            continue
        kand.append((t, n.get("meterFraPunkt", 0), navn))
    return min(kand)[2] if kand else None


def felles(a, b, tol=25):
    pa = br.hh.resample(a, 50)
    pb = br.hh.resample(b, 50)
    return sum(1 for p in pa if any(math.dist(p, q) < tol for q in pb)) / len(pa)


RETUR_MIN_PREP = 0.0   # tur-retur: ingen krav til preparert andel (OSM mangler ofte preparering-merket, f.eks. lysløyper)
RETUR_BANDER = [(1250, 2500), (2500, 5000), (5000, 8000), (8000, 13000)]  # vei ut (m) => tur-retur på 2,5–26 km


def retur_kandidater(nett, s, avst, komp):
    """Tur-retur for nett uten sløyfer: i hvert av lengdebåndene det fjerneste vendepunktet med nok preparert vei.
    Veien ut og samme vei tilbake (type retur). Maks 26 km totalt."""
    ut = []
    for lo, hi in RETUR_BANDER:
        noder = sorted((i for i in komp if lo <= avst.get(i, 0) <= hi), key=lambda i: -avst[i])
        for t in noder[:40]:
            sti = nett.vei(s, t)
            if not sti or len(sti) < 2:
                continue
            kanter = list(zip(sti, sti[1:]))
            tot = sum(nett.adj[a][b] for a, b in kanter) or 1
            ikke = sum(nett.adj[a][b] for a, b in kanter if (min(a, b), max(a, b)) in nett.uprep)
            if 1 - ikke / tot < RETUR_MIN_PREP:
                continue
            pts = br.polylinje(nett, sti)
            pts = pts + pts[::-1][1:]
            L = br.lengde(pts)
            if 2500 <= L <= 26000:
                ut.append((t, pts, L))
                break
    if len(ut) >= 4:  # maks tre tur-retur per start: dropp den korteste (finnes det lengre, dekker de samme veien og mer)
        ut = ut[1:]
    return ut


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--osm", action="append", required=True)
    ap.add_argument("--ut", required=True)
    ap.add_argument("--start", action="append", required=True)
    ap.add_argument("--skriv", action="store_true")
    ap.add_argument("--per-start", type=int, default=4)
    a = ap.parse_args()
    bo.Rutenett.min_noder = 30  # standard 300 kaster små nett (f.eks. lysløyper rundt tettsteder); områdene er alt klynget
    nett = bo.Rutenett(bo.last(a.osm, uprep=True))
    valgt = []
    brukt_navn = set()
    for sd in a.start:
        sn, c = sd.split("=")
        q = TO.transform(*map(float, c.split(",")))
        s = nett.nærmeste(q)
        if s is None:
            print(f"{sn}: ingen løype innen 800 m, hopper over")
            continue
        avst = bl.avstander(nett, s)
        komp = bo.komponent(nett, s)
        print(f"{sn}: start {math.dist(nett.noder[s], q):.0f} m fra punktet, nett med {len(komp)} noder")
        kand = []
        tell = {"kandidater": 0, "for stor overlapp": 0, "for mye upreparert": 0, "feil lengde": 0}
        for lo, hi in BANDER:
            nodes = [i for i in komp if lo <= avst.get(i, 0) <= hi]
            nodes = nodes[:: max(1, len(nodes) // 40)]
            sc = []
            for t in nodes:
                pts, L, ov = bl.runde(nett, s, t)
                up = 1 - bl.runde.belyst  # andel upreparert/bro
                tell["kandidater"] += 1
                if ov > br.MAKS_OVERLAPP:
                    tell["for stor overlapp"] += 1
                elif up > 0.25:
                    tell["for mye upreparert"] += 1
                elif not 3000 <= L <= 26000:
                    tell["feil lengde"] += 1
                if ov <= br.MAKS_OVERLAPP and up <= 0.25 and 3000 <= L <= 26000:
                    sc.append((L * (1 - ov / 100) ** 2, pts, L, ov, t))
            sc.sort(key=lambda x: -x[0])
            kand.append(sc[:8])
        tatt = []
        for band in kand:  # én runde per lengdebånd, den beste som ikke ligner de som er valgt
            for sc, pts, L, ov, t in band:
                if any(felles(pts, p2) > 0.7 for _, p2, *_ in tatt):
                    continue
                tatt.append((sc, pts, L, ov, t))
                break
        if not tatt:  # ingen runde funnet: nettet er trolig et tre (ingen sløyfer) eller for lite preparert. Lag tur-retur i stedet
            print(f"  {sn}: ingen runde godkjent ({', '.join(f'{k} {v}' for k, v in tell.items())}). Prøver tur-retur")
            for t, pts, L in retur_kandidater(nett, s, avst, komp):
                if any(felles(pts, p2) > 0.7 for _, p2, *_ in tatt):
                    continue
                tatt.append((0, pts, L, 100, t))
            retur = True
        else:
            retur = False
        for sc, pts, L, ov, t in tatt:
            lonlat = FRA.transform(*nett.noder[t])
            navn = stedsnavn(lonlat, brukt_navn | {sn}) or f"punkt {len(valgt) + 1}"
            brukt_navn.add(navn)
            print(f"  {sn} – {navn}: {L / 1000:.1f} km{' tur-retur' if retur else ''}, overlapp {ov} %")
            valgt.append((f"{sn} – {navn}", pts, lonlat, retur))
    if a.skriv:
        eks = json.load(open(a.ut)) if os.path.exists(a.ut) else []
        nye_ider = set()
        for navn, pts, mal, er_retur in valgt:
            try:
                t = br.til_trail({"id": bo.id_av(navn), "navn": navn}, pts)
                if er_retur:
                    t["type"] = "retur"
            except ValueError as e:
                print(f"  hopper over {navn}: {e}")
                continue
            ids = {e["id"] for e in eks}
            i = 2
            while t["id"] in ids or t["id"] in nye_ider:  # unik id: aldri overskriv en annen runde med samme navn
                t["id"] = f"{bo.id_av(navn)}-{i}"; i += 1
            nye_ider.add(t["id"])
            t.pop("kilde_runde", None)
            t.update(kilde="osm", mal=[round(mal[0], 5), round(mal[1], 5)])
            eks = eks + [t]
        eks.sort(key=lambda e: (e["navn"], bool(e.get("variantAv"))))
        json.dump(eks, open(a.ut, "w"), ensure_ascii=False, separators=(",", ":"))
        print("terreng:", " ".join(f'--navn "{n}"' for n, *_ in valgt))


if __name__ == "__main__":
    main()
