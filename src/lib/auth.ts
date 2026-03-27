import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME } from "@/lib/constants";
import { isSessionTokenValid } from "@/lib/settings";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function setAuthCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE
  });
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0)
  });
}

export async function hasValidSessionFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  return isSessionTokenValid(token);
}

export async function requirePageAccess() {
  const valid = await hasValidSessionFromCookies();
  if (!valid) {
    redirect("/unlock");
  }
}

export async function assertApiAccess() {
  const valid = await hasValidSessionFromCookies();
  if (!valid) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  return null;
}
