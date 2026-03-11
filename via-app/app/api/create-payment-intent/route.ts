import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

function toCents(amount: number) {
  return Math.round(amount * 100);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const cardId = String(body?.cardId ?? "").trim().toUpperCase();
    const rawAmount = Number(body?.amount);

    if (!cardId) {
      return NextResponse.json({ error: "Missing cardId" }, { status: 400 });
    }

    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const amount = toCents(rawAmount);

    if (amount < 50) {
      return NextResponse.json(
        { error: "Minimum payment is $0.50" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select(
        "id, display_name, stripe_account_id, stripe_connected, via_payments_enabled, is_premium"
      )
      .eq("id", cardId)
      .maybeSingle();

    if (cardError || !card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    if (!card.is_premium) {
      return NextResponse.json({ error: "Premium required" }, { status: 403 });
    }

    if (!card.stripe_account_id) {
      return NextResponse.json(
        { error: "Stripe account not connected" },
        { status: 403 }
      );
    }

    if (!card.stripe_connected) {
      return NextResponse.json(
        { error: "Stripe onboarding not complete" },
        { status: 403 }
      );
    }

    if (!card.via_payments_enabled) {
      return NextResponse.json(
        { error: "Payments are not enabled for this card" },
        { status: 403 }
      );
    }

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          cardId,
          displayName: card.display_name ?? "",
        },
      },
      {
        stripeAccount: card.stripe_account_id,
      }
    );

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      stripeAccountId: card.stripe_account_id,
    });
  } catch (error: any) {
    console.error("create-payment-intent error", error);

    return NextResponse.json(
      { error: error?.message ?? "Failed to create payment intent" },
      { status: 500 }
    );
  }
}