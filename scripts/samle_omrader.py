"""Flytter områdelinjene fra scripts/ut/omrader/omrader.sql (alle kjøringer, også eldre) inn i src/data/omrader.sql, som GitHub-jobben bruker.
Hopper over områder som alt ligger i fila, og setter vaer=true. Kjør før `git add src/data`:

  python -X utf8 scripts\\samle_omrader.py
"""
import os, re

HER = os.path.dirname(os.path.abspath(__file__))
KILDE = os.path.join(HER, "ut", "omrader", "omrader.sql")
MÅL = os.path.join(HER, "..", "src", "data", "omrader.sql")


def id_av(l):
    m = re.search(r"values \('([^']+)'", l)
    return m.group(1) if m else None


def main():
    if not os.path.exists(KILDE):
        raise SystemExit(f"finner ikke {KILDE}")
    har = [l.strip() for l in open(MÅL, encoding="utf-8") if l.strip()] if os.path.exists(MÅL) else []
    ider = {id_av(l) for l in har}
    nye = []
    for l in (x.strip() for x in open(KILDE, encoding="utf-8")):
        if not l.lower().startswith("insert into public.omrade ") or id_av(l) in ider:
            continue
        nye.append(re.sub(r",(true|false),(\d+)\) on conflict", r",true,\2) on conflict", l))
        ider.add(id_av(l))
    with open(MÅL, "a", encoding="utf-8") as f:
        f.write("".join(l + "\n" for l in nye))
    print(f"{len(nye)} nye områder lagt til ({len(har) + len(nye)} totalt i src/data/omrader.sql)")


if __name__ == "__main__":
    main()
