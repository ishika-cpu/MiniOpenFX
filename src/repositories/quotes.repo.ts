import { db } from "../db/client.js";
import { quotes } from "../db/schema.js";
import { and, eq } from "drizzle-orm";

export async function insertQuote(values: {
  clientId: string;
  symbol: string;
  side: string;
  baseCurrency: string;
  quoteCurrency: string;
  baseAmountMinor: bigint;
  price: string;
  quoteAmountMinor: bigint;
  status: string;
  expiresAt: Date;
}) {
  const [row] = await db.insert(quotes).values(values as any).returning();
  return row;
}

export async function getQuoteById(params: { clientId: string; quoteId: string }) {
  const [row] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, params.quoteId), eq(quotes.clientId, params.clientId)))
    .limit(1);

  return row ?? null;
}

export async function markQuoteExpired(params: { clientId: string; quoteId: string }) {
  const [row] = await db
    .update(quotes)
    .set({ status: "EXPIRED" })
    .where(and(eq(quotes.id, params.quoteId), eq(quotes.clientId, params.clientId)))
    .returning();

  return row ?? null;
}
