import { CategoryType } from "@prisma/client";
import { jsonError } from "@/lib/api";
import { assertApiAccess } from "@/lib/auth";
import { syncCategoryTemplateToOpenMonth } from "@/lib/budget-service";
import { toNumber } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { categorySchema } from "@/lib/validators";

type Context = {
  params: Promise<{ id: string }>;
};

function serialize(category: {
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
    isActive: category.isActive
  };
}

export async function PUT(request: Request, context: Context) {
  const unauthorized = await assertApiAccess();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const { id } = await context.params;
    const payload = categorySchema.parse(await request.json());

    if (payload.type === CategoryType.IMPREVISTA || payload.scope === "ONE_OFF") {
      return Response.json(
        { error: "Las categorias imprevistas se editan desde el listado del mes actual" },
        { status: 400 }
      );
    }

    const updated = await prisma.categoryTemplate.update({
      where: { id },
      data: {
        name: payload.name,
        type: payload.type,
        owner: payload.owner,
        monthlyBudget: payload.monthlyBudget,
        currency: payload.currency,
        biweeklyControl: payload.biweeklyControl,
        alertsEnabled: payload.alertsEnabled,
        alertPercentage: payload.alertPercentage,
        isActive: payload.isActive
      }
    });
    await syncCategoryTemplateToOpenMonth(id);

    return Response.json(serialize(updated));
  } catch (error) {
    return jsonError(error, "No se pudo actualizar la categoria");
  }
}

export async function DELETE(_request: Request, context: Context) {
  const unauthorized = await assertApiAccess();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const { id } = await context.params;
    await prisma.categoryTemplate.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error, "No se pudo eliminar la categoria");
  }
}
