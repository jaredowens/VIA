import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function POST(req: Request) {
  try {
    const { cardId } = (await req.json()) as { cardId?: string };
    if (!cardId) return new NextResponse("Missing cardId", { status: 400 });

    const token = getBearerToken(req);
    if (!token) return new NextResponse("Unauthorized", { status: 401 });

    // Create a client that acts as the user (RLS will apply)
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

    // Validate token → get user
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Atomic claim: only succeeds if owner_user_id is still null
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

    if (error) return new NextResponse(error.message, { status: 400 });

    // If no row updated, it was already claimed or invalid id
    if (!data) {
      // Decide if it's missing vs already claimed
      const { data: exists } = await supabase
        .from("cards")
        .select("id, owner_user_id")
        .eq("id", cardId)
        .maybeSingle();

      if (!exists) return new NextResponse("Card not found", { status: 404 });
      return new NextResponse("Already claimed", { status: 409 });
    }

    return NextResponse.json({ ok: true, card: data });
  } catch (e: any) {
    return new NextResponse(e?.message ?? "Unknown error", { status: 500 });
  }
}