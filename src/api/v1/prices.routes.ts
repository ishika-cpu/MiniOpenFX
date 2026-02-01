import { Hono } from "hono";
import { z } from "zod";
import { pricingService } from "../../services/pricing/pricing.service.js";

export const pricesRoutes = new Hono();

pricesRoutes.get("/", async (c) => {
  const querySchema = z.object({
    symbol: z.string().min(3),
  });

  const { symbol } = querySchema.parse(c.req.query());

  const price = await pricingService.getIndicativePrice(symbol);

  return c.json(price);
});
