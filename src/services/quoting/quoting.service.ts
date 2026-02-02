import Decimal from "decimal.js"; // Import high-precision decimal library for financial math
import { pricingService } from "../pricing/pricing.service.js"; // Import service to fetch live market prices
import { parseSymbol } from "../../config/symbols.js"; // Import helper to map symbols to currency metadata
import type { SupportedSymbol } from "../../config/symbols.js"; // Import union type for allowed symbols
import { toMinorUnits } from "../../domain/money.js"; // Import helper to convert decimals to database-friendly integers
import { badRequest } from "../../domain/errors.js"; // Import standard error for invalid inputs

const QUOTE_TTL_SECONDS = 30; // Define how long a quote remains valid after creation

// Optional markup: 5 bps = 0.0005
const MARKUP_BPS = new Decimal(5); // Define the platform fee in basis points
const BPS_DENOM = new Decimal(10_000); // Constant for basis point denominator (100% = 10,000 bps)

export type CreateQuoteInput = { // Define shape of the request to create a quote
  symbol: SupportedSymbol; // The trading pair (e.g., BTCUSDT)
  side: "BUY" | "SELL"; // Whether the client is buying or selling the base asset
  baseAmount: string; // The quantity of base asset (e.g., how much BTC) as a string
};

export type QuoteComputed = { // Define the shape of the calculated quote results
  symbol: SupportedSymbol; // The trading pair
  side: "BUY" | "SELL"; // The trade direction
  baseCurrency: string; // The asset being bought/sold (e.g., BTC)
  quoteCurrency: string; // The asset used for payment (e.g., USDT)
  baseAmountMinor: bigint; // Base amount converted to minor units (integers)
  price: string; // The firm price offered to the client
  quoteAmountMinor: bigint; // The total cost in quote currency minor units
  expiresAt: Date; // The deadline for executing this quote
};

export class QuotingService { // Main class responsible for calculating trade offers
  async createQuote(input: CreateQuoteInput): Promise<QuoteComputed> { // Logic to generate a firm trade quote
    const { baseCurrency, quoteCurrency } = parseSymbol(input.symbol); // Get currency details for the symbol

    const indicative = await pricingService.getIndicativePrice(input.symbol); // Fetch current market indicative price

    // Choose price side:
    // BUY base -> you pay quote at ASK
    // SELL base -> you receive quote at BID
    const rawPrice = new Decimal(input.side === "BUY" ? indicative.ask : indicative.bid); // Select appropriate side of the spread

    // Apply small markup against client
    const markup = rawPrice.mul(MARKUP_BPS.div(BPS_DENOM)); // Calculate the fee amount based on raw price
    const firmPrice = input.side === "BUY" ? rawPrice.add(markup) : rawPrice.sub(markup); // Adjust price to include fee

    if (firmPrice.lte(0)) { // Safety check to ensure price is positive
      throw badRequest("Invalid price after markup", { price: firmPrice.toString() }); // Reject if math results in invalid price
    }

    const baseAmountMinor = toMinorUnits(input.baseAmount, baseCurrency); // Convert base quantity to minor units
    const baseAmountDec = new Decimal(input.baseAmount); // Wrap base quantity for math
    const quoteAmountStr = baseAmountDec.mul(firmPrice).toFixed(); // Calculate total quote cost (base * price)
    const quoteAmountMinor = toMinorUnits(quoteAmountStr, quoteCurrency); // Convert total cost to minor units

    const expiresAt = new Date(Date.now() + QUOTE_TTL_SECONDS * 1000); // Calculate expiry timestamp

    return { // Return the finalized quote data
      symbol: input.symbol, // Echo the symbol
      side: input.side, // Echo the side
      baseCurrency, // Set the base asset code
      quoteCurrency, // Set the quote asset code
      baseAmountMinor, // Set the integer base quantity
      price: firmPrice.toString(), // Set the formatted price string
      quoteAmountMinor, // Set the total integer cost
      expiresAt, // Set the expiry time
    };
  }
}

export const quotingService = new QuotingService(); // Export a singleton service instance

