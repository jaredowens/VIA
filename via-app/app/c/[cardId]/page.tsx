"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Mail, Phone, Globe } from "lucide-react";
import {
  siVenmo,
  siPaypal,
  siCashapp,
  siInstagram,
  siTiktok,
  siYoutube,
  siX,
} from "simple-icons/icons";

type ViewStatus = "checking" | "unclaimed" | "claimed" | "notfound" | "error";

type PublicCardPayload = {
  cardId: string;
  displayName: string | null;
  bio: string | null;
  photoUrl: string | null;
  payLabel: string | null;
  payments: any;

  showPhone?: boolean;
  showEmail?: boolean;
  showSaveContact?: boolean;
};

type ActionType =
  | "phone"
  | "email"
  | "venmo"
  | "cashapp"
  | "paypal"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "x"
  | "website"
  | "other";

type ActionItem = {
  id?: string;
  type?: string;
  label?: string;
  value?: string;
  url?: string;
};

function digitsOnlyPhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function prettyLabel(t: ActionType, label?: string) {
  if (t === "phone") return "Direct";
  if (t === "email") return "Email";
  if (t === "venmo") return "Venmo";
  if (t === "cashapp") return "Cash App";
  if (t === "paypal") return "PayPal";
  if (t === "instagram") return "Instagram";
  if (t === "tiktok") return "TikTok";
  if (t === "youtube") return "YouTube";
  if (t === "x") return "X";
  if (t === "website") return "Website";
  return (label?.trim() || "Link");
}

function normalizeType(t?: string, label?: string): ActionType {
  const raw = String(t ?? "").toLowerCase().trim();
  const l = String(label ?? "").toLowerCase().trim();
  const s = `${raw} ${l}`;

  if (raw === "phone" || s.includes("phone") || s.includes("direct")) return "phone";
  if (raw === "email" || s.includes("email")) return "email";

  if (raw === "venmo" || s.includes("venmo")) return "venmo";
  if (raw === "cashapp" || s.includes("cash")) return "cashapp";
  if (raw === "paypal" || s.includes("paypal")) return "paypal";

  if (raw === "instagram" || s.includes("instagram")) return "instagram";
  if (raw === "tiktok" || s.includes("tiktok")) return "tiktok";
  if (raw === "youtube" || s.includes("youtube")) return "youtube";
  if (raw === "x" || s.includes("twitter") || s.includes(" x ")) return "x";
  if (raw === "website" || s.includes("website") || s.includes("site") || s.includes("web"))
    return "website";

  return "other";
}

function ensureHttp(v: string) {
  const t = (v ?? "").trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (t.includes(".") && !t.includes(" ")) return `https://${t}`;
  return t;
}

function buildHref(type: ActionType, value: string, url?: string): { href: string; fallback?: string } {
  if (url) return { href: url };

  const v = (value ?? "").trim();
  if (!v) return { href: "" };

  // If user pasted a URL, open it
  if (/^https?:\/\//i.test(v)) return { href: v };

  if (type === "phone") {
    return { href: `sms:${digitsOnlyPhone(v)}` };
  }

  if (type === "email") {
    // we copy emails on tap (UX you already had), but allow mailto if you want later
    return { href: "" };
  }

  if (type === "venmo") {
    const handle = v.startsWith("@") ? v.slice(1) : v;
    const web = `https://venmo.com/${encodeURIComponent(handle)}`;
    const deep = `venmo://paycharge?txn=pay&recipients=${encodeURIComponent(handle)}`;
    return { href: deep, fallback: web };
  }

  if (type === "cashapp") {
    const tag = v.startsWith("$") ? v.slice(1) : v;
    return { href: `https://cash.app/${encodeURIComponent(tag)}` };
  }

  if (type === "paypal") {
    const user = v.replace(/^@/, "");
    if (/paypal\.me\//i.test(user) || /^https?:\/\//.test(user)) {
      return { href: user.startsWith("http") ? user : `https://${user}` };
    }
    return { href: `https://www.paypal.me/${encodeURIComponent(user)}` };
  }

  if (type === "instagram") {
    const h = v.replace(/^@/, "");
    return { href: `https://instagram.com/${encodeURIComponent(h)}` };
  }

  if (type === "tiktok") {
    const h = v.replace(/^@/, "");
    return { href: `https://www.tiktok.com/@${encodeURIComponent(h)}` };
  }

  if (type === "youtube") {
    if (v.startsWith("@")) return { href: `https://www.youtube.com/${encodeURIComponent(v)}` };
    return { href: ensureHttp(v) };
  }

  if (type === "x") {
    const h = v.replace(/^@/, "");
    return { href: `https://x.com/${encodeURIComponent(h)}` };
  }

  if (type === "website") {
    return { href: ensureHttp(v) };
  }

  // other: open if it looks like a domain; else copy-only
  const maybe = ensureHttp(v);
  if (maybe.startsWith("http")) return { href: maybe };
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

function BrandSvg({ path, viewBox = "0 0 24 24" }: { path: string; viewBox?: string }) {
  return (
    <svg viewBox={viewBox} className="h-5 w-5" aria-hidden="true" fill="currentColor">
      <path d={path} />
    </svg>
  );
}

function Icon({ type }: { type: ActionType }) {
  if (type === "venmo") return <BrandSvg path={siVenmo.path} />;
  if (type === "cashapp") return <BrandSvg path={siCashapp.path} />;
  if (type === "paypal") return <BrandSvg path={siPaypal.path} />;

  if (type === "instagram") return <BrandSvg path={siInstagram.path} />;
  if (type === "tiktok") return <BrandSvg path={siTiktok.path} />;
  if (type === "youtube") return <BrandSvg path={siYoutube.path} />;
  if (type === "x") return <BrandSvg path={siX.path} />;
  if (type === "website") return <Globe className="h-5 w-5" />;

  if (type === "phone") return <Phone className="h-5 w-5" />;
  if (type === "email") return <Mail className="h-5 w-5" />;

  return null;
}

// ------------------------
// Save Contact helpers
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

function normalizeActions(payments: any): ActionItem[] {
  if (!payments || typeof payments !== "object") return [];

  // Preferred: payments.links is the single ordered list of all actions
  if (Array.isArray(payments.links)) {
    return (payments.links as any[])
      .map((x: any) => ({
        id: x?.id ? String(x.id) : undefined,
        type: x?.type ? String(x.type) : undefined,
        label: x?.label ? String(x.label) : undefined,
        value: x?.value ? String(x.value) : "",
        url: x?.url ? String(x.url) : undefined,
      }))
      .filter((x: ActionItem) => (String(x.value ?? "").trim() || String(x.url ?? "").trim()));
  }

  // Fallback legacy shape
  const out: ActionItem[] = [];
  if (typeof payments.phone === "string" && payments.phone.trim())
    out.push({ type: "phone", value: payments.phone.trim() });
  if (typeof payments.email === "string" && payments.email.trim())
    out.push({ type: "email", value: payments.email.trim() });

  if (typeof payments.venmo === "string" && payments.venmo.trim())
    out.push({ type: "venmo", value: payments.venmo.trim() });
  if (typeof payments.cashapp === "string" && payments.cashapp.trim())
    out.push({ type: "cashapp", value: payments.cashapp.trim() });
  if (typeof payments.paypal === "string" && payments.paypal.trim())
    out.push({ type: "paypal", value: payments.paypal.trim() });

  return out;
}

export default function CardPage() {
  const router = useRouter();
  const { cardId } = useParams<{ cardId: string }>();

  if (!cardId) return null;

  const [status, setStatus] = useState<ViewStatus>("checking");
  const [message, setMessage] = useState("");
  const [card, setCard] = useState<PublicCardPayload | null>(null);

  const [ownerCheck, setOwnerCheck] = useState<{
    loading: boolean;
    signedIn: boolean;
    isOwner: boolean;
  }>({ loading: true, signedIn: false, isOwner: false });

  const [savingContact, setSavingContact] = useState(false);

  // Toast
  const [toast, setToast] = useState("");
  function showToast(t: string) {
    setToast(t);
    setTimeout(() => setToast(""), 1400);
  }
  async function copyText(t: string) {
    if (!t) return;
    await navigator.clipboard.writeText(t);
    showToast("Copied");
  }

  useEffect(() => {
    try {
      localStorage.setItem("via:lastCardUrl", `/c/${cardId}`);
    } catch {}
  }, [cardId]);

  async function refreshOwner() {
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
    } = supabase.auth.onAuthStateChange(() => refreshOwner());

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

    check();
    return () => {
      cancelled = true;
    };
  }, [cardId]);

  const actions = useMemo(() => normalizeActions(card?.payments), [card?.payments]);

  const showPhone = card?.showPhone ?? true;
  const showEmail = card?.showEmail ?? true;
  const showSaveContact = card?.showSaveContact ?? true;

  const phoneValue = useMemo(() => {
    const p = card?.payments;
    if (p && typeof p === "object" && typeof p.phone === "string") return p.phone.trim();
    // also allow ordered link phone item
    const it = actions.find((a) => normalizeType(a.type, a.label) === "phone");
    return (it?.value ?? "").trim();
  }, [card?.payments, actions]);

  const emailValue = useMemo(() => {
    const p = card?.payments;
    if (p && typeof p === "object" && typeof p.email === "string") return p.email.trim();
    const it = actions.find((a) => normalizeType(a.type, a.label) === "email");
    return (it?.value ?? "").trim();
  }, [card?.payments, actions]);

  const canSaveContact =
    status === "claimed" &&
    !ownerCheck.isOwner &&
    !!card?.displayName?.trim() &&
    !!phoneValue &&
    showSaveContact;

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
                </div>

                <div className="mt-10 space-y-4">
                  {actions.map((raw, idx) => {
                    const type = normalizeType(raw.type, raw.label);
                    const value = String(raw.value ?? "").trim();
                    const label = prettyLabel(type, raw.label);
                    const { href, fallback } = buildHref(type, value, raw.url);

                    // Respect privacy toggles
                    if (type === "phone" && !showPhone) return null;
                    if (type === "email" && !showEmail) return null;

                    // If there's no usable value/url, don’t render
                    if (!value && !raw.url) return null;

                    const tapText =
                      type === "email"
                        ? "Copy"
                        : type === "phone"
                        ? "Message"
                        : "Open";

                    return (
                      <button
                        key={`${raw.id ?? `${type}-${idx}`}`}
                        onClick={async () => {
                          // Email stays copy-on-tap
                          if (type === "email") {
                            await copyText(value);
                            return;
                          }

                          // Everything else: open if possible; fallback to copy
                          if (href) {
                            await openWithFallback(href, fallback);
                            return;
                          }
                          if (value) await copyText(value);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          // Long-press always copies something useful
                          if (type === "email" || type === "phone") copyText(value);
                          else if (href) copyText(fallback ?? href);
                          else copyText(value);
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
                            <span>{label}</span>
                          </div>

                          <span className="text-white/60 text-sm">{tapText}</span>
                        </div>

                        <div className="mt-1 text-left text-sm text-white/55 break-all">
                          {type === "phone" || type === "email" ? value : (raw.url ?? value)}
                        </div>

                        {(type === "phone" || type === "email") && (
                          <div className="mt-1 text-left text-xs text-white/40">
                            Tap to {type === "phone" ? "message" : "copy"} · Hold to copy
                          </div>
                        )}
                      </button>
                    );
                  })}

                  {/* Viewer-only Save Contact */}
                  {!ownerCheck.isOwner && showSaveContact && (
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

                  {/* Owner-only Setup/Edit */}
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
                  <p className="mt-6 text-center text-sm text-white/55">{message}</p>
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

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-[#121214]/90 px-4 py-2 text-sm text-white/85 shadow-[0_20px_80px_rgba(0,0,0,0.6)] backdrop-blur">
          {toast}
        </div>
      )}

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