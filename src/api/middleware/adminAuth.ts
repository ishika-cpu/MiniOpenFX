import type { MiddlewareHandler } from "hono";//type middleware function

export function adminAuth(): MiddlewareHandler { //returns a middleware
    return async (c, next) => {//is the middleware itself
        const header = c.req.header("authorization") ?? "";//if undefined or null return empty string
        const token = header.startsWith("Bearer ") ? header.slice(7) : "";//if starts with Bearer then return the token
        const adminKey = process.env.API_KEY;

        if (!adminKey) {
            console.warn("API_KEY not set in environment");
            return c.json({ error: "Server configuration error" }, 500);
        }

        if (!token || token !== adminKey) {
            return c.json({ error: "Unauthorized: Invalid admin key" }, 401);
        }

        await next();
    };
}
