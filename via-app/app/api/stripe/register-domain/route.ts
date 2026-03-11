import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const { cardId } = await req.json();

    const normalizedCardId = String(cardId ?? "").trim().toUpperCase();

    if (!normalizedCardId) {
      return NextResponse.json({ error: "Missing cardId" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: card, error } = await supabase
      .from("cards")
      .select("id, stripe_account_id")
      .eq("id", normalizedCardId)
      .maybeSingle();

    if (error || !card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    if (!card.stripe_account_id) {
      return NextResponse.json(
        { error: "No connected Stripe account found" },
        { status: 400 }
      );
    }

    const domains = [
      "dev.viacard.co",
      "viacard.co",
      "www.viacard.co",
    ];

    const results = [];

    for (const domain of domains) {
      try {
        const created = await stripe.paymentMethodDomains.create(
          { domain_name: domain },
          { stripeAccount: card.stripe_account_id }
        );

        results.push({
          domain,
          ok: true,
          id: created.id,
        });
      } catch (err: any) {
        const msg = String(err?.message ?? "");

        if (
          msg.toLowerCase().includes("already exists") ||
          msg.toLowerCase().includes("already been registered")
        ) {
          results.push({
            domain,
            ok: true,
            alreadyRegistered: true,
          });
        } else {
          results.push({
            domain,
            ok: false,
            error: msg,
          });
        }
      }
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error("register-domain error", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to register payment method domain" },
      { status: 500 }
    );
  }
}