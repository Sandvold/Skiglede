// React Native har en ufullstendig URL/URLSearchParams (mangler bl.a. searchParams.set). Neon-biblioteket trenger hele; polyfill bare på mobil.
if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
  require('react-native-url-polyfill/auto');
}

// atob/btoa brukes til å lese utløpstid i innloggingstokenet; sørg for at de finnes.
if (typeof global.atob !== 'function') {
  const { Buffer } = require('buffer');
  global.atob = (s) => Buffer.from(String(s), 'base64').toString('binary');
  global.btoa = (s) => Buffer.from(String(s), 'binary').toString('base64');
}

// Hermes (Android) har ikke Web Crypto. Innloggingsbiblioteket (Neon/better-auth) bruker globalThis.crypto, så vi gir det en enkel versjon fra expo-crypto.
if (typeof global.crypto === 'undefined' || typeof global.crypto.getRandomValues !== 'function') {
  const C = require('expo-crypto');
  global.crypto = Object.assign(global.crypto ?? {}, {
    getRandomValues: C.getRandomValues,
    randomUUID: C.randomUUID,
    subtle: global.crypto?.subtle ?? { digest: C.digest },
  });
}

// Egen inngang: viser JS-feil på skjermen i stedet for at appen bare lukker seg (felles feilsøking for mobilappen).
if (global.ErrorUtils) {
  const { Alert } = require('react-native');
  global.ErrorUtils.setGlobalHandler((error, erFatal) => {
    try {
      Alert.alert(erFatal ? 'Skiglede krasjet' : 'Skiglede feil', `${error?.message ?? error}\n\n${String(error?.stack ?? '').slice(0, 1200)}`);
    } catch {
      // ingenting mer å gjøre
    }
  });
}
require('expo-router/entry');
