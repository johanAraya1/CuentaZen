import { z } from "zod";
import { CategoryOwner, CategoryType, Contributor, Currency, Frequency } from "@prisma/client";
import { DEFAULT_ALERT_PERCENTAGE } from "@/lib/constants";

export const unlockSchema = z.object({
  key: z.string().min(1, "La clave es obligatoria")
});

export const incomeTemplateSchema = z.object({
  name: z.string().trim().min(1, "Nombre obligatorio"),
  amount: z.coerce.number().positive("Monto invalido"),
  currency: z.enum(Currency),
  frequency: z.enum(Frequency),
  owner: z.enum(["JOHAN", "WENDY"]),
  isActive: z.coerce.boolean().default(true)
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Nombre obligatorio"),
  type: z.enum(CategoryType),
  owner: z.enum(CategoryOwner).default("AMBOS"),
  monthlyBudget: z.coerce.number().min(0, "Presupuesto invalido"),
  currency: z.enum(Currency),
  biweeklyControl: z.coerce.boolean().default(false),
  alertsEnabled: z.coerce.boolean().default(true),
  alertPercentage: z.coerce.number().min(1).max(200).default(DEFAULT_ALERT_PERCENTAGE),
  isActive: z.coerce.boolean().default(true),
  scope: z.enum(["TEMPLATE", "ONE_OFF"]).default("TEMPLATE")
});

export const expenseSchema = z.object({
  categoryId: z.string().min(1),
  amount: z.coerce.number().positive("Monto invalido"),
  currency: z.enum(Currency),
  paidBy: z.enum(Contributor),
  comment: z.string().trim().max(500).optional().or(z.literal(""))
});

export const fixedExpensePaySchema = z.object({
  categoryId: z.string().min(1),
  paidBy: z.enum(Contributor)
});

export const settingsSchema = z.object({
  exchangeRate: z.coerce.number().positive("Tipo de cambio invalido"),
  newGlobalKey: z.string().trim().min(1).optional().or(z.literal(""))
});

export const precloseSchema = z.object({
  fortnight: z.coerce.number().int().min(1).max(2).optional()
});
