import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Helper to extract Bearer token
function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function POST(req: Request) {
  try {
    // ✅ DEV BYPASS (must be inside POST)
    const dev =
      new URL(req.url).searchParams.get("dev") === "1";

    const devBypass =
      process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "1" && dev;

    const { cardId } = (await req.json()) as { cardId?: string };
    if (!cardId) {
      return new NextResponse("Missing cardId", { status: 400 });
    }

    // 🚀 If dev bypass → skip auth entirely
    if (devBypass) {
      return NextResponse.json({
        ok: true,
        devBypass: true,
      });
    }

    // 🔐 Normal auth flow
    const token = getBearerToken(req);
    if (!token) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const { data: userData, error: userErr } =
      await supabase.auth.getUser();

    if (userErr || !userData.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { data, error } = await supabase
      .from("cards")
      .update({
        owner_user_id: userData.user.id,
        claimed_at: new Date().toISOString(),
      })
      .eq("id", cardId)
      .is("owner_user_id", null)
      .select("id, owner_user_id")
      .maybeSingle();

    if (error) {
      return new NextResponse(error.message, { status: 400 });
    }

    if (!data) {
      const { data: exists } = await supabase
        .from("cards")
        .select("id, owner_user_id")
        .eq("id", cardId)
        .maybeSingle();

      if (!exists) {
        return new NextResponse("Card not found", { status: 404 });
      }

      return new NextResponse("Already claimed", { status: 409 });
    }

    return NextResponse.json({ ok: true, card: data });
  } catch (e: any) {
    return new NextResponse(
      e?.message ?? "Unknown error",
      { status: 500 }
    );
  }
}
