import { jsonError } from "@/lib/api";
import { assertApiAccess } from "@/lib/auth";
import { removeIncomeTemplateFromOpenMonth, syncIncomeTemplateToOpenMonth } from "@/lib/budget-service";
import { prisma } from "@/lib/prisma";
import { incomeTemplateSchema } from "@/lib/validators";
import { toNumber } from "@/lib/currency";

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
    const payload = incomeTemplateSchema.parse(await request.json());

    const updated = await prisma.incomeTemplate.update({
      where: { id },
      data: {
        name: payload.name,
        amount: payload.amount,
        currency: payload.currency,
        frequency: payload.frequency,
        owner: payload.owner,
        isActive: payload.isActive
      }
    });
    await syncIncomeTemplateToOpenMonth(id);

    return Response.json({
      id: updated.id,
      name: updated.name,
      amount: toNumber(updated.amount),
      currency: updated.currency,
      frequency: updated.frequency,
      owner: updated.owner,
      isActive: updated.isActive
    });
  } catch (error) {
    return jsonError(error, "No se pudo actualizar el ingreso");
  }
}

export async function DELETE(_request: Request, context: Context) {
  const unauthorized = await assertApiAccess();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const { id } = await context.params;
    await removeIncomeTemplateFromOpenMonth(id);
    await prisma.incomeTemplate.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error, "No se pudo eliminar el ingreso");
  }
}
