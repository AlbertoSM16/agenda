import { NextResponse, type NextRequest } from "next/server";
import { authUrl, googleConfigured } from "@/lib/google";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  if (!googleConfigured()) return NextResponse.redirect(`${origin}/calendario?gcal=noconfig`);

  const state = crypto.randomUUID();
  const res = NextResponse.redirect(authUrl(origin, state));
  res.cookies.set("g_oauth_state", state, {
    httpOnly: true, secure: origin.startsWith("https"), sameSite: "lax", maxAge: 600, path: "/api/google",
  });
  return res;
}
