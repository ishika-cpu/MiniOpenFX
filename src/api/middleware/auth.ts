import type { MiddlewareHandler } from "hono";
import { db } from "../../db/client.js"; //database connection
import { clients } from "../../db/schema.js";//table defn.
import { desc, eq } from "drizzle-orm";//sql helpers
import { verifyApiKey } from "../../domain/hash.js";//compares hashed and plaintext secret


declare module "hono" { 
  interface ContextVariableMap { //type safety for clientId for every request context
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
      secret = secretPart;//after the .
      [client] = await db//select client from clients table where apiKeyId matches
        .select()
        .from(clients)
        .where(eq(clients.apiKeyId, apiKeyId))//where apiKeyId matches
        .limit(1);//SELECT * FROM clients WHERE api_key_id = ? LIMIT 1;
    } else {//no .
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

    const ok = await verifyApiKey(secret, client.apiKeyHash);//verify secret hash matches
    if (!ok) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "Invalid API key" } }, 401);
    }

    c.set("clientId", client.id);//set clientId in context, every route knows who the client is
    await next();
  };
}
