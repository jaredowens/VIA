import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cardId = String(searchParams.get("cardId") ?? "").trim().toUpperCase();

    if (!cardId) {
      return NextResponse.json({ error: "Missing cardId" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: card, error } = await supabase
      .from("cards")
      .select("id, stripe_account_id")
      .eq("id", cardId)
      .maybeSingle();

    if (error || !card || !card.stripe_account_id) {
      return NextResponse.json(
        { error: "Card or Stripe account not found" },
        { status: 404 }
      );
    }

    const domains = await stripe.paymentMethodDomains.list(
      {},
      { stripeAccount: card.stripe_account_id }
    );

    return NextResponse.json({
      cardId,
      stripeAccountId: card.stripe_account_id,
      domains: domains.data.map((d) => ({
        id: d.id,
        domain_name: d.domain_name,
        enabled: d.enabled,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to check domains" },
      { status: 500 }
    );
  }
}