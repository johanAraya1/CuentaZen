import { Contributor, Currency, Frequency, CategoryType, CategoryOwner } from "@prisma/client";

export const AUTH_COOKIE_NAME = "budget_access";

export const CURRENCIES: Currency[] = ["CRC", "USD"];
export const FREQUENCIES: Frequency[] = ["MENSUAL", "QUINCENAL"];
export const CATEGORY_TYPES: CategoryType[] = ["FIJO", "VARIABLE", "IMPREVISTA"];
export const CONTRIBUTORS: Contributor[] = ["JOHAN", "WENDY"];
export const CATEGORY_OWNERS: CategoryOwner[] = ["JOHAN", "WENDY", "AMBOS"];

export const DEFAULT_ALERT_PERCENTAGE = 80;
export const GLOBAL_WARNING_PERCENTAGE = 98;
