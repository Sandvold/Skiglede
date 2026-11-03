/** Én tydelig farge per løype (gyllent snitt i fargehjulet), brukt både i oversiktskartet og i lista. */
export function løypeFarge(indeks: number): string {
  const h = ((indeks * 137.508) % 360) / 360;
  const s = 0.72;
  const l = 0.42;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
