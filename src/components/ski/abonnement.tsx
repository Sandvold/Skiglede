import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { gjenopprett, hentPakker, kjøp, kjøpTilgjengelig, type Pakke } from '@/data/kjop';
import { usePremium } from '@/data/premium';
import { useTheme } from '@/hooks/use-theme';

type Nivå = 'premium' | 'pro';
const PLANER: { nivå: Nivå; tittel: string; undertittel: string; ikon: string; fordeler: string[] }[] = [
  {
    nivå: 'premium',
    tittel: 'Premium',
    undertittel: 'For deg som smører ofte',
    ikon: '⛷️',
    fordeler: ['Smørelager med forslag til innkjøp', 'Skipark: hva som ligger på hvert par', 'Flere steder, og «Bruk min smøring»', 'Lagres på kontoen og følger deg mellom enheter'],
  },
  {
    nivå: 'pro',
    tittel: 'Pro',
    undertittel: 'For deg som går renn og lange turer',
    ikon: '🏆',
    fordeler: ['Alt i Premium', 'Egne ruter fra GPX med vær og terreng', 'Renn med løype', 'Smørelogg og oppfølging'],
  },
];

/** Kjøp og status for Pro/Premium. Vises når serveren har slått på betaling. */
export function Abonnement() {
  const theme = useTheme();
  const { premium, pro, oppdater } = usePremium();
  const [pakker, setPakker] = useState<Pakke[]>([]);
  const [laster, setLaster] = useState(true);
  const [feil, setFeil] = useState('');
  const [detaljer, setDetaljer] = useState(false);
  const [melding, setMelding] = useState('');
  const [opptatt, setOpptatt] = useState<Nivå | 'gjen' | null>(null);
  const native = Platform.OS !== 'web';
  const butikk = Platform.OS === 'ios' ? 'App Store' : 'Google Play';

  const last = useCallback(() => {
    if (!kjøpTilgjengelig()) {
      setLaster(false);
      return;
    }
    setLaster(true);
    setFeil('');
    hentPakker()
      .then(setPakker)
      .catch((e) => setFeil(String(e?.message ?? e)))
      .finally(() => setLaster(false));
  }, []);
  useEffect(last, [last]);

  // Tilgangen settes av serveren når butikken har bekreftet kjøpet (webhook), som oftest innen få sekunder.
  const vent = useCallback(async () => {
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      await oppdater();
    }
  }, [oppdater]);

  const trykk = async (p: Pakke) => {
    setOpptatt(p.nivå);
    setMelding('');
    const f = await kjøp(p.id);
    if (f) setMelding(f);
    else {
      setMelding('Venter på bekreftelse fra butikken …');
      await vent();
      setMelding('');
    }
    setOpptatt(null);
  };

  const gjen = async () => {
    setOpptatt('gjen');
    const f = await gjenopprett();
    setMelding(f ?? 'Henter kjøp …');
    if (!f) {
      await vent();
      setMelding('');
    }
    setOpptatt(null);
  };

  const nivåNå: Nivå | null = pro ? 'pro' : premium ? 'premium' : null;
  const statusTekst = pro ? 'Pro' : premium ? 'Premium' : 'Gratis';
  const statusFarge = pro || premium ? theme.accent : theme.backgroundSelected;
  const statusTekstFarge = pro || premium ? theme.onAccent : theme.textSecondary;

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontWeight: '800', fontSize: 16 }}>Ditt abonnement</Text>
          <ThemedText type="small" themeColor="textSecondary">
            {nivåNå ? 'Takk for at du støtter Skiglede.' : 'Prøv Skiglede gratis, oppgrader når du vil.'}
          </ThemedText>
        </View>
        <View style={{ backgroundColor: statusFarge, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 14 }}>
          <Text style={{ color: statusTekstFarge, fontWeight: '800', fontSize: 14 }}>{nivåNå ? `✓ ${statusTekst}` : statusTekst}</Text>
        </View>
      </View>

      {!native ? (
        <ThemedText type="small" themeColor="textSecondary">Abonnement kjøpes i mobilappen med samme konto. Da gjelder det også her.</ThemedText>
      ) : (
        PLANER.map((plan) => {
          const pakke = pakker.find((p) => p.nivå === plan.nivå);
          const aktiv = nivåNå === plan.nivå;
          const dekket = nivåNå === 'pro' && plan.nivå === 'premium'; // Pro inkluderer Premium
          const uthevet = plan.nivå === 'pro';
          return (
            <View
              key={plan.nivå}
              style={{
                borderWidth: aktiv ? 2 : 1,
                borderColor: aktiv || uthevet ? theme.accent : theme.border,
                backgroundColor: theme.backgroundElement,
                borderRadius: 16,
                padding: 14,
                gap: 10,
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 26 }}>{plan.ikon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: '800', fontSize: 18 }}>{plan.tittel}</Text>
                  <ThemedText type="small" themeColor="textSecondary">{plan.undertittel}</ThemedText>
                </View>
                {pakke ? (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: theme.text, fontWeight: '800', fontSize: 16 }}>{pakke.pris.replace(' per år', '')}</Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 12 }}>per år</Text>
                  </View>
                ) : null}
              </View>
              <View style={{ gap: 4 }}>
                {plan.fordeler.map((f) => (
                  <View key={f} style={{ flexDirection: 'row', gap: 8 }}>
                    <Text style={{ color: theme.accent, fontWeight: '800' }}>✓</Text>
                    <Text style={{ color: theme.text, fontSize: 14, flex: 1 }}>{f}</Text>
                  </View>
                ))}
              </View>
              {aktiv ? (
                <View style={{ backgroundColor: theme.accentSoft, borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}>
                  <Text style={{ color: theme.text, fontWeight: '800' }}>✓ Du har {plan.tittel}</Text>
                </View>
              ) : dekket ? (
                <View style={{ backgroundColor: theme.accentSoft, borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}>
                  <Text style={{ color: theme.text, fontWeight: '700' }}>Inkludert i Pro</Text>
                </View>
              ) : pakke ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={opptatt !== null}
                  onPress={() => trykk(pakke)}
                  style={{ backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center', opacity: opptatt !== null ? 0.6 : 1 }}>
                  <Text style={{ color: theme.onAccent, fontWeight: '800', fontSize: 16 }}>
                    {opptatt === plan.nivå ? 'Åpner butikken …' : nivåNå === 'premium' ? `Oppgrader til ${plan.tittel}` : `Velg ${plan.tittel}`}
                  </Text>
                </Pressable>
              ) : (
                <View style={{ backgroundColor: theme.backgroundSelected, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
                  <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>{laster ? 'Henter pris …' : 'Ikke tilgjengelig akkurat nå'}</Text>
                </View>
              )}
            </View>
          );
        })
      )}

      {native && !laster && pakker.length === 0 && kjøpTilgjengelig() ? (
        <Pressable onPress={last} accessibilityRole="button">
          <ThemedText type="small" themeColor="textSecondary">
            {`Abonnementene kan ikke hentes fra ${butikk} akkurat nå. Prøv igjen om litt. `}
            <Text style={{ color: theme.accent, fontWeight: '700' }}>Prøv på nytt</Text>
          </ThemedText>
        </Pressable>
      ) : null}
      {feil ? (
        <Pressable onPress={() => setDetaljer(!detaljer)} accessibilityRole="button">
          <ThemedText type="small" themeColor="textSecondary">{detaljer ? feil.slice(0, 400) : 'Vis tekniske detaljer'}</ThemedText>
        </Pressable>
      ) : null}

      {native ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {`Fornyes automatisk hvert år til du sier opp i ${butikk}. Betalingen belastes ${Platform.OS === 'ios' ? 'Apple-kontoen' : 'Google-kontoen'} din.`}
          </ThemedText>
          <Pressable disabled={opptatt !== null} onPress={gjen} accessibilityRole="button" style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
            <Text style={{ color: theme.accent, fontWeight: '700' }}>{opptatt === 'gjen' ? 'Henter kjøp …' : 'Gjenopprett kjøp'}</Text>
          </Pressable>
        </>
      ) : null}
      {melding ? <ThemedText type="small" themeColor="textSecondary">{melding}</ThemedText> : null}
    </View>
  );
}
