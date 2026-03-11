import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const { cardId } = await req.json();

    if (!cardId) {
      return NextResponse.json({ error: "Missing cardId" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const normalizedCardId = String(cardId).trim().toUpperCase();

    const { data: card, error } = await supabase
      .from("cards")
      .select("id, stripe_account_id")
      .eq("id", normalizedCardId)
      .maybeSingle();

    if (error || !card || !card.stripe_account_id) {
      return NextResponse.json({ connected: false });
    }

    const account = await stripe.accounts.retrieve(card.stripe_account_id);

    const connected = Boolean(account.charges_enabled && account.payouts_enabled);

    await supabase
      .from("cards")
      .update({ stripe_connected: connected })
      .eq("id", normalizedCardId);

    return NextResponse.json({
      connected,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    });
  } catch (error: any) {
    console.error("stripe status route error", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to check Stripe status" },
      { status: 500 }
    );
  }
}