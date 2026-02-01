export type IndicativePrice = {
  symbol: string;
  baseCurrency: string;
  quoteCurrency: string;
  bid: string;  // decimal string
  ask: string;  // decimal string
  timestamp: string; // ISO
  source: string;
};

export interface PricingProvider {
  getIndicativePrice(symbol: string): Promise<IndicativePrice>;
}
