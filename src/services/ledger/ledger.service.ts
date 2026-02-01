import { db } from "../../db/client.js";
import { balances, ledgerEntries } from "../../db/schema.js";
import { and, eq, or, sql } from "drizzle-orm";

/**
 * LedgerService encapsulates logic for recording ledger entries and updating
 * cached balances. It should be used within a transaction context when called
 * from other services (e.g. trading) to guarantee atomic updates.
 */
export class LedgerService {
  /**
   * Update a client's balances for a trade and record corresponding ledger entries.
   *
   * @param tx - The transaction object provided by drizzle's db.transaction()
   * @param clientId - ID of the client whose balances are being updated
   * @param debitCurrency - The currency being debited (reduced)
   * @param debitAmount - The amount (in minor units) to debit
   * @param creditCurrency - The currency being credited (increased)
   * @param creditAmount - The amount (in minor units) to credit
   * @param refId - The reference ID for the ledger entries (usually the trade ID)
   */
  async updateBalancesAndLedger(
    tx: any,
    clientId: string,
    debitCurrency: string,
    debitAmount: bigint,
    creditCurrency: string,
    creditAmount: bigint,
    refId: string
  ) {
    // Lock the relevant balance rows
    await tx.execute(
      sql`select 1 from ${balances} where ${balances.clientId} = ${clientId} and ${balances.currency} = ${debitCurrency} for update`
    );
    if (creditCurrency !== debitCurrency) {
      await tx.execute(
        sql`select 1 from ${balances} where ${balances.clientId} = ${clientId} and ${balances.currency} = ${creditCurrency} for update`
      );
    }

    // Fetch existing balances for both currencies
    const rows = await tx
      .select()
      .from(balances)
      .where(
        and(
          eq(balances.clientId, clientId),
          or(eq(balances.currency, debitCurrency), eq(balances.currency, creditCurrency))
        )
      );
    const balanceMap = new Map(rows.map((r: any) => [r.currency, r]));
    const debitBalance = balanceMap.get(debitCurrency);
    const creditBalance = balanceMap.get(creditCurrency);

    // Write two ledger entries: one debit and one credit
    await tx.insert(ledgerEntries).values([
      {
        clientId,
        currency: debitCurrency,
        deltaMinor: -debitAmount,
        reason: "TRADE",
        refType: "TRADE",
        refId,
      },
      {
        clientId,
        currency: creditCurrency,
        deltaMinor: creditAmount,
        reason: "TRADE",
        refType: "TRADE",
        refId,
      },
    ]);

    // Update or insert the cached balance records
    if (debitBalance) {
      await tx
        .update(balances)
        .set({
          availableMinor: sql`${balances.availableMinor} - ${debitAmount}`,
          updatedAt: new Date(),
        })
        .where(and(eq(balances.clientId, clientId), eq(balances.currency, debitCurrency)));
    }
    if (creditBalance) {
      await tx
        .update(balances)
        .set({
          availableMinor: sql`${balances.availableMinor} + ${creditAmount}`,
          updatedAt: new Date(),
        })
        .where(and(eq(balances.clientId, clientId), eq(balances.currency, creditCurrency)));
    } else {
      await tx.insert(balances).values({
        clientId,
        currency: creditCurrency,
        availableMinor: creditAmount,
      });
    }
  }

  /**
   * Retrieve all balances for a given client.
   */
  async getBalances(clientId: string) {
    return db
      .select()
      .from(balances)
      .where(eq(balances.clientId, clientId));
  }

  /**
   * Add funds to a client's account.
   */
  async deposit(clientId: string, currency: string, amount: bigint) {
    return db.transaction(async (tx) => {
      // Create ledger entry
      await tx.insert(ledgerEntries).values({
        clientId,
        currency,
        deltaMinor: amount,
        reason: "DEPOSIT",
        refType: "DEPOSIT",
      });

      // Upsert balance
      const [existing] = await tx
        .select()
        .from(balances)
        .where(and(eq(balances.clientId, clientId), eq(balances.currency, currency)))
        .limit(1);

      if (existing) {
        await tx
          .update(balances)
          .set({
            availableMinor: sql`${balances.availableMinor} + ${amount}`,
            updatedAt: new Date(),
          })
          .where(and(eq(balances.clientId, clientId), eq(balances.currency, currency)));
      } else {
        await tx.insert(balances).values({
          clientId,
          currency,
          availableMinor: amount,
        });
      }
    });
  }
}

export const ledgerService = new LedgerService();
