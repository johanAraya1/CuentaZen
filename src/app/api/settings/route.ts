import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { assertApiAccess, setAuthCookie } from "@/lib/auth";
import { getCurrentSessionToken, ensureSettings, updateSettings } from "@/lib/settings";
import { toNumber } from "@/lib/currency";
import { settingsSchema } from "@/lib/validators";

export async function GET() {
  const unauthorized = await assertApiAccess();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const settings = await ensureSettings();
    return NextResponse.json({
      exchangeRate: toNumber(settings.exchangeRate)
    });
  } catch (error) {
    return jsonError(error, "No se pudo cargar la configuracion");
  }
}

export async function PUT(request: Request) {
  const unauthorized = await assertApiAccess();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = await request.json();
    const payload = settingsSchema.parse(body);

    const updated = await updateSettings({
      exchangeRate: payload.exchangeRate,
      newGlobalKey: payload.newGlobalKey
    });

    const token = await getCurrentSessionToken();
    const response = NextResponse.json({
      ok: true,
      exchangeRate: toNumber(updated.exchangeRate)
    });
    setAuthCookie(response, token);
    return response;
  } catch (error) {
    return jsonError(error, "No se pudo actualizar la configuracion");
  }
}
