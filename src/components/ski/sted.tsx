import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Chip } from '@/components/ski/ui';
import { ThemedText } from '@/components/themed-text';
import { useSteder } from '@/data/lagring';
import { useOmråde } from '@/data/omrader';
import { usePosisjonNå } from '@/data/posisjon';
import { STED_RADIUS_KM, useStedStatus } from '@/data/stedauto';
import { useTheme } from '@/hooks/use-theme';

/** Velg sted (f.eks. fjellet eller hjemme). Hvert sted har eget smørelager og egen skipark. */
export function StedVelger({ forklaring }: { forklaring?: string }) {
  const theme = useTheme();
  const { steder, aktiv, velg, leggTil, gi_nytt_navn, fjern, posFor, settPos } = useSteder();
  const [valgtOmråde] = useOmråde();
  const pos = usePosisjonNå();
  const status = useStedStatus();
  const [modus, setModus] = useState<'ingen' | 'ny' | 'navn' | 'fjern'>('ingen');
  const [tekst, setTekst] = useState('');
  const nåværende = steder.find((s) => s.id === aktiv)!;
  const ferdig = () => {
    if (modus === 'ny' && tekst.trim()) leggTil(tekst, valgtOmråde.id, pos ?? { lat: valgtOmråde.visning.lat, lon: valgtOmråde.visning.lon }); // nytt sted får posisjonen din (ellers området du ser på)
    if (modus === 'navn') gi_nytt_navn(aktiv, tekst);
    setModus('ingen');
    setTekst('');
  };
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>Sted</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {steder.length > 1 && steder.map((s) => (
          <Chip key={s.id || 'standard'} aktiv={s.id === aktiv} onPress={() => velg(s.id)}>{s.navn}</Chip>
        ))}
        <Chip aktiv={false} onPress={() => { setTekst(''); setModus('ny'); }}>+ Legg til sted</Chip>
        {steder.length > 1 ? <Chip aktiv={false} onPress={() => { setTekst(nåværende.navn); setModus('navn'); }}>Endre navn</Chip> : null}
        {steder.length > 1 && aktiv ? <Chip aktiv={modus === 'fjern'} onPress={() => setModus(modus === 'fjern' ? 'ingen' : 'fjern')}>Fjern sted</Chip> : null}
      </View>
      {modus === 'ny' || modus === 'navn' ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TextInput
            value={tekst}
            onChangeText={setTekst}
            autoFocus
            placeholder={modus === 'ny' ? 'F.eks. Fjellet eller Hjemme i Oslo' : 'Nytt navn'}
            onSubmitEditing={ferdig}
            style={{ flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 16, color: theme.text, backgroundColor: theme.backgroundElement }}
          />
          <Chip aktiv onPress={ferdig}>Lagre</Chip>
          <Chip aktiv={false} onPress={() => setModus('ingen')}>Avbryt</Chip>
        </View>
      ) : null}
      {modus === 'fjern' ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <ThemedText type="small" style={{ flexShrink: 1 }}>Fjerner {nåværende.navn} med lager og skipark. Dette kan ikke angres.</ThemedText>
          <Chip aktiv onPress={() => { fjern(aktiv); setModus('ingen'); }}>Ja, fjern</Chip>
          <Chip aktiv={false} onPress={() => setModus('ingen')}>Avbryt</Chip>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {pos ? <Chip aktiv={false} onPress={() => settPos(aktiv, pos)}>{posFor(aktiv) ? 'Oppdater posisjon til der jeg er' : 'Bruk min posisjon som dette stedet'}</Chip> : null}
        <ThemedText type="small" themeColor="textSecondary" style={{ flexShrink: 1 }}>
          {status.tilstand === 'inne'
            ? `Du er innen ${STED_RADIUS_KM} km fra stedet, så det velges automatisk.`
            : status.tilstand === 'utenfor'
              ? `Du er mer enn ${STED_RADIUS_KM} km fra stedene dine. Velg selv smøring fra lageret, eller ski fra et av stedene.`
              : posFor(aktiv) ? 'Stedet velges automatisk når du er innen 10 km.' : 'Legg til posisjon, så velges stedet automatisk når du er innen 10 km.'}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {forklaring ?? (steder.length > 1 ? `Du ser ${nåværende.navn}.` : 'Har du ski eller smøring på flere steder, for eksempel på fjellet og hjemme, kan du legge til flere steder. Uten steder ligger alt samlet.')}
      </ThemedText>
    </View>
  );
}
