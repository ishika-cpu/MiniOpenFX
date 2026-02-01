import Decimal from "decimal.js";
import { pricingService } from "../pricing/pricing.service.js";
import { parseBinanceSymbol } from "../../config/symbols.js";
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
  baseAmount: string; // decimal string from client
};

export type QuoteComputed = {
  symbol: SupportedSymbol;
  side: "BUY" | "SELL";
  baseCurrency: string;
  quoteCurrency: string;
  baseAmountMinor: bigint;
  price: string;
  quoteAmountMinor: bigint;
  expiresAt: Date;
};

export class QuotingService {
  async createQuote(input: CreateQuoteInput): Promise<QuoteComputed> {
    const { baseCurrency, quoteCurrency } = parseBinanceSymbol(input.symbol);

    const indicative = await pricingService.getIndicativePrice(input.symbol);

    // Choose price side:
    // BUY base -> you pay quote at ASK
    // SELL base -> you receive quote at BID
    const rawPrice = new Decimal(input.side === "BUY" ? indicative.ask : indicative.bid);

    // Apply small markup against client
    const markup = rawPrice.mul(MARKUP_BPS.div(BPS_DENOM));
    const firmPrice = input.side === "BUY" ? rawPrice.add(markup) : rawPrice.sub(markup);

    if (firmPrice.lte(0)) {
      throw badRequest("Invalid price after markup", { price: firmPrice.toString() });
    }

    const baseAmountMinor = toMinorUnits(input.baseAmount, baseCurrency);
    const baseAmountDec = new Decimal(input.baseAmount);
    const quoteAmountStr = baseAmountDec.mul(firmPrice).toFixed();
    const quoteAmountMinor = toMinorUnits(quoteAmountStr, quoteCurrency);

    const expiresAt = new Date(Date.now() + QUOTE_TTL_SECONDS * 1000);

    return {
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
    
