import { upstreamUnavailable } from "../../domain/errors.js";
import type { IndicativePrice, PricingProvider } from "./types.js";
import { parseSymbol } from "../../config/symbols.js";
import type { SupportedSymbol } from "../../config/symbols.js";
import Decimal from "decimal.js";

type CoingeckoPriceResponse = Record<string, Record<string, number>>; // Type for the nested JSON response from CoinGecko

export class CoingeckoPricingProvider implements PricingProvider {
    private baseUrl = "https://api.coingecko.com/api/v3";

    async getIndicativePrice(symbol: SupportedSymbol): Promise<IndicativePrice> {
        const { baseCurrency, quoteCurrency, coingeckoId, coingeckoVsCurrency } = parseSymbol(symbol);

        const url = new URL(this.baseUrl + "/simple/price");
        url.searchParams.set("ids", coingeckoId);
        url.searchParams.set("vs_currencies", coingeckoVsCurrency);
        const res = await fetch(url.toString(), { // Perform the HTTP GET request
            headers: { "Accept": "application/json" },
        });

        if (!res.ok) { // Check if the response status is not 200 OK
            throw upstreamUnavailable("Pricing source error (CoinGecko)", { // Throw error with metadata if request failed
                provider: "coingecko", // Identify the failing provider
                status: res.status,
            });
        }

        const data = (await res.json()) as CoingeckoPriceResponse;
        const price = data[coingeckoId]?.[coingeckoVsCurrency];

        if (price === undefined) {
            throw upstreamUnavailable("Price not found in response", {
                provider: "coingecko",
                symbol,
                coingeckoId, // Record the internal ID used
            });
        }

        // Since CoinGecko simple price doesn't provide spread, we simulate a 0.1% spread
        const midPrice = new Decimal(price);
        const spreadMultiplier = new Decimal("0.0005");
        const bid = midPrice.mul(new Decimal(1).sub(spreadMultiplier)).toString();
        const ask = midPrice.mul(new Decimal(1).add(spreadMultiplier)).toString();

        return {
            symbol,
            baseCurrency,
            quoteCurrency,
            bid,
            ask,
            timestamp: new Date().toISOString(),
            source: "coingecko",
        };
    }
}
