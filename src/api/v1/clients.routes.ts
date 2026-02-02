import { Hono } from "hono";//hono class
import { z } from "zod";//runtime validation library
import { clientsService } from "../../services/clients/clients.service.js";//business logic for creating/deleting clients
import { adminAuth } from "../middleware/adminAuth.js";//
import { auth } from "../middleware/auth.js";

export const clientsRoutes = new Hono();

const createClientSchema = z.object({
    name: z.string().min(1),//name is required
    api_key: z.string().optional(),//api key is optional
});//create client json body defn.

// Admin only: Create Client
clientsRoutes.post("/", adminAuth(), async (c) => {
    let body;
    try {
        body = await c.req.json();//reads request body and parses json
        createClientSchema.parse(body);//validates json body
    } catch (e) {
        return c.json({ error: "Invalid input" }, 400);
    }

    try {
        const result = await clientsService.createClient({//calls service to create client
            name: body.name,
            apiKey: body.api_key,
        });

        return c.json(
            {
                client_id: result.clientId,
                api_key: result.apiKey,
            },
            201
        );
    } catch (error) {
        console.error("Failed to create client:", error);
        return c.json({ error: "Failed to create client" }, 500);
    }
});

// Client only: Delete self
clientsRoutes.delete("/:id", auth(), async (c) => {
    const clientIdParam = c.req.param("id");
    const authenticatedClientId = c.get("clientId");//get clientId of whoever is authenticated

    // Ensure client can only delete themselves
    if (clientIdParam !== authenticatedClientId) {
        return c.json({ error: "Forbidden: You can only delete your own account" }, 403);
    }//prevent one client from delting someone else

    try {
        const deleted = await clientsService.deleteClient(clientIdParam);
        if (!deleted) {
            return c.json({ error: "Client not found" }, 404);
        }
        return c.json({ ok: true, message: "Client deleted" });
    } catch (error) {
        console.error("Failed to delete client:", error);
        return c.json({ error: "Failed to delete client" }, 500);
    }
});
