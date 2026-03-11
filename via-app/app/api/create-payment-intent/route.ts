import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // Use the latest API version your installed Stripe SDK supports.
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawAmount = Number(body.amount);

    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      return Response.json({ error: "Invalid amount" }, { status: 400 });
    }

    const amount = Math.round(rawAmount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return Response.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("create-payment-intent error", error);
    return Response.json(
      { error: "Failed to create payment intent" },
      { status: 500 }
    );
  }
}