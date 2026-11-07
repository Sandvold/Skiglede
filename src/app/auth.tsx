import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';

/** Retur fra Google-innloggingen på mobil: skiglede://auth?neon_auth_session_verifier=… */
export default function AuthRetur() {
  const { neon_auth_session_verifier } = useLocalSearchParams<{ neon_auth_session_verifier?: string }>();
  const router = useRouter();
  const [feil, setFeil] = useState('');

  useEffect(() => {
    let avbrutt = false;
    (async () => {
      try {
        if (Platform.OS !== 'web' && neon_auth_session_verifier) {
          await require('@/data/native-konto').fullførMedVerifier(String(neon_auth_session_verifier));
        }
        if (!avbrutt) router.replace('/');
      } catch (e) {
        if (!avbrutt) setFeil(String((e as Error)?.message ?? e));
      }
    })();
    return () => {
      avbrutt = true;
    };
  }, [neon_auth_session_verifier, router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF2FB', padding: 24 }}>
      <Text style={{ color: '#12335F', fontSize: 18, fontWeight: '700' }}>{feil ? 'Innloggingen feilet' : 'Logger inn …'}</Text>
      {feil ? <Text style={{ color: '#12335F', marginTop: 12, textAlign: 'center' }}>{feil}</Text> : null}
      {feil ? <Text onPress={() => router.replace('/')} style={{ color: '#2F80D6', marginTop: 20, fontWeight: '700' }}>Til forsiden</Text> : null}
    </View>
  );
}
