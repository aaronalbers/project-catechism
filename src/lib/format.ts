/** A year as the content stores it (negative for BC) in words: "586 BC", "AD 70". */
export const formatYear = (y: number) => (y < 0 ? `${-y} BC` : `AD ${y}`);
/** "1 day", "3 days". */
export const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? '' : 's'}`;
