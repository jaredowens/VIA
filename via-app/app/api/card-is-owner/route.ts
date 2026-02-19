import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/src/lib/supabase/server";


export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cardId = searchParams.get("cardId");

    if (!cardId) {
      return NextResponse.json({ error: "Missing cardId" }, { status: 400 });
    }

    const supabase = await createSupabaseServer();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Not signed in = not owner
    if (!user) {
      return NextResponse.json({ signedIn: false, isOwner: false });
    }

    const { data: card, error } = await supabase
      .from("cards")
      .select("owner_user_id")
      .eq("id", cardId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    return NextResponse.json({
      signedIn: true,
      isOwner: card.owner_user_id === user.id,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
