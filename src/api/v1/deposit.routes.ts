import { Hono } from "hono";
import { z } from "zod";
import { ledgerService } from "../../services/ledger/ledger.service.js";
import { auth } from "../middleware/auth.js";
import { toMinorUnits, fromMinorUnits } from "../../domain/money.js";

export const depositRoutes = new Hono();

// Secure with Client Auth
depositRoutes.use("*", auth());

depositRoutes.post("/", async (c) => {
    const bodySchema = z.object({
        currency: z.string().min(3),
        amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
            message: "Amount must be a positive number",
        }),
    });

    try {
        const body = await c.req.json();
        const { currency, amount } = bodySchema.parse(body);
        const clientId = c.get("clientId") as string;

        const amountMinor = toMinorUnits(amount, currency);

        await ledgerService.deposit(clientId, currency, amountMinor);

        // Get updated balance to return (optional but nice)
        const balances = await ledgerService.getBalances(clientId);
        const newBalance = balances.find((b) => b.currency === currency);

        return c.json({
            ok: true,
            message: "Deposit successful",
            currency,
            new_balance: newBalance
                ? fromMinorUnits(BigInt(newBalance.availableMinor), currency)
                : amount,
        });
    } catch (e: any) {
        console.error("Deposit failed:", e);
        // Determine if it's a Zod error or other
        if (e.issues) {
            return c.json({ error: "Invalid input", details: e.issues }, 400);
        }
        return c.json({ error: "Deposit failed" }, 500);
    }
});
