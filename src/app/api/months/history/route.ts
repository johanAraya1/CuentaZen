import { jsonError } from "@/lib/api";
import { assertApiAccess } from "@/lib/auth";
import { getHistoryData } from "@/lib/budget-service";

export async function GET() {
  const unauthorized = await assertApiAccess();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const data = await getHistoryData(18);
    return Response.json(data);
  } catch (error) {
    return jsonError(error, "No se pudo cargar el historial");
  }
}
