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

    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("id, owner_user_id, display_name, stripe_account_id, is_premium")
      .eq("id", normalizedCardId)
      .maybeSingle();

    if (cardError || !card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    if (!card.owner_user_id) {
      return NextResponse.json({ error: "Card is unclaimed" }, { status: 403 });
    }

    if (!card.is_premium) {
      return NextResponse.json({ error: "Premium required" }, { status: 403 });
    }

    let accountId = card.stripe_account_id as string | null;

    if (!accountId) {
     const account = await stripe.accounts.create({
  type: "express",
  capabilities: {
    card_payments: { requested: true },
    transfers: { requested: true },
  },
});
      accountId = account.id;

      const { error: updateError } = await supabase
        .from("cards")
        .update({
          stripe_account_id: accountId,
          stripe_connected: false,
        })
        .eq("id", normalizedCardId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    const origin = new URL(req.url).origin;

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/c/${normalizedCardId}/customize?stripe=refresh`,
      return_url: `${origin}/c/${normalizedCardId}/customize?stripe=return`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error: any) {
    console.error("stripe connect route error", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to start Stripe onboarding" },
      { status: 500 }
    );
  }
}