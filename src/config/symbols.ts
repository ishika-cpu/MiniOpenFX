export type SupportedSymbol = "BTCUSDT" | "ETHUSDT" | "EURUSDT";

export const SUPPORTED_SYMBOLS: SupportedSymbol[] = ["BTCUSDT", "ETHUSDT", "EURUSDT"];

export function isSupportedSymbol(symbol: string): symbol is SupportedSymbol {
  return (SUPPORTED_SYMBOLS as string[]).includes(symbol);
}

// Basic parsing for Binance-style symbols (base + quote)
export function parseBinanceSymbol(symbol: SupportedSymbol): {
  baseCurrency: string;
  quoteCurrency: string;
} {
  // For our allowlist, hardcode mapping (simple + reliable)
  switch (symbol) {
    case "BTCUSDT":
      return { baseCurrency: "BTC", quoteCurrency: "USDT" };
    case "ETHUSDT":
      return { baseCurrency: "ETH", quoteCurrency: "USDT" };
    case "EURUSDT":
      return { baseCurrency: "EUR", quoteCurrency: "USDT" };
  }
}
