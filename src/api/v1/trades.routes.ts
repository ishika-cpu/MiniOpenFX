import { Hono } from "hono";
import { z } from "zod";
import { db } from "../../db/client.js";
import { trades } from "../../db/schema.js";
import { desc, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { badRequest } from "../../domain/errors.js";
import { fromMinorUnits } from "../../domain/money.js";
import { tradingService } from "../../services/trading/trading.service.js";

export const tradesRoutes = new Hono();

//pagination limits
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

//helper to convert db values to bigint
function asBigInt(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  if (typeof v === "string") return BigInt(v);
  throw new Error(`Expected bigint-compatible value, got ${typeof v}`);
}

//helper to format trade response
function formatTrade(row: any) {
  return {
    trade_id: row.id,
    quote_id: row.quoteId,
    symbol: row.symbol,
    side: row.side,
    base_currency: row.baseCurrency,
    quote_currency: row.quoteCurrency,
    base_amount: fromMinorUnits(asBigInt(row.baseAmountMinor), row.baseCurrency),
    quote_amount: fromMinorUnits(asBigInt(row.quoteAmountMinor), row.quoteCurrency),
    price: row.price,
    status: row.status,
    created_at: row.createdAt,
  };
}

//helper to parse cursor
function parseCursor(cursor: string) {
  const parts = cursor.split("_");
  if (parts.length !== 2) return null;
  const [createdAtStr, id] = parts;
  const createdAt = new Date(createdAtStr);
  if (!id || Number.isNaN(createdAt.getTime())) return null;
  return { createdAt, id };
}

//helper to build cursor
function buildCursor(row: any) {
  const createdAt = new Date(row.createdAt).toISOString();
  return `${createdAt}_${row.id}`;
}

// POST /v1/trades
// Now simply validates input, reads the idempotency key and clientId, and
// delegates the business logic to the trading service.
tradesRoutes.post("/", async (c) => {
  const bodySchema = z.object({
    quote_id: z.string().uuid(),
  });
  const body = bodySchema.parse(await c.req.json());
  const quoteId = body.quote_id;

  const idempotencyKey =
    c.req.header("idempotency-key") ?? c.req.header("Idempotency-Key");
  if (!idempotencyKey) {
    throw badRequest("Missing Idempotency-Key header");
  }
  const clientId = c.get("clientId") as string;

  const trade = await tradingService.executeTrade(clientId, quoteId, idempotencyKey);
  return c.json(formatTrade(trade));
});

// GET /v1/trades
// This endpoint for trade history remains the same and paginates results.
tradesRoutes.get("/", async (c) => {
  const clientId = c.get("clientId") as string;
  const limitParam = Number(c.req.query("limit") ?? DEFAULT_LIMIT);
  const limit = Math.min(Math.max(limitParam, 1), MAX_LIMIT);
  const cursor = c.req.query("cursor");

  const conditions: SQL[] = [eq(trades.clientId, clientId)];//only trades for this client
  if (cursor) {
    const parsed = parseCursor(cursor);
    if (!parsed) throw badRequest("Invalid cursor");
    conditions.push(
      sql`(${trades.createdAt} < ${parsed.createdAt} OR (${trades.createdAt} = ${parsed.createdAt} AND ${trades.id} < ${parsed.id}))`,
    );
  }

  // Build the where clause. We always have at least one condition.
  const whereClause: SQL = conditions.reduce(
    (acc, condition) => sql`${acc} AND ${condition}`,
  );

  const rows = await db
    .select()
    .from(trades)
    .where(whereClause)
    .orderBy(desc(trades.createdAt), desc(trades.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? buildCursor(page[page.length - 1]) : null;

  return c.json({
    trades: page.map(formatTrade),
    next_cursor: nextCursor,
  });
});
