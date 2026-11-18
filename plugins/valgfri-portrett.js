// Merker stående skjerm som valgfritt maskinvarekrav, så Play ikke utelukker nettbrett/skrivebord.
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function valgfriPortrett(config) {
  return withAndroidManifest(config, (c) => {
    const m = c.modResults.manifest;
    m['uses-feature'] = m['uses-feature'] ?? [];
    const navn = 'android.hardware.screen.portrait';
    const finnes = m['uses-feature'].find((f) => f.$['android:name'] === navn);
    if (finnes) finnes.$['android:required'] = 'false';
    else m['uses-feature'].push({ $: { 'android:name': navn, 'android:required': 'false' } });
    return c;
  });
};
