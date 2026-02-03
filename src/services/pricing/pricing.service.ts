import type { PricingProvider, IndicativePrice } from "./types.js"; 
import { CoingeckoPricingProvider } from "./coingecko.provider.js"; 
import { isSupportedSymbol } from "../../config/symbols.js"; 
import { badRequest } from "../../domain/errors.js"; 
import type { SupportedSymbol } from "../../config/symbols.js"; 

export class PricingService { // Wrapper service that coordinates pricing providers
  constructor(private provider: PricingProvider = new CoingeckoPricingProvider()) { }

  async getIndicativePrice(symbolRaw: string): Promise<IndicativePrice> { // Public method to get a price for a string symbol
    const symbol = symbolRaw.toUpperCase(); // Normalize symbol to uppercase for consistent matching

    if (!isSupportedSymbol(symbol)) { // Validate that the requested symbol is supported by the system
      throw badRequest("Unsupported symbol", { symbol, supported: ["BTCUSDT", "ETHUSDT", "EURUSDT"] }); // Error if symbol is unknown
    }

    return this.provider.getIndicativePrice(symbol as SupportedSymbol); // Forward the request to the active pricing provider
  }
}

export const pricingService = new PricingService(); // Export a singleton for app-wide use
