import { CategoryType, MonthStatus } from "@prisma/client";
import { jsonError } from "@/lib/api";
import { assertApiAccess } from "@/lib/auth";
import { convertCurrency, toNumber } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { ensureSettings } from "@/lib/settings";
import { fixedExpensePaySchema } from "@/lib/validators";

export async function POST(request: Request) {
  const unauthorized = await assertApiAccess();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const payload = fixedExpensePaySchema.parse(await request.json());
    const settings = await ensureSettings();
    const exchangeRate = toNumber(settings.exchangeRate);

    const category = await prisma.monthCategory.findUnique({
      where: { id: payload.categoryId },
      include: {
        month: {
          select: { id: true, status: true }
        },
        expenses: true
      }
    });

    if (!category) {
      return Response.json({ error: "Categoria no encontrada" }, { status: 404 });
    }
    if (category.month.status === MonthStatus.CLOSED) {
      return Response.json({ error: "El mes esta cerrado" }, { status: 400 });
    }
    if (category.type !== CategoryType.FIJO || category.biweeklyControl) {
      return Response.json({ error: "Solo aplica a categorias fijas mensuales" }, { status: 400 });
    }

    const budget = toNumber(category.monthlyBudget);
    const spent = category.expenses.reduce(
      (sum, expense) =>
        sum + convertCurrency(toNumber(expense.amount), expense.currency, category.currency, exchangeRate),
      0
    );
    const remaining = Math.round((Math.max(0, budget - spent) + Number.EPSILON) * 100) / 100;

    if (remaining <= 0.009) {
      return Response.json({ error: "Esta categoria ya fue pagada este mes" }, { status: 400 });
    }

    const created = await prisma.expense.create({
      data: {
        monthId: category.month.id,
        categoryId: category.id,
        amount: remaining,
        currency: category.currency,
        paidBy: payload.paidBy,
        comment: "Pago fijo mensual"
      }
    });

    return Response.json({
      ok: true,
      id: created.id,
      amount: toNumber(created.amount),
      currency: created.currency
    });
  } catch (error) {
    return jsonError(error, "No se pudo marcar el gasto fijo como pagado");
  }
}
