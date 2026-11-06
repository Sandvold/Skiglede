// Enkel worker-pool: en delt kø og N workers som plukker neste jobb så snart de er ferdige med forrige.
// Promise.all starter workerne samtidig, og queue.shift() sørger for at to workers aldri tar samme element (Node er enkelttrådet).
// Samtidigheten er begrenset, ikke «alt på én gang», så vi unngår rate limits.
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Kjører `behandle(element, workerNr)` for alle elementer med `samtidig` workers.
 * - `pause`: ms hver worker venter etter hvert element (vær grei mot API-et).
 * - `ferdig(antallFerdige, element, resultat)`: kalles etter hvert fullført element; antallet telles som fullførte
 *   (ikke indeks), så det blir riktig selv om workerne blir ferdige i ulik rekkefølge. Bruk den til å lagre fremdrift underveis.
 * - En feil på ett element fanges for seg og returneres i resultatlista; den velter ikke resten.
 */
export async function kjørPool(elementer, samtidig, behandle, { pause = 0, ferdig } = {}) {
  const kø = elementer.map((e, i) => [e, i]);
  const resultat = new Array(elementer.length);
  let fullført = 0;
  async function worker(nr) {
    let neste;
    while ((neste = kø.shift())) {
      const [element, i] = neste;
      try {
        resultat[i] = { ok: true, verdi: await behandle(element, nr) };
      } catch (feil) {
        resultat[i] = { ok: false, feil };
      }
      fullført++;
      await ferdig?.(fullført, element, resultat[i]);
      if (pause) await sleep(pause);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(samtidig, elementer.length)) }, (_, nr) => worker(nr)));
  return resultat;
}
