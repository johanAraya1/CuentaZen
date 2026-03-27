import { jsonError } from "@/lib/api";
import { assertApiAccess } from "@/lib/auth";
import { getDashboardData } from "@/lib/budget-service";

export async function GET(request: Request) {
  const unauthorized = await assertApiAccess();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const url = new URL(request.url);
    const monthId = url.searchParams.get("monthId") ?? undefined;
    const payload = await getDashboardData(monthId);
    return Response.json(payload);
  } catch (error) {
    return jsonError(error, "No se pudo cargar el dashboard");
  }
}
