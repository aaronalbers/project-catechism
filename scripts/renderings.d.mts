// Types for renderings.mjs, which the app shares with the data build.
export function core(gloss: string, cased?: boolean): string;
export function fold(counts: Map<string, number>, faces?: Map<string, string>): { list: [string, number][]; at: Map<string, number> };
export function isContentWord(morph: string, strongs: string): boolean;
export const RARE: { minUses: number; share: number };
