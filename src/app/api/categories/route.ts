import { CategoryType } from "@prisma/client";
import { jsonError } from "@/lib/api";
import { assertApiAccess } from "@/lib/auth";
import { attachCategoryTemplateToOpenMonth, createOneOffCategoryInOpenMonth, ensureOpenMonth } from "@/lib/budget-service";
import { toNumber } from "@/lib/currency";
import { monthStartOf } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { categorySchema } from "@/lib/validators";

function serializeTemplate(category: {
  id: string;
  name: string;
  type: CategoryType;
  owner: "JOHAN" | "WENDY" | "AMBOS";
  monthlyBudget: { toString(): string };
  currency: "CRC" | "USD";
  biweeklyControl: boolean;
  alertsEnabled: boolean;
  alertPercentage: number;
  isActive: boolean;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}) {
  return {
    id: category.id,
    scope: "TEMPLATE" as const,
    name: category.name,
    type: category.type,
    owner: category.owner,
    monthlyBudget: toNumber(category.monthlyBudget),
    currency: category.currency,
    biweeklyControl: category.biweeklyControl,
    alertsEnabled: category.alertsEnabled,
    alertPercentage: category.alertPercentage,
    isActive: category.isActive,
    effectiveFrom: category.effectiveFrom,
    effectiveTo: category.effectiveTo
  };
}

function serializeOneOff(category: {
  id: string;
  name: string;
  type: CategoryType;
  owner: "JOHAN" | "WENDY" | "AMBOS";
  monthlyBudget: { toString(): string };
  currency: "CRC" | "USD";
  biweeklyControl: boolean;
  alertsEnabled: boolean;
  alertPercentage: number;
  isActive: boolean;
  monthId: string;
}) {
  return {
    id: category.id,
    monthId: category.monthId,
    scope: "ONE_OFF" as const,
    name: category.name,
    type: category.type,
    owner: category.owner,
    monthlyBudget: toNumber(category.monthlyBudget),
    currency: category.currency,
    biweeklyControl: category.biweeklyControl,
    alertsEnabled: category.alertsEnabled,
    alertPercentage: category.alertPercentage,
    isActive: category.isActive
  };
}

export async function GET() {
  const unauthorized = await assertApiAccess();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const openMonth = await ensureOpenMonth();
    const [templates, oneOffCategories] = await Promise.all([
      prisma.categoryTemplate.findMany({
        orderBy: [{ isActive: "desc" }, { name: "asc" }]
      }),
      prisma.monthCategory.findMany({
        where: {
          monthId: openMonth.id,
          isOneOff: true
        },
        orderBy: [{ isActive: "desc" }, { name: "asc" }]
      })
    ]);

    return Response.json({
      month: {
        id: openMonth.id,
        monthStart: openMonth.monthStart,
        status: openMonth.status
      },
      templates: templates.map(serializeTemplate),
      oneOffCategories: oneOffCategories.map(serializeOneOff)
    });
  } catch (error) {
    return jsonError(error, "No se pudieron cargar las categorias");
  }
}

export async function POST(request: Request) {
  const unauthorized = await assertApiAccess();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const payload = categorySchema.parse(await request.json());

    if (payload.type === CategoryType.IMPREVISTA || payload.scope === "ONE_OFF") {
      const created = await createOneOffCategoryInOpenMonth({
        name: payload.name,
        owner: payload.owner,
        monthlyBudget: payload.monthlyBudget,
        currency: payload.currency,
        biweeklyControl: payload.biweeklyControl,
        alertsEnabled: payload.alertsEnabled,
        alertPercentage: payload.alertPercentage
      });

      return Response.json(serializeOneOff(created));
    }

    const created = await prisma.categoryTemplate.create({
      data: {
        name: payload.name,
        type: payload.type,
        owner: payload.owner,
        monthlyBudget: payload.monthlyBudget,
        currency: payload.currency,
        biweeklyControl: payload.biweeklyControl,
        alertsEnabled: payload.alertsEnabled,
        alertPercentage: payload.alertPercentage,
        isActive: payload.isActive,
        effectiveFrom: monthStartOf(new Date())
      }
    });

    if (created.isActive) {
      await attachCategoryTemplateToOpenMonth(created.id);
    }

    return Response.json(serializeTemplate(created));
  } catch (error) {
    return jsonError(error, "No se pudo crear la categoria");
  }
}
