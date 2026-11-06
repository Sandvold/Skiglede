import { usePosisjon, type Pos } from '@/data/omrader';

/** Siste kjente posisjon (spør ikke selv om tillatelse; det gjør områdevalget). */
export const usePosisjonNå = (): Pos | null => usePosisjon(false);
