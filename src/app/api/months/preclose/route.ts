import { jsonError } from "@/lib/api";
import { assertApiAccess } from "@/lib/auth";
import { generateFortnightPreclosure } from "@/lib/budget-service";
import { precloseSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const unauthorized = await assertApiAccess();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const parsed = precloseSchema.parse(await request.json().catch(() => ({})));
    const payload = await generateFortnightPreclosure({
      fortnight: parsed.fortnight as 1 | 2 | undefined
    });
    return Response.json(payload);
  } catch (error) {
    return jsonError(error, "No se pudo generar el precierre");
  }
}
