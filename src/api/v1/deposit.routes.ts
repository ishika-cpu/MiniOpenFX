import { Hono } from "hono";
import { z } from "zod";
import { ledgerService } from "../../services/ledger/ledger.service.js";//does actual balance update
import { auth } from "../middleware/auth.js";
import { toMinorUnits, fromMinorUnits } from "../../domain/money.js";
//toMinorUnits converts "1000.50" → bigint minor units.
//fromMinorUnits converts bigint → "1000.500000" etc.

export const depositRoutes = new Hono();

// Secure with Client Auth
depositRoutes.use("*", auth());//all paths under this router

depositRoutes.post("/", async (c) => {
    const bodySchema = z.object({
        currency: z.string().min(3),
        amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {//is Not a Number
            message: "Amount must be a positive number",
        }),
    });

    try {
        const body = await c.req.json();
        const { currency, amount } = bodySchema.parse(body);//parse and validate json request body
        const clientId = c.get("clientId") as string;

        const amountMinor = toMinorUnits(amount, currency);//convert string to minor units

        await ledgerService.deposit(clientId, currency, amountMinor);//dB writes + ledger entries

        // Get updated balance to return (optional but nice)
        const balances = await ledgerService.getBalances(clientId);//fetches balances
        const newBalance = balances.find((b) => b.currency === currency);

        return c.json({
            ok: true,
            message: "Deposit successful",
            currency,
            new_balance: newBalance
                ? fromMinorUnits(BigInt(newBalance.availableMinor), currency)//format it to decimal string
                : amount,
        });
    } catch (e: any) {
        console.error("Deposit failed 1:", e);
        // Determine if it's a Zod error or other
        if (e.issues) {
            return c.json({ error: "Invalid input", details: e.issues }, 400);
        }
        return c.json({ error: "Deposit failed 0" }, 500);
    }
});
