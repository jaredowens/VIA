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

  // ✅ safer fallback than /enter
  const fallbackDest = "/";

  // We create a redirect response, but we’ll set the final Location after we resolve dest
  const response = NextResponse.redirect(new URL(fallbackDest, url.origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const cookieHeader = req.headers.get("cookie") || "";
          if (!cookieHeader) return [];
          return cookieHeader.split(";").map((c) => {
            const [name, ...rest] = c.trim().split("=");
            return { name, value: decodeURIComponent(rest.join("=")) };
          });
        },
        setAll(cookiesToSet) {
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

  const cookieHeader = req.headers.get("cookie") || "";
  const returnToFromCookie = cookieHeader
    ? readCookie(cookieHeader, RETURN_COOKIE)
    : "";

  // clear cookie after use
  response.cookies.set(RETURN_COOKIE, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
  });

  // allow only internal paths (safety)
  const rawDest = returnToFromQuery || returnToFromCookie || fallbackDest;
  const dest = rawDest.startsWith("/") ? rawDest : fallbackDest;

  response.headers.set("Location", new URL(dest, url.origin).toString());
  return response;
}
