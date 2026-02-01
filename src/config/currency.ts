export const CURRENCY_SCALE: Record<string, number> = {
  USDT: 6,
  BTC: 8,
  ETH: 18,
  EUR: 2,
  USD: 2,
};

export function scaleFor(currency: string): number {
  const s = CURRENCY_SCALE[currency];
  if (s === undefined) throw new Error(`No scale configured for currency=${currency}`);
  return s;
}
