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
