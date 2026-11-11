# Fikseliste etter kontroll 11. nov 2026

Laget av to uavhengige kontrollører (kode/regelmotor og brukervennlighet). Hvert punkt er avgrenset slik at det kan tas alene.
Fast flyt for hvert punkt: endre, `npx tsc --noEmit`, kjør testene i `scripts/test-*.ts`, `npx expo export --platform web`, commit, push, `bash scripts/deploy_pages.sh`.
Regelendringer oppdateres i `docs/regelspesifikasjon.md` i samme commit. Kryss av her når punktet er gjort.

Status: «bekreftet» = lest/kjørt av to. «ikke testet på enhet» = bare lest, må prøves på Android.

## A. Må fikses

- [x] **A1. Android lagrer ingenting mellom appstarter** (ikke testet på enhet). `src/data/lagring.ts:11,36`, `src/data/varsel.ts`, `src/data/omrader.ts` bruker `globalThis.localStorage?.`, som ikke finnes i Hermes. Skipark, smørelager, valgt område og cache ligger da bare i minnet. Fiks: installer en synkron localStorage-erstatning for native øverst i `index.js` før `expo-router/entry` (sjekk Expo SDK 58-dokumentasjonen for `expo-sqlite/localStorage/install`). Krever nytt EAS-bygg og test på telefon: legg inn et par ski, lukk appen helt, åpne igjen.
- [x] **A2. Gammel innebygd værhistorikk regnes som fersk.** `src/data/omrader.ts:260-261`: `innebygd = !sist && data.timer.length > 0` gir `fersk = true` for Hovden, Nordmarka og Bærumsmarka når databasen ikke svarer. Filene slutter 6. nov, så snøen blir «ny» og rådet hardvoks selv på skare. Fiks: `innebygd` skal også kreve at siste time i `data.timer` er nyere enn `VÆR_FERSK_DØGN`. Vis «Henter værdata …» til `status.lastet`.
- [x] **A3. Smørelageret overser Rode P-linja og universalklister.** `src/engine/lager.ts:18-21`: bare Swix får ekstralister. Lager `['Rode P38','Rode P46','Rode P32']` ved −4 °C gir «ingen hardvoks», og `['Toko Universal klisterspray']` på klisterføre gir «ingen klister». Fiks: ta med `RODE_ANDRE` (etter `linje`) og `sys.universalVarm`/`universalKald` på samme måte som `ekstraH`/`ekstraK`. Én test per merke i `scripts/test-robust.ts`.
- [x] **A4. Feil glider når lageret har hull.** `src/engine/tabeller.ts:312`: uten treff velges alltid den varmeste glideren. Lager HS5 + HS10 ved −9,5 °C gir HS10 (0…+10). Fiks: velg glideren med minst avstand fra `t` til nærmeste kant av området (kaldeste ved likhet), og gi samme `utenfor()`-advarsel i `glidesone()` som i `byggGlider`. Test i `test-robust.ts`.
- [x] **A5. Kartet stopper rulling på mobil.** `src/components/ski/zoomkart.tsx:115` (`touchAction: 'none'`) og PanResponder linje 45. Sveip på kartet ruller ikke siden, og kartet fyller halve forsiden. Fiks: `touchAction: 'pan-y'` på web, én finger ruller siden, to fingre (og mus-dra) flytter kartet, med hinttekst «Bruk to fingre for å flytte kartet». Senk karthøyden på forsiden fra 420 til ca. 300.
- [x] **A6. Sletting uten bekreftelse.** `src/components/ski/egne-ruter.tsx:84`, `src/app/logg.tsx:44/60`, `src/app/renn.tsx:288`. Fiks: samme totrinnsmønster som `src/app/innstillinger.tsx` («Slette for godt?» → «Ja, slett» / «Avbryt»). Vis feil hvis slettingen feiler (`mine.slett` returnerer nå feiltekst).

## B. Bør fikses: motor og data

- [x] **B1. Feil fra kontosynk svelges.** `src/data/premium.tsx:61,99,120,121`, `src/data/logg.ts:57`, `src/data/minerute.ts:37`: `error` fra Neon sjekkes ikke. Fiks: `const { error } = await …; if (error) throw error;`. I `:61`: ved feil, sett `feil` og ikke rør `premium`.
- [x] **B2. Prognosen sjekkes bare mot starttid.** `src/app/index.tsx:313`: bruk `> r.tur.sluttTs` i stedet for `r.startTs`, så lange turer ikke regnes på frosset vær uten advarsel.
- [x] **B3. Databasekall uten tidsavbrudd.** `src/data/neon.ts:42,55`: legg `AbortController` med 12 s (mønster i `src/data/varsel.ts:43-50`), så «Henter løypene …» ikke henger.
- [x] **B4. Salt bare ved 0 °C eller varmere (avgjort).** Avkrysningen for saltet løype (`src/components/ski/underlag.tsx`, `src/engine/underlag.ts:51`) skal bare vises og gjelde når lufta/snøen på turen er 0 °C eller varmere (man salter ikke kald løype). Ved kaldere: skjul valget og nullstill det. Da stemmer `Math.min(t, 0) + SALT_SNØTEMP` med spesifikasjonen. Oppdater `docs/regelspesifikasjon.md`.
- [x] **B5. Isklister som mellomlag (avgjort: beholdes).** Ingen endring i `src/engine/stabel.ts:230`. Kristoffer: isklister kan brukes som mellomlag.
- [x] **B6. Motoren krasjer på tomme inndata.** `src/engine/tur.ts:100,114`: kast tydelig feil i `planTur` ved tom `seksjoner`/`timer`, og vis «Løypa mangler punkter» i `Hjem` når `løype.punkter.length < 2`.
- [x] **B7. Android-klienten mangler `update` og `rpc`** (ikke testet på enhet). `src/data/native-konto.ts`: `delMed` kaster, og `erKjentUtfartssted` svarer alltid nei. Fiks: `update()` (PATCH) i `Spørring` og `rpc(navn, args)` (POST `/rpc/<navn>`) i `nativKlient`.
- [x] **B8. «Oppdater vær» henter ikke historikken.** `src/app/index.tsx:230-236`, `src/data/omrader.ts:275`: eksporter `oppdaterHistorikk(id)` som nullstiller `friskVær`/`værSpurt` og henter på nytt; kall den fra `oppdaterVær`. Skill «nytt område uten data» fra «kallet feilet» med et `feilet`-flagg i `Værstatus`.
- [x] **B9. Værjobben.** `.github/workflows/oppdater-vaer.yml`: legg til `timeout-minutes: 45`. `scripts/oppdater_vaer.py`: kjør nytt forsøk gjennom `ex.map` (parallelt), og hopp over det hvis mer enn 25 % feilet.
- [x] **B10. Referansehøyde for værhistorikk** (størrelse ikke verifisert). `scripts/hent_vaer.py:152`: `referansehoyde_m` er snitthøyden av løypa, men MET-temperaturen gjelder modellhøyden i cella. Undersøk først: sammenlign `altitude[j][i]` fra MET med `ref_hoyde_m` for 10 områder. Rett bare hvis avviket er over ca. 50 m.
- [x] **B11. «I morgen» feil dato ved klokkeskifte.** `src/app/index.tsx:40-41`, `src/app/renn.tsx:41`: finn Oslo-datoen for nå og legg til dager med `Date.UTC(å, m, d + n, 12)`. Flytt samtidig `osloDato`, `osloTs`, `timerI` til én felles fil (de er duplisert i `index.tsx` og `renn.tsx`).
- [x] **B12. Testene.** `scripts/test-robust.ts:8-9` bruker feltnavn `t/fukt/straling` i stedet for `temp/rh/sw`. Rett, og legg `"test"` i `package.json` som kjører de fem testskriptene.
- [x] **B13. Dokumentasjon.** `db/schema.sql` beskriver gamle tabeller: dump gjeldende skjema med policyer (bare lesing fra Neon). Rett `docs/regelspesifikasjon.md:175` (prognosen hentes direkte fra MET; `netlify/functions/varsel.mjs` er død kode), `:98` (hver 4. time), `:45` og `:94` (motsies av senere avsnitt). Rett utdaterte kommentarer: `stabel.ts:18`, `stabel.ts:291`, `skipark.ts:99`, `omrader.ts:267`.

## C. Bør fikses: brukervennlighet

- [x] **C1. Smørerådet ligger for langt ned.** `src/app/index.tsx:331-441`, `src/components/ski/hero.tsx:74`. Legg én oppsummeringslinje rett under «Smøring»-tittelen («I dag: VP55 fiolett, 3–4 lag»), og bruk lavt toppfelt på løypesiden (tittel og meny, uten undertittel og områdevelger). **Beholdes som den er (Kristoffer).**
- [x] **C2. NB-boksen for vanskelig føre er en tekstvegg.** `src/app/index.tsx:417-422`: vis første setning, resten bak «Vis hvorfor». Flytt boksen under lagene.
- [x] **C3. Advarsel motsier snøkortet.** `src/engine/stabel.ts:174`: teksten «snøen er ikke omdannet» settes av `tur.sludd` uten å se på `snø.type`. Styr teksten av `snø.type`.
- [x] **C4. Interne merker i brukertekst.** Fjern `[Bruker]`/`[Forslag]` fra strenger som vises (`src/engine/underlag.ts:97,101,121`, `src/engine/stabel.ts:249`, `src/engine/tabeller.ts:66`). Kommentarer i koden skal stå. Kort kunstsnø-teksten til én setning.
- [x] **C5. Lagene leses ovenfra, men smøres nedenfra.** `src/app/index.tsx:430-441`: nummerer lagene i smørerekkefølge (1 nederst).
- [x] **C6. Fagord.** Forklar i teksten: festesone («midtpartiet under foten»), binder («grunnlag som får voksen til å sitte»), omdannet («gammel, grov snø»), skarphet («hvor mye snøen sliter på smøringen»). Fjern «(5./95. persentil)» i `index.tsx:471`. **Beholdes som den er (Kristoffer).**
- [x] **C7. Tilbake-knappen forlater appen.** `src/app/index.tsx:693-705`: valgt løype ligger ikke i adressen. Legg den i ruteparametre (`router.push({ pathname: '/', params: { loype: id } })`), så tilbake gir «Alle løyper».
- [x] **C8. Trykkflater under 44 px.** `minHeight: 44` på Chip (også `liten`), menyknapper, select (`ui.tsx`), tannhjul 44×44 (`konto.tsx`), zoomknapper (`zoomkart.tsx:105`), overskrift på sammenleggbare kort (`ui.tsx:28`). Sjekk at turvalget fortsatt får plass på to rader.
- [x] **C9. Mørk modus.** Aktiv chip har hvit tekst på `#6DB3F2` (kontrast 2,2:1): bruk mørk tekst `#08182A` i mørk modus (`ui.tsx:17`). Avkrysningsbokser: `theme.textSecondary` som kantfarge.
- [ ] **C10. Skjermleser.** `ui.tsx` Chip: `accessibilityRole="button"` og `accessibilityState={{ selected: aktiv }}`. Samme rolle på løyperadene (`loypevelger.tsx:20,47`) og «← Alle løyper». **Bare forklart, ikke gjort (Kristoffer).**
- [x] **C11. «Vis feilsøking» synlig for alle.** `src/app/index.tsx:626-664`: kall knappen «Hvorfor dette rådet?» og vis bare begrunnelsen. Tabellene bak `?debug=1`.
- [x] **C12. Rå engelske feilmeldinger.** Send `error.message` gjennom `feilTekst` (`src/data/premium.tsx:35`) i `logg.ts`, `minerute.ts`, `premium.tsx`. Auth-feil: «Du er logget ut. Logg inn igjen.» Ellers: «Noe gikk galt. Prøv igjen.»
- [x] **C13. Nytt sted ser ut som tømt lager.** `src/components/ski/sted.tsx:23`: vis «<Sted> er tomt. Det du hadde ligger fortsatt under <forrige sted>.» **Beholdes som den er (Kristoffer).**
- [x] **C14. Toppfeltet innlogget.** `src/components/ski/konto.tsx:35-54`: flytt Premium/Pro-bryterne og «Logg ut» til Innstillinger. Toppfeltet får bare e-post og tannhjul.
- [x] **C16. Egen tur både under kartet og i løypevelgeren.** Behold kortet under kartet (`src/app/index.tsx:683-684`), og legg samme innhold som en rad/knapp nederst i løypelista (`src/components/ski/loypevelger.tsx`) som åpner det samme kortet. Hold løypelista først i rekkefølgen under kartet slik at lista ikke skyves ned.
- [x] **C15. Småting.** Desimalkomma («10,7 km», «−1,9 °C») gjennomgående; «Ca. 37 min» i stedet for «Ca. 0 t 37 min»; skjul terrengskygge-linjen når andelen er 0 eller det er mørkt; temperaturtall kuttes i «Voks og klister» på mobil (`oversikt.tsx:46`).

## D. Avgjort av Kristoffer 11. nov

- **Felleski og rubbski** er bare for de som har den typen ski i skiparken. Ingen endring i stilvalget.
- **«Legg til egen tur (GPX)»** skal finnes både under kartet og der man velger løype (løypevelgeren). Ny oppgave **C16**.
- Salt: se B4. Isklister: se B5.

## Ikke sjekket

Kjøring på ekte Android, alt bak innlogging (GPX-opplasting, logg, renn), Neon-innhold og RLS, ekte skjermleser.
