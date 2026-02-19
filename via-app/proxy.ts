import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PREFIXES = ["/setup", "/create", "/claim"];

export default async function proxy(req: NextRequest) {
  const { pathname, origin, search } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) =>
    pathname.startsWith(p)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  // ✅ DEV BYPASS (requires BOTH env var AND ?dev=1)
  const dev =
    req.nextUrl.searchParams.get("dev") === "1";

  const devBypass =
    process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "1" && dev;

  if (devBypass) {
    return NextResponse.next();
  }

  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set(
      "returnTo",
      `${pathname}${search || ""}`
    );
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: ["/setup/:path*", "/create/:path*", "/claim/:path*"],
};
