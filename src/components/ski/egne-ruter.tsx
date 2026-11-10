import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Chip, Sammenleggbar } from '@/components/ski/ui';
import { ThemedText } from '@/components/themed-text';
import { byggFraGpx, lesGpx, terrengFor } from '@/data/gpx';
import { erKjentUtfartssted, type MinRute, useMineRuter } from '@/data/minerute';
import type { Område } from '@/data/omrader';
import { useTheme } from '@/hooks/use-theme';

const MAKS_KM = 60;

/**
 * Opplasting av egne GPX-ruter for alle innloggede. Navn er påkrevd. Alt regnes ut ved opplasting (høyde, skog og terreng for solskygge fra Kartverket)
 * og lagres i databasen. Ruten er privat; den kan bare deles hvis den starter ved et kjent utfartssted (en løype i databasen, innen 300 m).
 */
export function EgneRuter({ mine, bruker, område, onVelg }: { mine: ReturnType<typeof useMineRuter>; bruker?: { id: string } | null; område: Område; onVelg: (id: string) => void }) {
  const theme = useTheme();
  const [navn, setNavn] = useState('');
  const [del, setDel] = useState(false);
  const [status, setStatus] = useState('');
  const [opptatt, setOpptatt] = useState(false);
  const mineEgne = mine.ruter.filter((r: MinRute) => bruker && r.user_id === bruker.id);

  const last = async () => {
    setStatus('');
    const n = navn.trim();
    if (!n) return setStatus('Gi ruten et navn først.');
    if (n.length > 80) return setStatus('Navnet kan ha opptil 80 tegn.');
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ['*/*'], copyToCacheDirectory: true });
      if (r.canceled || !r.assets?.[0]) return;
      setOpptatt(true);
      const a = r.assets[0];
      const gpx = lesGpx(a.file ? await a.file.text() : await (await fetch(a.uri)).text());
      setStatus('Henter høyde og skog fra Kartverket …');
      const løype = await byggFraGpx(gpx.punkter, n);
      const avstand = Math.hypot((område.sted.lat - løype.start_lat) * 111, (område.sted.lon - løype.start_lon) * 111 * Math.cos((løype.start_lat * Math.PI) / 180));
      if (avstand > MAKS_KM) return setStatus(`Ruten starter ${Math.round(avstand)} km fra ${område.navn}. Bytt til området den ligger i, så får den riktig vær.`);
      løype.terreng = await terrengFor(løype.punkter, (f, t) => setStatus(`Regner terreng for solskygge … ${Math.round((f / t) * 100)} %`));
      let delt = false;
      let merk = 'Ruten er privat.';
      if (del) {
        if (await erKjentUtfartssted(løype.start_lat, løype.start_lon)) {
          delt = true;
          merk = 'Ruten er delt (starter ved et kjent utfartssted).';
        } else merk = 'Ruten starter ikke ved et kjent utfartssted, så den er lagret privat.';
      }
      const feil = await mine.lagre(løype, 'klassisk', delt);
      setStatus(feil ? `Kunne ikke lagre: ${feil}` : `Lagret «${n}» (${(løype.lengde_m / 1000).toFixed(1)} km). ${merk}`);
      if (!feil) setNavn('');
    } catch (e) {
      setStatus(String((e as Error)?.message ?? e));
    } finally {
      setOpptatt(false);
    }
  };

  const veksleDeling = async (r: MinRute) => {
    if (!r.delt && !(await erKjentUtfartssted(r.start_lat, r.start_lon))) return setStatus('Ruten starter ikke ved et kjent utfartssted, så den kan ikke deles.');
    await mine.delMed(r.id, !r.delt);
    setStatus('');
  };

  return (
    <Sammenleggbar id="egne-ruter" tittel={mineEgne.length ? `＋ Legg til egen tur (GPX) · du har ${mineEgne.length}` : '＋ Legg til egen tur (GPX)'} standardÅpen={mineEgne.length > 0}>
      {!bruker ? (
        <ThemedText type="small" themeColor="textSecondary">Logg inn for å laste opp egne GPX-ruter. Du får samme smøreråd som for andre løyper, regnet for akkurat din rute.</ThemedText>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">Gi ruten et navn og last opp GPX-filen. Høyde, skog og terreng for solskygge regnes ut ved opplasting (tar litt tid), og ruten lagres på kontoen din. Den er privat; den kan bare deles med andre hvis den starter ved et kjent utfartssted.</ThemedText>
          <TextInput value={navn} onChangeText={setNavn} maxLength={80} placeholder="Navn på ruten (påkrevd)" placeholderTextColor={theme.textSecondary} style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 10, color: theme.text }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip aktiv onPress={opptatt ? () => undefined : last}>{opptatt ? 'Laster opp …' : 'Last opp GPX'}</Chip>
            <Chip aktiv={del} onPress={() => setDel(!del)}>{del ? '✓ Del hvis mulig' : 'Del hvis mulig (av)'}</Chip>
          </View>
          {mineEgne.map((r: MinRute) => (
            <View key={r.id} style={{ gap: 6 }}>
              <ThemedText type="smallBold">{`${r.navn} · ${(r.lengde_m / 1000).toFixed(1)} km · ${r.delt ? 'delt' : 'privat'}`}</ThemedText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip aktiv onPress={() => onVelg(`egen-${r.id}`)}>Åpne</Chip>
                <Chip aktiv={false} onPress={() => veksleDeling(r)}>{r.delt ? 'Slutt å dele' : 'Del'}</Chip>
                <Chip aktiv={false} onPress={() => mine.slett(r.id)}>Slett</Chip>
              </View>
            </View>
          ))}
        </>
      )}
      {status ? <ThemedText type="small" style={{ color: theme.accent }}>{status}</ThemedText> : null}
      {mine.feil ? <ThemedText type="small" style={{ color: theme.accent }}>{mine.feil}</ThemedText> : null}
    </Sammenleggbar>
  );
}
