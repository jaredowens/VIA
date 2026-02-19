"use client";

import { use, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ClaimStatus = "checking" | "unclaimed" | "claimed" | "notfound" | "error";

export default function ClaimPage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = use(params);

  const [loading, setLoading] = useState(false);
  const [cardStatus, setCardStatus] = useState<ClaimStatus>("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function checkStatus() {
      try {
        const res = await fetch(
          `/api/card-status?cardId=${encodeURIComponent(cardId)}`,
          { cache: "no-store" }
        );

        if (!res.ok) {
          if (!cancelled) {
            setCardStatus(res.status === 404 ? "notfound" : "error");
            setMessage(
              res.status === 404 ? "Card not found." : "Something went wrong."
            );
          }
          return;
        }

        const data = (await res.json()) as { isClaimed: boolean };

        if (!cancelled) {
          setCardStatus(data.isClaimed ? "claimed" : "unclaimed");
          setMessage("");
        }
      } catch {
        if (!cancelled) {
          setCardStatus("error");
          setMessage("Network error.");
        }
      }
    }

    if (cardId) checkStatus();

    return () => {
      cancelled = true;
    };
  }, [cardId]);

  async function claim() {
    setLoading(true);
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setLoading(false);
      window.location.href = `/login?returnTo=${encodeURIComponent(
        `/setup/${cardId}`
      )}`;
      return;
    }

    const res = await fetch("/api/claim", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ cardId }),
    });

    if (res.status === 401) {
      setLoading(false);
      window.location.href = `/login?returnTo=${encodeURIComponent(
        `/setup/${cardId}`
      )}`;
      return;
    }

    if (res.status === 409) {
      setCardStatus("claimed");
      const txt = await res.text().catch(() => "");
      setMessage(txt || "This card was already claimed.");
      setLoading(false);
      return;
    }

    if (!res.ok) {
      const msg = await res.text().catch(() => "Claim failed");
      setMessage(msg);
      setLoading(false);
      return;
    }

    window.location.href = `/setup/${cardId}`;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0A0A0B] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/10 blur-[90px]" />
        <div className="absolute top-1/3 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-white/6 blur-[110px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/30 to-black/70" />
        <div className="absolute inset-0 shadow-[inset_0_0_140px_rgba(0,0,0,0.85)]" />
        <div className="grain absolute inset-0 opacity-[0.10]" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-[520px]">
          <div className="card-enter relative rounded-[28px] border border-white/10 bg-[#121214]/70 p-12 shadow-[0_30px_120px_rgba(0,0,0,0.75)] backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-0 rounded-[28px] border border-white/5" />
            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

            <div className="mb-10 flex justify-center">
              <div className="select-none text-[38px] font-light tracking-[0.55em] text-transparent bg-clip-text bg-gradient-to-b from-white to-white/55 drop-shadow-[0_0_18px_rgba(255,255,255,0.08)]">
                VIA
              </div>
            </div>

            <div className="text-center">
              <h1 className="text-[18px] font-medium tracking-wide text-white/90">
                Claim Your Card
              </h1>
              <p className="mt-3 text-[12px] tracking-[0.35em] text-white/45">
                {cardId}
              </p>
            </div>

            <div className="mt-10">
              {cardStatus === "checking" && (
                <div className="flex items-center justify-center gap-3 text-white/50">
                  <span className="loader h-4 w-4 rounded-full border border-white/20 border-t-white/70" />
                  <p className="text-sm">Checking card status…</p>
                </div>
              )}

              {!!message && cardStatus !== "checking" && (
                <p className="mb-4 text-center text-sm text-white/55">
                  {message}
                </p>
              )}

              {cardStatus === "unclaimed" && (
                <button
                  onClick={claim}
                  disabled={loading}
                  className="group relative w-full overflow-hidden rounded-2xl border border-white/15 bg-white px-4 py-4 font-semibold tracking-wide text-black transition-all duration-200 hover:-translate-y-[1px] hover:border-white/25 hover:bg-white/95 disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <span className="absolute -left-1/2 top-0 h-full w-1/2 skew-x-[-18deg] bg-gradient-to-r from-transparent via-black/10 to-transparent animate-sheen" />
                  </span>
                  {loading ? "Claiming…" : "Claim Card"}
                </button>
              )}

              {cardStatus === "claimed" && (
                <div className="space-y-6">
                  <div className="mx-auto w-fit rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs tracking-wider text-white/65">
                    ALREADY CLAIMED
                  </div>

                  <button
                    onClick={() => (window.location.href = `/c/${cardId}`)}
                    className="group relative w-full overflow-hidden rounded-2xl border border-white/12 bg-white/5 px-4 py-4 font-medium tracking-wide text-white/90 transition-all duration-200 hover:-translate-y-[1px] hover:border-white/20 hover:bg-white/7"
                  >
                    <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <span className="absolute -left-1/2 top-0 h-full w-1/2 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/10 to-transparent animate-sheen" />
                    </span>
                    View Card
                  </button>
                </div>
              )}

              {cardStatus === "notfound" && (
                <p className="text-center text-sm text-white/55">Card not found.</p>
              )}

              {cardStatus === "error" && (
                <p className="text-center text-sm text-white/55">
                  Something went wrong.
                </p>
              )}
            </div>
          </div>

          <p className="mt-6 text-center text-[11px] tracking-widest text-white/30">
            VIA · Secure Claim
          </p>
        </div>
      </div>

      <style jsx>{`
        .grain {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.35'/%3E%3C/svg%3E");
          mix-blend-mode: overlay;
        }
        .card-enter {
          animation: enter 420ms ease-out both;
        }
        @keyframes enter {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.99);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .loader {
          animation: spin 900ms linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        .animate-sheen {
          animation: sheen 900ms ease-out infinite;
        }
        @keyframes sheen {
          0% {
            transform: translateX(-60%) skewX(-18deg);
            opacity: 0;
          }
          25% {
            opacity: 1;
          }
          60% {
            transform: translateX(260%) skewX(-18deg);
            opacity: 0;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
