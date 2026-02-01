import { upstreamUnavailable } from "../../domain/errors.js";
import type { IndicativePrice, PricingProvider } from "./types.js";
import { parseBinanceSymbol } from "../../config/symbols.js";
import type { SupportedSymbol } from "../../config/symbols.js";

type BinanceBookTicker = {
  symbol: string;
  bidPrice: string;
  askPrice: string;
};

export class BinancePricingProvider implements PricingProvider {
  private baseUrl = "https://api.binance.com";

  async getIndicativePrice(symbol: SupportedSymbol): Promise<IndicativePrice> {
    const url = new URL("/api/v3/ticker/bookTicker", this.baseUrl);
    url.searchParams.set("symbol", symbol);

    const res = await fetch(url.toString(), {
      headers: { "Accept": "application/json" },
    });

    if (!res.ok) {
      throw upstreamUnavailable("Pricing source error", {
        provider: "binance",
        status: res.status,
      });
    }

    const data = (await res.json()) as BinanceBookTicker;

    // Binance returns strings for bid/ask
    const { baseCurrency, quoteCurrency } = parseBinanceSymbol(symbol);

    return {
      symbol,
      baseCurrency,
      quoteCurrency,
      bid: data.bidPrice,
      ask: data.askPrice,
      timestamp: new Date().toISOString(),
      source: "binance",
    };
  }
}
