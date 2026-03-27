import { Frequency } from "@prisma/client";
import { jsonError } from "@/lib/api";
import { assertApiAccess } from "@/lib/auth";
import { attachIncomeTemplateToOpenMonth, syncIncomeTemplateToOpenMonth } from "@/lib/budget-service";
import { monthStartOf } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { incomeTemplateSchema } from "@/lib/validators";
import { toNumber } from "@/lib/currency";

export async function GET() {
  const unauthorized = await assertApiAccess();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    let templates = await prisma.incomeTemplate.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    });

    const needsOwnerUpdate = templates.filter(
      (template) =>
        template.owner !== "WENDY" && template.name.toLowerCase().includes("wendy")
    );
    if (needsOwnerUpdate.length > 0) {
      await prisma.$transaction(
        needsOwnerUpdate.map((template) =>
          prisma.incomeTemplate.update({
            where: { id: template.id },
            data: { owner: "WENDY" }
          })
        )
      );
      await Promise.all(needsOwnerUpdate.map((template) => syncIncomeTemplateToOpenMonth(template.id)));
      const updateIds = new Set(needsOwnerUpdate.map((template) => template.id));
      templates = templates.map((template) =>
        updateIds.has(template.id) ? { ...template, owner: "WENDY" } : template
      );
    }

    return Response.json(
      templates.map((template) => ({
        id: template.id,
        name: template.name,
        amount: toNumber(template.amount),
        currency: template.currency,
        frequency: template.frequency,
        owner: template.owner,
        isActive: template.isActive,
        effectiveFrom: template.effectiveFrom,
        effectiveTo: template.effectiveTo
      }))
    );
  } catch (error) {
    return jsonError(error, "No se pudieron cargar los ingresos");
  }
}

export async function POST(request: Request) {
  const unauthorized = await assertApiAccess();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const payload = incomeTemplateSchema.parse(await request.json());
    const created = await prisma.incomeTemplate.create({
      data: {
        name: payload.name,
        amount: payload.amount,
        currency: payload.currency,
        frequency: payload.frequency ?? Frequency.MENSUAL,
        owner: payload.owner,
        isActive: payload.isActive,
        effectiveFrom: monthStartOf(new Date())
      }
    });

    if (created.isActive) {
      await attachIncomeTemplateToOpenMonth(created.id);
    }

    return Response.json({
      id: created.id,
      name: created.name,
      amount: toNumber(created.amount),
      currency: created.currency,
      frequency: created.frequency,
      owner: created.owner,
      isActive: created.isActive
    });
  } catch (error) {
    return jsonError(error, "No se pudo crear el ingreso");
  }
}
