import { jsonError } from "@/lib/api";
import { assertApiAccess } from "@/lib/auth";
import { getMonthSummary } from "@/lib/budget-service";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Context) {
  const unauthorized = await assertApiAccess();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const { id } = await context.params;
    const summary = await getMonthSummary(id);
    return Response.json(summary);
  } catch (error) {
    return jsonError(error, "No se pudo cargar el resumen mensual");
  }
}
