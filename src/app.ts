import { Hono } from "hono";
import { v1Routes } from "./api/v1/routes.js";
import { errorHandler } from "./api/middleware/errorHandler.js";
import { requestId } from "./api/middleware/requestId.js";

export const app = new Hono();

app.use("*", requestId());
app.use("*", errorHandler());

app.get("/health", (c) => c.json({ ok: true }));

app.route("/v1", v1Routes);
