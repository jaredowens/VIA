import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cardId = String(body?.cardId ?? "").trim().toUpperCase();
    const userId = String(body?.userId ?? "").trim();

    if (!cardId) {
      return NextResponse.json({ error: "Missing cardId" }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: card, error } = await supabase
      .from("cards")
      .select("owner_user_id")
      .eq("id", cardId)
      .maybeSingle();

    if (error || !card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    if (card.owner_user_id !== userId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { error: updateError } = await supabase
      .from("cards")
      .update({
        status: "unclaimed",
        owner_user_id: null,
        claimed_at: null,
        display_name: null,
        bio: null,
        photo_url: null,
        payments_json: null,
        stripe_account_id: null,
        stripe_connected: false,
        via_payments_enabled: false,
        is_premium: false,
        accent_color: null,
        premium_verified: false,
        button_style: "pill",
        accent_glow: true,
        bg_style: "default",
        bg_color: null,
        bg_color_2: null,
        pay_btn_accent: "none",
        show_phone: true,
        show_email: true,
        show_save_contact: true,
        pay_label: null,
      })
      .eq("id", cardId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to reset card" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}