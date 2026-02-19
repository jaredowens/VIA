import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const RETURN_COOKIE = "via_returnTo";

function readCookie(cookieHeader: string, name: string) {
  const parts = cookieHeader.split(";").map((c) => c.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) {
      return decodeURIComponent(p.slice(name.length + 1));
    }
  }
  return "";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const returnToFromQuery = url.searchParams.get("returnTo") || "";

  if (!code) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  // Decide destination later; start with a safe fallback
  const fallbackDest = "/auth/finish";
  const response = NextResponse.redirect(new URL(fallbackDest, url.origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Route handlers don't have cookie helpers like middleware,
        // so we parse from the request header.
        getAll() {
          const cookieHeader = req.headers.get("cookie") || "";
          if (!cookieHeader) return [];
          return cookieHeader.split(";").map((c) => {
            const [name, ...rest] = c.trim().split("=");
            return { name, value: decodeURIComponent(rest.join("=")) };
          });
        },
        setAll(cookiesToSet) {
          // Write auth cookies onto the redirect response
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  // Determine return target:
  // 1) query param returnTo (if present)
  // 2) cookie via_returnTo (set on login page)
  // 3) /auth/finish (localStorage fallback)
  const cookieHeader = req.headers.get("cookie") || "";
  const returnToFromCookie = cookieHeader ? readCookie(cookieHeader, RETURN_COOKIE) : "";

  // Clear the return cookie now that we're signed in
  response.cookies.set(RETURN_COOKIE, "", { path: "/", maxAge: 0, sameSite: "lax" });

  const dest = returnToFromQuery || returnToFromCookie || fallbackDest;

  // Update redirect location (keep cookies already set on `response`)
  response.headers.set("Location", new URL(dest, url.origin).toString());

  return response;
}