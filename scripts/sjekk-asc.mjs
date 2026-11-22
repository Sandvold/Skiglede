// Tester App Store Connect API-nøkkelen lokalt før iOS-bygget.
// Leser EXPO_ASC_API_KEY_PATH, EXPO_ASC_KEY_ID og EXPO_ASC_ISSUER_ID.
// Skriver ut nøyaktig hva som er galt (feil nøkkel, ID, rolle eller klokke).
import { readFileSync, existsSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { basename } from 'node:path';

const sti = process.env.EXPO_ASC_API_KEY_PATH;
const keyId = process.env.EXPO_ASC_KEY_ID;
const issuer = process.env.EXPO_ASC_ISSUER_ID;
const feil = (t) => { console.error('FEIL: ' + t); process.exit(1); };

if (!sti || !keyId || !issuer) feil('Mangler EXPO_ASC_API_KEY_PATH, EXPO_ASC_KEY_ID eller EXPO_ASC_ISSUER_ID.');
if ([keyId, issuer].some((v) => v.includes('<') || v.includes('>'))) feil('Key ID/Issuer ID inneholder < >. Skriv inn de ekte verdiene.');
if (!existsSync(sti)) feil('Finner ikke nøkkelfilen: ' + sti);
const filId = basename(sti).match(/^AuthKey_([A-Z0-9]+)\.p8$/i)?.[1];
if (filId && filId !== keyId) feil(`Key ID (${keyId}) passer ikke med filnavnet (${filId}). Bruk Key ID ${filId}.`);
if (keyId === '6W4F79H9J5') feil('6W4F79H9J5 er In-App Purchase-nøkkelen til RevenueCat. Lag en egen Team Key (rolle Admin) til EAS.');

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const nå = Math.floor(Date.now() / 1000);
const data = b64({ alg: 'ES256', kid: keyId, typ: 'JWT' }) + '.' + b64({ iss: issuer, iat: nå, exp: nå + 600, aud: 'appstoreconnect-v1' });
const sig = createSign('SHA256').update(data).sign({ key: readFileSync(sti, 'utf8'), dsaEncoding: 'ieee-p1363' }).toString('base64url');

const r = await fetch('https://api.appstoreconnect.apple.com/v1/apps/6837495352', { headers: { Authorization: `Bearer ${data}.${sig}` } });
if (r.ok) { console.log('OK: Apple godtar nøkkelen og ser appen Skiglede.'); } else {
const dato = r.headers.get('date');
console.error(`Apple svarte ${r.status}. ` + (await r.text()).slice(0, 300));
if (r.status === 401) console.error('Sjekk: Key ID og Issuer ID (øverst på siden Team Keys), at filen er den nøkkelen, og at PC-klokken stemmer (Apple-tid: ' + dato + ').');
if (r.status === 403) console.error('Nøkkelen er gyldig, men mangler rettigheter. Lag en ny Team Key med rollen Admin.');
process.exitCode = 1;
}
