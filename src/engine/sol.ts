export const HOVDEN = { lat: 59.5667, lon: 7.3667 };

/** Anslår kortbølget innstråling (J/m² per time) fra solhøyde og skydekke, siden Yr ikke oppgir innstråling.
 *  Klarvær: Haurwitz. Skyer: Kasten–Czeplak (1 − 0,75·N^3,4). Snøalbedo og terrengskygge er ikke med. */
export function solHøyde(ts: number, lat: number, lon: number): number {
  const rad = Math.PI / 180;
  const d = new Date(ts);
  const dagNr = (ts - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400_000;
  const g = (2 * Math.PI * (dagNr - 1 + (d.getUTCHours() - 12) / 24)) / 365;
  const dekl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g);
  const ekv = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const tidMin = d.getUTCHours() * 60 + d.getUTCMinutes() + ekv + 4 * lon;
  const vinkel = (tidMin / 4 - 180) * rad;
  const sinH = Math.sin(lat * rad) * Math.sin(dekl) + Math.cos(lat * rad) * Math.cos(dekl) * Math.cos(vinkel);
  return Math.asin(Math.max(-1, Math.min(1, sinH))) / rad;
}

/** Innstråling i J/m² for timen som slutter ved ts (midtpunktet i timen brukes). skyPst: 0–100. */
export function innstråling(ts: number, skyPst: number, lat: number, lon: number): number {
  const h = solHøyde(ts - 1800_000, lat, lon);
  if (h <= 0) return 0;
  const c = Math.sin((h * Math.PI) / 180);
  const klar = 1098 * c * Math.exp(-0.057 / c);
  const sky = 1 - 0.75 * Math.pow(Math.min(1, Math.max(0, skyPst / 100)), 3.4);
  return Math.max(0, klar * sky) * 3600;
}

/** Solens retning i grader fra nord, medsols (180 = sør). */
export function solAzimut(ts: number, lat: number, lon: number): number {
  const rad = Math.PI / 180;
  const d = new Date(ts);
  const dagNr = (ts - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400_000;
  const g = (2 * Math.PI * (dagNr - 1 + (d.getUTCHours() - 12) / 24)) / 365;
  const dekl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g);
  const ekv = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const vinkel = (((d.getUTCHours() * 60 + d.getUTCMinutes() + ekv + 4 * lon) / 4) - 180) * rad;
  const h = solHøyde(ts, lat, lon) * rad;
  const sinAz = (-Math.cos(dekl) * Math.sin(vinkel)) / Math.cos(h);
  const cosAz = (Math.sin(dekl) - Math.sin(h) * Math.sin(lat * rad)) / (Math.cos(h) * Math.cos(lat * rad));
  return (Math.atan2(sinAz, cosAz) / rad + 360) % 360;
}
