# Smøreapp for Hovden – regelspesifikasjon (utkast 1)

Status: utkast fra samtale 3. november 2026. Merking: **[Kilde]** = fra kilde jeg har lest, **[Bruker]** = fra Kristoffers erfaring, **[Forslag]** = mitt forslag som ikke er validert, **[Åpent]** = må avklares.

## 1. Formål
Gi en komplett Swix-smøring for en bestemt løype, før start. Skille seg fra dagens apper (Swix Wax Tip, Wax Thermometer) ved å (a) tilpasse seg løypa og ikke bare posisjonen, og (b) bygge opp fra grunnsmøring til topplag, ikke bare vise dagens voks.

## 2. Brukerflyt
- Input: løype, dato, starttid, **Trening** eller **Tur** [Bruker].
- Tempo [Forslag, justerbart]: Trening 9 km/t, Tur 5 km/t. Brukes til å regne posisjon om til klokkeslett, så riktig timesprognose slås opp.
- Output: én komplett lagstabel før start. Ingen smørepunkter underveis, fordi svært få smører om [Bruker].

## 3. Datakilder
| Behov | Kilde | Status |
|---|---|---|
| Observert vær, timesverdier, 1 km | MET Nordic Analysis via THREDDS/OPeNDAP (`metpplatest` siste 3 døgn, `metpparchive` fra 2018) | **Testet fra arbeidsområdet**. Variabler: air_temperature_2m (K), precipitation_amount, relative_humidity_2m (0–1), wind_speed_10m, shortwave-integral (J/m² per time). Rutenett: LCC, 1796×2321. Hovden (59.5667 N, 7.3667 E): i=468, j=748, 838 m. |
| Prognose | Yr/MET Locationforecast | Krever identifiserende User-Agent med kontaktinfo, cache, `If-Modified-Since`, koordinater med 4 desimaler, backend som mellomledd. CC BY 4.0. [Åpent: kontakt til User-Agent] |
| Høyde | Kartverket `https://ws.geonorge.no/hoydedata/v1/punkt` | **Testet** (817 m ved Hovden, kilde dtm1). WPS-tjenesten er merket deprecated. |
| Løyper | OSM (`piste:type=nordic`) | Mer komplett enn Turrutebasen, men med dubletter. Må ryddes (Bykle: ca. 375 km merket preppet mot ca. 170 km oppgitt). |
| Skog / skygge | Kartverket DOM (overflatemodell) eller AR50/AR5 | Finnes. Dekning og vilkår ikke sjekket for Hovden. |
| Stasjon | Hovden–Lundane (temperatur, nedbør, vind, snødybde, ikke fuktighet) | Valgfritt, bare ett punkt. |

## 4. Snøtilstand
- Typer [Kilde, Swix-system]: 1 nysnø, 2 finkornet, 3 gammel omdannet, 4 våt, 5 frossen/oppfrosset (normalt klister).
- Nysnø nullstiller tilstanden [Forslag].
- **Omdannet snø**: begynner å omdannes ved ca. +1 °C med sol, lite vind og uten snøfall siden sist. Regn og flere runder gir grovere korn [Bruker].
- **Skarp snø** (sliter voks og klister mest) [Bruker]: avhenger av hvor kalde nettene har vært etter milde dager (tine/frys-runder). Løypene freses antatt daglig, så fresing er ikke en variabel [Bruker]. Skarpe forhold er typisk et mars-problem på Hovden og et sent-februar-problem i Oslo [Bruker]; årstidseffekten skal komme ut av strålingsdata, ikke en fast månedsregel [Forslag].
- Skarphetsindeks [Forslag]: antall dager med mild dag og kald natt de siste 14, nattens laveste temperatur, dagens maks, regn, dager siden siste snøfall.
- [Åpent] Terskler i tall for «skarp».

## 5. Soleksponering per seksjon [Forslag]
Faktor 0–1 per seksjon og time: terrengskygge (horisontvinkel fra høydemodell og solposisjon) × hellingsretning × skog (DOM eller AR5) brukt på MET Nordics strålingsverdi.
- [Åpent] 10 m terrengmodell er grovt for løypenivå; Kartverkets REST bruker dtm1 (1 m).

## 6. Temperatur per seksjon [Forslag]
Temperatur justeres med høyde (ca. 0,6 °C per 100 m) mot 1 km-cellens høyde. Inversjoner kan avvike.

## 7. Stabler (kun Swix først) [Bruker]
### 7.1 Hardvoks
Binder (VG35 grønn, ved aggressiv/skarp omdannet snø og lange turer; VG30 blå ved mildere snø [Kilde]) → base fra **kaldt til varmt** → dagens voks → **dekke** av kaldere voks.
- Hardvoks bygges i 4–10 tynne lag i pyramideform, tykkest under foten; festesone ca. 65–70 cm fra hælen [Kilde].
- Dekke: ett eller to trinn kaldere. Antall avhenger av **hvor lenge** man er i varmere føre [Bruker]: noen få km eller ca. en time gir ett trinn; lang strekning videre (f.eks. 12 km av 20) gir to. [Åpent: tidsgrenser; forslag: 1 t = ett, 2 t eller mer = to]

### 7.2 Klister (omdannet snø)
Baseklister (KB20C/KX20 grønn) → **isklister** (blå) → flere mellomlag (kan bygges opp i mange lag) → dagens klister (tykkere enn lagene under til sammen [Kilde]). Hardvoks på toppen er unntaket og brukes ved isingsfare, ikke som standard [Bruker].
- Antall lag og valg av klister styres av hvor skarp snøen er [Bruker]. [Åpent: hvilke klistertyper hører til hvilken skarphetsgrad]

## 8. Swix-tabeller – PLASSHOLDERE, må verifiseres mot offisiell tabell
VP (nysnø / omdannet): VP30 −8…−16 / −12…−20; VP40 −4…−10 / −5…−14; VP45 −1…−5 / −3…−8; VP50 0…−3 / −1…−6; VP55 +1…−2 / 0…−5; VP60 +2…−1 / −1…−4; VP65 0…+2 / 0…−4.
Klister (fra produktlister): KX30 −12…0; KX35 +1…−4; KX40S −4…+2; KX45N −4…+1; KX65 +1…+5; KX75 +2…+15.

## 9. Arkitektur [Bruker + Forslag]
- Klient: Expo med web som første mål (Expo Router), senere Android/iOS.
- Database: Neon (Postgres + PostGIS).
- Backend: API og planlagt jobb som henter og lagrer værdata; regelmotor som delt TypeScript-modul.
- Egen feilsøkingsside som viser mellomresultater: tine/frys-historikk, skarphetsindeks, soleksponering, snøtilstand per time og begrunnelse for stabelen.

## 10. Åpne punkter
1. Tall for «skarp snø» (tine/frys-runder, nattemperatur).
2. Tidsgrenser for ett/to dekketrinn.
3. Hvilke klistertyper og hvor mange lag per skarphetsgrad.
4. Offisielle Swix-tabeller for hardvoks og klister (nåværende sesong).
5. Kontaktinfo til Yr-User-Agent.
6. Lisens og dekning for DOM og AR5 på Hovden.
7. Validering mot egne observasjoner («fungerte / fungerte ikke»).

## 11. Implementert i regelmotoren (src/engine), 3. november
- `snø.ts`: skarphetsindeks 0–100 fra tine/frys-runder siste 14 døgn (mild dag maks ≥ +1 °C, påfølgende natt; full skarphet ved −6 °C; vekter 1/0,6/0,3 etter alder; sol øker). Snøfall ≥ 5 mm siste 48 t nullstiller til nysnø. Advarsel når snittet siste 7 døgn er over +3 °C (forutsetter snødekke).
- `tur.ts`: seksjoner à ca. 250 m, tid per seksjon fra tempo, temperatur justert 0,6 °C/100 m mot cellehøyden, sol-tillegg opptil +2 °C per 500 W/m² dempet av skog. Hellingsretning og terrengskygge mangler fortsatt.
- `stabel.ts`: hardvoks (binder → base → dagens voks → dekke) eller klister (baseklister → isklister → mellomlag → dagens klister). Klister når snøen er omdannet og skarphet ≥ 50 eller varmest ≥ +0,5 °C.
- Turdagen bruker observert vær 2. november som stand-in for prognose til Yr er koblet på.

**[Åpent 8] Dekketrinn:** punkt 7.1 sier at antall trinn avhenger av tiden i *varmere* føre. Kristoffers eksempel (7–8 km kaldt før det blir varmere, da to) tilsier at det er varigheten i det *kalde* partiet. Motoren bruker det siste: under 1 t kaldt = ett trinn, 2 t eller mer = to. Må bekreftes.
