import { jsonError } from "@/lib/api";
import { assertApiAccess } from "@/lib/auth";
import { ensureOpenMonth } from "@/lib/budget-service";
import { convertCurrency, round2, toNumber } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { ensureSettings } from "@/lib/settings";

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

    const month = await prisma.budgetMonth.findUniqueOrThrow({
      where: { id: targetMonthId },
      select: {
        id: true,
        status: true,
        monthStart: true,
        preclosures: {
          orderBy: { generatedAt: "desc" },
          select: {
            fortnight: true,
            generatedAt: true
          }
        }
      }
    });

    const categories = await prisma.monthCategory.findMany({
      where: { monthId: targetMonthId, isActive: true },
      orderBy: { name: "asc" },
      include: {
        expenses: {
          select: {
            amount: true,
            currency: true,
            spentAt: true
          }
        }
      }
    });

    const firstPreclosure = month.preclosures.find((item) => item.fortnight === 1);
    const cutoff = firstPreclosure ? new Date(firstPreclosure.generatedAt).getTime() : null;

    const payloadCategories = categories.map((category) => {
      let spentQ1 = 0;
      let spentQ2 = 0;

      for (const expense of category.expenses) {
        const converted = convertCurrency(
          toNumber(expense.amount),
          expense.currency,
          category.currency,
          exchangeRate
        );
        if (cutoff === null) {
          spentQ1 += converted;
          continue;
        }

        const spentAtMs = expense.spentAt.getTime();
        if (spentAtMs >= cutoff) {
          spentQ2 += converted;
        } else {
          spentQ1 += converted;
        }
      }

      const budget = toNumber(category.monthlyBudget);
      const difference = budget - (spentQ1 + spentQ2);

      return {
        id: category.id,
        name: category.name,
        currency: category.currency,
        monthlyBudget: round2(budget),
        biweeklyControl: category.biweeklyControl,
        spentQ1: round2(spentQ1),
        spentQ2: round2(spentQ2),
        difference: round2(difference)
      };
    });

    return Response.json({
      month,
      categories: payloadCategories
    });
  } catch (error) {
    return jsonError(error, "No se pudo cargar el control de gastos");
  }
}
