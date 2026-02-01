import { describe, it } from "node:test";
import assert from "node:assert";
import { toMinorUnits, fromMinorUnits } from "../domain/money.js";

describe("Money Logic (money.ts)", () => {
    describe("toMinorUnits", () => {
        it("converts standard currency (2 decimals) correctly", () => {
            // 100.50 USD => 10050 cents
            const minor = toMinorUnits("100.50", "USD");
            assert.strictEqual(minor, 10050n);
        });

        it("converts crypto currency (8 decimals) correctly", () => {
            // 1.12345678 BTC => 112345678 satoshis
            const minor = toMinorUnits("1.12345678", "BTC");
            assert.strictEqual(minor, 112345678n);
        });

        it("handles integer strings", () => {
            const minor = toMinorUnits("50", "EUR");
            assert.strictEqual(minor, 5000n); // 50.00
        });

        it("throws on negative amounts", () => {
            assert.throws(() => toMinorUnits("-5", "USD"), /Invalid amount/);
        });
    });

    describe("fromMinorUnits", () => {
        it("converts back to string for standard currency", () => {
            const str = fromMinorUnits(10050n, "USD");
            assert.strictEqual(str, "100.50");
        });

        it("converts back to string for crypto", () => {
            const str = fromMinorUnits(112345678n, "BTC");
            assert.strictEqual(str, "1.12345678");
        });

        it("pads zeros correctly", () => {
            const str = fromMinorUnits(5n, "USD"); // 0.05
            assert.strictEqual(str, "0.05");
        });
    });
});
