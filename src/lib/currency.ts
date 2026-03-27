import { Currency, Prisma } from "@prisma/client";

type DecimalLike = Prisma.Decimal | number | string | { toString(): string };

export function toNumber(value: DecimalLike): number {
  if (typeof value === "number") {
    return value;
  }

  return Number(value.toString());
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function convertCurrency(
  amount: number,
  from: Currency,
  to: Currency,
  exchangeRate: number
): number {
  if (from === to) {
    return amount;
  }

  if (from === "USD" && to === "CRC") {
    return amount * exchangeRate;
  }

  if (from === "CRC" && to === "USD") {
    return amount / exchangeRate;
  }

  return amount;
}

export function toCRC(amount: number, currency: Currency, exchangeRate: number): number {
  return convertCurrency(amount, currency, "CRC", exchangeRate);
}

export function formatCurrency(value: number, currency: Currency): string {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value);
}
