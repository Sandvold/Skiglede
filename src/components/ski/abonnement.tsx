import { useCallback, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { Chip } from '@/components/ski/ui';
import { ThemedText } from '@/components/themed-text';
import { gjenopprett, hentPakker, kjøp, kjøpTilgjengelig, type Pakke } from '@/data/kjop';
import { usePremium } from '@/data/premium';

/** Kjøp og status for Pro/Premium. Vises når serveren har slått på betaling. Kjøp gjøres bare i appen (Google Play). */
export function Abonnement() {
  const { premium, pro, oppdater } = usePremium();
  const [pakker, setPakker] = useState<Pakke[]>([]);
  const [melding, setMelding] = useState('');
  const [opptatt, setOpptatt] = useState(false);
  const native = Platform.OS !== 'web';

  useEffect(() => {
    if (!kjøpTilgjengelig()) return;
    hentPakker().then(setPakker).catch((e) => setMelding(`Kunne ikke hente abonnement: ${e?.message ?? e}`));
  }, []);

  // Tilgangen settes av serveren når Google har bekreftet kjøpet (webhook), som oftest innen få sekunder.
  const vent = useCallback(async () => {
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      await oppdater();
    }
  }, [oppdater]);

  const trykk = async (p: Pakke) => {
    setOpptatt(true);
    setMelding('');
    const f = await kjøp(p.id);
    if (f) setMelding(f);
    else {
      setMelding('Venter på bekreftelse fra butikken …');
      await vent();
      setMelding('');
    }
    setOpptatt(false);
  };

  const gjen = async () => {
    setOpptatt(true);
    const f = await gjenopprett();
    setMelding(f ?? 'Henter kjøp …');
    if (!f) {
      await vent();
      setMelding('');
    }
    setOpptatt(false);
  };

  return (
    <View style={{ gap: 8 }}>
      <ThemedText type="smallBold">{premium ? 'Du har Premium' : pro ? 'Du har Pro' : 'Du har ikke Pro eller Premium'}</ThemedText>
      {!native ? (
        <ThemedText type="small" themeColor="textSecondary">Abonnement kjøpes i Android-appen med samme konto. Da gjelder det også her.</ThemedText>
      ) : !kjøpTilgjengelig() ? (
        <ThemedText type="small" themeColor="textSecondary">Kjøp er ikke klart ennå.</ThemedText>
      ) : (
        <>
          {!premium &&
            pakker
              .filter((p) => !(pro && p.nivå === 'pro'))
              .map((p) => (
                <View key={p.id} style={{ flexDirection: 'row' }}>
                  <Chip aktiv onPress={() => !opptatt && trykk(p)}>{`Kjøp ${p.tittel} · ${p.pris}`}</Chip>
                </View>
              ))}
          <ThemedText type="small" themeColor="textSecondary">Fornyes automatisk hvert år til du sier opp i {Platform.OS === 'ios' ? 'App Store' : 'Google Play'}.</ThemedText>
          <View style={{ flexDirection: 'row' }}>
            <Chip aktiv={false} onPress={() => !opptatt && gjen()}>Gjenopprett kjøp</Chip>
          </View>
        </>
      )}
      {melding ? <ThemedText type="small" themeColor="textSecondary">{melding}</ThemedText> : null}
    </View>
  );
}
