import type { MiddlewareHandler } from "hono";

export function adminAuth(): MiddlewareHandler {
    return async (c, next) => {
        const header = c.req.header("authorization") ?? "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : "";

        const adminKey = process.env.API_KEY;

        if (!adminKey) {
            // Fail authentication if no admin key is configured
            console.error("ADMIN AUTH: No API_KEY configured in environment.");
            return c.json({ error: { code: "INTERNAL_ERROR", message: "Server configuration error" } }, 500);
        }

        // DEBUG LOGGING
        console.log(`[AdminAuth] Expected: ${adminKey}, Received: ${token}`);

        if (!token || token !== adminKey) {
            console.log("[AdminAuth] Auth failed");
            return c.json({ error: { code: "UNAUTHORIZED", message: "Invalid Admin API key" } }, 401);
        }

        await next();
    };
}
