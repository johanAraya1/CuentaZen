import { jsonError } from "@/lib/api";
import { assertApiAccess } from "@/lib/auth";
import { deleteOneOffCategory, updateOneOffCategory } from "@/lib/budget-service";
import { toNumber } from "@/lib/currency";
import { categorySchema } from "@/lib/validators";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: Context) {
  const unauthorized = await assertApiAccess();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const { id } = await context.params;
    const payload = categorySchema.parse(await request.json());

    const updated = await updateOneOffCategory({
      categoryId: id,
      name: payload.name,
      owner: payload.owner,
      monthlyBudget: payload.monthlyBudget,
      currency: payload.currency,
      biweeklyControl: payload.biweeklyControl,
      alertsEnabled: payload.alertsEnabled,
      alertPercentage: payload.alertPercentage,
      isActive: payload.isActive
    });

    return Response.json({
      id: updated.id,
      monthId: updated.monthId,
      scope: "ONE_OFF",
      name: updated.name,
      type: updated.type,
      owner: updated.owner,
      monthlyBudget: toNumber(updated.monthlyBudget),
      currency: updated.currency,
      biweeklyControl: updated.biweeklyControl,
      alertsEnabled: updated.alertsEnabled,
      alertPercentage: updated.alertPercentage,
      isActive: updated.isActive
    });
  } catch (error) {
    return jsonError(error, "No se pudo actualizar la categoria imprevista");
  }
}

export async function DELETE(_request: Request, context: Context) {
  const unauthorized = await assertApiAccess();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const { id } = await context.params;
    const result = await deleteOneOffCategory(id);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return jsonError(error, "No se pudo eliminar la categoria imprevista");
  }
}
