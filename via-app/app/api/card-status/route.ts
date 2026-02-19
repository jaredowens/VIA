import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cardId = searchParams.get("cardId");

    if (!cardId) {
      return new NextResponse("Missing cardId", { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Public read (RLS select policy should allow this)
    const { data, error } = await supabase
      .from("cards")
      .select("owner_user_id")
      .eq("id", cardId)
      .maybeSingle();

    if (error) return new NextResponse(error.message, { status: 400 });
    if (!data) return new NextResponse("Card not found", { status: 404 });

    return NextResponse.json({
      isClaimed: !!data.owner_user_id,
    });
  } catch (err) {
    console.error("Card status error:", err);
    return new NextResponse("Server error", { status: 500 });
  }
}