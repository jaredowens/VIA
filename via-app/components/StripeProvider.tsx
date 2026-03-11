"use client";

import { ReactNode, useMemo } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

export default function StripeProvider({
  clientSecret,
  stripeAccountId,
  children,
}: {
  clientSecret: string;
  stripeAccountId: string;
  children: ReactNode;
}) {
  const stripePromise = useMemo(() => {
    return loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!, {
      stripeAccount: stripeAccountId,
    });
  }, [stripeAccountId]);

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "night",
          variables: {
            borderRadius: "16px",
          },
        },
      }}
    >
      {children}
    </Elements>
  );
}