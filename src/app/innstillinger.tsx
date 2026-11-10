import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Hero } from '@/components/ski/hero';
import { Chip, Kort } from '@/components/ski/ui';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useLagret } from '@/data/lagring';
import { useMineRuter, type MinRute } from '@/data/minerute';
import { usePremium } from '@/data/premium';
import { useTheme } from '@/hooks/use-theme';

const TEMPO = [
  { id: 'Tur', tekst: 'Tur', hjelp: 'rolig tempo (klassisk 7 km/t, skøyting 10 km/t)' },
  { id: 'Trening', tekst: 'Trening', hjelp: 'raskere (klassisk 10 km/t, skøyting 15 km/t)' },
] as const;

export default function Innstillinger() {
  const theme = useTheme();
  const router = useRouter();
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={{ alignItems: 'center', paddingBottom: Spacing.six }}>
      <Hero />
      <View style={{ width: '100%', maxWidth: MaxContentWidth, padding: Spacing.three, gap: Spacing.three }}>
        <Pressable onPress={() => router.back()} style={{ alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.backgroundElement }}>
          <Text style={{ color: theme.text, fontWeight: '700' }}>← Tilbake</Text>
        </Pressable>
        <Tempo />
        <PrivateRuter />
      </View>
    </ScrollView>
  );
}

function Tempo() {
  const theme = useTheme();
  const [standard, setStandard] = useLagret<string>('skiglede.standardModus', 'Tur');
  const valgt = standard === 'Trening' ? 'Trening' : 'Tur';
  return (
    <Kort>
      <Text style={{ color: theme.text, fontWeight: '800', fontSize: 20 }}>Standard tempo</Text>
      <ThemedText type="small" themeColor="textSecondary">Brukes til å regne ut hvor lenge turen varer og hvilket vær du møter. På løypesiden kan du bytte for en enkelt tur.</ThemedText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {TEMPO.map((t) => (
          <Chip key={t.id} aktiv={valgt === t.id} onPress={() => setStandard(t.id)}>{t.tekst}</Chip>
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">{`Nå: ${TEMPO.find((t) => t.id === valgt)?.hjelp}.`}</ThemedText>
    </Kort>
  );
}

function PrivateRuter() {
  const theme = useTheme();
  const { klar, bruker, loggInnMedGoogle } = usePremium();
  const mine = useMineRuter(!!bruker);
  const [bekreft, setBekreft] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const mineEgne = mine.ruter.filter((r: MinRute) => bruker && r.user_id === bruker.id);
  const privat = mineEgne.filter((r) => !r.delt);
  const delte = mineEgne.filter((r) => r.delt);
  const slett = async (r: MinRute) => {
    const feil = await mine.slett(r.id);
    setBekreft(null);
    setStatus(feil ? `Kunne ikke slette: ${feil}` : `Slettet «${r.navn}».`);
  };
  const rad = (r: MinRute) => (
    <View key={r.id} style={{ gap: 6, paddingVertical: 6 }}>
      <ThemedText type="smallBold">{`${r.navn} · ${(r.lengde_m / 1000).toFixed(1)} km · ${r.delt ? 'delt' : 'privat'}`}</ThemedText>
      {bekreft === r.id ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <ThemedText type="small">Slette for godt?</ThemedText>
          <Chip aktiv onPress={() => slett(r)}>Ja, slett</Chip>
          <Chip aktiv={false} onPress={() => setBekreft(null)}>Avbryt</Chip>
        </View>
      ) : (
        <View style={{ flexDirection: 'row' }}>
          <Chip aktiv={false} onPress={() => { setStatus(''); setBekreft(r.id); }}>Slett</Chip>
        </View>
      )}
    </View>
  );
  return (
    <Kort>
      <Text style={{ color: theme.text, fontWeight: '800', fontSize: 20 }}>Mine ruter</Text>
      {!klar ? null : !bruker ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">Logg inn for å se og slette egne GPX-ruter.</ThemedText>
          <Chip aktiv onPress={loggInnMedGoogle}>Logg inn med Google</Chip>
        </>
      ) : mineEgne.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">Du har ingen egne ruter. Legg til fra forsiden («Legg til egen tur»).</ThemedText>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">Private ruter ser bare du. Å slette fjerner ruten fra kontoen din og kan ikke angres.</ThemedText>
          {privat.map(rad)}
          {delte.length > 0 && <ThemedText type="smallBold" themeColor="textSecondary">Delte ruter</ThemedText>}
          {delte.map(rad)}
        </>
      )}
      {status ? <ThemedText type="small" style={{ color: theme.accent }}>{status}</ThemedText> : null}
      {mine.feil ? <ThemedText type="small" style={{ color: theme.accent }}>{mine.feil}</ThemedText> : null}
    </Kort>
  );
}
