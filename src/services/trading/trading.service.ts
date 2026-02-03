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

export class TradingService { // Service containing core trade execution logic
  async executeTrade(clientId: string, quoteId: string, idempotencyKey: string) { // Main trade execution entry point
    return db.transaction(async (tx) => { // Start a database transaction for atomicity
      // Idempotency check: return existing trade if idempotencyKey used before
      const [existing] = await tx
        .select() // Select columns
        .from(trades) // From the trades history table
        .where(and(eq(trades.clientId, clientId), eq(trades.idempotencyKey, idempotencyKey))) // Match client and unique key
        .limit(1); // Only need the first match
      if (existing) { // If a trade already exists with this key
        if (existing.quoteId !== quoteId) { // Check if the existing trade matches the current request
          throw badRequest("Idempotency-Key already used for a different quote", { // Prevent key recycling
            idempotency_key: idempotencyKey, // Include key in error metadata
          });
        }
        return existing; // Return the original trade result instead of creating a new one
      }

      // Lock the quote row so we can safely inspect or modify it
      await tx
        .select({ id: quotes.id }) // Acquire a database lock to prevent concurrent execution of the same quote
        .from(quotes)
        .where(and(eq(quotes.id, quoteId), eq(quotes.clientId, clientId)))
        .for("update");

      const [quote] = await tx // Fetch the finalized quote data
        .select() 
        .from(quotes) 
        .where(and(eq(quotes.id, quoteId), eq(quotes.clientId, clientId))) 
        .limit(1); 
      if (!quote) { // If no quote is found
        throw notFound("Quote not found", { quote_id: quoteId }); 
      }

      // Ensure no trade already exists for this quote
      const [tradeForQuote] = await tx // One final check to ensure the quote hasn't been used
        .select() 
        .from(trades)   
        .where(and(eq(trades.clientId, clientId), eq(trades.quoteId, quoteId))) 
        .limit(1); 
      if (tradeForQuote) { // If quote was already used by a different request
        await tx // Cleanup: ensure quote status is correct
          .update(quotes) 
          .set({ status: "EXECUTED" }) // Mark as executed
          .where(and(eq(quotes.id, quoteId), eq(quotes.clientId, clientId))); // Target specific quote
        throw badRequest("Quote already executed", { quote_id: quoteId }); // Error if reused
      }

      // Validate quote status and expiry
      if (quote.status === "EXECUTED") throw badRequest("Quote already executed", { quote_id: quoteId });
      if (quote.status === "EXPIRED") throw badRequest("Quote expired", { quote_id: quoteId }); 
      if (quote.status !== "ACTIVE") throw badRequest("Quote not active", { status: quote.status }); 
      const now = new Date(); // Get current timestamp
      if (now >= new Date(quote.expiresAt)) { // Check if time has run out
        await tx // Perform update
          .update(quotes) // Target quotes table
          .set({ status: "EXPIRED" }) // Mark as expired
          .where(and(eq(quotes.id, quoteId), eq(quotes.clientId, clientId))); // Match specific quote
        throw badRequest("Quote expired", { quote_id: quoteId }); // Error if expired
      }

      // Determine debit and credit currencies and amounts
      const baseAmountMinor = asBigInt(quote.baseAmountMinor); // Quantize base amount
      const quoteAmountMinor = asBigInt(quote.quoteAmountMinor); // Quantize quote amount
      const isBuy = quote.side === "BUY"; // Check trade direction
      const debitCurrency = isBuy ? quote.quoteCurrency : quote.baseCurrency; // Asset to be removed
      const debitAmount = isBuy ? quoteAmountMinor : baseAmountMinor; // Quantity to be removed
      const creditCurrency = isBuy ? quote.baseCurrency : quote.quoteCurrency; // Asset to be added
      const creditAmount = isBuy ? baseAmountMinor : quoteAmountMinor; // Quantity to be added

      // Check that the client has enough balance
      const balanceRows = await tx // Fetch current balances for the involved assets
        .select() // Select columns
        .from(balances) // From balance cache table
        .where( // Match owner and relevant assets
          and(
            eq(balances.clientId, clientId), // Specific client
            or(eq(balances.currency, debitCurrency), eq(balances.currency, creditCurrency)), // Only the two currencies in the trade
          ),
        );
      const balanceMap = new Map(balanceRows.map((row: any) => [row.currency, row])); // Map results for lookup
      const debitBalance = balanceMap.get(debitCurrency); // Get the row for the asset being spent
      const debitAvailable = debitBalance ? asBigInt(debitBalance.availableMinor) : 0n; // Get numeric value or zero
      if (debitAvailable < debitAmount) { // If funds are insufficient
        throw badRequest("Insufficient balance", { // Return 400 error
          currency: debitCurrency, // Asset that failed
          available_minor: debitAvailable.toString(), // Current balance
          required_minor: debitAmount.toString(), // Required amount
        });
      }

      // Create the trade record
      const [createdTrade] = await tx // Formally record the trade
        .insert(trades) // Into the trades table
        .values({
          clientId, // Link to client
          quoteId: quote.id, // Link to originating quote
          symbol: quote.symbol, // Record symbol
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
      await ledgerService.updateBalancesAndLedger( // Delegate the complex accounting to LedgerService
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
    }); // Commit transaction
  }
}

export const tradingService = new TradingService(); 
