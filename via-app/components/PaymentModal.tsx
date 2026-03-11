"use client";

import { useEffect, useMemo, useState } from "react";
import StripeProvider from "@/components/StripeProvider";
import ViaCheckout from "@/components/ViaCheckout";

type Props = {
  open: boolean;
  onClose: () => void;
  cardId: string;
  accentColor?: string | null;
};

export default function PaymentModal({
  open,
  onClose,
  cardId,
  accentColor,
}: Props) {
  const [amount, setAmount] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const parsedAmount = useMemo(() => {
    const n = Number(amount);
    return Number.isFinite(n) ? n : 0;
  }, [amount]);

  useEffect(() => {
    if (!open) {
      setAmount("");
      setClientSecret("");
      setLoadingIntent(false);
      setErrorMessage("");
    }
  }, [open]);

  if (!open) return null;

  async function startCheckout() {
    setErrorMessage("");
    setClientSecret("");

    if (!parsedAmount || parsedAmount <= 0) {
      setErrorMessage("Enter a valid amount.");
      return;
    }

    try {
      setLoadingIntent(true);

      const res = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cardId,
          amount: parsedAmount,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data?.error ?? "Could not start payment.");
        return;
      }

      setClientSecret(data.clientSecret);
    } catch {
      setErrorMessage("Network error. Please try again.");
    } finally {
      setLoadingIntent(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#121214]/95 p-5 shadow-[0_30px_120px_rgba(0,0,0,0.75)] backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs tracking-[0.35em] text-white/45">PAY THROUGH VIA</div>
            <div className="mt-1 text-lg font-semibold text-white">Enter amount</div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm text-white/75 hover:bg-white/10"
            type="button"
          >
            Close
          </button>
        </div>

        {!clientSecret ? (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm text-white/70">Amount</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/45">
                  $
                </span>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="w-full rounded-2xl border border-white/12 bg-white/5 py-4 pl-8 pr-4 text-white outline-none placeholder:text-white/30 focus:border-white/25"
                />
              </div>
              <p className="mt-2 text-xs text-white/40">Minimum payment: $0.50</p>
            </div>

            {errorMessage ? (
              <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
                {errorMessage}
              </div>
            ) : null}

            <button
              onClick={startCheckout}
              disabled={loadingIntent}
              type="button"
              className="w-full rounded-2xl px-4 py-4 font-semibold transition disabled:opacity-60"
              style={{
                backgroundColor: accentColor || "#7C3AED",
                color: "#FFFFFF",
              }}
            >
              {loadingIntent ? "Starting payment..." : "Continue to payment"}
            </button>
          </div>
        ) : (
          <StripeProvider clientSecret={clientSecret}>
            <ViaCheckout amount={parsedAmount} />
          </StripeProvider>
        )}
      </div>
    </div>
  );
}