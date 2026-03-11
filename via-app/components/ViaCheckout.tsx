"use client";

import { FormEvent, useState } from "react";
import {
  ExpressCheckoutElement,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

export default function ViaCheckout({ amount }: { amount: number }) {
  const stripe = useStripe();
  const elements = useElements();

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function confirmNow() {
    if (!stripe || !elements) return;

    setSubmitting(true);
    setErrorMessage("");

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
    });

    if (error) {
      setErrorMessage(error.message ?? "Payment failed.");
      setSubmitting(false);
      return;
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await confirmNow();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="mb-2 text-xs tracking-[0.25em] text-white/45">FAST PAY</div>
        <ExpressCheckoutElement
          onConfirm={async () => {
            await confirmNow();
          }}
        />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="mb-2 text-xs tracking-[0.25em] text-white/45">CARD OR OTHER METHODS</div>
        <PaymentElement />
      </div>

      <div className="text-sm text-white/60">
        Total: ${amount.toFixed(2)}
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {errorMessage}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={!stripe || !elements || submitting}
        className="w-full rounded-2xl bg-white px-4 py-4 font-semibold text-black disabled:opacity-50"
      >
        {submitting ? "Processing..." : "Pay with VIA"}
      </button>
    </form>
  );
}