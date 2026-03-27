import { jsonError } from "@/lib/api";
import { assertApiAccess } from "@/lib/auth";
import { closeCurrentMonth } from "@/lib/budget-service";

export async function POST() {
  const unauthorized = await assertApiAccess();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const payload = await closeCurrentMonth();
    return Response.json(payload);
  } catch (error) {
    return jsonError(error, "No se pudo cerrar el mes");
  }
}
