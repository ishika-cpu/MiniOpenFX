import type { MiddlewareHandler } from "hono";
import { db } from "../../db/client.js";
import { clients } from "../../db/schema.js";
import { desc, eq } from "drizzle-orm";
import { verifyApiKey } from "../../domain/hash.js";


declare module "hono" {
  interface ContextVariableMap {
    clientId: string;
  }
}

export function auth(): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";

    if (!token) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "Missing API key" } }, 401);
    }

    let client;
    let secret = token;

    if (token.includes(".")) {
      const [apiKeyId, secretPart] = token.split(".");
      if (!apiKeyId || !secretPart) {
        return c.json(
          { error: { code: "UNAUTHORIZED", message: "Invalid API key format" } },
          401
        );
      }
      secret = secretPart;
      [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.apiKeyId, apiKeyId))
        .limit(1);
    } else {
      // Back-compat: accept a single token and match against the latest client
      [client] = await db
        .select()
        .from(clients)
        .orderBy(desc(clients.createdAt))
        .limit(1);
    }
    if (!client) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "Invalid API key" } }, 401);
    }

    const ok = await verifyApiKey(secret, client.apiKeyHash);
    if (!ok) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "Invalid API key" } }, 401);
    }

    c.set("clientId", client.id);
    await next();
  };
}
