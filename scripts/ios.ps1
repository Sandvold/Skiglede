# Bygger iOS-appen i Expo og sender den til TestFlight.
# Bruk (PowerShell, i Skiglede-mappen):  .\scripts\ios.ps1
# Bruker alltid API-nøkkelen (aldri Apple-ID/SMS). Nøkkelen testes først, og bygget stoppes hvis Apple ikke godtar den.
$ErrorActionPreference = 'Stop'
$env:EAS_BUILD_NO_EXPO_GO_WARNING = 'true'
$env:EXPO_NO_CAPABILITY_SYNC = '1'  # Sign in with Apple er slått på manuelt; Apples API avviser automatisk synk
# Standardverdier for nøkkelen (ikke hemmelige; selve .p8-filen ligger i Nedlastinger). Overstyres av variabler du har satt selv.
if (-not $env:EXPO_ASC_API_KEY_PATH) { $env:EXPO_ASC_API_KEY_PATH = Join-Path $env:USERPROFILE 'Downloads\AuthKey_Z23J4V7RFV.p8' }
if (-not $env:EXPO_ASC_KEY_ID) { $env:EXPO_ASC_KEY_ID = 'Z23J4V7RFV' }
if (-not $env:EXPO_ASC_ISSUER_ID) { $env:EXPO_ASC_ISSUER_ID = 'c6267f3a-8a40-44e6-bf5e-7255d770f4eb' }
if (-not $env:EXPO_APPLE_TEAM_ID) { $env:EXPO_APPLE_TEAM_ID = 'Z6T865J5G2' }
if (-not (Test-Path $env:EXPO_ASC_API_KEY_PATH)) { Write-Host "Finner ikke nøkkelfilen: $env:EXPO_ASC_API_KEY_PATH"; exit 1 }
node scripts/sjekk-asc.mjs
if ($LASTEXITCODE -ne 0) { Write-Host 'Apple godtok ikke nøkkelen. Bygget stoppes så Expo ikke ber om Apple-ID og SMS.'; exit 1 }
npx eas-cli build -p ios --profile production --auto-submit
