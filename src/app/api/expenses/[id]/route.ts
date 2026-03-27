import { MonthStatus } from "@prisma/client";
import { jsonError } from "@/lib/api";
import { assertApiAccess } from "@/lib/auth";
import { toNumber } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { expenseSchema } from "@/lib/validators";

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
    const payload = expenseSchema.parse(await request.json());
    const spentAt = parseSpentAt(payload.spentAt);

    const existing = await prisma.expense.findUnique({
      where: { id },
      include: { month: { select: { status: true, id: true } } }
    });
    if (!existing) {
      return Response.json({ error: "Gasto no encontrado" }, { status: 404 });
    }

    if (existing.month.status === MonthStatus.CLOSED) {
      return Response.json({ error: "No se puede editar un mes cerrado" }, { status: 400 });
    }

    const category = await prisma.monthCategory.findUnique({
      where: { id: payload.categoryId },
      select: {
        id: true,
        monthId: true,
        name: true
      }
    });

    if (!category || category.monthId !== existing.month.id) {
      return Response.json(
        { error: "La categoria debe pertenecer al mismo mes del gasto" },
        { status: 400 }
      );
    }

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        categoryId: payload.categoryId,
        amount: payload.amount,
        currency: payload.currency,
        paidBy: payload.paidBy,
        comment: payload.comment && payload.comment.length > 0 ? payload.comment : null,
        ...(spentAt ? { spentAt } : {})
      },
      include: {
        category: { select: { name: true } }
      }
    });

    return Response.json({
      id: updated.id,
      monthId: updated.monthId,
      categoryId: updated.categoryId,
      categoryName: updated.category.name,
      amount: toNumber(updated.amount),
      currency: updated.currency,
      paidBy: updated.paidBy,
      spentAt: updated.spentAt,
      comment: updated.comment
    });
  } catch (error) {
    return jsonError(error, "No se pudo actualizar el gasto");
  }
}

export async function DELETE(_request: Request, context: Context) {
  const unauthorized = await assertApiAccess();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const { id } = await context.params;
    const existing = await prisma.expense.findUnique({
      where: { id },
      include: { month: { select: { status: true } } }
    });

    if (!existing) {
      return Response.json({ error: "Gasto no encontrado" }, { status: 404 });
    }

    if (existing.month.status === MonthStatus.CLOSED) {
      return Response.json({ error: "No se puede eliminar en un mes cerrado" }, { status: 400 });
    }

    await prisma.expense.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error, "No se pudo eliminar el gasto");
  }
}

function parseSpentAt(value?: string) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T12:00:00` : trimmed;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Fecha invalida");
  }
  return date;
}
