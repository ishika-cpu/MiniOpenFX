import "dotenv/config";
import crypto from "crypto";
import { hashApiKey } from "../domain/hash.js";
import { db, pool } from "./client.js";
import { clients, balances, ledgerEntries } from "./schema.js";

async function main() {
  // Either use a key provided in .env or generate a new random one
  const provided = process.env.API_KEY;
  const apiKeyId = crypto.randomUUID();
  const secret = provided ?? crypto.randomUUID();
  const apiKey = `${apiKeyId}.${secret}`;
  const apiKeyHash = await hashApiKey(secret);

  const [client] = await db
    .insert(clients)
    .values({ name: "dev-client", apiKeyId, apiKeyHash })
    .returning();

  // 2) Seed balances via ledger + balances cache
  // Example: give user 10,000 USDT and 0 of other currencies
  const seed = [
    { currency: "USDT", availableMinor: 10_000_000_000n }, // 10,000.000000 (6 dp)
    { currency: "BTC", availableMinor: 0n },
    { currency: "ETH", availableMinor: 0n },
    { currency: "EUR", availableMinor: 0n },
    { currency: "USD", availableMinor: 0n },
  ];

  await db.insert(balances).values(
    seed.map((s) => ({
      clientId: client.id,
      currency: s.currency,
      availableMinor: s.availableMinor,
    }))
  );

  await db.insert(ledgerEntries).values(
    seed
      .filter((s) => s.availableMinor !== 0n)
      .map((s) => ({
        clientId: client.id,
        currency: s.currency,
        deltaMinor: s.availableMinor,
        reason: "DEPOSIT",
        refType: "SEED",
        refId: null,
      }))
  );

  console.log("Seeded client:", { clientId: client.id });
  console.log(`Use this API key: ${apiKey}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
