export type IndicativePrice = { // Define the structure for a point-in-time price quote
  symbol: string; // The trading pair identifier (e.g., "BTCUSDT")
  baseCurrency: string; // The currency being traded (e.g., "BTC")
  quoteCurrency: string; // The reference currency (e.g., "USDT")
  bid: string;  // The highest price a buyer is willing to pay (as a decimal string)
  ask: string;  // The lowest price a seller is willing to accept (as a decimal string)
  timestamp: string; // The exact moment the price was recorded in ISO 8601 format
  source: string; // The name of the provider that supplied the data
};

export interface PricingProvider { // Define a common interface for all price data sources
  getIndicativePrice(symbol: string): Promise<IndicativePrice>; // Standard method to fetch a price for any given symbol
}
