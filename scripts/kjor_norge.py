#!/usr/bin/env python3
"""Kjører bygg_omrade.py for alle områdene i manifestet fra del_i_omrader.py, parallelt, og kan avbrytes og startes igjen.

  1. Steder fra pbf_til_loyper.py deles per område (bare de innen området + margin).
  2. Hvert område bygges i egen prosess (--samtidig), med egen logg og utfil. Områder som alt er ferdige hoppes over.
  3. Status skrives til <mappe>/status.json, og SQL for tabellen `omrade` samles i <mappe>/omrader.sql.

    python3 -I scripts/kjor_norge.py --mappe scripts/ut/omrader --steder scripts/ut/norge/steder.json --dtm "dtm/*.tif" [--samtidig 4] [--kun id,id] [--maks 10]
"""
import argparse, json, os, subprocess, sys, threading, time
from concurrent.futures import ThreadPoolExecutor, as_completed

HER = os.path.dirname(os.path.abspath(__file__))
ROT = os.path.join(HER, "..")
sys.path.insert(0, HER)
from bygg_omrade import bbox_av


AKTIVE = {}  # id -> (starttid, loggfil) for områder som bygges nå
SQL_LÅS = threading.Lock()  # én tråd om gangen skriver til src/data/omrader.sql


def bygg(m, a, steder, status):
    id_ = m["id"]
    mappe = os.path.join(a.mappe, id_)
    fil = os.path.join(ROT, "src", "data", f"trails-{id_}.json")
    if status.get(id_, {}).get("ok") and os.path.exists(fil):
        return id_, "hoppet (ferdig fra før)"
    s, w, n, e = bbox_av(os.path.join(mappe, "osm.json"))
    mar = 0.06
    lokale = [x for x in steder if s - mar <= x["lat"] <= n + mar and w - mar * 2 <= x["lon"] <= e + mar * 2]
    sf = os.path.join(mappe, "steder.json")
    json.dump(lokale, open(sf, "w"), ensure_ascii=False)
    cmd = [sys.executable, "-X", "utf8", os.path.join(HER, "bygg_omrade.py"), "--id", id_, "--navn", m["navn"], "--osm", os.path.join(mappe, "osm.json"), "--steder", sf, "--overskriv"]
    if a.dtm:
        cmd += ["--dtm", a.dtm]
    elif a.uten_terreng:
        cmd += ["--uten-terreng"]  # ellers hentes terrenget fra Kartverkets API (tregt)
    t0 = time.time()
    logg = os.path.join(mappe, "bygg.log")
    AKTIVE[id_] = (t0, logg)
    try:
        with open(logg, "w", encoding="utf-8", buffering=1) as lf:  # loggen skrives underveis, så fremdriften kan følges
            p = subprocess.Popen(cmd, stdout=lf, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace", cwd=ROT)
            try:
                p.wait(timeout=a.timeout)
            except subprocess.TimeoutExpired:
                p.kill()
                raise
        tekst = open(logg, encoding="utf-8", errors="replace").read()
        sql = [l for l in tekst.splitlines() if l.startswith("insert into public.omrade")]
        ok = p.returncode == 0 and bool(sql)
        status[id_] = dict(ok=ok, sek=round(time.time() - t0), feil=None if ok else tekst[-300:])
        if ok:
            linje = sql[0].replace("'Test'", "'" + m["navn"].replace("'", "''") + "'")
            with open(os.path.join(a.mappe, "omrader.sql"), "a") as f:
                f.write(linje + "\n")
            # Samme linje i repoet, så GitHub-jobben setter området inn i Neon når filen pushes (ingen manuell SQL)
            repo_sql = os.path.join(ROT, "src", "data", "omrader.sql")
            with SQL_LÅS:
                finnes = open(repo_sql, encoding="utf-8").read() if os.path.exists(repo_sql) else ""
                if f"values ('{id_}'," not in finnes:
                    with open(repo_sql, "a", encoding="utf-8") as f:
                        f.write(linje + "\n")
    except subprocess.TimeoutExpired:
        status[id_] = dict(ok=False, sek=round(time.time() - t0), feil="tidsavbrudd")
    AKTIVE.pop(id_, None)
    if not status[id_]["ok"] and os.path.exists(fil):
        os.replace(fil, fil + ".feilet")  # en halvferdig løypefil skal aldri havne i en commit; et nytt forsøk bygger på nytt
    json.dump(status, open(os.path.join(a.mappe, "status.json"), "w"), ensure_ascii=False, indent=1)
    return id_, "ok" if status[id_]["ok"] else "FEILET: " + str(status[id_]["feil"])[:120]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mappe", required=True)
    ap.add_argument("--steder", required=True)
    ap.add_argument("--dtm")
    ap.add_argument("--uten-terreng", action="store_true", help="hopp over terreng helt (test)")
    ap.add_argument("--samtidig", type=int, default=max(1, min(4, os.cpu_count() or 1)))
    ap.add_argument("--kun")
    ap.add_argument("--maks", type=int)
    ap.add_argument("--timeout", type=int, default=7200)
    a = ap.parse_args()
    man = json.load(open(os.path.join(a.mappe, "manifest.json")))
    if a.kun:
        man = [m for m in man if m["id"] in a.kun.split(",")]
    sp = os.path.join(a.mappe, "status.json")
    status = json.load(open(sp)) if os.path.exists(sp) else {}
    man = [m for m in man if not status.get(m["id"], {}).get("ok")]
    if a.maks:
        man = man[: a.maks]
    steder = json.load(open(a.steder))
    print(f"{len(man)} områder, {a.samtidig} samtidig, {len(steder)} steder", flush=True)
    ferdig = [0]
    stopp = threading.Event()

    def fremdrift():
        """Hvert halve minutt: hvor mange som er ferdige og hva hvert pågående område holder på med (siste linje i bygg.log)."""
        while not stopp.wait(30):
            rader = []
            for id_, (t0, lf) in list(AKTIVE.items()):
                try:
                    linjer = [l.strip() for l in open(lf, encoding="utf-8", errors="replace").read().splitlines() if l.strip()]
                except OSError:
                    linjer = []
                steg = next((l for l in reversed(linjer) if l.startswith("$ ")), "starter")[2:]
                sist = linjer[-1][:60] if linjer else ""
                rader.append(f"    {id_} ({(time.time() - t0) / 60:.0f} min): {steg} | {sist}")
            print(f"[{time.strftime('%H:%M')}] {ferdig[0]}/{len(man)} ferdige, {len(rader)} pågår" + ("\n" + "\n".join(rader) if rader else ""), flush=True)

    threading.Thread(target=fremdrift, daemon=True).start()
    with ThreadPoolExecutor(a.samtidig) as ex:
        fut = {ex.submit(bygg, m, a, steder, status): m["id"] for m in man}
        for f in as_completed(fut):  # skriv hvert område straks det er ferdig
            id_, res = f.result()
            ferdig[0] += 1
            sek = status.get(id_, {}).get("sek", 0)
            print(f"[{time.strftime('%H:%M')}] {ferdig[0]}/{len(man)} {id_}: {res} ({sek // 60} min)", flush=True)
    stopp.set()
    feilet = [k for k, v in status.items() if not v.get("ok")]
    print(f"ferdig. {sum(1 for v in status.values() if v.get('ok'))} ok, {len(feilet)} feilet" + (": " + ", ".join(feilet) if feilet else ""))


if __name__ == "__main__":
    main()
