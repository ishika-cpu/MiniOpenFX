import { Hono } from "hono";
import { z } from "zod";
import { quotingService } from "../../services/quoting/quoting.service.js";
import {
  insertQuote,
  getQuoteById,
  markQuoteExpired,
} from "../../repositories/quotes.repo.js";
import { fromMinorUnits } from "../../domain/money.js";
import { isSupportedSymbol } from "../../config/symbols.js";
import { badRequest, notFound } from "../../domain/errors.js";

export const quotesRoutes = new Hono();

// Helper to safely convert DB values to bigint
function asBigInt(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  if (typeof v === "string") return BigInt(v);
  throw new Error(`Expected bigint-compatible value, got ${typeof v}`);
}

function formatQuote(row: any) {
  return {
    quote_id: row.id,
    symbol: row.symbol,
    side: row.side,
    base_currency: row.baseCurrency,
    quote_currency: row.quoteCurrency,
    base_amount: fromMinorUnits(asBigInt(row.baseAmountMinor), row.baseCurrency),
    price: row.price,
    quote_amount: fromMinorUnits(asBigInt(row.quoteAmountMinor), row.quoteCurrency),
    status: row.status,
    expires_at: row.expiresAt,
    created_at: row.createdAt,
  };
}

quotesRoutes.post("/", async (c) => {
  const bodySchema = z.object({
    symbol: z.string(),
    side: z.enum(["BUY", "SELL"]),
    base_amount: z.string(),
  });

  const body = bodySchema.parse(await c.req.json());

  const symbol = body.symbol.toUpperCase();
  if (!isSupportedSymbol(symbol)) throw badRequest("Unsupported symbol", { symbol });

  const clientId = c.get("clientId") as string;

  const computed = await quotingService.createQuote({
    symbol,
    side: body.side,
    baseAmount: body.base_amount,
  });

  const row = await insertQuote({
    clientId,
    symbol: computed.symbol,
    side: computed.side,
    baseCurrency: computed.baseCurrency,
    quoteCurrency: computed.quoteCurrency,
    baseAmountMinor: computed.baseAmountMinor,
    price: computed.price,
    quoteAmountMinor: computed.quoteAmountMinor,
    status: "ACTIVE",
    expiresAt: computed.expiresAt,
  });

  return c.json(formatQuote(row));
});

// ✅ GET /v1/quotes/:id (marks ACTIVE -> EXPIRED if past expires_at)
quotesRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const clientId = c.get("clientId") as string;

  let quote = await getQuoteById({ clientId, quoteId: id });
  if (!quote) throw notFound("Quote not found", { quote_id: id });

  const now = new Date();

  // If expired AND still ACTIVE, flip to EXPIRED
  if (quote.status === "ACTIVE" && now >= new Date(quote.expiresAt)) {
    const updated = await markQuoteExpired({ clientId, quoteId: id });
    if (updated) quote = updated;
  }

  return c.json(formatQuote(quote));
});
