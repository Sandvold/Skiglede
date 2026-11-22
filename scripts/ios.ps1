# Bygger iOS-appen i Expo og sender den til TestFlight.
# Bruk (PowerShell, i Skiglede-mappen):  .\scripts\ios.ps1
# Uten API-nøkkel spør Expo om Apple-ID og tofaktorkode.
# Med API-nøkkel (EXPO_ASC_API_KEY_PATH, EXPO_ASC_KEY_ID, EXPO_ASC_ISSUER_ID) testes nøkkelen først.
$ErrorActionPreference = 'Stop'
$env:EAS_BUILD_NO_EXPO_GO_WARNING = 'true'
$env:EXPO_NO_CAPABILITY_SYNC = '1'  # Sign in with Apple er slått på manuelt; Apples API avviser automatisk synk
if ($env:EXPO_ASC_API_KEY_PATH -or $env:EXPO_ASC_KEY_ID -or $env:EXPO_ASC_ISSUER_ID) {
  node scripts/sjekk-asc.mjs
  if ($LASTEXITCODE -ne 0) { Write-Host 'Rett opp nøkkelen over, eller fjern variablene (Remove-Item Env:EXPO_ASC_*) for å bruke Apple-ID.'; exit 1 }
}
npx eas-cli build -p ios --profile production --auto-submit
