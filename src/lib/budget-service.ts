import {
  CategoryOwner,
  CategoryType,
  Contributor,
  Currency,
  Frequency,
  MonthStatus,
  Prisma,
  PrismaClient
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { convertCurrency, round2, toCRC, toNumber } from "@/lib/currency";
import {
  addMonthsUTC,
  currentFortnight,
  dayOfMonthUTC,
  daysInMonthUTC,
  formatMonthKey,
  fortnightBounds,
  isSameMonthUTC,
  monthStartOf
} from "@/lib/dates";
import { GLOBAL_WARNING_PERCENTAGE } from "@/lib/constants";
import { ensureSettings } from "@/lib/settings";

type Tx = PrismaClient | Prisma.TransactionClient;

const monthInclude = {
  incomes: true,
  categories: {
    orderBy: { name: "asc" as const },
    include: { expenses: true }
  },
  expenses: {
    orderBy: { spentAt: "desc" as const },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          currency: true,
          owner: true,
          type: true,
          monthlyBudget: true,
          biweeklyControl: true
        }
      }
    }
  },
  preclosures: {
    orderBy: { generatedAt: "desc" as const },
    take: 10
  }
};

type MonthWithData = Prisma.BudgetMonthGetPayload<{ include: typeof monthInclude }>;

type CategorySummary = {
  id: string;
  templateId: string | null;
  name: string;
  type: CategoryType;
  owner: CategoryOwner;
  currency: Currency;
  budget: number;
  spent: number;
  available: number;
  consumedPercent: number;
  alertsEnabled: boolean;
  alertPercentage: number;
  alertColor: "green" | "yellow" | "red";
  isOneOff: boolean;
  biweeklyControl: boolean;
  biweekly: {
    budget: number;
    spent: number;
    available: number;
    projectedMonthly: number;
    fortnight: 1 | 2;
  } | null;
};

type ContributorKey = "JOHAN" | "WENDY";

type SplitTotals = Record<ContributorKey, number>;

type ContributorExpenseDetail = {
  id: string;
  categoryName: string;
  spentAt: Date;
  amount: number;
  currency: Currency;
  owner: CategoryOwner;
  shareCRC: number;
  comment: string | null;
};

function emptySplitTotals(): SplitTotals {
  return { JOHAN: 0, WENDY: 0 };
}

function resolveIncomeOwnerFromName(name: string): ContributorKey {
  const lower = name.toLowerCase();
  if (lower.includes("wendy")) {
    return "WENDY";
  }
  if (lower.includes("johan")) {
    return "JOHAN";
  }
  return "JOHAN";
}

function resolveIncomeOwner(owner: Contributor | null, name: string): Contributor {
  const inferred = resolveIncomeOwnerFromName(name);
  if (!owner) {
    return inferred;
  }
  if (owner === "JOHAN" && inferred === "WENDY") {
    return "WENDY";
  }
  return owner;
}

function splitByOwner(owner: Contributor | CategoryOwner, amount: number): SplitTotals {
  if (owner === "AMBOS") {
    const half = amount / 2;
    return { JOHAN: half, WENDY: half };
  }
  if (owner === "JOHAN") {
    return { JOHAN: amount, WENDY: 0 };
  }
  return { JOHAN: 0, WENDY: amount };
}

function addSplitTotals(target: SplitTotals, owner: Contributor | CategoryOwner, amount: number) {
  const split = splitByOwner(owner, amount);
  target.JOHAN += split.JOHAN;
  target.WENDY += split.WENDY;
}

function activeTemplateFilter(monthStart: Date) {
  return {
    isActive: true,
    effectiveFrom: { lte: monthStart },
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: monthStart } }]
  };
}

async function createMonthWithSnapshots(monthStart: Date, tx: Tx) {
  const existing = await tx.budgetMonth.findUnique({
    where: { monthStart }
  });

  if (existing) {
    return existing;
  }

  const created = await tx.budgetMonth.create({
    data: {
      monthStart,
      status: MonthStatus.OPEN
    }
  });

  const [incomeTemplates, categoryTemplates] = await Promise.all([
    tx.incomeTemplate.findMany({
      where: activeTemplateFilter(monthStart),
      orderBy: { createdAt: "asc" }
    }),
    tx.categoryTemplate.findMany({
      where: {
        ...activeTemplateFilter(monthStart),
        type: { not: CategoryType.IMPREVISTA }
      },
      orderBy: { createdAt: "asc" }
    })
  ]);

  const monthIncomeData: Prisma.MonthIncomeCreateManyInput[] = [];
  for (const template of incomeTemplates) {
    const occurrences = template.frequency === Frequency.QUINCENAL ? 2 : 1;
    for (let occurrence = 1; occurrence <= occurrences; occurrence += 1) {
      monthIncomeData.push({
        monthId: created.id,
        templateId: template.id,
        name: template.name,
        amount: template.amount,
        currency: template.currency,
        frequency: template.frequency,
        owner: resolveIncomeOwner(template.owner, template.name),
        occurrenceNumber: occurrence
      });
    }
  }

  if (monthIncomeData.length > 0) {
    await tx.monthIncome.createMany({
      data: monthIncomeData
    });
  }

  const monthCategoryData: Prisma.MonthCategoryCreateManyInput[] = categoryTemplates.map((template) => ({
    monthId: created.id,
    templateId: template.id,
    name: template.name,
    type: template.type,
    owner: template.owner,
    monthlyBudget: template.monthlyBudget,
    currency: template.currency,
    biweeklyControl: template.biweeklyControl,
    alertsEnabled: template.alertsEnabled,
    alertPercentage: template.alertPercentage,
    isActive: template.isActive,
    isOneOff: false
  }));

  if (monthCategoryData.length > 0) {
    await tx.monthCategory.createMany({
      data: monthCategoryData
    });
  }

  return created;
}

export async function ensureOpenMonth() {
  await ensureSettings();

  const openMonth = await prisma.budgetMonth.findFirst({
    where: { status: MonthStatus.OPEN },
    orderBy: { monthStart: "desc" }
  });

  if (openMonth) {
    return openMonth;
  }

  const latestMonth = await prisma.budgetMonth.findFirst({
    orderBy: { monthStart: "desc" }
  });

  const targetStart = latestMonth ? addMonthsUTC(latestMonth.monthStart, 1) : monthStartOf(new Date());
  return prisma.$transaction((tx) => createMonthWithSnapshots(targetStart, tx));
}

export async function syncIncomeTemplateToOpenMonth(templateId: string) {
  const openMonth = await ensureOpenMonth();
  const template = await prisma.incomeTemplate.findUnique({ where: { id: templateId } });

  if (!template || !template.isActive) {
    await prisma.monthIncome.deleteMany({
      where: {
        monthId: openMonth.id,
        templateId
      }
    });
    return;
  }

  const resolvedOwner = resolveIncomeOwner(template.owner, template.name);
  const occurrences = template.frequency === Frequency.QUINCENAL ? 2 : 1;
  for (let occurrence = 1; occurrence <= occurrences; occurrence += 1) {
    await prisma.monthIncome.upsert({
      where: {
        monthId_templateId_occurrenceNumber: {
          monthId: openMonth.id,
          templateId,
          occurrenceNumber: occurrence
        }
      },
      update: {
        name: template.name,
        amount: template.amount,
        currency: template.currency,
        frequency: template.frequency,
        owner: resolvedOwner
      },
      create: {
        monthId: openMonth.id,
        templateId,
        name: template.name,
        amount: template.amount,
        currency: template.currency,
        frequency: template.frequency,
        owner: resolvedOwner,
        occurrenceNumber: occurrence
      }
    });
  }

  await prisma.monthIncome.deleteMany({
    where: {
      monthId: openMonth.id,
      templateId,
      occurrenceNumber: { gt: occurrences }
    }
  });
}

export async function removeIncomeTemplateFromOpenMonth(templateId: string) {
  const openMonth = await ensureOpenMonth();
  await prisma.monthIncome.deleteMany({
    where: {
      monthId: openMonth.id,
      templateId
    }
  });
}

export async function attachIncomeTemplateToOpenMonth(templateId: string) {
  await syncIncomeTemplateToOpenMonth(templateId);
}

export async function syncCategoryTemplateToOpenMonth(templateId: string) {
  const openMonth = await ensureOpenMonth();
  const template = await prisma.categoryTemplate.findUnique({ where: { id: templateId } });

  if (!template || template.type === CategoryType.IMPREVISTA) {
    return;
  }

  if (!template.isActive) {
    await prisma.monthCategory.updateMany({
      where: {
        monthId: openMonth.id,
        templateId
      },
      data: {
        isActive: false,
        alertsEnabled: template.alertsEnabled,
        alertPercentage: template.alertPercentage
      }
    });
    return;
  }

  await prisma.monthCategory.upsert({
    where: {
      monthId_templateId: {
        monthId: openMonth.id,
        templateId
      }
    },
    update: {
      name: template.name,
      type: template.type,
      owner: template.owner,
      monthlyBudget: template.monthlyBudget,
      currency: template.currency,
      biweeklyControl: template.biweeklyControl,
      alertsEnabled: template.alertsEnabled,
      alertPercentage: template.alertPercentage,
      isActive: template.isActive
    },
    create: {
      monthId: openMonth.id,
      templateId,
      name: template.name,
      type: template.type,
      owner: template.owner,
      monthlyBudget: template.monthlyBudget,
      currency: template.currency,
      biweeklyControl: template.biweeklyControl,
      alertsEnabled: template.alertsEnabled,
      alertPercentage: template.alertPercentage,
      isActive: template.isActive,
      isOneOff: false
    }
  });
}

export async function attachCategoryTemplateToOpenMonth(templateId: string) {
  await syncCategoryTemplateToOpenMonth(templateId);
}

export async function createOneOffCategoryInOpenMonth(input: {
  name: string;
  owner: CategoryOwner;
  monthlyBudget: number;
  currency: Currency;
  biweeklyControl: boolean;
  alertsEnabled: boolean;
  alertPercentage: number;
}) {
  const openMonth = await ensureOpenMonth();
  return prisma.monthCategory.create({
    data: {
      monthId: openMonth.id,
      templateId: null,
      name: input.name,
      type: CategoryType.IMPREVISTA,
      owner: input.owner,
      monthlyBudget: input.monthlyBudget,
      currency: input.currency,
      biweeklyControl: input.biweeklyControl,
      alertsEnabled: input.alertsEnabled,
      alertPercentage: input.alertPercentage,
      isActive: true,
      isOneOff: true
    }
  });
}

export async function updateOneOffCategory(input: {
  categoryId: string;
  name: string;
  owner: CategoryOwner;
  monthlyBudget: number;
  currency: Currency;
  biweeklyControl: boolean;
  alertsEnabled: boolean;
  alertPercentage: number;
  isActive: boolean;
}) {
  const category = await prisma.monthCategory.findUnique({
    where: { id: input.categoryId },
    include: {
      month: {
        select: { status: true }
      }
    }
  });

  if (!category || !category.isOneOff || category.type !== CategoryType.IMPREVISTA) {
    throw new Error("Categoria imprevista no encontrada");
  }
  if (category.month.status === MonthStatus.CLOSED) {
    throw new Error("No se puede editar una categoria de un mes cerrado");
  }

  return prisma.monthCategory.update({
    where: { id: input.categoryId },
    data: {
      name: input.name,
      owner: input.owner,
      monthlyBudget: input.monthlyBudget,
      currency: input.currency,
      biweeklyControl: input.biweeklyControl,
      alertsEnabled: input.alertsEnabled,
      alertPercentage: input.alertPercentage,
      isActive: input.isActive
    }
  });
}

export async function deleteOneOffCategory(categoryId: string) {
  const category = await prisma.monthCategory.findUnique({
    where: { id: categoryId },
    include: {
      month: {
        select: { status: true }
      },
      expenses: {
        select: { id: true }
      }
    }
  });

  if (!category || !category.isOneOff || category.type !== CategoryType.IMPREVISTA) {
    throw new Error("Categoria imprevista no encontrada");
  }
  if (category.month.status === MonthStatus.CLOSED) {
    throw new Error("No se puede eliminar una categoria de un mes cerrado");
  }

  if (category.expenses.length > 0) {
    await prisma.monthCategory.update({
      where: { id: category.id },
      data: { isActive: false }
    });
    return { softDeleted: true };
  }

  await prisma.monthCategory.delete({ where: { id: category.id } });
  return { softDeleted: false };
}

function summarizeCategory(
  category: MonthWithData["categories"][number],
  monthStart: Date,
  exchangeRate: number,
  activeFortnight: 1 | 2,
  elapsedFortnightDays: number,
  fullFortnightDays: number
): CategorySummary {
  const budget = toNumber(category.monthlyBudget);
  const biweeklyBudget = budget / 2;
  const bounds = fortnightBounds(monthStart, activeFortnight);

  let spent = 0;
  let biweeklySpent = 0;

  for (const expense of category.expenses) {
    const converted = convertCurrency(toNumber(expense.amount), expense.currency, category.currency, exchangeRate);
    spent += converted;

    const expenseDay = dayOfMonthUTC(expense.spentAt);
    if (expenseDay >= bounds.startDay && expenseDay <= bounds.endDay) {
      biweeklySpent += converted;
    }
  }

  const available = budget - spent;
  const consumedPercent = budget > 0 ? (spent / budget) * 100 : 0;
  const alertColor: "green" | "yellow" | "red" = !category.alertsEnabled
    ? "green"
    : consumedPercent >= 100
      ? "red"
      : consumedPercent >= category.alertPercentage
        ? "yellow"
        : "green";

  const projectedFromFortnight =
    elapsedFortnightDays > 0 ? (biweeklySpent / elapsedFortnightDays) * fullFortnightDays * 2 : 0;

  return {
    id: category.id,
    templateId: category.templateId,
    name: category.name,
    type: category.type,
    owner: category.owner,
    currency: category.currency,
    budget: round2(budget),
    spent: round2(spent),
    available: round2(available),
    consumedPercent: round2(consumedPercent),
    alertsEnabled: category.alertsEnabled,
    alertPercentage: category.alertPercentage,
    alertColor,
    isOneOff: category.isOneOff,
    biweeklyControl: category.biweeklyControl,
    biweekly: category.biweeklyControl
      ? {
          budget: round2(biweeklyBudget),
          spent: round2(biweeklySpent),
          available: round2(biweeklyBudget - biweeklySpent),
          projectedMonthly: round2(projectedFromFortnight),
          fortnight: activeFortnight
        }
      : null
  };
}

function getMonthProgressContext(month: MonthWithData, referenceDate: Date) {
  const monthStart = month.monthStart;
  const monthDays = daysInMonthUTC(monthStart);
  const monthIsCurrent = isSameMonthUTC(monthStart, monthStartOf(referenceDate));
  const refDay = dayOfMonthUTC(referenceDate);

  const activeFortnight: 1 | 2 =
    month.status === MonthStatus.CLOSED || !monthIsCurrent ? 2 : currentFortnight(referenceDate);
  const fortnightMeta = fortnightBounds(monthStart, activeFortnight);

  let elapsedDays = monthDays;
  let elapsedFortnightDays = fortnightMeta.days;

  if (month.status === MonthStatus.OPEN && monthIsCurrent) {
    elapsedDays = Math.max(1, Math.min(monthDays, refDay));
    elapsedFortnightDays =
      activeFortnight === 1 ? Math.max(1, Math.min(15, refDay)) : Math.max(1, Math.min(fortnightMeta.days, refDay - 15));
  }

  return {
    monthDays,
    activeFortnight,
    elapsedDays,
    elapsedFortnightDays,
    fullFortnightDays: fortnightMeta.days
  };
}

function getContributorFortnight(month: MonthWithData, referenceDate: Date): 1 | 2 {
  const monthIsCurrent = isSameMonthUTC(month.monthStart, monthStartOf(referenceDate));
  if (month.status === MonthStatus.CLOSED || !monthIsCurrent) {
    return 2;
  }

  const hasFirstPreclosure = month.preclosures.some((item) => item.fortnight === 1);
  if (hasFirstPreclosure) {
    return 2;
  }

  return currentFortnight(referenceDate);
}

function getCarryoverAdjustment(
  preclosures: MonthWithData["preclosures"],
  owner: ContributorKey,
  activeFortnight: 1 | 2
) {
  if (activeFortnight !== 2) {
    return 0;
  }

  const previous = preclosures.find((item) => item.fortnight === 1);
  if (!previous) {
    return 0;
  }

  const snapshot = previous.snapshot as {
    contributors?: Record<ContributorKey, { balanceBiweeklyCRC?: number }>;
  };
  const balance = snapshot?.contributors?.[owner]?.balanceBiweeklyCRC;
  if (typeof balance !== "number") {
    return 0;
  }

  return balance;
}

function buildDashboardFromMonth(month: MonthWithData, exchangeRate: number, referenceDate = new Date()) {
  const progress = getMonthProgressContext(month, referenceDate);
  const contributorFortnight = getContributorFortnight(month, referenceDate);

  const incomeTotals = emptySplitTotals();
  const totalIncomeCRC = month.incomes.reduce((sum, income) => {
    const amountCRC = toCRC(toNumber(income.amount), income.currency, exchangeRate);
    addSplitTotals(incomeTotals, resolveIncomeOwner(income.owner, income.name), amountCRC);
    return sum + amountCRC;
  }, 0);

  const expenseTotals = emptySplitTotals();
  const expenseFortnightTotals = emptySplitTotals();
  const expenseDetails: Record<ContributorKey, ContributorExpenseDetail[]> = {
    JOHAN: [],
    WENDY: []
  };
  const contributorBounds = fortnightBounds(month.monthStart, contributorFortnight);

  const totalExpenseCRC = month.expenses.reduce((sum, expense) => {
    const amount = toNumber(expense.amount);
    const amountCRC = toCRC(amount, expense.currency, exchangeRate);
    const split = splitByOwner(expense.category.owner, amountCRC);
    const day = dayOfMonthUTC(expense.spentAt);
    const inFortnight = day >= contributorBounds.startDay && day <= contributorBounds.endDay;

    if (split.JOHAN > 0) {
      expenseTotals.JOHAN += split.JOHAN;
      if (inFortnight) {
        expenseFortnightTotals.JOHAN += split.JOHAN;
      }
      expenseDetails.JOHAN.push({
        id: expense.id,
        categoryName: expense.category.name,
        spentAt: expense.spentAt,
        amount,
        currency: expense.currency,
        owner: expense.category.owner,
        shareCRC: split.JOHAN,
        comment: expense.comment
      });
    }

    if (split.WENDY > 0) {
      expenseTotals.WENDY += split.WENDY;
      if (inFortnight) {
        expenseFortnightTotals.WENDY += split.WENDY;
      }
      expenseDetails.WENDY.push({
        id: expense.id,
        categoryName: expense.category.name,
        spentAt: expense.spentAt,
        amount,
        currency: expense.currency,
        owner: expense.category.owner,
        shareCRC: split.WENDY,
        comment: expense.comment
      });
    }

    return sum + amountCRC;
  }, 0);

  const projectedExpenseCRC =
    progress.elapsedDays > 0 ? (totalExpenseCRC / progress.elapsedDays) * progress.monthDays : totalExpenseCRC;
  const projectedBalanceCRC = totalIncomeCRC - projectedExpenseCRC;
  const balanceCRC = totalIncomeCRC - totalExpenseCRC;

  const globalConsumptionPercent = totalIncomeCRC > 0 ? (totalExpenseCRC / totalIncomeCRC) * 100 : 0;
  const globalIndicator: "green" | "yellow" | "red" =
    globalConsumptionPercent >= 100
      ? "red"
      : globalConsumptionPercent >= GLOBAL_WARNING_PERCENTAGE
        ? "yellow"
        : "green";

  const categories = month.categories.map((category) =>
    summarizeCategory(
      category,
      month.monthStart,
      exchangeRate,
      progress.activeFortnight,
      progress.elapsedFortnightDays,
      progress.fullFortnightDays
    )
  );

  const contributors = {
    activeFortnight: contributorFortnight,
    JOHAN: buildContributorSummary("JOHAN"),
    WENDY: buildContributorSummary("WENDY")
  };

  function buildContributorSummary(owner: ContributorKey) {
    const incomeMonthly = incomeTotals[owner];
    const incomeBiweekly = incomeMonthly / 2;
    const expenseMonthly = expenseTotals[owner];
    const expenseBiweekly = expenseFortnightTotals[owner];
    const carryoverAdjustment = getCarryoverAdjustment(month.preclosures, owner, contributorFortnight);

    return {
      incomeMonthlyCRC: round2(incomeMonthly),
      incomeBiweeklyCRC: round2(incomeBiweekly),
      expenseMonthlyCRC: round2(expenseMonthly),
      expenseBiweeklyCRC: round2(expenseBiweekly),
      balanceMonthlyCRC: round2(incomeMonthly - expenseMonthly),
      balanceBiweeklyCRC: round2(incomeBiweekly + carryoverAdjustment - expenseBiweekly),
      carryoverAdjustmentCRC: round2(carryoverAdjustment),
      expenseDetails: expenseDetails[owner].map((detail) => ({
        ...detail,
        amount: round2(detail.amount),
        shareCRC: round2(detail.shareCRC)
      }))
    };
  }

  return {
    month: {
      id: month.id,
      monthStart: month.monthStart,
      monthKey: formatMonthKey(month.monthStart),
      status: month.status
    },
    totals: {
      totalIncomeCRC: round2(totalIncomeCRC),
      totalExpenseCRC: round2(totalExpenseCRC),
      balanceCRC: round2(balanceCRC),
      projectedExpenseCRC: round2(projectedExpenseCRC),
      projectedBalanceCRC: round2(projectedBalanceCRC),
      globalConsumptionPercent: round2(globalConsumptionPercent),
      globalIndicator
    },
    categories,
    contributors,
    incomes: month.incomes.map((income) => ({
      id: income.id,
      templateId: income.templateId,
      name: income.name,
      amount: round2(toNumber(income.amount)),
      currency: income.currency,
      frequency: income.frequency,
      occurrenceNumber: income.occurrenceNumber,
      owner: resolveIncomeOwner(income.owner, income.name)
    })),
    expenses: month.expenses.map((expense) => ({
      id: expense.id,
      categoryId: expense.categoryId,
      categoryName: expense.category.name,
      amount: round2(toNumber(expense.amount)),
      currency: expense.currency,
      paidBy: expense.paidBy,
      categoryOwner: expense.category.owner,
      spentAt: expense.spentAt,
      comment: expense.comment
    })),
    preclosures: month.preclosures
  };
}

async function getMonthByIdOrOpen(monthId?: string) {
  const targetMonth = monthId
    ? await prisma.budgetMonth.findUnique({
        where: { id: monthId },
        include: monthInclude
      })
    : await prisma.budgetMonth.findFirst({
        where: { status: MonthStatus.OPEN },
        orderBy: { monthStart: "desc" },
        include: monthInclude
      });

  if (targetMonth) {
    return targetMonth;
  }

  const openMonth = await ensureOpenMonth();
  return prisma.budgetMonth.findUniqueOrThrow({
    where: { id: openMonth.id },
    include: monthInclude
  });
}

export async function getDashboardData(monthId?: string) {
  const settings = await ensureSettings();
  const month = await getMonthByIdOrOpen(monthId);
  const dashboard = buildDashboardFromMonth(month, toNumber(settings.exchangeRate));

  return {
    settings: {
      exchangeRate: round2(toNumber(settings.exchangeRate))
    },
    ...dashboard
  };
}

export async function closeCurrentMonth() {
  const settings = await ensureSettings();
  const exchangeRate = toNumber(settings.exchangeRate);

  return prisma.$transaction(async (tx) => {
    const openMonth = await tx.budgetMonth.findFirst({
      where: { status: MonthStatus.OPEN },
      orderBy: { monthStart: "desc" },
      include: monthInclude
    });

    if (!openMonth) {
      throw new Error("No hay un mes abierto para cerrar");
    }

    const snapshot = {
      generatedAt: new Date().toISOString(),
      exchangeRate,
      ...buildDashboardFromMonth(openMonth, exchangeRate, new Date())
    };

    await tx.budgetMonth.update({
      where: { id: openMonth.id },
      data: {
        status: MonthStatus.CLOSED,
        closedAt: new Date()
      }
    });

    await tx.monthClosure.upsert({
      where: { monthId: openMonth.id },
      update: { snapshot, closedAt: new Date() },
      create: {
        monthId: openMonth.id,
        snapshot,
        closedAt: new Date()
      }
    });

    const nextMonthStart = addMonthsUTC(openMonth.monthStart, 1);
    const nextMonth = await createMonthWithSnapshots(nextMonthStart, tx);

    return {
      closedMonthId: openMonth.id,
      nextMonthId: nextMonth.id,
      nextMonthStart
    };
  });
}

export async function generateFortnightPreclosure(input: { monthId?: string; fortnight?: 1 | 2 }) {
  const settings = await ensureSettings();
  const exchangeRate = toNumber(settings.exchangeRate);
  const month = await getMonthByIdOrOpen(input.monthId);

  const referenceDate = new Date();
  const targetFortnight =
    input.fortnight ?? (month.status === MonthStatus.CLOSED ? 2 : currentFortnight(referenceDate));
  const bounds = fortnightBounds(month.monthStart, targetFortnight);

  const partialExpenses = month.expenses
    .filter((expense) => {
      const day = dayOfMonthUTC(expense.spentAt);
      return day >= bounds.startDay && day <= bounds.endDay;
    })
    .reduce((sum, expense) => sum + toCRC(toNumber(expense.amount), expense.currency, exchangeRate), 0);

  const incomeTotals = emptySplitTotals();
  const totalIncomeCRC = month.incomes.reduce((sum, income) => {
    const amountCRC = toCRC(toNumber(income.amount), income.currency, exchangeRate);
    addSplitTotals(incomeTotals, resolveIncomeOwner(income.owner, income.name), amountCRC);
    return sum + amountCRC;
  }, 0);

  const expenseTotals = emptySplitTotals();
  for (const expense of month.expenses) {
    const day = dayOfMonthUTC(expense.spentAt);
    if (day < bounds.startDay || day > bounds.endDay) {
      continue;
    }
    const amountCRC = toCRC(toNumber(expense.amount), expense.currency, exchangeRate);
    addSplitTotals(expenseTotals, expense.category.owner, amountCRC);
  }

  const contributors = {
    JOHAN: buildContributorPreclosure("JOHAN"),
    WENDY: buildContributorPreclosure("WENDY")
  };

  function buildContributorPreclosure(owner: ContributorKey) {
    const incomeMonthly = incomeTotals[owner];
    const incomeBiweekly = incomeMonthly / 2;
    const expenseBiweekly = expenseTotals[owner];
    const carryoverAdjustment = getCarryoverAdjustment(month.preclosures, owner, targetFortnight);
    const balanceBiweekly = incomeBiweekly + carryoverAdjustment - expenseBiweekly;

    return {
      incomeMonthlyCRC: round2(incomeMonthly),
      incomeBiweeklyCRC: round2(incomeBiweekly),
      expenseBiweeklyCRC: round2(expenseBiweekly),
      balanceBiweeklyCRC: round2(balanceBiweekly),
      carryoverAdjustmentCRC: round2(carryoverAdjustment)
    };
  }

  const payload = {
    monthId: month.id,
    monthKey: formatMonthKey(month.monthStart),
    fortnight: targetFortnight,
    generatedAt: new Date().toISOString(),
    totalIncomeCRC: round2(totalIncomeCRC),
    partialExpenseCRC: round2(partialExpenses),
    partialBalanceCRC: round2(totalIncomeCRC - partialExpenses),
    contributors
  };

  await prisma.fortnightPreclosure.create({
    data: {
      monthId: month.id,
      fortnight: targetFortnight,
      snapshot: payload
    }
  });

  return payload;
}

export async function getHistoryData(limit = 12) {
  await ensureOpenMonth();
  const settings = await ensureSettings();
  const exchangeRate = toNumber(settings.exchangeRate);

  const months = await prisma.budgetMonth.findMany({
    orderBy: { monthStart: "desc" },
    take: limit,
    include: {
      closure: true,
      incomes: true,
      expenses: true
    }
  });

  return months.map((month) => {
    const snapshot = month.closure?.snapshot as { totals?: { totalIncomeCRC?: number; totalExpenseCRC?: number } } | undefined;

    const incomeCRC =
      snapshot?.totals?.totalIncomeCRC ??
      month.incomes.reduce((sum, income) => sum + toCRC(toNumber(income.amount), income.currency, exchangeRate), 0);
    const expenseCRC =
      snapshot?.totals?.totalExpenseCRC ??
      month.expenses.reduce((sum, expense) => sum + toCRC(toNumber(expense.amount), expense.currency, exchangeRate), 0);

    return {
      id: month.id,
      monthStart: month.monthStart,
      monthKey: formatMonthKey(month.monthStart),
      status: month.status,
      totalIncomeCRC: round2(incomeCRC),
      totalExpenseCRC: round2(expenseCRC),
      balanceCRC: round2(incomeCRC - expenseCRC)
    };
  });
}

export async function getMonthSummary(monthId: string) {
  const settings = await ensureSettings();
  const month = await prisma.budgetMonth.findUnique({
    where: { id: monthId },
    include: monthInclude
  });

  if (!month) {
    throw new Error("Mes no encontrado");
  }

  return {
    settings: { exchangeRate: round2(toNumber(settings.exchangeRate)) },
    ...buildDashboardFromMonth(month, toNumber(settings.exchangeRate))
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
export type HistoryData = Awaited<ReturnType<typeof getHistoryData>>;
export type MonthSummaryData = Awaited<ReturnType<typeof getMonthSummary>>;
