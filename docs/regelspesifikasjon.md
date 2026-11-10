# Smøreapp for Hovden – regelspesifikasjon (utkast 1)

Status: utkast fra samtale 3. november 2026. Merking: **[Kilde]** = fra kilde jeg har lest, **[Bruker]** = fra Kristoffers erfaring, **[Forslag]** = mitt forslag som ikke er validert, **[Åpent]** = må avklares.

## 1. Formål
Gi en komplett Swix-smøring for en bestemt løype, før start. Skille seg fra dagens apper (Swix Wax Tip, Wax Thermometer) ved å (a) tilpasse seg løypa og ikke bare posisjonen, og (b) bygge opp fra grunnsmøring til topplag, ikke bare vise dagens voks.

## 2. Brukerflyt
- Input: løype, dato, starttid, **Trening** eller **Tur** [Bruker].
- Tempo [Bruker]: klassisk Tur 7 km/t og Trening 10 km/t; skøyting Tur 10 og Trening 15. Brukes til å regne posisjon om til klokkeslett, så riktig timesprognose slås opp.
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
Maks **fire lag** [Bruker: «sjelden mer enn tre-fire»; Swix-veiledningen bekrefter]. Swix: ett tynt baselag (KB20C/KX20), ett mellomlag (KX35N/KX45N) og ett tykt toppsjikt som er tykkere enn base + mellomlag til sammen. Valgfritt: tre eller flere tynne lag hardvoks over klisteret mot ising.
Valg av dagens klister [Bruker]: **KX-klistrene** (KX35N, KX45N, KX40S, KX65, KX75) når været er veldig stabilt. **Universal** (K22 fra −3 °C, K21S kaldere) er mest brukt totalt og passer ved skiftende vær (utslag ≥ 4 °C i lufta ±3 t rundt turen, eller ≥ 5 °C langs løypa). **KN33** (+1…−7) og **KN44** (+5…−3), Nero, ved sludd og vekslende forhold (nedbør ≥ 0,3 mm/t mellom −1 og +3,5 °C; KN44 når varmeste del ≥ −0,5 °C). Universal og Nero legges som ett tykt dagslag uten mellomlag. **Har brukeren KN44 i smørelageret, brukes den også ved skiftende vær (og ikke bare ved sludd) i stedet for universal, innenfor −3…+5 °C** [Bruker: den iser mindre og tåler varierende vær bedre]. Uten KN44 i lageret er universal fortsatt valget.
Slik bygges det: Baseklister KB20C → isklister KX30 (bare hard bane: skarphet ≥70 eller tMin < −3) → mellomlag (utelates når dagens klister er KX35N/KX45N, og i Trening) → dagens klister, ett tykt lag. Tidligere 2–5 mellomlag var for mange.

## 8. Swix-tabeller (verifisert mot swixsport.com, se `src/engine/tabeller.ts`)
Swix oppgir **ett** temperaturområde per voks, ikke ett for nysnø og ett for omdannet. Kolonnen «omdannet» fra første utkast er droppet.
VP30 −16…−8; VP40 −10…−4; VP45 −5…−1; VP50 −3…0; VP55 −2…+1; VP60 −1…+2; VP65 0…+2; VP70 0…+3.
Klister: KX30 −12…0; KX35N −8…0; KX45N −4…+1; KX40S −4…+2; KX65 +1…+5; KX75 +2…+15. Bindere VG30/VG35 har ikke område. K22 −3…+10, KN33 +1…−7 og KN44 −3…+5 er bekreftet mot swixsport.com; K21S og KX55 er ikke verifisert.
Fargene i appen er tilnærminger til Swix’ etikettfarger, ikke offisielle fargekoder.

### 8.1 Glidevoks (skøyting) [Bruker + Swix]
Skøyting er bare glider; temperaturen er hovedsaken. Swix HS (hydrokarbon, uten fluor): HS5 turkis −18…−10, HS6 blå −12…−6, HS7 violett −8…−2, HS8 rød −4…+4, HS10 gul 0…+10 (swixsport.com-produktsidene). Glidere overlapper. Da velges den **kaldeste** som passer («heller hakket kaldt enn varmt»; brukeren gikk mest på violett i fjor). Temperaturen er snittet av snøtemperaturen langs turen. Klassisk glidesone er ikke med.

### 8.1b Felleski og rubbski [Bruker]
Skityper på turen og i skipark: klassisk (voks/klister), felleski, rubbski, skøyting.
- **Felleski:** fungerer alltid, men aldri perfekt, og glir alltid. Ingen festevoks eller klister; samme felle uansett føre. Glidesonene foran og bak får en glider valgt etter temperaturen (Forslag, bekreft).
- **Rubbski** (smørefri, festesonen børstes opp med sandpapir, ingen festesmøring): **bare på sluddføre** (nedbør ≥ 0,3 mm/t mellom −1 og +3,5 °C rundt turen) og **aldri ved fare for ordentlig minus**: frarådes hvis lufta eller snøen rundt turen går under −2 °C (`RUBB.minLuft`, Forslag). Frarådes den, vises vanlig klassisk smøring som alternativ. Kilder: snl.no/rubbski og klikk.no (rubbeski iser i kulde og snøbyger).
- Felle og rubb er ikke valg på hovedsiden. Har brukeren slike ski i skiparken, vises de som **alternativ** under klassisk smøring: rubbski når den passer (sluddføre uten fare for ordentlig minus), felleski når føret er utfordrende (sludd, skiftende temperatur eller klister). Se `byggAlternativer` og `utfordrendeGrunn` i `engine/stabel.ts`.
- Felle og rubb har ingen festesmøring å lagre i skiparken.

### 8.2 Smørelager [Bruker]
Brukeren krysser av produktene han eier (`/lager`). Når lageret ikke er tomt, byttes anbefalte produkter som mangler mot nærmeste i samme kategori (hardvoks, binder, klister, glider) etter senter av temperaturområdet; ved lik avstand velges det kaldeste. Finnes ingen i kategorien, markeres produktet som mangler. Tomt lager betyr at alt foreslås.

### 8.3 Skipark [Bruker, regler Forslag]
Flere par ski (`/skipark`), hvert klassisk, skøyting, felle eller rubb. På hovedsiden krysser brukeren av alle parene som smøres i dag (valget huskes), og hvert par får sin egen vurdering og «Lagre smøring» (eller «Lagre på alle valgte»). Lagret smøring huskes til neste gang paret smøres. Lagring er lokalt i nettleseren (`data/lagring.ts`) til innlogging kommer.

Regler for **rens eller topplag** (`vurderPåfylling`, `SKIPARK` i `engine/skipark.ts`):
- **Rens** hvis type endres (hardvoks ↔ klister ↔ glider), ved 4 turer uten rens, eller når smøringen er over 14 dager gammel.
- **Voks og klister:** nytt lag legges oppå *øverste* lag på skia. Varmere eller lik går alltid fint som topplag (smurt opp til blå ekstra, så fiolett oppå: ok) [Bruker]. Kaldere oppå varmere fester seg dårlig, f.eks. blå oppå rød: **rens** [Bruker]. Boulder Nordic bekrefter at kaldere kan ligge *som tynt dekke* ca. ett trinn (en til to temperaturområder) over varmere, så er den nye voksen opptil `maksKaldere` = 3 °C kaldere (midt i området) enn øverste lag, anbefales bare et tynt dekke; mer enn det gir rens.
- **Glider:** å bytte glider krever rens [Bruker]. Ligger det en glider på, er det slingringsmonn: er snøtemperaturen i dag innenfor området til glideren som ligger på ±`glideMonn` (1,5 °C, Forslag), beholdes den (ingen rens, ingen ny glider). Utenfor monnet: rens.
- Felle og rubb har ingen festesmøring å lagre.
Testes med `scripts/test-lager-skipark.ts`.

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
- `snø.ts` vind: ved maks 1–2 °C og snittvind ≥ 5 m/s (kl. 08–16) regnes dagen ikke som tinedag; dempingen er lineær fra 3 til 5 m/s og forsvinner mellom 2 og 4 °C [Bruker, terskler Forslag].
- `tur.ts`: seksjoner à ca. 250 m, tid per seksjon fra tempo, temperatur justert 0,6 °C/100 m mot cellehøyden, sol-tillegg opptil +2 °C per 500 W/m² dempet av skog. Terreng (implementert): `scripts/hent_terreng.py` henter hellingsretning, helning og horisont i 16 retninger (ut til 3 km) hvert 250. m fra Kartverkets høydedata (dtm1) og lagrer det som `terreng` i trails.json. `terreng.ts` regner solhøyde og -retning (`sol.ts`); er sola lavere enn horisonten i solretningen, blir direkte sol (70 % av innstrålingen) blokkert; ellers skaleres den med cos(innfallsvinkel)/sin(solhøyde), maks 2. Skog demper i tillegg: 75 % ved solhøyde ≤10° ned til 45 % ved ≥40° (lineært; ca. 70 % i november, ca. 55 % i mars) [Forslag]. Høydedata er terreng uten trær og uten skyer i regnestykket (innstrålingen kommer fra MET, eller anslås fra skydekke).
- `sol.ts`: solposisjon og innstråling fra skydekke (Haurwitz + Kasten–Czeplak) for Yr-prognosen, som mangler stråling.
- Værhistorikk oppdateres hvert 6. time av GitHub Actions (`.github/workflows/oppdater-vaer.yml`, `hent_vaer.py --json`).
- `stabel.ts`: hardvoks (binder → base → dagens voks → dekke) eller klister (baseklister → isklister → mellomlag → dagens klister). Klister når snøen er omdannet og skarphet ≥ 50 eller varmest ≥ +0,5 °C.
- Turdagen bruker observert vær 2. november som stand-in for prognose til Yr er koblet på.

**Dekketrinn (avklart 3. nov):** antall trinn styres av lengde og tid i det kalde partiet før det blir varmt, ikke tiden i varmt føre. Motoren måler det sammenhengende kalde partiet fra start (under underkanten til dagens voks): ett trinn som standard, to trinn fra 6 km eller 90 min [Forslag, tallene skal justeres].

**Trening vs tur (avklart 3. nov):** Trening får mindre smøring: færre og tynnere lag, ingen mellomtrinn i basen, høyst ett dekketrinn, og færre mellomlag klister.

## 12. Løyperegler (håndheves av scripts/kontroller-loyper.mjs før hvert bygg)
1. Hver løype starter og slutter på samme punkt (maks 15 m) og samme høyde.
2. Formen er `retur` (tur-retur fra laveste ende, ut-turen speiles) eller `sloyfe` (lukket runde). Fra enden av en løype tas en annen løype tilbake hvis nettet har en vei som ikke bruker samme løype og er kortere enn 75 % av løypa (Lundane går ut hele Lundane og tilbake via Galten). `retur-ren` tvinger samme vei tilbake. Felles startpunkt kan angis med `start=ANNEN_LØYPE`; ligger runden innen 300 m og nettet gir en omvei på mer enn 3 ganger så mye, brukes en rett kobling som må kontrolleres i kartet.
3. Ingen hopp over 120 m mellom nabopunkter (hull i løypa), avstanden øker jevnt, og siste avstand stemmer med lengden.
Kontrollen feiler bygget på Netlify hvis en regel brytes. Kjør lokalt med `npm run kontroller`.

### Korte og lange partier i skygge/sol [Bruker]
Løypa deles i biter på 250 m med egen snøtemperatur. Kaldeste og varmeste temperatur langs løypa (`tMin`, `tMaks`) er **5. og 95. persentil etter lengde** (`vektetPersentil` i `engine/tur.ts`), ikke enkeltbiter. Et kort parti i skygge eller sol (under ca. 5 % av løypa) avgjør dermed ikke isklister, klisterføre eller «skiftende». Langt strekk teller. Ellers brukes 10./50./80. persentil for voks (`stabel.ts`) og snitt for glider. Appen viser andelen av løypa i terrengskygge (%) og km. Fra 10 % vises kaldeste/varmeste verdi og en oppfordring til å vurdere selv om en vil smøre for sola eller skyggen. Absolutt ytterpunkt ligger i `tMinRå`/`tMaksRå`.

**Skygge under 10 % av løypa teller ikke** [Bruker]: dekker terrengskyggen mindre enn 10 % av løypa (`SKYGGE_MIN_ANDEL` i `engine/tur.ts`), regnes sola som uhindret i alle bitene (`skyggeIgnorert`). Fra 10 % brukes skyggen i temperaturene, og kaldeste/varmeste holdes innenfor 5./95. persentil. Appen sier fra i begge tilfeller.

**Feste regnes der du trenger grep** [Bruker]: temperaturene som bestemmer hardvoksen (kald/midt/varm = 10./50./80. persentil) tas bare fra seksjoner som er flatt eller stigning (svake og bratte). Alt som går nedover teller ikke, selv 0,1 %, fordi man staker der og da er det glid som gjelder (`FESTE_MIN_STIGNING` i `engine/stabel.ts`, −0,05° som slingringsmonn for målestøy). Er under 20 % av løypa igjen, brukes hele løypa. Glideren velges fortsatt for hele løypa.

**Mye skygge** [Forslag]: fra 25 % skygge (`SKYGGE_MYE_ANDEL`) og minst 4 °C mellom kaldeste og varmeste del (`SKYGGE_SPENN`) gir appen en egen advarsel: kald base og tynt topplag av den varme voksen (aldri kald oppå varm), tynne lag og god korking, fordi bakglatt kommer av for hard voks i sola og klabb av tykke lag eller fuktige ski som kommer inn i kald skygge.

### Utvide turen med flere løyper [Bruker]
Velger man en løype, kan man legge til løyper som starter ved samme sted (startpunktene innen 300 m, `tilhørende` i `data/rute.ts`): Galten og Lundane, Rørvikåsen og Ny Lysløype, Hovden fjellpark og Hovden lysløype, Auversvatn og Remestøylsflotti. Turen blir hovedløypa, så hver valgt ekstra løype, og tilbake til start (`byggRute`; rett kobling hvis startene ikke er identiske). Avstander og terrengdata forskyves, og smøringen regnes for hele turen. Løyper som bare krysser hverandre midt i løypa er ikke med ennå.

## Smøremerker (Swix, Toko, Rode, Ski Go)

**Anbefalingen tar alltid utgangspunkt i Swix** [Bruker]. Det finnes ingen merkevelger. Avkrysningen «Bruk min smøring» tilpasser anbefalingen til smørelageret (`byggMedLager` i `engine/lager.ts`): bygger idealstabelen i Swix og velger deretter ETT merke for festelagene, Swix hvis lageret rekker, ellers merket med flest brukbare produkter. Andre merker som også rekker vises som «Alternativ: …». Mangler lageret en hel type (hardvoks, klister, glider), vises idealstabelen med advarsel. Glidesonen kan komme fra et annet merke enn festelagene. Tomt lager gir ren Swix.

Hvert merke er et `Smøresystem` i `src/engine/tabeller.ts` med hardvoks, klister, glider og valgfrie roller (binder, baseklister, isklister, universal, sludd, mellomlag). Mangler et merke en rolle, hoppes laget over.
- Swix: kontrollert mot swixsport.com.
- Toko, Rode, Ski Go: fluorfrie produkter, hentet 3. nov 2026 fra produsent/forhandler. Temperaturområdene er IKKE kontrollert mot etikett. Rode K-serien og Ski Go klister har uklare områder hos ulike kilder.
- Produktnavn er unike på tvers av merker («Toko Rød»). «Mine produkter» i temperaturtabellen viser alt du eier, fra alle merker. «Forslag til innkjøp» foreslår Swix-produkter bare der det er et **hull** i dekningen (et sammenhengende temperaturområde du ikke dekker, f.eks. −6 til −1 °C), ikke alle varianter [Bruker].
- Nytt merke: lag listene og et `Smøresystem`, legg det i `SYSTEMER`. Testene i `scripts/test-lager-skipark.ts` sjekker alle merker.

### Regler fra kontrollen og research (nov 2026)
Researchen (Swix-guider, Dæhlie/DN, Budstikka, Dinside, norske forhandlere, Boulder Nordic m.fl.) er lagret i prosjektet. Merking: [Solid] flere kilder, [Produsent], [Enkeltkilde], [Forslag] min vurdering uten kilde.
- **Lagantall i festesonen** [Bruker]: kald snø 4–6 lag, over 30 km opptil 8, rundt 0 °C (varm del ≥ −1 °C) 2–4 lag, klister 2–3 lag totalt (`LAG` i `engine/stabel.ts`). Reduseres i rekkefølgen: dekke → 1 lag, base → 1 lag, binder → 1 lag, dagens voks → 3, færre base-trinn, dagens voks → 2, uten dekke. Klister: baseklister + (isklister på hard bane, ellers mellomlag) + dagens.
- **Klister styres av snøtype** [Solid]: bare omdannet/skarp snø gir klister, og varmeste punkt må være over −8 °C (`KLISTER_KALDGRENSE`) [Bruker; Knut Nystad definerer kaldføre som −8 °C og kaldere; Swix KX30 går til −12, men brukes da med dekke]. Nysnø gir hardvoks. Kaldere enn −8: hardvoks over binder.
- **KX30 som dagens klister** [Bruker]: på omdannet snø under 0 °C (varmeste punkt ≤ 0,5 °C, innenfor KX30-området) er KX30 dagens klister, med voksdekke over (gjerne Blå Extra). Da er det ikke eget mellomlag eller isklister. Ikke ved sludd eller skiftende vær (universalklister). Baseklister ligger under.
- **KX30 og KX35N er byttbare** [Bruker]: de fungerer nesten likt. Har du bare den ene i smørelageret, brukes den uten advarsel om at den anbefalte mangler. Voksdekket velges etter temperatur og tvinges ikke til Blå Extra.
- **Utenfor produktets område** [Produsent/forhandler]: advarsel ved mer enn 1 °C på varm side (ising, baller) og mer enn 2,5 °C på kald side (fluorfri voks går ofte kaldere enn etiketten).
- **Snø** [Bruker]: 5 cm nysnø (≈ 5 mm nedbør, `SNØ.begravMm`) oppå uansett lag er helt ny snø, og tellingen på skarphet starter på nytt: eldre tine/frys-sykluser, regn og milde timer før dette teller ikke. Bare nysnø nullstiller; alder gjør det ikke. Under 5 cm dekkes skorpa delvis (teller forholdsmessig), og `nysnøOppå` brukes til å avgjøre om klisteret trenger voksdekke. **Skorpa varer til det snør igjen** [Bruker]: vær-vinduet er 14 døgn (`SNØ.dager`), men appen lagrer sist kjente snøstatus per område (`skiglede.snostatus.<område>`: omdannet/ny, skarphet og tidspunkt). Er statusen omdannet og det ikke har kommet 5 cm nysnø siden, er snøen fortsatt omdannet selv om tine/frys-beviset er eldre enn 14 døgn. Bare ny snø (5 cm) nullstiller. Konstant kulde (f.eks. −6 °C i 30 dager) gir ingen skorpe og dermed tørrvoks. I vinduet teller tine/frys-sykluser uten aldersvekt (bare skarphetsindeksen veies etter alder). Omdannet snø krever uvektet sum ≥ 0,8 (`SNØ.minSum`, én sterk eller to moderate sykluser) [Forslag], regn ≥ 2 mm siste uke eller ≥ 6 milde soltimer. Nysnø er finkornet etter 24–48 t (24 t nær 0 °C), men det gir ikke skarp snø.
- **Smelting (tine/frys-syklus per dag)** [Forslag, støttet av Swix-manualen og J. Glaciology «Energy balance and formation of sun crust in snow»]: en omdannende syklus krever frost om natten (full ved −6 °C) og smelting om dagen. Smeltingen er det største av to ledd. (1) *Lufttemperatur*: gradvis fra 0 °C til full ved +3 °C (`SNØ.tempFull`). Swix: ved 0 °C holder snøen 0 °C og vanninnholdet øker bare med varme over, og snø omdannes raskere jo varmere det er. Vind ved 1–2 °C gir fordampning og kjøling i stedet for smelting, fra 3 til 5 m/s [Bruker], men **bare i tørr luft** (full ved relativ fuktighet ≤ 0,75, borte ved ≥ 0,9; `SNØ.tørrRh`/`fuktigRh`) og **bare tidlig i sesongen** (nov–feb, f.eks. vinterferien uke 7–8; `SNØ.vindMåneder`) [Bruker]. Kilder (Cryosphere 2023, Pomeroy & Brun) sier at vind øker smeltingen i fuktig luft over 0 °C og bare kjøler i svært tørr luft, så uten tørr luft og vinter tiner +1 °C med vind. +1 °C med litt vind i tørr februarluft gir dermed nesten ingen tining. (2) *Sol*: solskorpe kan dannes også ved minusgrader ned til ca. −3 °C når innstrålingen er over ca. 350–600 W/m² (skorpe krever ca. 200 W/m² ABSORBERT, og gammel snø har albedo 0,5–0,7; lab: skorpe ved ≥ 200 W/m² absorbert, dannet på 2–5 t, 1–2 mm tykk, på gammel grov snø). Sterk vind (fra 6 m/s, borte ved 10) kjøler den bort, og den er tynnere, så den veies 0,7. En dag teller som ekte syklus for «omdannet» først ved smelting ≥ 0,25 (`SNØ.minSmelt`); svakere dager bidrar bare til skarphetsindeksen. Sola i februar er svak (lav solhøyde), og solverdiene våre er anslått fra skydekke.
- Statusen ligger på enheten. Den bør senere flyttes til serveren (delt mellom enheter), og første gang appen åpnes på en ny enhet har den ingen historikk utover 14 døgn.

- **Swix' doble områder** [Produsent]: VP40, VP45, VP50, V40 og V45 har eget område for gammel snø (1–4 °C kaldere). Er snøen omdannet, brukes `omrGammel` automatisk ved valg av voks og i advarsler (`hardvoksForSnø`). Andre produkter har ett område.
- **Klister med dekke** [Solid: Swix, NSF-smørere, Dæhlie]: ved klisterføre, når snøen er under 0 °C (varmeste punkt ≤ 0,5 °C) eller det ligger minst 1 cm nysnø oppå, kommer 2–3 tynne lag hardvoks over klisteret (ett trinn hardere enn temperaturen tilsier [Forslag]). Klisteret herdes ca. 5 min først. Ikke i sludd/våt snø. Voksdekket kommer i tillegg til de 2–3 klisterlagene og slites av etter ca. 1–2 mil.
- **Nattestråling** trekker snøtemperaturen ned 1–2 °C på klar, stille natt (`UTSTRÅLING`) [Forslag, svake kilder].
- **Glider beholdes** når snøen er innenfor produktets område (`SKIPARK.glideMonn` 0) [Forslag].
- **Ski-soner** følger landslagets strukturkode: kald ≤ −5 °C, mid −5…0, varm over 0 (`SONER`) [Produsent].
- **Glidesone** nederst i festestabelen vises som eget lag. Hardvoks i sludd gir snøballe-advarsel.
- **Tempo** [Bruker]: klassisk 7 km/t tur og 10 trening; skøyting 10 og 15.

Ikke gjort ennå (funn fra researchen): gammel-snø-område for flere Swix-produkter (bare de fem over er funnet), normalisering av Toko/Rode (snø- vs lufttemperatur, Nord-/Sør-Europa) og etikettkontroll av Ski Go Blå/Violett, Rode P36/P42/P46 og Toko-klister.

### Prognose og lagring av smøring
- Siste vellykkede Yr-prognose lagres på enheten med tidspunkt og brukes hvis ny henting feiler. Finnes ingen brukbar prognose (tom eller utløpt), vises ingen smøretips, bare en tydelig advarsel; dagvalget er av.
- «Oppdater vær» henter på nytt. Advarsel når prognosen er over 6 timer gammel og når observert vær i appen er over 12 timer gammelt.
- Valg som løype, ekstra løyper, dag, starttid, tur/trening og stil huskes mellom sidene.
- Lagring av smøring på ski: i Enkel visning lagres bare base, glidesone og dagens smøring; i Full lagres hele stabelen. Smøringen knyttes til datoen turen gjelder (`mål`): lagres den på nytt for samme tur, erstattes den uten å telle en ny tur.
- Å slette et ski krever bekreftelse; «Renset (nullstill)» gjør ikke det.

## Premium (grunnlag, nov 2026)
- Premium: smørelager, skipark, steder (flere steder, flytte ski og produkter mellom dem), innkjøpsforslag, «Bruk min smøring» og utvide løypa («Gå lenger»). Uten premium vises en lås; lokale data røres ikke.
- Innlogging: Google via Neon Auth. Data i Neon (tabellene `profil` og `brukerdata`, RLS på `user_id`). Brukerens lagringsnøkler (lager, skipark, valgte, steder, brukLager) synkes som JSON per nøkkel; kontoen vinner ved innlogging, er kontoen tom lastes lokale data opp.
- Bryteren «Premium: på/Vanlig» i toppen er midlertidig og endrer `profil.premium` direkte fra klienten. MÅ låses (kun server/betalingswebhook kan sette `premium`) før ekte betaling.

## Områder, løyper og værhistorikk i Neon
- Områdene ligger i tabellen `omrade` (id, navn, lat/lon for værpunktet, kartutsnitt `vis_*`, snøtemperatur `vinter_*`, `ref_hoyde_m`, `loypefil`, `vaer`, `rekkefolge`). Appen leser den ved start; de tre første områdene ligger også innebygd som reserve.
- **Nytt område:** sett inn en rad i `omrade` (loypefil = filnavnet i `src/data/`, f.eks. `trails-geilo.json`), legg løypefilen i `src/data/`, og push. GitHub laster løypene opp (`last_opp_loyper.py`) og værjobben henter været for området (`oppdater_vaer.py`, hver fjerde time). Ingen Netlify-bygg og ingen kodeendring.
- **Nye løyper:** endre løypefilen og push. Løypene hentes bare når de blir sett på (`loype`: lett liste + full løype).
- Prognosen (Yr) hentes via Netlify-funksjonen `varsel` med lat/lon/høyde fra området.
