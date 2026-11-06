import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Chip } from '@/components/ski/ui';
import { ThemedText } from '@/components/themed-text';
import { useSteder } from '@/data/lagring';
import { sorterOmråder, useOmråde, useOmråder } from '@/data/omrader';
import { usePosisjonNå } from '@/data/posisjon';
import { useTheme } from '@/hooks/use-theme';

/** Velg sted (f.eks. fjellet eller hjemme). Hvert sted har eget smørelager og egen skipark. */
export function StedVelger({ forklaring }: { forklaring?: string }) {
  const theme = useTheme();
  const { steder, aktiv, velg, leggTil, gi_nytt_navn, fjern, områdeFor, knytt } = useSteder();
  const [valgtOmråde] = useOmråde();
  const områder = useOmråder();
  const pos = usePosisjonNå();
  const [visOmråder, setVisOmråder] = useState(false);
  const knyttetNavn = områder.find((o) => o.id === områdeFor(aktiv))?.navn;
  const [modus, setModus] = useState<'ingen' | 'ny' | 'navn' | 'fjern'>('ingen');
  const [tekst, setTekst] = useState('');
  const nåværende = steder.find((s) => s.id === aktiv)!;
  const ferdig = () => {
    if (modus === 'ny' && tekst.trim()) leggTil(tekst, valgtOmråde.id); // nytt sted hører til området du er i
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
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Chip aktiv={visOmråder} onPress={() => setVisOmråder(!visOmråder)}>{knyttetNavn ? `Område: ${knyttetNavn}` : 'Knytt til område'}</Chip>
          <ThemedText type="small" themeColor="textSecondary" style={{ flexShrink: 1 }}>
            {knyttetNavn ? `Velger du ${knyttetNavn} (eller er du der), byttes det automatisk til ${nåværende.navn}.` : 'Knyttes stedet til et område, byttes det automatisk når du velger eller er i området.'}
          </ThemedText>
        </View>
        {visOmråder ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip aktiv={!knyttetNavn} onPress={() => { knytt(aktiv, ''); setVisOmråder(false); }}>Ingen</Chip>
            {sorterOmråder(områder, pos, []).map((o) => (
              <Chip key={o.id} aktiv={områdeFor(aktiv) === o.id} onPress={() => { knytt(aktiv, o.id); setVisOmråder(false); }}>{o.navn}</Chip>
            ))}
          </View>
        ) : null}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {forklaring ?? (steder.length > 1 ? `Du ser ${nåværende.navn}.` : 'Har du ski eller smøring på flere steder, for eksempel på fjellet og hjemme, kan du legge til flere steder. Uten steder ligger alt samlet.')}
      </ThemedText>
    </View>
  );
}
