# Bygger iOS-appen i Expo og sender den til TestFlight.
# Bruk (PowerShell, i Skiglede-mappen):  .\scripts\ios.ps1
# Første gang spør Expo om Apple-ID og tofaktorkode og ordner sertifikater selv.
$ErrorActionPreference = 'Stop'
npx eas-cli build -p ios --profile production --auto-submit
