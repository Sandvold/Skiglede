#!/usr/bin/env bash
# Venter til en tekst finnes i den publiserte appen (Netlify). Bruk: scripts/vent-deploy.sh "tekst" [url]
# Søker i alle index-pakker, ikke bare den første (første .js-fil er metro-runtime og har ikke appkoden).
tekst="${1:?Oppgi en tekst som bare finnes i nytt bygg}"; url="${2:-https://skiglede.netlify.app}"
for i in $(seq 1 30); do
  for f in $(curl -s "$url/" | grep -o '_expo/static/js/web/index-[^"]*\.js'); do
    curl -s "$url/$f" | grep -q -- "$tekst" && { echo "LIVE"; exit 0; }
  done
  sleep 15
done
echo "ikke live etter 7,5 min"; exit 1
