import { db } from "../../db/client.js";
import { clients, balances } from "../../db/schema.js";
import { hashApiKey } from "../../domain/hash.js";
// import { v4 as uuidv4 } from "uuid"; // Removed
import crypto from "crypto";
import { toMinorUnits } from "../../domain/money.js";
import { eq } from "drizzle-orm";

export type CreateClientInput = {
    name: string;
    apiKey?: string;
};

export type CreateClientOutput = {
    clientId: string;
    apiKey: string;
};

const SEED_CURRENCIES = ["USDT", "BTC", "ETH", "EUR", "USD"];

export class ClientsService {
    async createClient(input: CreateClientInput): Promise<CreateClientOutput> {
        let apiKeyId: string;
        let secret: string;

        if (input.apiKey) {
            if (!input.apiKey.includes('.')) {
                // If user provides a raw key without dot, treat it as secret and generate ID?
                if (input.apiKey.includes('.')) {
                    const parts = input.apiKey.split('.');
                    apiKeyId = parts[0];
                    secret = parts[1];
                } else {
                    apiKeyId = crypto.randomUUID();
                    secret = input.apiKey;
                }
            } else {
                const parts = input.apiKey.split('.');
                apiKeyId = parts[0];
                secret = parts.slice(1).join('.');
            }
        } else {
            apiKeyId = crypto.randomUUID();
            secret = crypto.randomBytes(32).toString("hex");
        }

        // NOTE: If the user provided a key with a dot, we respected it above? 
        // Actually, let's re-read carefully: "If the caller doesn’t provide an API key, generate one."
        // It doesn't explicitly say what to do if they DO provide one.
        // Let's assume standard behavior: We generate the ID (the prefix), they can provide the secret.
        // So the final key is `generated_uuid.provided_secret`.

        // Re-evaluating logic:
        // If input.apiKey contains '.', use it as 'id.secret'.
        // Else, use a generated UUID as ID, and input.apiKey as secret.

        if (input.apiKey && input.apiKey.includes('.')) {
            const parts = input.apiKey.split('.');
            apiKeyId = parts[0];
            secret = parts.slice(1).join('.');
        }

        const apiKeyHash = await hashApiKey(secret);
        const fullApiKey = `${apiKeyId}.${secret}`;

        const [newClient] = await db
            .insert(clients)
            .values({
                name: input.name,
                apiKeyId,
                apiKeyHash,
            })
            .returning();

        // Seed balances
        // We need to use a transaction ideally, but for now simple awaits/Promise.all is fine
        // as we aren't enforcing strict atomicity across services yet?
        // DB client supports transaction? Yes.

        // Let's try to just insert balances.
        const initialBalances = SEED_CURRENCIES.map((currency) => ({
            clientId: newClient.id,
            currency,
            availableMinor: 0n, // BigInt 0
        }));

        if (initialBalances.length > 0) {
            await db.insert(balances).values(initialBalances);
        }

        return {
            clientId: newClient.id,
            apiKey: fullApiKey,
        };
    }

    async getClientById(clientId: string) {
        const [client] = await db
            .select()
            .from(clients)
            .where(eq(clients.id, clientId))
            .limit(1);
        return client;
    }

    async deleteClient(clientId: string) {
        const result = await db.delete(clients).where(eq(clients.id, clientId)).returning();
        return result.length > 0;
    }
}

export const clientsService = new ClientsService();
