# Konkurranse (premium): idé og skisse

## Idé
Vanlig versjon: smøretips for en dag og et sted. **Premium konkurranse**: forberedelse til et bestemt renn. Appen er et planleggingsverktøy som snevrer inn til 2–3 kandidater som man tester på morgenen. Den erstatter ikke glidtesting.

## Der vi er bedre enn de fleste
- Råd for **hele løypa** (høyde, sol, skog, vind, terreng), ikke ett punkt: «klister på vidda, fast på resten».
- **Snøhistorikk** (14 døgn timesdata), ikke bare varselet.
- Regner for **starttid og forventet tid i løypa**, og kan si hva som holder gjennom hele løpet.
- Konsekvent og oppdatert når varselet endres.

## Der vi er svakere (si det i appen)
Snøkrystaller og målt snøtemperatur i løypa, preparering/salt/kunstsnø, glidtest, slipestruktur og skispenn, produktregler (fluor). Rådet heter derfor «forslag å teste».

## Skjermbilde: Renn
1. Rennliste (dato, sted, stil, dager igjen). Premium-lås for ikke-premium.
2. Rennside: løypeprofil, start per bølge, varsel for hele løypa (T-3 dager, T-1, rennmorgen), anbefalt hovedvalg + 2 alternativer, testliste («test disse i denne rekkefølgen»).
3. **Logg etter renn/trening**: snøtemperatur, lufttemperatur, hva som ble smurt, ski, resultat (traff / for tregt / ikke feste). Dette er kalibreringsdata for skarphet og terskler, og gir premium verdi over tid.

## Data
- Tabell `konkurranse` i Neon (id, navn, omrade, dato, starttid, stil, lengde_km, loype_id, gpx_kilde, testdata, merknad). Offentlig lesing (RLS), skriving via jobb/MCP.
- Løype: **arrangørens GPX** (spør om lov, krediter), ikke OSM. Renn går ofte på midlertidige traseer, og OSM har dem sjelden (Hovden Tour finnes ikke som egen løype i OSM-uttaket, bare som backcountry-biter). GPX går gjennom samme høyde- og terrengløype som øvrige løyper (`hent_terreng*.py`) og lagres som `src/data/trails-renn-<id>.json`.
- Rennkalender: start med 20–30 store renn lagt inn for hånd (Skiforbundets terminliste og arrangørenes sider), ikke automatisk.

## Status
- `konkurranse` er opprettet, og raden `hovden-tour-test` ligger inne som **testoppføring**: ingen dato, starttid eller distanse. Løypa er OSM-linjene HovdenTour (10,3 km) og HovdenTuren (1,7 km), forlenget med korteste vei i preparert nett (langs Auversvatn-løypa, 4,5 km) ned til stadion: 16,4 km, i mål ved stadion, bygget med `scripts/bygg_renn.py` og lagt i `src/data/renn-hovden-tour.json` (ikke `trails*.json`, så den ikke kontrolleres som runde). Ikke bekreftet som arrangørens løype.
- **Pro-bruker**: knapp ved siden av Premium (kun synlig for premium, test uten betaling). Lagres i `profil.pro`. Pro bygger på premium.
- **Rennvisning** `/renn` (lenke «Renn» ved Skipark, låst for ikke-pro): velg renn, dag, starttid og stil. Viser slipestruktur (rilljern), glidelag og festelag. Uten prognose for rennstarten brukes siste kjente vær, og det står tydelig i visningen.
- Motoren: `src/engine/pro.ts` (`anbefalStruktur`, `proGlidelag`). Alle terskler er [Forslag] og skal justeres mot loggen.
- **Smøreloggen (premium)**: kort «Hvordan gikk smøringen?» på løypesiden og siden `/logg`. Vurdering feste (−2 veldig bakglatt … +2 mye klabb), glid (tregt/OK/fort), valgfri målt snø- og lufttemp, kommentar. Lagrer også det modellen mente (`modell` jsonb). Tabell `smoring_logg` (RLS: bare egne rader, og bare premium kan skrive). Analyse mot modellen venter til det er data.
- Mangler: påminnelse «hvordan gikk det i går?», GPX-import, flere renn, ekte betaling og server-side lås.

## Åpne spørsmål
- Pris: per sesong eller per renn (sesongen er kort, januar–mars).
- Server-side premium-lås må på plass før betaling.
- Kalibrering uten fasit: loggen er svaret, men trenger brukere.
