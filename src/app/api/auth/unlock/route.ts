import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { setAuthCookie } from "@/lib/auth";
import { getCurrentSessionToken, verifyGlobalKey } from "@/lib/settings";
import { unlockSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key } = unlockSchema.parse(body);

    const valid = await verifyGlobalKey(key);
    if (!valid) {
      return NextResponse.json({ error: "Clave incorrecta" }, { status: 401 });
    }

    const token = await getCurrentSessionToken();
    const response = NextResponse.json({ ok: true });
    setAuthCookie(response, token);

    return response;
  } catch (error) {
    return jsonError(error, "No se pudo desbloquear");
  }
}
