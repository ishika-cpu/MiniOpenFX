import Decimal from "decimal.js";
import { scaleFor } from "../config/currency.js";

export function toMinorUnits(amountStr: string, currency: string): bigint {
  const scale = scaleFor(currency);
  const d = new Decimal(amountStr);
  if (!d.isFinite() || d.isNeg()) throw new Error("Invalid amount");
  const factor = new Decimal(10).pow(scale);
  // round down to avoid over-crediting
  return BigInt(d.mul(factor).toFixed(0, Decimal.ROUND_DOWN));
}

export function fromMinorUnits(minor: bigint, currency: string): string {
  const scale = scaleFor(currency);
  const factor = new Decimal(10).pow(scale);
  return new Decimal(minor.toString()).div(factor).toFixed(scale);
}
