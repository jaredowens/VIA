"use client";

import { FormEvent, useState } from "react";
import {
  ExpressCheckoutElement,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

export default function ViaCheckout() {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

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

    setSubmitting(false);
  }

  async function handleExpressConfirm() {
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

    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ExpressCheckoutElement onConfirm={handleExpressConfirm} />
      <PaymentElement />

      {errorMessage ? (
        <div className="text-sm text-red-400">{errorMessage}</div>
      ) : null}

      <button
        type="submit"
        disabled={!stripe || !elements || submitting}
        className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-black disabled:opacity-50"
      >
        {submitting ? "Processing..." : "Pay with VIA"}
      </button>
    </form>
  );
}