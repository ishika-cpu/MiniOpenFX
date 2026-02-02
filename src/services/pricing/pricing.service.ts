import type { PricingProvider, IndicativePrice } from "./types.js";
import { CoingeckoPricingProvider } from "./coingecko.provider.js";
import { isSupportedSymbol } from "../../config/symbols.js";
import { badRequest } from "../../domain/errors.js";
import type { SupportedSymbol } from "../../config/symbols.js";

export class PricingService {
  constructor(private provider: PricingProvider = new CoingeckoPricingProvider()) { }

  async getIndicativePrice(symbolRaw: string): Promise<IndicativePrice> {
    const symbol = symbolRaw.toUpperCase();

    if (!isSupportedSymbol(symbol)) {
      throw badRequest("Unsupported symbol", { symbol, supported: ["BTCUSDT", "ETHUSDT", "EURUSDT"] });
    }

    return this.provider.getIndicativePrice(symbol as SupportedSymbol);
  }
}

export const pricingService = new PricingService();
