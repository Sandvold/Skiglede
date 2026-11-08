# Regler for fornuftige løypevalg

Gjelder løyper i `src/data/trails.json`, bygget av `scripts/hent_loyper.py` og kontrollert av `scripts/kontroller-loyper.mjs`. Tenk som en skiløper: hva ville du faktisk gått?

## Må (kontrollen feiler bygget)
1. **Start og slutt er samme punkt** (maks 15 m, samme høyde). Ingen enveisløyper.
2. **Formen er `retur` eller `sloyfe`.** I landsdekkende kjøring lages tur-retur (`retur`) som reserve der nettet ikke gir noen runde fra et startpunkt. Runde slår tur-retur: går man ut til enden, tas en annen løype tilbake hvis nettet har en som ikke bruker samme løype og er kortere enn 75 % av løypa. `retur-ren` tvinger samme vei tilbake.
3. **En sløyfe går maks 25 % av veien to ganger.** Mer enn det er en tur-retur i forkledning (målt: sløyfene våre ligger på 2–6 %, tur-retur på 98 %).
4. **Ingen hull** (hopp over 120 m mellom punkter), avstanden øker jevnt og siste avstand stemmer med lengden.

## Bør (skriptet og kontrollen advarer)
5. **Felles startpunkt er sentralt** (laveste punkt ved bygda/arenaen, f.eks. Lundanes laveste ende midt i Hovden). Flere løyper kan dele startpunkt.
6. **Ingen unødvendige omveier til startpunktet.** Ligger runden innen 300 m fra startpunktet og nettet gir mer enn tre ganger så lang vei, brukes en rett kobling (må sees i kartet). Stikk via nettet over 1 km gir advarsel. Eksempel på feil: Galten startet med å gå hele Lundane (4,8 km hver vei) fordi en kobling på 200 m manglet i Turrutebasen.
7. **Lengde 3–25 km.** Utenfor gir advarsel.
8. **Sett løypa i kartet** før den regnes som ferdig: sammenhengende, start- og sluttprikk samme sted, høydeprofil starter og slutter likt, og at den følger en reell løype og ikke hopper mellom biter.

## Vanlige feil å se etter
- Turrutebasen har løypene i biter og mangler korte koblinger. Kjeden kan være en del av en lengre rute.
- Navnet på en løype er ikke det samme som hele turen en skiløper går. Galten og Lundane deler start.
- Preparering er ofte ikke registrert i Turrutebasen, så dataene viser hva som finnes, ikke hva som er kjørt opp i dag.

## Koblinger som mangler i Turrutebasen
«Ny Lysløype Hovden» er bygget som runde fra stadion (startpunktet til Rørvikåsen) med rette koblinger til begge ender: `scripts/bygg_ny_lysloype_runde.py`. Kjøres hent_loyper.py på nytt for den løypa, må skriptet kjøres igjen, og deretter hent_terreng.py.
