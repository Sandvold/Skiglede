# Hele Norge: rask kjøring (Geofabrik + lokal terrengfil)

Alt kjøres lokalt i PowerShell (Overpass og Geofabrik er blokkert fra skyen). Tidsbruk: noen timer, ikke dager.

## 1. Én gang: verktøy
```
pip install osmium pyproj scikit-learn scipy numpy rasterio
```

## 2. Last ned data
- OSM for Norge: https://download.geofabrik.de/europe/norway-latest.osm.pbf (ca. 1,3 GB) → `data\norway-latest.osm.pbf` (filnavnet kan ha dato, f.eks. `norway-261107.osm.pbf`; bruk det som står i mappa). Filen kan slettes etter steg 3.
- Høydemodell er valgfri (19 GB for hele Norge). Uten den hentes terrenget fra Kartverkets API. Med den: DTM10 fra https://hoydedata.no → `data\dtm\*.tif`.

## 3. Løyper og steder fra pbf
```
python -X utf8 scripts/pbf_til_loyper.py --pbf data\norway-latest.osm.pbf --ut scripts\ut\norge
```
Gir `osm-loyper.json` (alle nordiske pistes) og `steder.json` (hotell, hytter, parkering, tettsteder ...).

## 4. Del i skiområder
```
python -X utf8 scripts/del_i_omrader.py --osm scripts\ut\norge\osm-loyper.json --ut scripts\ut\omrader
```
Klynger nettet (eps 2 km, maks 30 km). Legg til `--min-km 3 --manifest` for å beholde små nett og id/navn fra tidligere kjøring (minst 3 km løype), navngir fra Kartverket og skriver `manifest.json`. Hovden og Sjusjøen er låst og hoppes over. Nordmarka og Bærumsmarka var låst til 10. nov, men bygges nå med landspipelinen og gjenbruker de gamle id-ene (`FASTE`). Se gjennom `manifest.json` og rett navn før neste steg. Windows: bruk alltid `python -X utf8` (aldri `-I`, den skjuler pakkene du har installert; uten utf8 krasjer JSON-skriving på cp1252).

## 5. Bygg områdene (ett fylke om gangen, anbefalt)
Bruk `kjor_fylke.py` under. `kjor_norge.py` kan kjøre alt i ett:
```
python -X utf8 scripts/kjor_norge.py --mappe scripts\ut\omrader --steder scripts\ut\norge\steder.json --dtm "data\dtm\*.tif" --samtidig 4
```
Kan avbrytes og startes igjen (ferdige områder hoppes over, status i `status.json`). Test først med `--maks 2` eller `--kun id1,id2`. Loggen per område: `scripts\ut\omrader\<id>\bygg.log`. Uten `--dtm` hentes terreng fra Kartverkets API (ca. 1 min per løype, mye tregere).

### Ett fylke om gangen
```
python -X utf8 scripts/kjor_fylke.py                          # oversikt: fylker, områder, km, ferdige
python -X utf8 scripts/kjor_fylke.py --fylke Telemark --maks 2   # test
python -X utf8 scripts/kjor_fylke.py --fylke Telemark          # hele fylket (Ctrl+C og start igjen er trygt)
```
Uten `--dtm` hentes terrenget fra Kartverkets API (tregt, men ingen nedlasting). Fylket slås opp mot Kartverket og lagres i `scripts\ut\omrader\fylker.json`.

## 6. Inn i appen (per fylke)
1. **Områdene** skrives automatisk til `src/data/omrader.sql` (en `INSERT … ON CONFLICT DO NOTHING` per område, med vaer=true) mens kjøringen går. Filen pushes sammen med løypefilene (`git add src/data`), og GitHub-jobben «Last opp løyper til Neon» setter områdene inn før løypene lastes opp. Ingen manuell SQL. Forutsetning (én gang, som databaseeier): `grant insert on public.omrade to vaer_skriver;`. Uten den skriver jobben en tydelig melding og laster løypene opp som før. Se opp for dobbelte områder med nesten lik posisjon.
   - Status når som helst: `python -X utf8 scripts\status.py` (krever DATABASE_URL): områder uten løyper, uten vær eller med gammelt vær.
   - Etter endringer i appen: `npx expo export --platform web`, så `node scripts/test-web.mjs` (vær mangler/gammelt/ferskt og nabo-løyper).
2. Deretter: `git add src/data/trails-*.json && git commit && git pull --rebase && git push`. Jobben «Last opp løyper til Neon» kontrollerer løypene (dårlige settes i karantene) og laster dem opp.
3. Værhistorikk: samles inn fra nå, uten tung første fylling. Områdene settes inn med `vaer = true`; værjobben (hvert 4. time, MET Nordic via OPeNDAP, `--vekst`) starter et nytt område med de siste 12 timene og lar vinduet vokse til 14 døgn (ca. 10 kall per område per kjøring etterpå). Etter to uker er historikken full; frem til da er snøberegningen mindre sikker (ikke et problem før snøsesongen). Hull etter en feilet kjøring fylles neste gang. Jobben bruker identifiserende User-Agent og venter ved 429. Alternativ kilde: `--kilde openmeteo` (ett kall for hele 14 døgn, men gratis bare til ikke-kommersiell bruk, og 0,5 °C varmere enn MET på Hovden i en test; sammenlignet 8 døgn, korrelasjon 0,994–1,000).

Hold oversikt over hvilke fylker som er kjørt: `kjor_fylke.py` uten argumenter viser ferdige/feilet per fylke.

## Hva byggeskriptene gjør (kort)
- Startpunkter fra steder (hotell, parkering, hytte) innen 600 m, minst 2,5 km fra hverandre. Rundløyper: maks 25 % overlapp, ≥75 % preparert, 3–26 km.
- **Tur-retur som reserve:** finnes ingen runde fra et startpunkt, lages tur-retur ut til det fjerneste punktet i avstandsbånd (1,25–13 km ut), `type: retur`, maks tre per start (den korteste droppes når det finnes fire). Standard er 8 startpunkter per område, minst 3 km mellom. Små nett (≥30 noder) beholdes.
- Ingen startpunkter: midten av nettet brukes.
- Navn: `navn_fra_turrutebasen.py` kjøres automatisk og gir løypene navn fra Turrutebasen der de følger en navngitt skiløype (kan kjøres på alle filer: `python -X utf8 scripts/navn_fra_turrutebasen.py --alle --skriv`). Mange områder har ingen navngitte løyper der, og beholder «Start – Sted».
- Kontrollen setter sløyfer med >30 % dobbel vei i karantene (ikke slettet).

## Kjente begrensninger
- Korte stadionrunder (under ca. 3 km) droppes bevisst; områder med bare slike (f.eks. lillesand-stadion) får ingen løyper.
- Områdenavn kommer fra Kartverkets stedsnavn og er ikke sjekket mot Turrutebasen; noen er rare («Skiområde 59.36 7.33»).
- `.gitignore` må ha `/data/` (ikke `data/`), ellers skjules `src/data/trails-*.json`.
