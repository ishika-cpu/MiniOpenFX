export type IndicativePrice = { // Define the structure for a point-in-time price quote
  symbol: string;
  baseCurrency: string;
  quoteCurrency: string;
  bid: string;
  ask: string;
  timestamp: string;
  source: string;
};

export interface PricingProvider { // Define a common interface for all price data sources
  getIndicativePrice(symbol: string): Promise<IndicativePrice>; // Standard method to fetch a price for any given symbol
}
