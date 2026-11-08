import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Chip, Kort } from '@/components/ski/ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { GLID_VALG, GREP_VALG, lagreLogg, type NyLogg } from '@/data/logg';
import { usePremium } from '@/data/premium';
import { useTheme } from '@/hooks/use-theme';

/** Premium: noter hvordan smøringen gikk. Lagrer også det modellen mente, så vi kan sammenligne modell og utfall senere. */
export function Loggkort({ grunnlag }: { grunnlag: Omit<NyLogg, 'grep' | 'glid' | 'snotemp_malt' | 'lufttemp_malt' | 'kommentar'> }) {
  const theme = useTheme();
  const router = useRouter();
  const { premium } = usePremium();
  const skøyting = grunnlag.stil === 'skoyting'; // skøyting har ikke feste: bare glid vurderes
  const [grep, setGrep] = useState<number | null>(null);
  const [glid, setGlid] = useState<number | null>(null);
  const [snø, setSnø] = useState('');
  const [luft, setLuft] = useState('');
  const [kommentar, setKommentar] = useState('');
  const [status, setStatus] = useState<'' | 'lagrer' | 'lagret' | string>('');

  if (!premium) {
    return (
      <Kort>
        <Text style={{ color: theme.text, fontWeight: '800', fontSize: 18 }}>Smøreloggen</Text>
        <ThemedText themeColor="textSecondary">🔒 Premium: noter hvordan smøringen gikk (bakglatt, god, klabete), med kommentar. Det hjelper oss å tilpasse rådene.</ThemedText>
      </Kort>
    );
  }
  const tall = (t: string) => { const n = parseFloat(t.replace(',', '.')); return Number.isFinite(n) ? n : null; };
  const lagre = async () => {
    if ((skøyting ? false : grep === null) && glid === null && !kommentar.trim()) { setStatus('Velg en vurdering eller skriv en kommentar først.'); return; }
    setStatus('lagrer');
    const feil = await lagreLogg({ ...grunnlag, grep: skøyting ? null : grep, glid, snotemp_malt: tall(snø), lufttemp_malt: tall(luft), kommentar: kommentar.trim() || null });
    if (feil) { setStatus(feil); return; }
    setStatus('lagret');
    setGrep(null); setGlid(null); setSnø(''); setLuft(''); setKommentar('');
  };
  const felt = { borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 10, color: theme.text, backgroundColor: theme.background, fontSize: 15 } as const;
  return (
    <Kort style={{ gap: Spacing.two }}>
      <Text style={{ color: theme.text, fontWeight: '800', fontSize: 18 }}>Hvordan gikk smøringen?</Text>
      <ThemedText type="small" themeColor="textSecondary">Gjelder smøringen over. Du kan logge etter turen.</ThemedText>
      {skøyting ? null : (
        <>
          <ThemedText type="smallBold" themeColor="textSecondary">FESTE</ThemedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {GREP_VALG.map((g) => <Chip key={g.v} aktiv={grep === g.v} onPress={() => setGrep(grep === g.v ? null : g.v)}>{g.tekst}</Chip>)}
          </View>
          {grep === -2 && <ThemedText type="small" themeColor="textSecondary">Veldig bakglatt: for kald smøring.</ThemedText>}
          {grep === 2 && <ThemedText type="small" themeColor="textSecondary">Mye klabb: for varm smøring, eller klister på tørr snø.</ThemedText>}
        </>
      )}
      <ThemedText type="smallBold" themeColor="textSecondary">GLID</ThemedText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {GLID_VALG.map((g) => <Chip key={g.v} aktiv={glid === g.v} onPress={() => setGlid(glid === g.v ? null : g.v)}>{g.tekst}</Chip>)}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput value={snø} onChangeText={setSnø} placeholder="Snøtemp °C" placeholderTextColor={theme.textSecondary} keyboardType="numbers-and-punctuation" style={[felt, { flex: 1, minWidth: 0 }]} />
        <TextInput value={luft} onChangeText={setLuft} placeholder="Lufttemp °C" placeholderTextColor={theme.textSecondary} keyboardType="numbers-and-punctuation" style={[felt, { flex: 1, minWidth: 0 }]} />
      </View>
      <TextInput value={kommentar} onChangeText={setKommentar} placeholder="Kommentar: hva du smurte annerledes, preparering, ski, følelse …" placeholderTextColor={theme.textSecondary} multiline style={[felt, { minHeight: 72, textAlignVertical: 'top' }]} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <Chip aktiv onPress={lagre}>{status === 'lagrer' ? 'Lagrer …' : 'Lagre i loggen'}</Chip>
        <Chip aktiv={false} onPress={() => router.push("/logg")}>Se loggen</Chip>
      </View>
      {status === 'lagret' ? <ThemedText type="small" style={{ color: theme.accent }}>✓ Lagret i loggen.</ThemedText> : status && status !== 'lagrer' ? <ThemedText type="small" style={{ color: theme.accent }}>{status}</ThemedText> : null}
    </Kort>
  );
}
