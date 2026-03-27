import { MonthStatus } from "@prisma/client";
import { jsonError } from "@/lib/api";
import { assertApiAccess } from "@/lib/auth";
import { ensureOpenMonth } from "@/lib/budget-service";
import { convertCurrency, toNumber } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { ensureSettings } from "@/lib/settings";
import { expenseSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const unauthorized = await assertApiAccess();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const url = new URL(request.url);
    const monthIdParam = url.searchParams.get("monthId");
    const targetMonthId = monthIdParam ?? (await ensureOpenMonth()).id;

    const settings = await ensureSettings();
    const exchangeRate = toNumber(settings.exchangeRate);

    const [expenses, categories, month] = await Promise.all([
      prisma.expense.findMany({
        where: { monthId: targetMonthId },
        orderBy: { spentAt: "desc" },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              currency: true,
              owner: true,
              type: true,
              monthlyBudget: true,
              biweeklyControl: true,
              isOneOff: true,
              isActive: true
            }
          }
        }
      }),
      prisma.monthCategory.findMany({
        where: { monthId: targetMonthId, isActive: true },
        orderBy: { name: "asc" }
      }),
      prisma.budgetMonth.findUniqueOrThrow({
        where: { id: targetMonthId },
        select: {
          id: true,
          status: true,
          monthStart: true,
          preclosures: {
            orderBy: { generatedAt: "desc" },
            select: {
              id: true,
              fortnight: true,
              generatedAt: true
            }
          }
        }
      })
    ]);

    const serializedCategories = categories.map((category) => {
      const spentInCategoryCurrency = expenses
        .filter((expense) => expense.categoryId === category.id)
        .reduce(
          (sum, expense) =>
            sum + convertCurrency(toNumber(expense.amount), expense.currency, category.currency, exchangeRate),
          0
        );

      const monthlyBudget = toNumber(category.monthlyBudget);
      const isFixedMonthly = category.type === "FIJO" && !category.biweeklyControl;
      const remainingToSettle = Math.max(0, monthlyBudget - spentInCategoryCurrency);
      const isSettled = isFixedMonthly && remainingToSettle <= 0.009;

      return {
        id: category.id,
        templateId: category.templateId,
        name: category.name,
        type: category.type,
        owner: category.owner,
        currency: category.currency,
        monthlyBudget: roundForClient(monthlyBudget),
        biweeklyControl: category.biweeklyControl,
        isOneOff: category.isOneOff,
        totalSpent: roundForClient(spentInCategoryCurrency),
        remainingToSettle: roundForClient(remainingToSettle),
        isFixedMonthly,
        isSettled
      };
    });

    return Response.json({
      month,
      categories: serializedCategories,
      expenses: expenses.map((expense) => ({
        id: expense.id,
        monthId: expense.monthId,
        categoryId: expense.categoryId,
        categoryName: expense.category.name,
        categoryOwner: expense.category.owner,
        categoryType: expense.category.type,
        categoryCurrency: expense.category.currency,
        categoryIsFixedMonthly: expense.category.type === "FIJO" && !expense.category.biweeklyControl,
        amount: toNumber(expense.amount),
        currency: expense.currency,
        paidBy: expense.paidBy,
        spentAt: expense.spentAt,
        comment: expense.comment
      }))
    });
  } catch (error) {
    return jsonError(error, "No se pudieron cargar los gastos");
  }
}

export async function POST(request: Request) {
  const unauthorized = await assertApiAccess();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const payload = expenseSchema.parse(await request.json());
    const spentAt = parseSpentAt(payload.spentAt);
    const category = await prisma.monthCategory.findUnique({
      where: { id: payload.categoryId },
      include: {
        month: {
          select: {
            id: true,
            status: true
          }
        }
      }
    });

    if (!category) {
      throw new Error("Categoria no encontrada en el mes activo");
    }

    if (category.month.status === MonthStatus.CLOSED) {
      return Response.json({ error: "El mes esta cerrado" }, { status: 400 });
    }

    const created = await prisma.expense.create({
      data: {
        monthId: category.month.id,
        categoryId: category.id,
        amount: payload.amount,
        currency: payload.currency,
        paidBy: payload.paidBy,
        comment: payload.comment && payload.comment.length > 0 ? payload.comment : null,
        ...(spentAt ? { spentAt } : {})
      },
      include: {
        category: {
          select: {
            name: true
          }
        }
      }
    });

    return Response.json({
      id: created.id,
      monthId: created.monthId,
      categoryId: created.categoryId,
      categoryName: created.category.name,
      amount: toNumber(created.amount),
      currency: created.currency,
      paidBy: created.paidBy,
      spentAt: created.spentAt,
      comment: created.comment
    });
  } catch (error) {
    return jsonError(error, "No se pudo crear el gasto");
  }
}

function roundForClient(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
