import type { Lag, SnøAnalyse, Stabel, Tur } from './typer';
import type { Struktur } from './pro';

/**
 * Underlag som ikke er vanlig natursnø: kunstsnø og saltet løype. Bare brukerens avkrysning styrer dette; værdata kan ikke se det.
 *
 * Kilder (hva som faktisk står der, og hva som er mitt forslag):
 * - Kunstsnø [SkinnySki/Swix-råd]: oppfører seg som omdannet og gjenfrosset snø, så klister er det trygge festevalget. Baseklister (KR20) først beskytter festet mot den slipende snøen,
 *   og et hardvoksdekke over klisteret holder skitt og løse iskorn unna (kan være varmere enn temperaturen tilsier). Glid: velg etter snøtemperatur som ellers, hardere (kaldere) voks tåler slitasje bedre,
 *   men kunstsnø holder ekstra fuktighet, så ved varmt vær går man litt varmere. Rens og smør skiene rett etter turen, kunstsnø er skitten. Faller det natursnø oppå, gjelder natursnø-valg igjen.
 * - Salting [NSF: «Veiledning i salting av langrennsløyper» og saltveileder v7]: gir hardere og jevnere løype, «stor påvirkning på festesmøring og sålestruktur», staking blir mer fordelaktig enn diagonalgang,
 *   salt virker ikke ved lufttemperatur rundt null eller kaldere, og for mye salt tørker ut snøen. Testing på prøveområde anbefales. NSF gir INGEN konkrete anbefalinger for glider eller struktur på saltet snø.
 *   Det jeg bruker om at saltet løype er hard og iset (skarphet) og om ekstra vann/sug på glid er [Forslag] og må testes.
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
export type Underlag = { kunstsnø: Påvirkning; salt: Påvirkning };
export const INGEN_UNDERLAG: Underlag = { kunstsnø: { på: false, del: 'hele' }, salt: { på: false, del: 'hele' } };

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

/** Snøanalysen smøringen bygges på. Kunstsnø og salt regnes som hard, omdannet snø når de dekker minst halve løypa. */
export function snøMedUnderlag(snø: SnøAnalyse, u: Underlag): SnøAnalyse {
  const ak = delAndel(u.kunstsnø);
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

  if (k.på) {
    begrunnelse.push(`Kunstsnø${bare(k)}: oppfører seg som omdannet, gjenfrosset snø (Swix/SkinnySki). ${delAndel(k) >= UNDERLAG_MIN_ANDEL ? 'Smøringen er valgt som for hard, omdannet snø.' : ''}`.trim());
    if (klassisk) {
      advarsler.push('Kunstsnø er slipende: legg baseklister/binder først og hold laget under festet tynt og jevnt, så festet ikke slites bort. Et hardvoksdekke over klisteret holder skitt og løse iskorn unna (kan være litt varmere enn temperaturen tilsier).');
    }
    if (stabel.type === 'hardvoks') advarsler.push('Kunstsnø under −8 °C: hardvoks over binder i stedet for klister. Hvis festet slipper, bytt til klister med voksdekke.');
    tillegg.push('Kunstsnø slites hardt: kaldere (hardere) glider tåler slitasje bedre, men snøen holder ekstra fuktighet, så ved varme (rundt 0 °C og over) går du heller litt varmere. Rens og smør skiene rett etter turen.');
    partielt(k, 'Kunstsnø');
  }
  if (s.på) {
    begrunnelse.push(`Saltet løype${bare(s)}: hard og jevn (NSF). Salting har «stor påvirkning på festesmøring og sålestruktur». ${delAndel(s) >= UNDERLAG_MIN_ANDEL ? 'Smøringen er valgt som for hard, omdannet snø.' : ''}`.trim());
    if (tur.tMaks < -1) advarsler.push(`Salting virker ikke ved lufttemperatur rundt null eller kaldere (NSF), og det er ned mot ${tur.tMin.toFixed(1)} °C. Sjekk at løypa faktisk er saltet.`);
    if (klassisk) advarsler.push('Hard saltet løype: staking får fordel over diagonalgang med festesmøring (NSF). Test festet på et prøvestykke før start, og smør ikke tykkere enn nødvendig.');
    tillegg.push('Saltet snø er hard og kan holde ekstra vann (brine). [Forslag] Test en grovere struktur og en litt varmere glider mot anbefalingen. NSF gir ingen fasit for glid på saltet snø.');
    advarsler.push('For mye salt tørker ut snøen, og små saltkorn kan gi en isete skorpe. Be om å få teste ski på prøveområdet.');
    partielt(s, 'Salt');
  }
  const lag = stabel.lag.map((l) => (erGlid(l) && tillegg.length ? { ...l, merknad: [l.merknad, ...tillegg].filter(Boolean).join(' ') } : l));
  return { ...stabel, lag, begrunnelse, advarsler, alternativ: stabel.alternativ ? medUnderlag(stabel.alternativ, u, tur) : undefined };
}

/** Struktur: samme anbefaling, med en kort merknad (kunstsnø: samme struktur som natursnø ved samme temperatur; salt: test grovere). */
export function strukturMedUnderlag(s: Struktur, u: Underlag): Struktur {
  if (!harUnderlag(u)) return s;
  const del: string[] = [];
  if (u.kunstsnø.på) del.push('Kunstsnø: samme struktur som natursnø ved samme temperatur (SkinnySki/Swix).');
  if (u.salt.på) del.push('Saltet løype: NSF sier salting påvirker sålestrukturen, men gir ingen anbefaling. [Forslag] Test strukturen ett trinn grovere.');
  return { ...s, grunn: `${s.grunn} ${del.join(' ')}` };
}
