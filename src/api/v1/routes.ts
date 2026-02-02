//root router
import { Hono } from "hono";
import { clientsService } from "../../services/clients/clients.service.js";
import { auth } from "../middleware/auth.js";
import { pricesRoutes } from "./prices.routes.js";
import { quotesRoutes } from "./quotes.routes.js";
import tradesRoutes from "./trades.routes.js";
import { balancesRoutes } from "./balances.routes.js";
import { depositRoutes } from "./deposit.routes.js";
import { clientsRoutes } from "./clients.routes.js";


const v1Routes = new Hono();

// Public routes (Admin protected)
v1Routes.route("/clients", clientsRoutes);

// Protect subsequent routes with standard Auth
v1Routes.use("*", auth());

v1Routes.get("/me", async (c) => {
    const clientId = c.get("clientId");
    const client = await clientsService.getClientById(clientId);

    if (!client) {
        return c.json({ error: "Client not found" }, 404);
    }

    return c.json({
        id: client.id,
        name: client.name,
        createdAt: client.createdAt,
    });
});
v1Routes.route("/prices", pricesRoutes);
v1Routes.route("/quotes", quotesRoutes);
v1Routes.route("/trades", tradesRoutes);
v1Routes.route("/balances", balancesRoutes);
v1Routes.route("/deposit", depositRoutes);

export default v1Routes