# Rutevelger: OSM som grunndata, navn fra Turrutebasen

Verktøy på `/rutevelger` (https://skiglede.netlify.app/rutevelger, lenke nederst på Løyper-siden). Beslutning [Bruker]: **OpenStreetMap er grunndata for løypegeometri, og navnene hentes fra Turrutebasen** (Kartverket). Backcountry (ikke preparert) tas ut.

## Hvordan dataene settes sammen (`src/data/osm.ts`, testet i `scripts/test-osm.ts`)
1. OSM-biter leses fra `scripts/hent_osm_loyper.mjs` (eller rå Overpass-JSON). Biter med `piste:grooming=backcountry` kastes.
2. Hver OSM-bit får **navn fra Turrutebasen** hvis minst 50 % av biten ligger innen 25 m langs en navngitt Turrutebasen-løype (`navnKilde: turrutebasen`). Ellers brukes OSM-navnet (`osm`). Ellers står den uten navn. (Turrutebasens «Ukjent» gir aldri navn.)
3. **Dekning mot appen:** andel av biten innen 30 m av løypene som allerede ligger i appen. ≥ 80 % = «i appen», under 50 % = «NY».
4. På den første kjøringen mot Hovden-filen fikk 192 av 226 biter (88,5 km) navn fra Turrutebasen, 24 fra OSM, og bare 10 biter (1,5 km) manglet navn.

## Steg for steg (PowerShell)
1. Hent OSM-løyper: `git pull`, så `node scripts\hent_osm_loyper.mjs` (skriver `scripts\ut\osm-loyper.json`). Eget område: `--bbox "59.50,7.25,59.62,7.45"` (anførselstegn i PowerShell). Overpass-feil: eksporter fra overpass-turbo og bruk `--fil`.
2. Åpne siden og trykk «OpenStreetMap: last inn fil …», velg `osm-loyper.json`.
3. **Se kartet.** Oransje = ny bit, beige = delvis i appen, grå = allerede i appen, rød = krysset av, grønn = med i en løype.
4. **Velg biter:** trykk på et navn under «Løyper etter navn» (krysser av alle bitene med det navnet), eller trykk på biter i kartet. «Uten navn» åpner listen med biter uten navn.
5. **Slå sammen:** gi navn og velg Tur-retur eller Sløyfe, trykk «Slå sammen til løype». Eller bruk «Lag én løype per nytt navn» (bare nye biter fra navn som ikke allerede er i appen) / «per navn (alle)».
6. Under «Løyper som skal importeres» kan du endre navn og type eller fjerne en løype. Trykk «Last ned valgte-loyper.json».
7. **Importer:** gi filen til Claude i chatten, eller `python3 -I scripts/importer_valgte.py valgte-loyper.json` (Windows: `python scripts\importer_valgte.py valgte-loyper.json`, `pip install pyproj`). Skriptet kjeder bitene (OSM 25 m toleranse), setter punkt hvert 50. m, henter høyde og skog, beregner avstand og skriver til `src/data/trails.json`. **Det advarer hvis ikke alle bitene henger i én kjede** (forgreninger tas ikke med): del da opp i flere løyper.
8. Terreng og kontroll: `python3 -I scripts/hent_terreng.py --ut src/data/trails.json --navn "Navnet"` og `node scripts/kontroller-loyper.mjs`. Se løypa i kartet, bygg, commit og push.

## Begrensninger og kjente punkter
- Importen lager én kjede per løype. Nettverk med forgreninger (arenaen ved Hovden: 62 biter, 9 km) må deles i flere løyper eller bygges som sløyfe med tilpasset skript.
- Sløyfe krever at endene ligger innen 600 m. Ellers: tur-retur eller legg inn koblingen.
- Turrutebasen-kandidater (`src/data/kandidater-turrutebasen.json`, `scripts/hent_kandidater.py`) brukes både som navnekilde og som alternativ kilde i siden.
- OSM-data krever kreditering (ODbL, © OpenStreetMap-bidragsytere) i appen når de tas i bruk. Importerte løyper får `kilde: "osm"`.
