import { db } from "../../db/client.js"; // Import the main database client instance
import { balances, ledgerEntries } from "../../db/schema.js"; // Import table definitions for balances and ledger
import { and, eq, or, sql } from "drizzle-orm"; // Import Drizzle SQL operator helpers

/**
 * LedgerService encapsulates logic for recording ledger entries and updating
 * cached balances. It should be used within a transaction context when called
 * from other services (e.g. trading) to guarantee atomic updates.
 */
export class LedgerService { // Main class for managing financial accounting logic

  async updateBalancesAndLedger( // Atomic method to update inventory and history
    tx: any, // Use the provided transaction object for database operations
    clientId: string, // The unique identifier for the client account
    debitCurrency: string, // The currency type being reduced (e.g., "USD")
    debitAmount: bigint, // The absolute amount to subtract (in minor units)
    creditCurrency: string, // The currency type being increased (e.g., "BTC")
    creditAmount: bigint, // The absolute amount to add (in minor units)
    refId: string // A foreign key reference to the related trade or transaction
  ) {
    // Lock the relevant balance rows
    await tx
      .select({ id: balances.id }) // Execute raw SQL to prevent other transactions from modifying these rows
      .from(balances)
      .where(and(eq(balances.clientId, clientId), eq(balances.currency, debitCurrency)))
      .for("update"); // Locking the debit currency row
    if (creditCurrency !== debitCurrency) { // Check if we are dealing with two different currencies
      await tx
        .select({ id: balances.id }) // Execute raw SQL to lock the second currency row
        .from(balances)
        .where(and(eq(balances.clientId, clientId), eq(balances.currency, creditCurrency)))
        .for("update"); // Locking the credit currency row
    }

    // Fetch existing balances for both currencies
    const rows = await tx // Perform the database select query
      .select() // Select all columns
      .from(balances) // From the cached balances table
      .where( // Filter specifically for this client and these currencies
        and( // All conditions must be true
          eq(balances.clientId, clientId), // Matches the specific client ID
          or(eq(balances.currency, debitCurrency), eq(balances.currency, creditCurrency)) // Matches either currency
        )
      );
    const balanceMap = new Map(rows.map((r: any) => [r.currency, r])); // Convert result rows into a Map for easy lookup
    const debitBalance = balanceMap.get(debitCurrency); // Get the current balance object for the debit asset
    const creditBalance = balanceMap.get(creditCurrency); // Get the current balance object for the credit asset

    // Write two ledger entries: one debit and one credit
    await tx.insert(ledgerEntries).values([ // Insert the immutable history records
      {
        clientId, // Link entry to the client
        currency: debitCurrency, // Record the currency being removed
        deltaMinor: -debitAmount, // Record negative change (debit)
        reason: "TRADE", // Categorize this action as a trade
        refType: "TRADE", // Specify the reference object type
        refId, // Link back to the trade ID
      },
      {
        clientId, // Link entry to the client
        currency: creditCurrency, // Record the currency being added
        deltaMinor: creditAmount, // Record positive change (credit)
        reason: "TRADE", // Categorize this action as a trade
        refType: "TRADE", // Specify the reference object type
        refId, // Link back to the trade ID
      },
    ]);

    // Update or insert the cached balance records
    if (debitBalance) { // If a balance record already exists for the debit currency
      await tx // Perform the update
        .update(balances) // In the balances table
        .set({ // Update the numeric value
          availableMinor: sql`${balances.availableMinor} - ${debitAmount}`, // Subtract amount using SQL math
          updatedAt: new Date(), // Update the modification timestamp
        })
        .where(and(eq(balances.clientId, clientId), eq(balances.currency, debitCurrency))); // Ensure we only touch one specific row
    }
    if (creditBalance) { // If a balance record already exists for the credit currency
      await tx // Perform the update
        .update(balances) // In the balances table
        .set({ // Update the numeric value
          availableMinor: sql`${balances.availableMinor} + ${creditAmount}`, // Add amount using SQL math
          updatedAt: new Date(), // Update the modification timestamp
        })
        .where(and(eq(balances.clientId, clientId), eq(balances.currency, creditCurrency))); // Ensure we only touch one specific row
    } else { // If this is a new currency for the client
      await tx.insert(balances).values({ // Create a new row
        clientId, // Link to the client
        currency: creditCurrency, // Identify the asset
        availableMinor: creditAmount, // Set the initial balance
      });
    }
  }

  /**
   * Retrieve all balances for a given client.
   */
  async getBalances(clientId: string) { // Helper to fetch all assets for a user
    return db // Use the standard database client
      .select() // Select all columns
      .from(balances) // From the cached balances table
      .where(eq(balances.clientId, clientId)); // Filter for the specific owner
  }

  /**
   * Add funds to a client's account.
   */
  async deposit(clientId: string, currency: string, amount: bigint) { // Entry point for increasing funds
    return db.transaction(async (tx) => { // Start a database transaction for safety
      // Create ledger entry
      await tx.insert(ledgerEntries).values({ // Record the history of this deposit
        clientId, // Link to the user
        currency, // Identify the asset (e.g., "USDT")
        deltaMinor: amount, // Record positive change
        reason: "DEPOSIT", // Categorize as a deposit
        refType: "DEPOSIT", // Specify reference metadata
      });

      // Upsert balance
      const [existing] = await tx // Check if the client already has this asset row
        .select() // Select column
        .from(balances) // From the cache table
        .where(and(eq(balances.clientId, clientId), eq(balances.currency, currency))) // Match owner and asset
        .limit(1); // Only need the first match

      if (existing) { // If row exists, update it
        await tx // Perform update
          .update(balances) // Target balances table
          .set({ // Modify value
            availableMinor: sql`${balances.availableMinor} + ${amount}`, // Increase balance in SQL
            updatedAt: new Date(), // Set current time
          })
          .where(and(eq(balances.clientId, clientId), eq(balances.currency, currency))); // Match specific row
      } else { // If row doesn't exist, create it
        await tx.insert(balances).values({ // Insert new data
          clientId, // Owner ID
          currency, // Asset code
          availableMinor: amount, // Starting amount
        });
      }
    }); // End transaction
  }
}

export const ledgerService = new LedgerService(); // Export a singleton instance of the service
