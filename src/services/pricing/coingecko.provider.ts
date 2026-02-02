import { upstreamUnavailable } from "../../domain/errors.js"; // Import custom error for external API failures
import type { IndicativePrice, PricingProvider } from "./types.js"; // Import interface and type definitions
import { parseSymbol } from "../../config/symbols.js"; // Import helper to map symbols to API requirements
import type { SupportedSymbol } from "../../config/symbols.js"; // Import type for validated symbols
import Decimal from "decimal.js"; // Import high-precision decimal library

type CoingeckoPriceResponse = Record<string, Record<string, number>>; // Type for the nested JSON response from CoinGecko

export class CoingeckoPricingProvider implements PricingProvider { // Implement the standard pricing provider interface
    private baseUrl = "https://api.coingecko.com/api/v3"; // Base URL for the CoinGecko public API

    async getIndicativePrice(symbol: SupportedSymbol): Promise<IndicativePrice> { // Method to fetch current market price
        const { baseCurrency, quoteCurrency, coingeckoId, coingeckoVsCurrency } = parseSymbol(symbol); // Extract mapping details

        const url = new URL(this.baseUrl + "/simple/price"); // Create a new URL object by appending the endpoint to the base path
        url.searchParams.set("ids", coingeckoId); // Set the coin identifier parameter
        url.searchParams.set("vs_currencies", coingeckoVsCurrency); // Set the target currency for comparison

        const res = await fetch(url.toString(), { // Perform the HTTP GET request
            headers: { "Accept": "application/json" }, // Specify that we expect a JSON response
        });

        if (!res.ok) { // Check if the response status is not 200 OK
            throw upstreamUnavailable("Pricing source error (CoinGecko)", { // Throw error with metadata if request failed
                provider: "coingecko", // Identify the failing provider
                status: res.status, // Record the HTTP status code
            });
        }

        const data = (await res.json()) as CoingeckoPriceResponse; // Parse the response body as JSON
        const price = data[coingeckoId]?.[coingeckoVsCurrency]; // Extract the specific price value from the map

        if (price === undefined) { // Check if the expected price property exists in the response
            throw upstreamUnavailable("Price not found in response", { // Throw error if API returned 200 but no price
                provider: "coingecko", // Identify the provider
                symbol, // Record the symbol that failed
                coingeckoId, // Record the internal ID used
            });
        }

        // Since CoinGecko simple price doesn't provide spread, we simulate a 0.1% spread
        const midPrice = new Decimal(price); // Wrap the raw number in a Decimal for math
        const spreadMultiplier = new Decimal("0.0005"); // Define a 0.05% offset for each side
        const bid = midPrice.mul(new Decimal(1).sub(spreadMultiplier)).toString(); // Calculate the buy price (price - 0.05%)
        const ask = midPrice.mul(new Decimal(1).add(spreadMultiplier)).toString(); // Calculate the sell price (price + 0.05%)

        return { // Return the standardized price object
            symbol, // The trading symbol
            baseCurrency, // The currency being bought/sold
            quoteCurrency, // The currency used for payment
            bid, // The calculated bid price
            ask, // The calculated ask price
            timestamp: new Date().toISOString(), // The time the price was fetched
            source: "coingecko", // The metadata identifying the source
        };
    }
}
