import type { Lag, SnøAnalyse, Stabel, Tur } from './typer';

/** Snøtemperatur på saltet snø (°C) når lufta er rundt null eller mildere [Forslag]. */
export const SALT_SNØTEMP = -3;
import type { Struktur } from './pro';

/**
 * Underlag som ikke er vanlig natursnø: kunstsnø og saltet løype. Bare brukerens avkrysning styrer dette; værdata kan ikke se det.
 *
 * Kilder (hva som faktisk står der, og hva som er mitt forslag):
 * - Kunstsnø [SkinnySki/Swix-råd]: oppfører seg som omdannet og gjenfrosset snø, så klister er det trygge festevalget. Baseklister (KR20) først beskytter festet mot den slipende snøen,
 *   og et hardvoksdekke over klisteret holder skitt og løse iskorn unna (kan være varmere enn temperaturen tilsier). Glid: velg etter snøtemperatur som ellers, hardere (kaldere) voks tåler slitasje bedre.
 *   Fra brukeren [Bruker]: kunstsnø er mest iskrystaller og føles glatt, så klister gir mening. Hard glider også rundt null og medium til grov struktur er [Forslag] fra en usitert kilde. Rens og smør skiene rett etter turen, kunstsnø er skitten. Faller det natursnø oppå, gjelder natursnø-valg igjen.
 * - Salting [NSF: «Veiledning i salting av langrennsløyper» og saltveileder v7]: gir hardere og jevnere løype, «stor påvirkning på festesmøring og sålestruktur», staking blir mer fordelaktig enn diagonalgang,
 *   salt virker ikke ved lufttemperatur rundt null eller kaldere, og for mye salt tørker ut snøen. Testing på prøveområde anbefales. NSF gir INGEN konkrete anbefalinger for glider eller struktur på saltet snø.
 *   Fra brukeren [Bruker]: salt kjøler snøen (saltlaken tar varme fra snøen rundt, bekreftet av Beitostølen-veilederen, som ikke oppgir tall: «flere minusgrader» er brukerens erfaring) og binder fritt vann,
 *   så løypa blir tørr, trå og slipende, ikke våt og sugende. Derfor settes snøtemperaturen til ca. −3 °C uansett hvor mild lufta er [Forslag på tallet], og sludd slås av. Hard glider, ikke grov struktur mot vann.
 */
export type Del = 'hele' | 'første-halvdel' | 'siste-halvdel' | 'første-tredjedel' | 'midten' | 'siste-tredjedel';
export const DEL_VALG: { verdi: Del; tekst: string; fra: number; til: number }[] = [
  { verdi: 'hele', tekst: 'Hele løypen', fra: 0, til: 1 },
  { verdi: 'første-halvdel', tekst: 'Første halvdel', fra: 0, til: 0.5 },
  { verdi: 'siste-halvdel', tekst: 'Siste halvdel', fra: 0.5, til: 1 },
  { verdi: 'første-tredjedel', tekst: 'Første tredjedel', fra: 0, til: 1 / 3 },
  { verdi: 'midten', tekst: 'Midtre tredjedel', fra: 1 / 3, til: 2 / 3 },
  { verdi: 'siste-tredjedel', tekst: 'Siste tredjedel', fra: 2 / 3, til: 1 },
];
export type Påvirkning = { på: boolean; del: Del };
/** Kunstsnø: fersk er slipende og hard; eldre (noen dager i løypa) er avrundet, og Swix sier at vanlig smøring gjelder igjen. Mangler alder, regnes den som fersk. */
export type KunstAlder = 'fersk' | 'eldre';
export type Underlag = { kunstsnø: Påvirkning & { alder?: KunstAlder }; salt: Påvirkning };
export const INGEN_UNDERLAG: Underlag = { kunstsnø: { på: false, del: 'hele', alder: 'fersk' }, salt: { på: false, del: 'hele' } };
export const eldreKunst = (u: Underlag) => u.kunstsnø.på && u.kunstsnø.alder === 'eldre';

/** Andel av løypa (0–1) påvirkningen gjelder. */
export const delAndel = (p: Påvirkning): number => {
  if (!p.på) return 0;
  const d = DEL_VALG.find((x) => x.verdi === p.del) ?? DEL_VALG[0];
  return d.til - d.fra;
};
const delTekst = (p: Påvirkning) => (DEL_VALG.find((x) => x.verdi === p.del)?.tekst ?? 'Hele løypen').toLowerCase();
export const harUnderlag = (u: Underlag) => u.kunstsnø.på || u.salt.på;

/** Fra denne andelen av løypa velges smøringen for det harde underlaget [Forslag]. Under: natursnø-valget beholdes, med advarsel. */
export const UNDERLAG_MIN_ANDEL = 0.5;
export const SKARPHET = { kunstsnø: 75, salt: 80 };

/** Saltet løype (minst halve løypa): snøen er kaldere enn lufta og tørr. Seksjonenes snøtemperatur settes til −3 °C (eller kaldere hvis den allerede er det), og sludd slås av. Rå-verdiene beholdes til visning. */
export function turMedUnderlag(tur: Tur, u: Underlag): Tur {
  if (delAndel(u.salt) < UNDERLAG_MIN_ANDEL) return tur;
  const f = (t: number) => Math.min(t, 0) + SALT_SNØTEMP;
  return { ...tur, tMin: f(tur.tMin), tMaks: f(tur.tMaks), sludd: false, seksjoner: tur.seksjoner.map((x) => ({ ...x, tEff: f(x.tEff) })) };
}

/** Snøanalysen smøringen bygges på. Kunstsnø og salt regnes som hard, omdannet snø når de dekker minst halve løypa. */
export function snøMedUnderlag(snø: SnøAnalyse, u: Underlag): SnøAnalyse {
  const ak = eldreKunst(u) ? 0 : delAndel(u.kunstsnø);
  const as = delAndel(u.salt);
  const sk = Math.max(ak >= UNDERLAG_MIN_ANDEL ? SKARPHET.kunstsnø : 0, as >= UNDERLAG_MIN_ANDEL ? SKARPHET.salt : 0);
  if (!sk) return snø;
  return {
    ...snø,
    type: 'omdannet',
    skarphet: Math.max(snø.skarphet, sk),
    forklaring: [...snø.forklaring, `${ak >= UNDERLAG_MIN_ANDEL ? 'Kunstsnø' : 'Saltet løype'} (avkrysset): regnes som hard, omdannet snø (skarphet minst ${sk}).`],
  };
}

const erGlid = (l: Lag) => l.rolle.startsWith('Glidesone') || l.rolle === 'Glider';

/** Legger merknader og advarsler for kunstsnø/salt på en ferdig stabel. Endrer ikke produktvalget (det styres av snøanalysen over). */
export function medUnderlag(stabel: Stabel, u: Underlag, tur: Tur): Stabel {
  if (!harUnderlag(u)) return stabel;
  const begrunnelse = [...stabel.begrunnelse];
  const advarsler = [...stabel.advarsler];
  const tillegg: string[] = []; // til glidesonen
  const k = u.kunstsnø;
  const s = u.salt;
  const klassisk = stabel.type === 'hardvoks' || stabel.type === 'klister';
  const bare = (p: Påvirkning) => (delAndel(p) >= 1 ? '' : ` (${delTekst(p)}, ${Math.round(delAndel(p) * 100)} % av løypa)`);
  const partielt = (p: Påvirkning, hva: string) => {
    if (p.på && delAndel(p) < UNDERLAG_MIN_ANDEL) {
      advarsler.push(`${hva} bare på ${delTekst(p)} (${Math.round(delAndel(p) * 100)} % av løypa): smøringen er valgt for resten av løypa. Test festet der det er ${hva.toLowerCase()}, og ha klister eller en voks mykere/hardere klar å smøre om på hvis det slipper eller isner.`);
    }
  };

  if (k.på && eldreKunst(u)) {
    begrunnelse.push(`Eldre kunstsnø${bare(k)}: har ligget noen dager, kantene er slitt ned og snøen likner gammel, finkornet natursnø. Swix: glidet blir merkbart bedre og vanlig smøring gjelder igjen. Smøringen er valgt som for natursnø.`);
    advarsler.push('Eldre kunstsnø er fortsatt tettere og fuktigere enn natursnø: slites festet fort, bruk baseklister/binder hvis det slipper. Velg fersk kunstsnø hvis det nylig er produsert eller lagt ut ny snø.');
    partielt(k, 'Kunstsnø');
  } else if (k.på) {
    begrunnelse.push(`Kunstsnø${bare(k)}: oppfører seg som omdannet, gjenfrosset snø (Swix/SkinnySki). ${delAndel(k) >= UNDERLAG_MIN_ANDEL ? 'Smøringen er valgt som for hard, omdannet snø.' : ''}`.trim());
    if (klassisk) {
      advarsler.push('Kunstsnø er slipende: legg baseklister/binder først og hold laget under festet tynt og jevnt, så festet ikke slites bort. Et hardvoksdekke over klisteret holder skitt og løse iskorn unna (kan være litt varmere enn temperaturen tilsier).');
    }
    if (stabel.type === 'hardvoks') advarsler.push('Kunstsnø under −8 °C: hardvoks over binder i stedet for klister. Hvis festet slipper, bytt til klister med voksdekke.');
    tillegg.push('Kunstsnø er tette, harde iskrystaller som slipende sandpapir: velg en hard, slitesterk glider selv rundt null, og ikke gå varmere. Swix nevner PS Polar, PS05/HS05 og PS06/HS06 på fersk kunstsnø i kulde, og at glidet blir bedre og vanlig smøring gjelder igjen etter noen dager. Kald kunstsnø antas å gi ekstra mekanisk friksjon [Bruker]. Snøen holder ekstra fuktighet, så test medium til grov struktur mot sug [Forslag]. Rens og smør skiene rett etter turen.');
    partielt(k, 'Kunstsnø');
  }
  if (s.på) {
    begrunnelse.push(`Saltet løype${bare(s)}: salt kjøler snøen og binder det frie vannet, så løypa blir hard, tørr og slipende (NSF, Beitostølen-veilederen og erfaring). Salting har «stor påvirkning på festesmøring og sålestruktur». ${delAndel(s) >= UNDERLAG_MIN_ANDEL ? `Snøtemperaturen er satt til ca. ${SALT_SNØTEMP} °C uansett lufta [Forslag], og smøringen er valgt som for hard, omdannet snø.` : ''}`.trim());
    if (tur.tMaksRå < -1) advarsler.push(`Salting virker ikke ved lufttemperatur rundt null eller kaldere (NSF), og det er ned mot ${tur.tMinRå.toFixed(1)} °C. Sjekk at løypa faktisk er saltet.`);
    if (klassisk) advarsler.push('Hard saltet løype: staking får fordel over diagonalgang med festesmøring (NSF). Test festet på et prøvestykke før start, og smør ikke tykkere enn nødvendig.');
    tillegg.push('Saltet snø er kald, hard og slipende, med en tynn saltlakefilm på sålen (Swix: salt gir tykkere smørefilm): velg en hard, slitesterk glider (kald) og ikke gå varmere. Medium til grov rille leder bort laken og hindrer sug [Forslag, test].');
    advarsler.push('Smør etter snøtemperaturen, ikke lufta: smører du etter lufta, kladder og iser festet. Be om å få teste ski på prøveområdet.');
    partielt(s, 'Salt');
  }
  const lag = stabel.lag.map((l) => (erGlid(l) && tillegg.length ? { ...l, merknad: [l.merknad, ...tillegg].filter(Boolean).join(' ') } : l));
  return { ...stabel, lag, begrunnelse, advarsler, alternativ: stabel.alternativ ? medUnderlag(stabel.alternativ, u, tur) : undefined };
}

/**
 * Struktur på kunstsnø og saltet løype. Alle riller er utgangspunkt for testing (Sporten Beitostølen: avanserte riller først når du kjenner ski og føre).
 * Salt [Bruker: stoler på Gemini-rapporten, har selv gått lite på saltet løype]: tynn saltholdig væskefilm og kapillærsug, så medium til grov rille. Swix bekrefter at salt senker smeltepunktet og gir tykkere smørefilm.
 * Kunstsnø: SkinnySki/Swix sier samme struktur som natursnø; en annen kilde sier medium til grov. Den kalde, harde kunstsnøen antas å gi ekstra mekanisk friksjon [Bruker].
 */
export function strukturMedUnderlag(s: Struktur, u: Underlag, stil: 'klassisk' | 'skoyting' = 'klassisk'): Struktur {
  if (!harUnderlag(u)) return s;
  const del: string[] = [];
  let ut = s;
  if (u.kunstsnø.på) del.push('Kunstsnø: tett og fuktig, med sug under skiene. SkinnySki/Swix sier samme struktur som natursnø; en annen kilde sier medium til grov. [Forslag] Start med anbefalingen og test ett trinn grovere.');
  if (u.salt.på) {
    del.push('Saltet løype: salt senker smeltepunktet og gir en tykkere vannfilm med saltlake og sug (Swix, Gemini-rapport). Derfor medium til grov rille for å lede bort laken. Test, ikke fasit.');
    if (delAndel(u.salt) >= UNDERLAG_MIN_ANDEL && s.nivå < 3) {
      ut = stil === 'skoyting'
        ? { ...s, navn: 'Medium slip, grov skrue (1–1,5 mm) eller V-avtrykk', nivå: 3 }
        : { ...s, navn: 'Medium til grov lineær', nivå: 3 };
    }
  }
  return { ...ut, grunn: `${ut.grunn} ${del.join(' ')}` };
}
