import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

const SESSION_SALT = "family-budget-session-v1";

function normalizeExchangeRate(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Tipo de cambio invalido");
  }

  return Math.round(rate * 100) / 100;
}

export async function ensureSettings() {
  const found = await prisma.appSetting.findUnique({ where: { id: 1 } });
  if (found) {
    return found;
  }

  const defaultKey = process.env.DEFAULT_GLOBAL_KEY ?? "1234";
  const defaultExchangeRate = normalizeExchangeRate(Number(process.env.DEFAULT_EXCHANGE_RATE ?? "520"));
  const hash = await bcrypt.hash(defaultKey, 10);

  return prisma.appSetting.create({
    data: {
      id: 1,
      exchangeRate: defaultExchangeRate,
      globalKeyHash: hash
    }
  });
}

export async function verifyGlobalKey(rawKey: string): Promise<boolean> {
  const settings = await ensureSettings();
  return bcrypt.compare(rawKey, settings.globalKeyHash);
}

export function buildSessionToken(globalKeyHash: string): string {
  return createHash("sha256")
    .update(`${globalKeyHash}:${SESSION_SALT}`)
    .digest("hex");
}

export async function getCurrentSessionToken(): Promise<string> {
  const settings = await ensureSettings();
  return buildSessionToken(settings.globalKeyHash);
}

export async function isSessionTokenValid(token: string | null | undefined): Promise<boolean> {
  if (!token) {
    return false;
  }

  const expected = await getCurrentSessionToken();
  return token === expected;
}

export async function updateSettings(input: { exchangeRate: number; newGlobalKey?: string }) {
  const normalizedRate = normalizeExchangeRate(input.exchangeRate);
  const data: { exchangeRate: number; globalKeyHash?: string } = { exchangeRate: normalizedRate };

  if (input.newGlobalKey && input.newGlobalKey.trim().length > 0) {
    data.globalKeyHash = await bcrypt.hash(input.newGlobalKey.trim(), 10);
  }

  return prisma.appSetting.update({
    where: { id: 1 },
    data
  });
}
