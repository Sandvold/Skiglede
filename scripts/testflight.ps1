# Sender siste iOS-bygg til TestFlight med App Store Connect-nøkkelen (ingen Apple-innlogging).
# Forutsetter at AuthKey_Z23J4V7RFV.p8 ligger i Downloads (stien står i eas.json, profil "testflight").
# Bruk (PowerShell, i Skiglede-mappen):  .\scripts\testflight.ps1
$ErrorActionPreference = 'Stop'
$env:EAS_BUILD_NO_EXPO_GO_WARNING = 'true'
npx eas-cli submit -p ios --profile testflight --latest
