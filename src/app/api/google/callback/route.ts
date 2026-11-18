import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode, primaryCalendarId } from "@/lib/google";

export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const fail = (reason: string) => {
    const res = NextResponse.redirect(`${origin}/calendario?gcal=${reason}`);
    res.cookies.delete({ name: "g_oauth_state", path: "/api/google" });
    return res;
  };

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (searchParams.get("error") || !code) return fail("cancelado");
  if (!state || state !== request.cookies.get("g_oauth_state")?.value) return fail("error");

  try {
    const tokens = await exchangeCode(code, origin);
    if (!tokens.refresh_token) return fail("error");
    const email = await primaryCalendarId(tokens.access_token);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(`${origin}/login`);
    const { error } = await supabase.from("google_accounts").upsert({
      user_id: user.id,
      email,
      refresh_token: tokens.refresh_token,
      calendar_id: "primary",
    });
    if (error) throw error;
  } catch (err) {
    console.error("Google OAuth:", err);
    return fail("error");
  }

  const res = NextResponse.redirect(`${origin}/calendario?gcal=conectado`);
  res.cookies.delete({ name: "g_oauth_state", path: "/api/google" });
  return res;
}
