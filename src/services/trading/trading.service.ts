import { db } from "../../db/client.js";
import { balances, quotes, trades } from "../../db/schema.js";
import { and, eq, or, sql } from "drizzle-orm";
import { badRequest, notFound } from "../../domain/errors.js";
import { ledgerService } from "../ledger/ledger.service.js";

/** Convert a string/number/bigint into a bigint */
function asBigInt(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  if (typeof v === "string") return BigInt(v);
  throw new Error(`Expected bigint-compatible value, got ${typeof v}`);
}

export class TradingService {
  /**
   * Execute a trade for a given quote and idempotency key.
   *
   * This method validates that the quote exists, hasn't expired or been executed,
   * ensures the client has sufficient balance, and writes the trade along with
   * ledger and balance updates in a single transaction.
   */
  async executeTrade(clientId: string, quoteId: string, idempotencyKey: string) {
    return db.transaction(async (tx) => {
      // Idempotency check: return existing trade if idempotencyKey used before
      const [existing] = await tx
        .select()
        .from(trades)
        .where(and(eq(trades.clientId, clientId), eq(trades.idempotencyKey, idempotencyKey)))
        .limit(1);
      if (existing) {
        if (existing.quoteId !== quoteId) {
          throw badRequest("Idempotency-Key already used for a different quote", {
            idempotency_key: idempotencyKey,
          });
        }
        return existing;
      }

      // Lock the quote row so we can safely inspect or modify it
      await tx.execute(
        sql`select 1 from ${quotes} where ${quotes.id} = ${quoteId} and ${quotes.clientId} = ${clientId} for update`,
      );

      const [quote] = await tx
        .select()
        .from(quotes)
        .where(and(eq(quotes.id, quoteId), eq(quotes.clientId, clientId)))
        .limit(1);
      if (!quote) {
        throw notFound("Quote not found", { quote_id: quoteId });
      }

      // Ensure no trade already exists for this quote
      const [tradeForQuote] = await tx
        .select()
        .from(trades)
        .where(and(eq(trades.clientId, clientId), eq(trades.quoteId, quoteId)))
        .limit(1);
      if (tradeForQuote) {
        await tx
          .update(quotes)
          .set({ status: "EXECUTED" })
          .where(and(eq(quotes.id, quoteId), eq(quotes.clientId, clientId)));
        throw badRequest("Quote already executed", { quote_id: quoteId });
      }

      // Validate quote status and expiry
      if (quote.status === "EXECUTED") throw badRequest("Quote already executed", { quote_id: quoteId });
      if (quote.status === "EXPIRED") throw badRequest("Quote expired", { quote_id: quoteId });
      if (quote.status !== "ACTIVE") throw badRequest("Quote not active", { status: quote.status });
      const now = new Date();
      if (now >= new Date(quote.expiresAt)) {
        await tx
          .update(quotes)
          .set({ status: "EXPIRED" })
          .where(and(eq(quotes.id, quoteId), eq(quotes.clientId, clientId)));
        throw badRequest("Quote expired", { quote_id: quoteId });
      }

      // Determine debit and credit currencies and amounts
      const baseAmountMinor = asBigInt(quote.baseAmountMinor);
      const quoteAmountMinor = asBigInt(quote.quoteAmountMinor);
      const isBuy = quote.side === "BUY";
      const debitCurrency  = isBuy ? quote.quoteCurrency : quote.baseCurrency;
      const debitAmount    = isBuy ? quoteAmountMinor : baseAmountMinor;
      const creditCurrency = isBuy ? quote.baseCurrency : quote.quoteCurrency;
      const creditAmount   = isBuy ? baseAmountMinor : quoteAmountMinor;

      // Check that the client has enough balance
      const balanceRows = await tx
        .select()
        .from(balances)
        .where(
          and(
            eq(balances.clientId, clientId),
            or(eq(balances.currency, debitCurrency), eq(balances.currency, creditCurrency)),
          ),
        );
      const balanceMap = new Map(balanceRows.map((row: any) => [row.currency, row]));
      const debitBalance   = balanceMap.get(debitCurrency);
      const debitAvailable = debitBalance ? asBigInt(debitBalance.availableMinor) : 0n;
      if (debitAvailable < debitAmount) {
        throw badRequest("Insufficient balance", {
          currency: debitCurrency,
          available_minor: debitAvailable.toString(),
          required_minor: debitAmount.toString(),
        });
      }

      // Create the trade record
      const [createdTrade] = await tx
        .insert(trades)
        .values({
          clientId,
          quoteId: quote.id,
          symbol: quote.symbol,
          side: quote.side,
          baseCurrency: quote.baseCurrency,
          quoteCurrency: quote.quoteCurrency,
          baseAmountMinor,
          quoteAmountMinor,
          price: quote.price,
          status: "FILLED",
          idempotencyKey,
        })
        .returning();

      // Update balances and ledger entries via the ledger service
      await ledgerService.updateBalancesAndLedger(
        tx,
        clientId,
        debitCurrency,
        debitAmount,
        creditCurrency,
        creditAmount,
        createdTrade.id,
      );

      // Mark the quote as executed
      await tx
        .update(quotes)
        .set({ status: "EXECUTED" })
        .where(and(eq(quotes.id, quoteId), eq(quotes.clientId, clientId)));

      return createdTrade;
    });
  }
}

export const tradingService = new TradingService();
