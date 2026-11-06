# Hele Norge: rask kjøring (Geofabrik + lokal terrengfil)

Alt kjøres lokalt i PowerShell (Overpass og Geofabrik er blokkert fra skyen). Tidsbruk: noen timer, ikke dager.

## 1. Én gang: verktøy
```
pip install osmium pyproj scikit-learn scipy numpy rasterio
```

## 2. Last ned data
- OSM for Norge: https://download.geofabrik.de/europe/norway-latest.osm.pbf (ca. 1,3 GB) → `data\norway-latest.osm.pbf`
- Høydemodell DTM10 (UTM33, GeoTIFF) fra https://hoydedata.no (Last ned → «DTM 10 m», hele Norge eller fylkesvis) → pakk ut i `data\dtm\` (filer `*.tif`).

## 3. Løyper og steder fra pbf
```
python -I scripts/pbf_til_loyper.py --pbf data\norway-latest.osm.pbf --ut scripts\ut\norge
```
Gir `osm-loyper.json` (alle nordiske pistes) og `steder.json` (hotell, hytter, parkering, tettsteder ...).

## 4. Del i skiområder
```
python -I scripts/del_i_omrader.py --osm scripts\ut\norge\osm-loyper.json --ut scripts\ut\omrader
```
Klynger nettet (eps 2 km, maks 30 km, minst 15 km løype), navngir fra Kartverket og skriver `manifest.json`. Hovden, Nordmarka, Bærumsmarka og Sjusjøen er låst og hoppes over. Se gjennom `manifest.json` og rett navn før neste steg.

## 5. Bygg alle områder parallelt
```
python -I scripts/kjor_norge.py --mappe scripts\ut\omrader --steder scripts\ut\norge\steder.json --dtm "data\dtm\*.tif" --samtidig 4
```
Kan avbrytes og startes igjen (ferdige områder hoppes over, status i `status.json`). Test først med `--maks 2` eller `--kun id1,id2`. Loggen per område: `scripts\ut\omrader\<id>\bygg.log`. Uten `--dtm` hentes terreng fra Kartverkets API (ca. 1 min per løype, mye tregere).

## 6. Inn i appen
1. Kjør `scripts\ut\omrader\omrader.sql` i Neon (SQL-editoren, eller send meg innholdet).
2. `git add src/data/trails-*.json && git commit && git pull --rebase && git push`. Opplastingsjobben kontrollerer løypene (dårlige settes i karantene) og laster dem til Neon.
3. Start «Oppdater værhistorikk» i GitHub Actions én gang; deretter går den hver 4. time.

## Kjente begrensninger
- Pbf-skriptet og rastersamplingen er testet på små uttak, ikke på hele Norge: gi beskjed om feil, så retter jeg.
- Områder uten runder (f.eks. bare korte biter) får ingen løyper og hoppes over.
- Navn kommer fra Kartverkets stedsnavn; sjekk manifestet for rare navn.
