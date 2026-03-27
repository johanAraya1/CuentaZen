import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonError(error: unknown, fallbackMessage = "Error interno", status = 500) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Datos invalidos",
        details: error.issues.map((issue) => issue.message)
      },
      { status: 400 }
    );
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message || fallbackMessage }, { status });
  }

  return NextResponse.json({ error: fallbackMessage }, { status });
}

export function jsonOk<T>(payload: T) {
  return NextResponse.json(payload);
}
