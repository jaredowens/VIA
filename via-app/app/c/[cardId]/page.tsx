"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Mail, Phone } from "lucide-react";
import { siVenmo, siPaypal, siCashapp } from "simple-icons/icons";

type ViewStatus = "checking" | "unclaimed" | "claimed" | "notfound" | "error";

type PublicCardPayload = {
  cardId: string;
  displayName: string | null;
  bio: string | null;
  photoUrl: string | null;
  payLabel: string | null;
  payments: any;
};

type PaymentType = "venmo" | "cashapp" | "email" | "phone" | "paypal" | "other";

type PaymentLinkItem = {
  key?: string;
  label: string;
  value: string;
  url?: string;
};

function prettyLabel(key: string) {
  const map: Record<string, string> = {
    venmo: "Venmo",
    cashapp: "Cash App",
    email: "Email (Zelle)",
    phone: "Phone Pay (Apple Pay, Samsung Pay, etc.)",
    paypal: "PayPal",
  };

  return (
    map[key.toLowerCase()] ??
    key.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function normalizePayments(payments: any): PaymentLinkItem[] {
  if (!payments) return [];

  if (Array.isArray(payments)) {
    return payments
      .map((x) => ({
        label: String(x?.label ?? x?.type ?? "Payment"),
        value: String(x?.value ?? ""),
        url: x?.url ? String(x.url) : undefined,
      }))
      .filter((x) => x.value || x.url);
  }

  if (typeof payments === "object") {
    return Object.entries(payments)
      .map(([k, v]) => {
        if (typeof v === "string") {
          return { key: k, label: prettyLabel(k), value: v };
        }
        return {
          key: k,
          label: prettyLabel(k),
          value: String((v as any)?.value ?? ""),
          url: (v as any)?.url ? String((v as any).url) : undefined,
        };
      })
      .filter((x) => x.value || x.url);
  }

  return [];
}

function digitsOnlyPhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function detectType(it: PaymentLinkItem): PaymentType {
  const k = (it.key || "").toLowerCase();
  const l = (it.label || "").toLowerCase();

  if (k.includes("venmo") || l.includes("venmo")) return "venmo";
  if (k.includes("cash") || l.includes("cash")) return "cashapp";
  if (k === "email" || l.includes("email")) return "email";
  if (k === "phone" || l.includes("phone")) return "phone";
  if (k.includes("paypal") || l.includes("paypal")) return "paypal";

  return "other";
}

function sortPayments(items: PaymentLinkItem[]) {
  const priority: Record<PaymentType, number> = {
    venmo: 0,
    cashapp: 1,
    email: 2,
    phone: 3,
    paypal: 4,
    other: 99,
  };

  return [...items].sort((a, b) => {
    const ta = detectType(a);
    const tb = detectType(b);
    const pa = priority[ta];
    const pb = priority[tb];
    if (pa !== pb) return pa - pb;
    return (a.label || "").localeCompare(b.label || "");
  });
}

function buildLink(
  label: string,
  value: string,
  url?: string
): { href: string; fallback?: string } {
  if (url) return { href: url };

  const v = (value ?? "").trim();
  if (!v) return { href: "" };
  if (/^https?:\/\//i.test(v)) return { href: v };

  const lower = label.toLowerCase();

  if (lower.includes("venmo")) {
    const handle = v.startsWith("@") ? v.slice(1) : v;
    const web = `https://venmo.com/${encodeURIComponent(handle)}`;
    const deep = `venmo://paycharge?txn=pay&recipients=${encodeURIComponent(
      handle
    )}`;
    return { href: deep, fallback: web };
  }

  if (lower.includes("cash")) {
    const tag = v.startsWith("$") ? v.slice(1) : v;
    return { href: `https://cash.app/${encodeURIComponent(tag)}` };
  }

  if (lower.includes("email")) {
    return { href: `mailto:${v}` };
  }

  if (lower.includes("phone")) {
    const phone = digitsOnlyPhone(v);
    if (!phone) return { href: "" };
    return { href: `tel:${phone}` };
  }

  if (lower.includes("paypal")) {
    const user = v.replace(/^@/, "");
    return { href: `https://www.paypal.me/${encodeURIComponent(user)}` };
  }

  return { href: "" };
}

async function openWithFallback(href: string, fallback?: string) {
  if (!href) return;

  const isAppScheme =
    /^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(href) && !href.startsWith("http");

  if (fallback && isAppScheme) {
    window.location.href = href;
    setTimeout(() => {
      window.location.href = fallback;
    }, 700);
    return;
  }

  window.location.href = href;
}

function BrandSvg({
  path,
  viewBox = "0 0 24 24",
}: {
  path: string;
  viewBox?: string;
}) {
  return (
    <svg
      viewBox={viewBox}
      className="h-5 w-5"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d={path} />
    </svg>
  );
}

function Icon({ type }: { type: PaymentType }) {
  if (type === "venmo") return <BrandSvg path={siVenmo.path} />;
  if (type === "cashapp") return <BrandSvg path={siCashapp.path} />;
  if (type === "paypal") return <BrandSvg path={siPaypal.path} />;
  if (type === "email") return <Mail className="h-5 w-5" />;
  if (type === "phone") return <Phone className="h-5 w-5" />;
  return null;
}

// ------------------------
// ✅ Save Contact helpers
// ------------------------
function vEscape(v: string) {
  return (v ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function splitName(full: string) {
  const t = (full ?? "").trim();
  if (!t) return { first: "", last: "" };
  const parts = t.split(/\s+/);
  const first = parts[0] ?? "";
  const last = parts.slice(1).join(" ");
  return { first, last };
}

function buildVCard(opts: {
  fullName: string;
  phone?: string;
  email?: string;
  note?: string;
  url?: string;
}) {
  const { first, last } = splitName(opts.fullName);

  const lines: string[] = [];
  lines.push("BEGIN:VCARD");
  lines.push("VERSION:3.0");
  lines.push(`N:${vEscape(last)};${vEscape(first)};;;`);
  lines.push(`FN:${vEscape(opts.fullName)}`);

  const phone = (opts.phone ?? "").trim();
  if (phone) lines.push(`TEL;TYPE=CELL:${vEscape(phone)}`);

  const email = (opts.email ?? "").trim();
  if (email) lines.push(`EMAIL;TYPE=INTERNET:${vEscape(email)}`);

  const url = (opts.url ?? "").trim();
  if (url) lines.push(`URL:${vEscape(url)}`);

  const note = (opts.note ?? "").trim();
  if (note) lines.push(`NOTE:${vEscape(note)}`);

  lines.push("END:VCARD");
  return lines.join("\r\n");
}

function downloadVCard(filename: string, vcard: string) {
  const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function CardPage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const router = useRouter();
  const { cardId } = use(params);

  const [status, setStatus] = useState<ViewStatus>("checking");
  const [message, setMessage] = useState("");
  const [card, setCard] = useState<PublicCardPayload | null>(null);

  const [ownerCheck, setOwnerCheck] = useState<{
    loading: boolean;
    signedIn: boolean;
    isOwner: boolean;
  }>({ loading: true, signedIn: false, isOwner: false });

  const [savingContact, setSavingContact] = useState(false);

  useEffect(() => {
    if (!cardId) return;
    try {
      localStorage.setItem("via:lastCardUrl", `/c/${cardId}`);
    } catch {}
  }, [cardId]);

  async function refreshOwner() {
    if (!cardId) return;
    try {
      setOwnerCheck((p) => ({ ...p, loading: true }));
      const res = await fetch(
        `/api/card-is-owner?cardId=${encodeURIComponent(cardId)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        setOwnerCheck({ loading: false, signedIn: false, isOwner: false });
        return;
      }
      const j = await res.json();
      setOwnerCheck({
        loading: false,
        signedIn: !!j.signedIn,
        isOwner: !!j.isOwner,
      });
    } catch {
      setOwnerCheck({ loading: false, signedIn: false, isOwner: false });
    }
  }

  useEffect(() => {
    refreshOwner();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      refreshOwner();
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(
          `/api/card-status?cardId=${encodeURIComponent(cardId)}`,
          { cache: "no-store" }
        );

        if (!res.ok) {
          if (!cancelled) {
            setStatus(res.status === 404 ? "notfound" : "error");
            setMessage(
              res.status === 404 ? "Card not found." : "Something went wrong."
            );
          }
          return;
        }

        const data = (await res.json()) as { isClaimed: boolean };
        if (cancelled) return;

        if (!data.isClaimed) {
          setStatus("unclaimed");
          window.location.replace(`/claim/${cardId}`);
          return;
        }

        setStatus("claimed");

        const res2 = await fetch(
          `/api/card-public?cardId=${encodeURIComponent(cardId)}`,
          { cache: "no-store" }
        );

        if (!res2.ok) {
          let details = "";
          try {
            const j = await res2.json();
            details = j?.details || j?.error || "";
          } catch {}
          if (!cancelled) {
            setMessage(
              details
                ? `Could not load card details: ${details}`
                : "Could not load card details."
            );
          }
          return;
        }

        const payload = (await res2.json()) as PublicCardPayload;
        if (!cancelled) setCard(payload);
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Network error.");
        }
      }
    }

    if (cardId) check();

    return () => {
      cancelled = true;
    };
  }, [cardId]);

  const paymentItems = useMemo(() => {
    const items = normalizePayments(card?.payments);
    return sortPayments(items);
  }, [card?.payments]);

  // ✅ For Save Contact (viewer side)
  const phoneValue = useMemo(() => {
    const it =
      paymentItems.find((x) => detectType(x) === "phone") ??
      paymentItems.find((x) => (x.key || "").toLowerCase() === "phone");
    return (it?.value ?? "").trim();
  }, [paymentItems]);

  const emailValue = useMemo(() => {
    const it =
      paymentItems.find((x) => detectType(x) === "email") ??
      paymentItems.find((x) => (x.key || "").toLowerCase() === "email");
    return (it?.value ?? "").trim();
  }, [paymentItems]);

  const canSaveContact =
    status === "claimed" &&
    !ownerCheck.isOwner &&
    !!card?.displayName?.trim() &&
    !!phoneValue;

  async function saveContact() {
    if (!card?.displayName?.trim() || !phoneValue) return;

    setSavingContact(true);
    try {
      const url =
        typeof window !== "undefined"
          ? `${window.location.origin}/c/${cardId}`
          : "";

      const noteParts: string[] = [];
      if (card?.payLabel?.trim()) noteParts.push(card.payLabel.trim());
      noteParts.push(`VIA card: ${url}`);

      const vcard = buildVCard({
        fullName: card.displayName.trim(),
        phone: phoneValue,
        email: emailValue || undefined,
        note: noteParts.join(" • "),
        url,
      });

      const safeName = card.displayName.trim().replace(/[^\w\s-]/g, "").trim();
      const filename = `${safeName || "VIA"}-${cardId}.vcf`;

      downloadVCard(filename, vcard);
    } finally {
      setSavingContact(false);
    }
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

            <div className="mb-10 flex items-center justify-center relative">
              <div className="select-none text-[38px] font-light tracking-[0.55em] text-transparent bg-clip-text bg-gradient-to-b from-white to-white/55 drop-shadow-[0_0_18px_rgba(255,255,255,0.08)]">
                VIA
              </div>

              {ownerCheck.isOwner && (
                <button
                  onClick={logout}
                  className="absolute right-0 top-1/2 -translate-y-1/2 rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-white/75 hover:bg-white/10"
                >
                  Logout
                </button>
              )}
            </div>

            {status === "checking" && (
              <div className="flex items-center justify-center gap-3 text-white/50">
                <span className="loader h-4 w-4 rounded-full border border-white/20 border-t-white/70" />
                <p className="text-sm">Loading card…</p>
              </div>
            )}

            {status === "claimed" && (
              <>
                <div className="text-center">
                  {card?.photoUrl ? (
                    <div className="mb-5 flex justify-center">
                      <img
                        src={card.photoUrl}
                        alt={card.displayName ?? "VIA profile"}
                        className="h-16 w-16 rounded-full object-cover border border-white/10"
                      />
                    </div>
                  ) : null}

                  <h1 className="text-[22px] font-semibold tracking-wide text-white/95">
                    {card?.displayName?.trim() || "VIA Card"}
                  </h1>

                  {card?.bio?.trim() ? (
                    <p className="mt-3 text-sm text-white/60 leading-relaxed">
                      {card.bio}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-white/40"> </p>
                  )}

                  {card?.payLabel?.trim() ? (
                    <div className="mt-4 flex justify-center">
                      <div className="w-fit rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs tracking-wider text-white/70">
                        {card.payLabel}
                      </div>
                    </div>
                  ) : null}

                  {!card && (
                    <p className="mt-6 text-sm text-white/55">Loading…</p>
                  )}
                </div>

                <div className="mt-10 space-y-4">
                  {card && paymentItems.length === 0 && (
                    <p className="text-center text-sm text-white/55">
                      No payment methods added yet.
                    </p>
                  )}

                  {paymentItems.map((it, idx) => {
                    const { href, fallback } = buildLink(
                      it.label,
                      it.value,
                      it.url
                    );
                    const text = it.value || it.url || "";
                    const type = detectType(it);

                    return (
                      <button
                        key={`${it.key ?? it.label}-${idx}`}
                        onClick={async () => {
                          if (href) {
                            await openWithFallback(href, fallback);
                            return;
                          }
                          if (text) await navigator.clipboard.writeText(text);
                        }}
                        className="group relative w-full overflow-hidden rounded-2xl border border-white/12 bg-white/5 px-4 py-4 font-medium tracking-wide text-white/90 transition-all duration-200 hover:-translate-y-[1px] hover:border-white/20 hover:bg-white/7"
                      >
                        <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                          <span className="absolute -left-1/2 top-0 h-full w-1/2 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/10 to-transparent animate-sheen" />
                        </span>

                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                              <Icon type={type} />
                            </div>
                            <span>{it.label}</span>
                          </div>

                          <span className="text-white/60 text-sm">
                            {href ? "Open" : "Copy"}
                          </span>
                        </div>

                        <div className="mt-1 text-left text-sm text-white/55 break-all">
                          {text}
                        </div>
                      </button>
                    );
                  })}

                  {/* ✅ Viewer-only Save Contact */}
                  {!ownerCheck.isOwner && (
                    <button
                      onClick={saveContact}
                      disabled={!canSaveContact || savingContact}
                      className="group relative w-full overflow-hidden rounded-2xl border border-white/12 bg-white/5 px-4 py-4 font-medium tracking-wide text-white/90 transition-all duration-200 hover:-translate-y-[1px] hover:border-white/20 hover:bg-white/7 disabled:opacity-60 disabled:hover:translate-y-0"
                    >
                      <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <span className="absolute -left-1/2 top-0 h-full w-1/2 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/10 to-transparent animate-sheen" />
                      </span>
                      {savingContact ? "Preparing contact…" : "Save Contact"}
                      {!phoneValue && (
                        <div className="mt-1 text-left text-sm text-white/55">
                          No phone number added yet.
                        </div>
                      )}
                    </button>
                  )}

                  {/* ✅ Owner-only Setup/Edit */}
                  {ownerCheck.isOwner && (
                    <button
                      onClick={() => (window.location.href = `/setup/${cardId}`)}
                      className="group relative w-full overflow-hidden rounded-2xl border border-white/12 bg-white/5 px-4 py-4 font-medium tracking-wide text-white/90 transition-all duration-200 hover:-translate-y-[1px] hover:border-white/20 hover:bg-white/7"
                    >
                      <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <span className="absolute -left-1/2 top-0 h-full w-1/2 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/10 to-transparent animate-sheen" />
                      </span>
                      Setup / Edit
                    </button>
                  )}
                </div>

                {!!message && (
                  <p className="mt-6 text-center text-sm text-white/55">
                    {message}
                  </p>
                )}
              </>
            )}

            {status === "notfound" && (
              <p className="text-center text-sm text-white/55">
                {message || "Card not found."}
              </p>
            )}

            {status === "error" && (
              <p className="text-center text-sm text-white/55">
                {message || "Something went wrong."}
              </p>
            )}
          </div>

          <p className="mt-6 text-center text-[11px] tracking-widest text-white/30">
            VIA · Tap to pay
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
