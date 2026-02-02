export type SupportedSymbol = "BTCUSDT" | "ETHUSDT" | "EURUSDT";

export const SUPPORTED_SYMBOLS: SupportedSymbol[] = ["BTCUSDT", "ETHUSDT", "EURUSDT"];
//type guard
export function isSupportedSymbol(symbol: string): symbol is SupportedSymbol {
  return (SUPPORTED_SYMBOLS as string[]).includes(symbol);
}

// Mappings for CoinGecko
export function parseSymbol(symbol: SupportedSymbol): {
  baseCurrency: string;
  quoteCurrency: string;
  coingeckoId: string;
  coingeckoVsCurrency: string;
} {
  switch (symbol) {
    case "BTCUSDT":
      return {
        baseCurrency: "BTC",
        quoteCurrency: "USDT",
        coingeckoId: "bitcoin",
        coingeckoVsCurrency: "usd"
      };
    case "ETHUSDT":
      return {
        baseCurrency: "ETH",
        quoteCurrency: "USDT",
        coingeckoId: "ethereum",
        coingeckoVsCurrency: "usd"
      };
    case "EURUSDT":
      return {
        baseCurrency: "EUR",
        quoteCurrency: "USDT",
        coingeckoId: "euro",
        coingeckoVsCurrency: "usd"
      };
  }
}
