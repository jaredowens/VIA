"use client";

import { use, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Payments = {
  venmo?: string;
  cashapp?: string;
  paypal?: string;
  zelle?: string;
  applepay_phone?: string;
};

type CardRow = {
  id: string;
  owner_user_id: string | null;
  display_name: string | null;
  bio: string | null;
  photo_url: string | null;
  pay_label: string | null;
  payments_json: Payments | null;
};

function normalizeCashApp(input: string) {
  const v = input.trim();
  if (!v) return "";
  return v.startsWith("$") ? v : `$${v}`;
}

function normalizeVenmo(input: string) {
  const v = input.trim();
  if (!v) return "";
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  return v.replace(/^@/, "");
}

function normalizePaypal(input: string) {
  return input.trim();
}

function normalizePhone(input: string) {
  return input.trim();
}

export default function SetupPage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = use(params);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [card, setCard] = useState<CardRow | null>(null);

  // form state
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [payLabel, setPayLabel] = useState("");

  const [venmo, setVenmo] = useState("");
  const [cashapp, setCashapp] = useState("");
  const [paypal, setPaypal] = useState("");
  const [zelle, setZelle] = useState("");
  const [applePhone, setApplePhone] = useState("");

  const returnToCard = useMemo(() => `/c/${cardId}`, [cardId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setMsg("");

      // Must be logged in to edit/setup
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        window.location.href = `/login?returnTo=${encodeURIComponent(
          `/setup/${cardId}`
        )}`;
        return;
      }

      // Load card
      const { data, error } = await supabase
        .from("cards")
        .select(
          "id, owner_user_id, display_name, bio, photo_url, pay_label, payments_json"
        )
        .eq("id", cardId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setMsg(error.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setMsg("Card not found.");
        setLoading(false);
        return;
      }

      // If not claimed, force claim flow
      if (!data.owner_user_id) {
        window.location.href = `/claim/${cardId}`;
        return;
      }

      // Ensure this user is the owner (RLS will also enforce update)
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;

      if (!uid || data.owner_user_id !== uid) {
        window.location.href = returnToCard;
        return;
      }

      setCard(data as CardRow);

      // hydrate form values
      setDisplayName(data.display_name ?? "");
      setBio((data as any).bio ?? "");
      setPhotoUrl(data.photo_url ?? "");
      setPayLabel(data.pay_label ?? "");

      const p = (data.payments_json ?? {}) as Payments;
      setVenmo(p.venmo ?? "");
      setCashapp(p.cashapp ?? "");
      setPaypal(p.paypal ?? "");
      setZelle(p.zelle ?? "");
      setApplePhone(p.applepay_phone ?? "");

      setLoading(false);
    }

    if (cardId) load();

    return () => {
      cancelled = true;
    };
  }, [cardId, returnToCard]);

  async function save() {
    if (!displayName.trim()) {
      setMsg("Display name is required.");
      return;
    }

    setSaving(true);
    setMsg("");

    const payments: Payments = {
      venmo: normalizeVenmo(venmo) || undefined,
      cashapp: normalizeCashApp(cashapp) || undefined,
      paypal: normalizePaypal(paypal) || undefined,
      zelle: zelle.trim() || undefined,
      applepay_phone: normalizePhone(applePhone) || undefined,
    };

    // Remove empty keys
    Object.keys(payments).forEach((k) => {
      const key = k as keyof Payments;
      if (!payments[key]) delete payments[key];
    });

    const { error } = await supabase
      .from("cards")
      .update({
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        photo_url: photoUrl.trim() || null,
        pay_label: payLabel.trim() || null,
        payments_json: payments,
      })
      .eq("id", cardId);

    if (error) {
      setMsg(error.message);
      setSaving(false);
      return;
    }

    window.location.href = returnToCard;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0A0A0B] text-white">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/10 blur-[90px]" />
        <div className="absolute top-1/3 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-white/6 blur-[110px]" />
        <div className="absolute inset-0 shadow-[inset_0_0_140px_rgba(0,0,0,0.85)]" />
        <div className="grain absolute inset-0 opacity-[0.10]" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-6 py-10">
        <div className="w-full max-w-[560px] rounded-[28px] border border-white/10 bg-[#121214]/80 p-10 shadow-[0_30px_120px_rgba(0,0,0,0.75)] backdrop-blur-xl">
          {/* Logo */}
          <div className="mb-10 flex justify-center">
            <div className="select-none text-[38px] font-light tracking-[0.55em] text-transparent bg-clip-text bg-gradient-to-b from-white to-white/55">
              VIA
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-lg font-medium tracking-wide text-white/90">
              Setup Your Card
            </h1>
            <p className="mt-3 text-[12px] tracking-[0.35em] text-white/45">
              {cardId}
            </p>
          </div>

          {loading ? (
            <div className="mt-10 flex items-center justify-center gap-3 text-white/50">
              <span className="loader h-4 w-4 rounded-full border border-white/20 border-t-white/70" />
              <p className="text-sm">Loading setup…</p>
            </div>
          ) : (
            <div className="mt-10 space-y-8">
              {!!msg && (
                <p className="text-center text-sm text-red-400">{msg}</p>
              )}

              {/* Basics */}
              <div className="space-y-4">
                <div className="text-xs tracking-[0.35em] text-white/45">
                  BASICS
                </div>

                <div>
                  <label className="block text-xs tracking-wider text-white/60 mb-2">
                    DISPLAY NAME
                  </label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g., Alex Johnson"
                    className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                  />
                </div>

                <div>
                  <label className="block text-xs tracking-wider text-white/60 mb-2">
                    NOTE (OPTIONAL)
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="e.g., Primarily Venmo, others welcome"
                    className="w-full resize-none rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                  />
                </div>

                

                <div>
                  <label className="block text-xs tracking-wider text-white/60 mb-2">
                    PAY LABEL (OPTIONAL)
                  </label>
                  <input
                    value={payLabel}
                    onChange={(e) => setPayLabel(e.target.value)}
                    placeholder="e.g., Haircut, Tip, Deposit"
                    className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                  />
                </div>
              </div>

              {/* Payments */}
              <div className="space-y-4">
                <div className="text-xs tracking-[0.35em] text-white/45">
                  PAYMENTS
                </div>

                <div>
                  <label className="block text-xs tracking-wider text-white/60 mb-2">
                    VENMO (USERNAME OR LINK)
                  </label>
                  <input
                    value={venmo}
                    onChange={(e) => setVenmo(e.target.value)}
                    placeholder="alexjohnson or https://venmo.com/alexjohnson"
                    className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                  />
                </div>

                <div>
                  <label className="block text-xs tracking-wider text-white/60 mb-2">
                    CASH APP (CASHTAG)
                  </label>
                  <input
                    value={cashapp}
                    onChange={(e) => setCashapp(e.target.value)}
                    placeholder="$alexjohnson"
                    className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                  />
                </div>

                <div>
                  <label className="block text-xs tracking-wider text-white/60 mb-2">
                    PAYPAL (LINK OR PAYPAL.ME USERNAME)
                  </label>
                  <input
                    value={paypal}
                    onChange={(e) => setPaypal(e.target.value)}
                    placeholder="https://paypal.me/alexjohnson"
                    className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                  />
                </div>

                <div>
                  <label className="block text-xs tracking-wider text-white/60 mb-2">
                    ZELLE (EMAIL OR PHONE)
                  </label>
                  <input
                    value={zelle}
                    onChange={(e) => setZelle(e.target.value)}
                    placeholder="alex@example.com or +1..."
                    className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                  />
                </div>

                <div>
                  <label className="block text-xs tracking-wider text-white/60 mb-2">
                    APPLE PAY (PHONE NUMBER FOR iMESSAGE)
                  </label>
                  <input
                    value={applePhone}
                    onChange={(e) => setApplePhone(e.target.value)}
                    placeholder="+1 (555) 555-5555"
                    className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                  />
                  <p className="mt-2 text-xs text-white/40">
                    This button will open Messages to that number (sms:).
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={save}
                  disabled={saving}
                  className="group relative w-full overflow-hidden rounded-2xl border border-white/12 bg-white/5 px-4 py-4 font-medium tracking-wide text-white/90 transition-all duration-200 hover:-translate-y-[1px] hover:border-white/20 hover:bg-white/7 disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <span className="absolute -left-1/2 top-0 h-full w-1/2 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/10 to-transparent animate-sheen" />
                  </span>
                  {saving ? "Saving…" : "Save & Continue"}
                </button>

                <button
                  onClick={() => (window.location.href = returnToCard)}
                  className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-4 text-sm tracking-wide text-white/60 hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .grain {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.35'/%3E%3C/svg%3E");
          mix-blend-mode: overlay;
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
