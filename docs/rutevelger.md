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

## Automatiske runder fra OSM (`scripts/bygg_osm_runder.py`)
Ingen manuell plukking: skriptet bruker OSM-nettet (uten backcountry og Hartevatn, som brøytes lite) og gjør tur-retur-løyper til runder. Veien ut beholdes, veien tilbake er korteste vei i nettet som unngår veien ut. Godtas hvis under 25 % overlapp og ikke urimelig lang. Små biter (under ca. 1,5 km) tas ikke med som egne løyper; de er bare koblinger i nettet.
Kjør uten `--skriv` for rapport, med `--skriv` for å lagre; deretter `hent_terreng.py` og `npm run kontroller`. Resultat 3. nov: Ny Lysløype Hovden (4,5 km, ekte OSM-vei tilbake til stadion i stedet for rette linjer) og Auversvatn (16,7 km runde). Hovden fjellpark gav en mulig runde på 7,2 km, men med uryddig retur, så den er ikke tatt i bruk.

## Oslo (Nordmarka) fra OSM (`scripts/bygg_osm_omrade.py`)
Området har ingen eksisterende løyper, så rundene lages fra OSM-nettet (preparerte biter; backcountry og scooter ute; upreparerte biter over 150 m bare som siste utvei, kostnadsfaktor 4). Hver runde går fra et startpunkt til et mål (hytte/utsiktspunkt) på korteste vei og tilbake på en annen vei. Godtas ved 5–25 km, under 25 % overlapp og under 15 % upreparert. Navn: «Start – Mål». Data: `scripts/ut/osm-oslo.json`, ut: `src/data/trails-oslo.json`.
Lagt inn 3. nov: 7 runder fra Sognsvann, Frognerseteren og Holmenkollen. Fossum (Eiksmarka) henger ikke sammen med noe preparert nett i OSM (950 m til hovednettet), og Sørkedalen/Krokskogen er et eget nett uten mål; derfor ikke med ennå.

## Tre områder (4. nov): Hovden, Bærumsmarka, Nordmarka
`src/data/omrader.ts` har tre områder med egen løypefil og værcelle: `trails.json` (Hovden), `trails-baerumsmarka.json` (værcelle 59.955 N 10.52 E, 228 m) og `trails-nordmarka.json` (59.98 N 10.65 E, 290 m). Gammelt valg «oslo» i nettleseren tolkes som Nordmarka.
Bærumsmarka bygges med `scripts/bygg_auto_ruter.py` fra startpunkter (parkeringer): for hvert startpunkt tas én runde per lengdebånd (ca. 4, 7, 11 og 16 km ut), vendepunktet navngis fra OSM-stedsnavn, og runder som ligner hverandre droppes. OSM-nettet i Bærumsmarka har hull mellom delnett, så nettene kobles der avstanden er under 350 m (regnes som upreparert strekk). Tur-retur-varianter lages med `lag_retur_varianter.py` (bruker feltet `mal` på løypa).
Data: `scripts/ut/osm-baerum.json` og `osm-oslo.json`. Startpunkt som ikke er nær løype (Fossum, 600 m) starter ved nærmeste løype.

## Hente OSM-løyper (Overpass) uten å stoppe på 429/504
`node scripts/hent_osm_loyper.mjs --bbox sør,vest,nord,øst` deler området i ruter à ca. 11 km og tar dem én og én (`scripts/lib/pool.mjs`, en enkel worker-pool med delt kø). Mellom spørringene er det 3 s pause, og ved 429 (for mange kall) eller 504 (server opptatt) ventes 60–90 s før nytt forsøk, opptil 4 forsøk per rute (bytter server fra tredje forsøk). Fremdriften lagres i `<ut>.fremdrift.json` etter hver rute: feiler noen ruter, lagres resten, skriptet melder hvilke som mangler (avslutter med kode 2), og samme kommando på nytt henter bare dem. Overpass bør tas sekvensielt (standard). `--samtidig 2` bruker to ulike servere parallelt hvis du har det travelt; `--pause`, `--vent` og `--forsok` justerer farten.
