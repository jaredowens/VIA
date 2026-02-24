"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PaymentItem = {
  id: string;
  type: "venmo" | "cashapp" | "paypal" | "custom";
  label: string;
  value: string;
};

type CardsRow = {
  id: string;
  owner_user_id: string | null;
  display_name: string | null;
  bio: string | null;
  photo_url: string | null;
  pay_label: string | null;
  payments_json: any | null;

  show_phone?: boolean | null;
  show_email?: boolean | null;
  show_save_contact?: boolean | null;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeVenmoHandle(input: string) {
  return input.trim().replace(/^@/, "");
}
function normalizeCashAppTag(input: string) {
  return input.trim().replace(/^\$/, "");
}
function normalizePaypal(input: string) {
  return input.trim().replace(/^@/, "");
}
function normalizePhone(input: string) {
  return input.trim();
}
function normalizeEmail(input: string) {
  return input.trim();
}

function coerceToStatePayments(p: any): {
  phone: string;
  email: string;
  links: PaymentItem[];
} {
  // Preferred: { phone, email, links: [] }
  if (p && typeof p === "object" && Array.isArray(p.links)) {
    return {
      phone: typeof p.phone === "string" ? p.phone : "",
      email: typeof p.email === "string" ? p.email : "",
      links: p.links
        .map((x: any) => ({
          id: String(x?.id ?? uid()),
          type:
            (String(x?.type ?? "custom") as PaymentItem["type"]) || "custom",
          label: String(x?.label ?? "Payment"),
          value: String(x?.value ?? ""),
        }))
        .filter((x: PaymentItem) => x.value.trim()),
    };
  }

  // Legacy object: { venmo, cashapp, paypal, phone, email }
  if (p && typeof p === "object" && !Array.isArray(p)) {
    const links: PaymentItem[] = [];

    if (typeof p.venmo === "string" && p.venmo.trim()) {
      links.push({
        id: uid(),
        type: "venmo",
        label: "Venmo",
        value: normalizeVenmoHandle(p.venmo),
      });
    }
    if (typeof p.cashapp === "string" && p.cashapp.trim()) {
      links.push({
        id: uid(),
        type: "cashapp",
        label: "Cash App",
        value: normalizeCashAppTag(p.cashapp),
      });
    }
    if (typeof p.paypal === "string" && p.paypal.trim()) {
      links.push({
        id: uid(),
        type: "paypal",
        label: "PayPal",
        value: normalizePaypal(p.paypal),
      });
    }

    return {
      phone: typeof p.phone === "string" ? p.phone : "",
      email: typeof p.email === "string" ? p.email : "",
      links,
    };
  }

  // Array format (rare): treat as ordered links only
  if (Array.isArray(p)) {
    return {
      phone: "",
      email: "",
      links: p
        .map((x: any) => ({
          id: String(x?.id ?? uid()),
          type:
            (String(x?.type ?? "custom") as PaymentItem["type"]) || "custom",
          label: String(x?.label ?? "Payment"),
          value: String(x?.value ?? ""),
        }))
        .filter((x: PaymentItem) => x.value.trim()),
    };
  }

  return { phone: "", email: "", links: [] };
}

export default function SetupPage() {
  const { cardId } = useParams<{ cardId: string }>();
  if (!cardId) return null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [payLabel, setPayLabel] = useState("");

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [payments, setPayments] = useState<PaymentItem[]>([]);

  const [showPhone, setShowPhone] = useState(true);
  const [showEmail, setShowEmail] = useState(true);
  const [showSaveContact, setShowSaveContact] = useState(true);

  const [customLabel, setCustomLabel] = useState("");
  const [customValue, setCustomValue] = useState("");

  const returnToCard = useMemo(() => `/c/${cardId}`, [cardId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setMsg("");

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        window.location.href = `/login?returnTo=${encodeURIComponent(
          `/setup/${cardId}`
        )}`;
        return;
      }

      const { data, error } = await supabase
        .from("cards")
        .select(
          "id, owner_user_id, display_name, bio, photo_url, pay_label, payments_json, show_phone, show_email, show_save_contact"
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

      if (!data.owner_user_id) {
        window.location.href = `/claim/${cardId}`;
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const currentUid = userData.user?.id;

      if (!currentUid || data.owner_user_id !== currentUid) {
        window.location.href = returnToCard;
        return;
      }

      const row = data as CardsRow;

      const dn = (row.display_name ?? "").trim();
      if (dn) {
        const parts = dn.split(/\s+/);
        setFirstName(parts[0] ?? "");
        setLastName(parts.slice(1).join(" "));
      } else {
        setFirstName("");
        setLastName("");
      }

      setBio(row.bio ?? "");
      setPhotoUrl(row.photo_url ?? "");
      setPayLabel(row.pay_label ?? "");

      const parsed = coerceToStatePayments(row.payments_json);
      setPhone(parsed.phone ?? "");
      setEmail(parsed.email ?? "");
      setPayments(parsed.links ?? []);

      setShowPhone(row.show_phone ?? true);
      setShowEmail(row.show_email ?? true);
      setShowSaveContact(row.show_save_contact ?? true);

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [cardId, returnToCard]);

  function movePayment(id: string, dir: -1 | 1) {
    setPayments((prev) => {
      const i = prev.findIndex((p) => p.id === id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[i];
      next[i] = next[j];
      next[j] = tmp;
      return next;
    });
  }

  function updatePayment(id: string, patch: Partial<PaymentItem>) {
    setPayments((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
    );
  }

  function removePayment(id: string) {
    setPayments((prev) => prev.filter((p) => p.id !== id));
  }

  function addPreset(type: PaymentItem["type"]) {
    const label =
      type === "venmo"
        ? "Venmo"
        : type === "cashapp"
        ? "Cash App"
        : type === "paypal"
        ? "PayPal"
        : "Payment";
    setPayments((prev) => [...prev, { id: uid(), type, label, value: "" }]);
  }

  function addCustomPayment() {
    const l = customLabel.trim();
    const v = customValue.trim();
    if (!l || !v) return;

    setPayments((prev) => [
      ...prev,
      { id: uid(), type: "custom", label: l, value: v },
    ]);

    setCustomLabel("");
    setCustomValue("");
  }

  async function save() {
    const fn = firstName.trim();
    const ln = lastName.trim();
    const computedDisplay = `${fn} ${ln}`.trim();

    if (!fn) {
      setMsg("Preferred first name is required.");
      return;
    }

    const phoneNorm = normalizePhone(phone);
    if (!phoneNorm) {
      setMsg("Direct phone number is required.");
      return;
    }

    setSaving(true);
    setMsg("");

    try {
      const cleanedLinks = payments
        .map((p) => {
          let v = p.value.trim();
          if (p.type === "venmo") v = normalizeVenmoHandle(v);
          if (p.type === "cashapp") v = normalizeCashAppTag(v);
          if (p.type === "paypal") v = normalizePaypal(v);
          return {
            ...p,
            label: p.label.trim() || "Payment",
            value: v,
          };
        })
        .filter((p) => p.value);

      // ✅ LEGACY-FRIENDLY SHAPE (passes DB constraints that expect venmo/cashapp/paypal keys)
      const venmo = cleanedLinks.find((x) => x.type === "venmo")?.value ?? "";
      const cashapp =
        cleanedLinks.find((x) => x.type === "cashapp")?.value ?? "";
      const paypal = cleanedLinks.find((x) => x.type === "paypal")?.value ?? "";

      const payments_json: any = {
        venmo,
        cashapp,
        paypal,
        phone: phoneNorm,
        email: normalizeEmail(email) || "",
        // keep modern list too (so /c can use links if needed)
        links: cleanedLinks.map((p) => ({
          id: p.id,
          type: p.type,
          label: p.label,
          value: p.value,
        })),
      };

      const { error } = await supabase
        .from("cards")
        .update({
          display_name: computedDisplay,
          bio: bio.trim() || null,
          photo_url: photoUrl.trim() || null,
          pay_label: payLabel.trim() || null,
          payments_json,
          show_phone: showPhone,
          show_email: showEmail,
          show_save_contact: showSaveContact,
        })
        .eq("id", cardId);

      if (error) {
        console.error("SAVE ERROR:", error);
        setMsg(error.message);
        return;
      }

      window.location.href = returnToCard;
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0A0A0B] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/10 blur-[90px]" />
        <div className="absolute top-1/3 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-white/6 blur-[110px]" />
        <div className="absolute inset-0 shadow-[inset_0_0_140px_rgba(0,0,0,0.85)]" />
        <div className="grain absolute inset-0 opacity-[0.10]" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-6 py-10">
        <div className="w-full max-w-[560px] rounded-[28px] border border-white/10 bg-[#121214]/80 p-10 shadow-[0_30px_120px_rgba(0,0,0,0.75)] backdrop-blur-xl">
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

              {/* BASICS */}
              <div className="space-y-4">
                <div className="text-xs tracking-[0.35em] text-white/45">
                  BASICS
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs tracking-wider text-white/60 mb-2">
                      PREFERRED FIRST NAME
                    </label>
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs tracking-wider text-white/60 mb-2">
                      PREFERRED LAST NAME
                    </label>
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs tracking-wider text-white/60 mb-2">
                    NOTE (OPTIONAL)
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
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
                    className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                  />
                </div>
              </div>

              {/* PAYMENTS */}
              <div className="space-y-4">
                <div className="text-xs tracking-[0.35em] text-white/45">
                  PAYMENTS
                </div>

                <div>
                  <label className="block text-xs tracking-wider text-white/60 mb-2">
                    DIRECT PHONE (REQUIRED)
                  </label>
                  <p className="mb-2 text-xs text-white/40 tracking-wide">
                    Used for direct transfers. On your card: tap to message, hold
                    to copy.
                  </p>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                  />
                </div>

                <div>
                  <label className="block text-xs tracking-wider text-white/60 mb-2">
                    EMAIL (OPTIONAL)
                  </label>
                  <p className="mb-2 text-xs text-white/40 tracking-wide">
                    On your card: tap/hold copies it.
                  </p>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                  />
                </div>

                <div className="pt-2">
                  <div className="text-xs tracking-[0.35em] text-white/45 mb-3">
                    PAYMENT LINKS (ORDERED)
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => addPreset("venmo")}
                      className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
                    >
                      + Venmo
                    </button>
                    <button
                      type="button"
                      onClick={() => addPreset("cashapp")}
                      className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
                    >
                      + Cash App
                    </button>
                    <button
                      type="button"
                      onClick={() => addPreset("paypal")}
                      className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
                    >
                      + PayPal
                    </button>
                  </div>

                  <div className="mt-3 space-y-3">
                    {payments.map((p, idx) => (
                      <div
                        key={p.id}
                        className="rounded-2xl border border-white/12 bg-white/5 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-white/90">
                            {p.label || "Payment"}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => movePayment(p.id, -1)}
                              disabled={idx === 0}
                              className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-white/75 disabled:opacity-50"
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              onClick={() => movePayment(p.id, 1)}
                              disabled={idx === payments.length - 1}
                              className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-white/75 disabled:opacity-50"
                            >
                              Down
                            </button>
                            <button
                              type="button"
                              onClick={() => removePayment(p.id)}
                              className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-red-300 hover:bg-white/10"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs tracking-wider text-white/55 mb-2">
                              LABEL
                            </label>
                            <input
                              value={p.label}
                              onChange={(e) =>
                                updatePayment(p.id, { label: e.target.value })
                              }
                              className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                            />
                          </div>

                          <div>
                            <label className="block text-xs tracking-wider text-white/55 mb-2">
                              USERNAME OR LINK
                            </label>
                            <input
                              value={p.value}
                              onChange={(e) =>
                                updatePayment(p.id, { value: e.target.value })
                              }
                              className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/12 bg-white/5 p-4">
                    <div className="text-sm font-medium text-white/90">
                      Add Custom Link
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input
                        placeholder="Label (e.g., Apple Pay)"
                        value={customLabel}
                        onChange={(e) => setCustomLabel(e.target.value)}
                        className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                      />
                      <input
                        placeholder="Username or link"
                        value={customValue}
                        onChange={(e) => setCustomValue(e.target.value)}
                        className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addCustomPayment}
                      className="mt-3 w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white/80 hover:bg-white/10"
                    >
                      Add
                    </button>
                  </div>

                  <p className="mt-3 text-xs text-white/40 tracking-wide">
                    Tip: reorder with Up/Down. The top link shows first on your
                    card.
                  </p>
                </div>
              </div>

              {/* PRIVACY */}
              <div className="space-y-4">
                <div className="text-xs tracking-[0.35em] text-white/45">
                  PRIVACY
                </div>

                <label className="flex items-center gap-3 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={showPhone}
                    onChange={(e) => setShowPhone(e.target.checked)}
                  />
                  Show phone on my card
                </label>

                <label className="flex items-center gap-3 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={showEmail}
                    onChange={(e) => setShowEmail(e.target.checked)}
                  />
                  Show email on my card
                </label>

                <label className="flex items-center gap-3 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={showSaveContact}
                    onChange={(e) => setShowSaveContact(e.target.checked)}
                  />
                  Allow “Save Contact”
                </label>
              </div>

              {/* ACTIONS */}
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