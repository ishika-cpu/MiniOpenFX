import Decimal from "decimal.js";
import { pricingService } from "../pricing/pricing.service.js";
import { parseSymbol } from "../../config/symbols.js";
import type { SupportedSymbol } from "../../config/symbols.js";
import { toMinorUnits } from "../../domain/money.js";
import { badRequest } from "../../domain/errors.js";

const QUOTE_TTL_SECONDS = 30;

// Optional markup: 5 bps = 0.0005
const MARKUP_BPS = new Decimal(5);
const BPS_DENOM = new Decimal(10_000);

export type CreateQuoteInput = {
  symbol: SupportedSymbol;
  side: "BUY" | "SELL";
  baseAmount: string;
};

export type QuoteComputed = { // Define the shape of the calculated quote results
  symbol: SupportedSymbol;
  side: "BUY" | "SELL";
  baseCurrency: string;
  quoteCurrency: string;
  baseAmountMinor: bigint;
  price: string;
  quoteAmountMinor: bigint;
  expiresAt: Date;
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
    const baseAmountDec = new Decimal(input.baseAmount);
    const quoteAmountStr = baseAmountDec.mul(firmPrice).toFixed(); // Calculate total quote cost (base * price)
    const quoteAmountMinor = toMinorUnits(quoteAmountStr, quoteCurrency); // Convert total cost to minor units

    const expiresAt = new Date(Date.now() + QUOTE_TTL_SECONDS * 1000); // Calculate expiry timestamp

    return { // Return the finalized quote data
      symbol: input.symbol,
      side: input.side,
      baseCurrency,
      quoteCurrency,
      baseAmountMinor,
      price: firmPrice.toString(),
      quoteAmountMinor,
      expiresAt,
    };
  }
}

export const quotingService = new QuotingService();

