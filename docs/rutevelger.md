# Rutevelger: velg løyper fra Turrutebasen eller OpenStreetMap

Verktøy på `/rutevelger` (https://skiglede.netlify.app/rutevelger, også lenke nederst på Løyper-siden). Det lar deg se kandidater fra to kilder i samme kart, velge hvilke som skal inn i appen, og lage en fil som importeres.

## Datakilder
- **Turrutebasen (Kartverket, CC BY 4.0):** ferdig innebygd. Lista kommer fra `src/data/kandidater-turrutebasen.json`, laget av `scripts/hent_kandidater.py` (område 59.45–59.70 N, 7.15–7.55 Ø). Kjør skriptet på nytt for å oppdatere eller utvide området (`--bbox sør,vest,nord,øst`).
- **OpenStreetMap (ODbL):** hentes av deg lokalt med `scripts/hent_osm_loyper.mjs` (Overpass er blokkert fra Claudes arbeidsmiljø) og lastes inn i siden som fil.

## Steg for steg
1. **Hent OSM-løyper** (på din maskin, i en klone av repoet, Node 18+):
   ```
   git pull
   node scripts/hent_osm_loyper.mjs
   ```
   Området er som standard Hovden (`--bbox 59.50,7.25,59.62,7.45`). Skriptet skriver `scripts/ut/osm-loyper.json` og en liste i terminalen med kilometer per løypenavn. Går Overpass tregt eller feiler: kjør spørringen i overpass-turbo, eksporter som JSON og bruk `node scripts/hent_osm_loyper.mjs --fil eksport.json`. Selve eksportfilen kan også lastes rett inn i Rutevelgeren.
2. **Åpne Rutevelgeren** (nettadressen over). Velg kilde:
   - «Turrutebasen» viser kandidatene som allerede er innebygd.
   - «OpenStreetMap: last inn fil …» åpner en filvelger. Velg `osm-loyper.json`. Biter med samme navn slås sammen til én kandidat. Biter uten navn blir hver sin kandidat («(uten navn) way/123»).
3. **Se på kartet.** Stiplet blå linje = løyper som allerede ligger i appen. Oransje = kandidater fra valgt kilde. Rød = valgt. «i appen» står bak kandidater med samme navn som en løype vi har.
4. **Velg løyper**: trykk på navnet i lista eller på linja i kartet (trykk igjen for å fjerne). Zoom med +/−, musehjul eller klyping, og dra for å flytte kartet.
5. **Under «Valgte»**: gi hver løype et navn (påkrevd for OSM-biter uten navn), og velg **Tur-retur** (ut og tilbake samme vei) eller **Sløyfe** (lukket runde; endene må ligge innen 600 m fra hverandre, ellers hoppes løypa over i importen).
6. **Trykk «Last ned valgte-loyper.json».**
7. **Importer** (en av to måter):
   - Gi filen til Claude i chatten, så importerer og kontrollerer jeg den.
   - Eller kjør selv: `python3 -I scripts/importer_valgte.py valgte-loyper.json` (trenger `pip install pyproj`, og tilgang til Kartverkets høyde-API). Skriptet kjeder bitene, setter punkt hvert 50. m, henter høyde og skog, beregner avstand og skriver til `src/data/trails.json` (løype med samme id erstattes).
8. **Terreng og kontroll** for de nye løypene:
   ```
   python3 -I scripts/hent_terreng.py --ut src/data/trails.json --navn "Navnet"
   node scripts/kontroller-loyper.mjs
   ```
9. **Se løypa i kartet i appen**, bygg (`npx expo export --platform web`), commit og push. Netlify bygger fra repoet.

## Hva som ikke gjøres automatisk
- Importen lager ikke koblinger der kildene mangler dem. Ligger endene langt fra hverandre, velg Tur-retur eller legg inn koblingen først (se `scripts/bygg_ny_lysloype_runde.py`).
- Dublett-sjekken er bare på navn («i appen»). Sammenlign geometrien i kartet.
- Løyper hentet fra OSM får `kilde: "osm"` i trails.json; husk å krediteres OpenStreetMap-bidragsyterne (ODbL) i appen hvis OSM-data tas i bruk.
