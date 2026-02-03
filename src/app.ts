import { Hono } from "hono";
import v1Routes from "./api/v1/routes.js";
import { requestId } from "./api/middleware/requestId.js";
import { errorHandler } from "./api/errorHandler.js";

export const app = new Hono();

app.use("*", requestId());
// app.use("*", errorHandler()); illegal 

app.get("/", (c) => c.text("MiniOpenFX is running! 🚀"));
app.get("/health", (c) => c.json({ ok: true, status: "up" }));

app.route("/v1", v1Routes);


// app.onError((error, c) => {
//     console.log(error)
//     return c.json({ error: error.message })
// })

app.onError(errorHandler);
