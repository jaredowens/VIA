"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function isLightColor(hex: string) {
  const h = (hex ?? "").replace("#", "").trim();
  if (h.length !== 6) return false;

  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);

  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 160;
}


type Payload = {
  cardId: string;
  isPremium?: boolean;
  accentColor?: string | null;
  verified?: boolean;
  buttonStyle?: "pill" | "soft";
  accentGlow?: boolean;

  bgStyle?: "default" | "solid" | "gradient";
  bgColor?: string | null;
  bgColor2?: string | null;
  payBtnAccent?: "none" | "outline" | "shine";

  stripeAccountId?: string | null;
  stripeConnected?: boolean;
  viaPaymentsEnabled?: boolean;
};

const PRESETS = [
  { name: "Midnight Violet", value: "#7C3AED" },
  { name: "Electric Blue", value: "#3B82F6" },
  { name: "Emerald", value: "#22C55E" },
  { name: "Rose", value: "#F43F5E" },
  { name: "Gold", value: "#F59E0B" },
  { name: "Crimson", value: "#EF4444" },
  { name: "Arctic", value: "#E5E7EB" },
  { name: "Stealth", value: "#111827" },
];

function cleanHex(v: string, fallback: string) {
  const t = (v ?? "").trim();
  const ok = /^#[0-9a-fA-F]{6}$/.test(t);
  return ok ? t.toUpperCase() : fallback;
}

/**
 * Flat control: no card background. Just a row + color rail.
 */
function ColorBar({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const safe = cleanHex(value, "#000000");
  return (
    <div className="rounded-2xl border border-white/12 bg-black/30 px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium text-white/85">{label}</div>
        <div className="text-xs tracking-wider text-white/55">{safe}</div>
      </div>

      <div className="relative h-12 w-full overflow-hidden rounded-xl border border-white/12">
        <div className="absolute inset-0" style={{ background: safe }} />
        <input
          type="color"
          value={safe}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={label}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/12 to-transparent" />
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pt-8">
      <div className="flex flex-col gap-1">
        <div className="text-xs tracking-[0.35em] text-white/55">{title}</div>
        {subtitle ? <div className="text-sm text-white/65">{subtitle}</div> : null}
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

export default function CustomizeClient({ cardId }: { cardId: string }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [isPremium, setIsPremium] = useState(false);

   const [stripeConnected, setStripeConnected] = useState(false);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [viaPaymentsEnabled, setViaPaymentsEnabled] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);

  // Accent / premium button
  const [accent, setAccent] = useState("#7C3AED");
  const [buttonStyle, setButtonStyle] = useState<"pill" | "soft">("pill");
  const [accentGlow, setAccentGlow] = useState(true);
  const [payBtnAccent, setPayBtnAccent] = useState<"none" | "outline" | "shine">("none");

  // Background
  const [bgStyle, setBgStyle] = useState<"default" | "solid" | "gradient">("default");
  const [bgColor, setBgColor] = useState("#0A0A0B");
  const [bgColor2, setBgColor2] = useState("#111114");

  const [toast, setToast] = useState("");

  const lightAccent = isLightColor(accent);

  function showToast(t: string) {
    setToast(t);
    setTimeout(() => setToast(""), 1400);
  }

  async function connectStripe() {
  if (!isPremium) {
    showToast("Premium required");
    return;
  }

  try {
    setStripeLoading(true);

    const res = await fetch("/api/stripe/connect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cardId }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Failed to connect Stripe");
    }

    if (!data?.url) {
      throw new Error("Stripe onboarding link missing");
    }

    window.location.href = data.url;
  } catch (e: any) {
    showToast(e?.message ?? "Stripe connect failed");
  } finally {
    setStripeLoading(false);
  }
}

async function refreshStripeStatus() {
  try {
    setStripeLoading(true);

    const res = await fetch("/api/stripe/status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cardId }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Failed to refresh Stripe");
    }

    setStripeConnected(Boolean(data.connected));
    showToast(data.connected ? "Stripe connected" : "Stripe setup incomplete");
  } catch (e: any) {
    showToast(e?.message ?? "Could not refresh Stripe");
  } finally {
    setStripeLoading(false);
  }
}

  // load current settings
 useEffect(() => {
  let cancelled = false;

  async function load() {
    try {
      setLoading(true);
      const res = await fetch(`/api/card-public?cardId=${encodeURIComponent(cardId)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("load failed");

      const data = (await res.json()) as Payload;
      if (cancelled) return;

      setAccent(cleanHex((data.accentColor ?? "#7C3AED").trim(), "#7C3AED"));
      setButtonStyle((data.buttonStyle ?? "pill") as "pill" | "soft");
      setAccentGlow(data.accentGlow ?? true);
      setPayBtnAccent((data.payBtnAccent ?? "none") as "none" | "outline" | "shine");

      const bs = (data.bgStyle ?? "default") as "default" | "solid" | "gradient";
      setBgStyle(bs);
      setBgColor(cleanHex(data.bgColor ?? "#0A0A0B", "#0A0A0B"));
      setBgColor2(cleanHex(data.bgColor2 ?? "#111114", "#111114"));

      setIsPremium(Boolean(data.isPremium));
      setStripeConnected(Boolean(data.stripeConnected));
      setStripeAccountId(data.stripeAccountId ?? null);
      setViaPaymentsEnabled(Boolean(data.viaPaymentsEnabled));
    } catch {
      if (!cancelled) showToast("Could not load");
    } finally {
      if (!cancelled) setLoading(false);
    }
  }

  load();
  return () => {
    cancelled = true;
  };
}, [cardId]);

  const payBtnRadius = buttonStyle === "soft" ? "rounded-2xl" : "rounded-full";
  const payBtnGlow = accentGlow
    ? "shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_36px_rgba(0,0,0,0.55)]"
    : "";

  const payBtnAccentClass =
    payBtnAccent === "outline"
      ? "ring-1 ring-white/25"
      : payBtnAccent === "shine"
        ? "before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/18 before:to-transparent before:content-['']"
        : "";

  // Live-page background preview (entire page updates while editing)
  const pageBgStyle =
    bgStyle === "solid"
      ? { background: bgColor }
      : bgStyle === "gradient"
        ? { background: `linear-gradient(135deg, ${bgColor}, ${bgColor2})` }
        : { background: "#0A0A0B" };

  // ---------- Readability + "glass" theme ----------
  const bgIsLight =
    bgStyle === "solid"
      ? isLightColor(bgColor)
      : bgStyle === "gradient"
        ? isLightColor(bgColor) || isLightColor(bgColor2)
        : false;

  const glassCard = bgIsLight ? "bg-black/55 border-white/15" : "bg-black/35 border-white/10";
  const glassCardSoft = bgIsLight ? "bg-black/45 border-white/12" : "bg-black/28 border-white/10";

  const bottomGlass = bgIsLight ? "bg-black/80 border-white/20" : "bg-black/60 border-white/12";

  // Accent tint on bar (so it isn't just black)
  const bottomTint = bgIsLight ? "0.22" : "0.16";

  const bottomBtnBase = "rounded-2xl px-4 py-3 text-sm font-semibold transition-all";
  const bottomBtnGlass = bgIsLight
    ? "border border-white/18 bg-white/10 text-white/90 hover:bg-white/14"
    : "border border-white/12 bg-white/7 text-white/85 hover:bg-white/10";

  const choiceBase = "rounded-2xl border px-4 py-4 text-sm transition-all";
  const choiceOn = "border-white/30 bg-black/45";
  const choiceOff = "border-white/12 bg-black/30 hover:bg-black/40";

  // Labels (capitalized)
  const prettyBgStyle = (k: "default" | "solid" | "gradient") =>
    k === "default" ? "Default" : k === "solid" ? "Solid" : "Gradient";

  const prettyAccent = (k: "none" | "outline" | "shine") =>
    k === "none" ? "None" : k === "outline" ? "Outline" : "Shine";

  async function save({ goBack }: { goBack: boolean }) {
    if (!isPremium) return showToast("Premium required");

    setSaving(true);
    try {
      const { error } = await supabase
        .from("cards")
        .update({
          accent_color: cleanHex(accent, "#7C3AED"),
          button_style: buttonStyle,
          accent_glow: accentGlow,

          bg_style: bgStyle,
          bg_color: bgStyle === "default" ? null : cleanHex(bgColor, "#0A0A0B"),
          bg_color_2: bgStyle === "gradient" ? cleanHex(bgColor2, "#111114") : null,

          via_payments_enabled: viaPaymentsEnabled,
        
          pay_btn_accent: payBtnAccent,
        })
        .eq("id", cardId);

      if (error) throw error;

      showToast("Saved");
      if (goBack) setTimeout(() => router.push(`/c/${cardId}`), 350);
    } catch (e: any) {
      showToast(e?.message ? String(e.message) : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setAccent("#7C3AED");
    setButtonStyle("pill");
    setAccentGlow(true);
    setPayBtnAccent("none");

    setBgStyle("default");
    setBgColor("#0A0A0B");
    setBgColor2("#111114");

    showToast("Reset");
  }

  return (
    <div className="relative min-h-screen px-6 py-10 pb-36" style={pageBgStyle}>
      {/* Subtle darkness overlay so text stays readable on bright gradients */}
      <div className="pointer-events-none absolute inset-0 bg-black/35" />

      <div className="relative mx-auto w-full max-w-[720px]">
        {/* Header row (match analytics pattern) */}
        <div className="mb-2">
          <button
            type="button"
            onClick={() => router.push(`/c/${cardId}`)}
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-white/75 hover:bg-white/10"
          >
            ← Return to card
          </button>

          <h1 className="text-xl font-semibold">Customize</h1>
          <p className="mt-1 text-sm text-white/70">Accent, background, and button styling.</p>
        </div>

        {/* Live preview (NO outer wrap behind it) */}
        <Section title="LIVE PREVIEW">
          <div className="rounded-2xl border border-white/12 p-5" style={pageBgStyle}>
            <button
              className={`relative w-full overflow-hidden border border-white/12 px-4 py-4 font-semibold tracking-wide transition-all ${payBtnRadius} ${payBtnGlow} ${payBtnAccentClass}`}
              style={{
                backgroundColor: accent,
                color: lightAccent ? "#000000" : "#FFFFFF",
              }}
              onClick={() => showToast("Preview")}
              type="button"
            >
              Pay Through VIA
            </button>

            {!isPremium && (
              <div className="mt-3 text-sm text-white/70">
                Customize is Premium-only. Upgrade to unlock.
              </div>
            )}
          </div>
        </Section>

        <div className="mt-8 h-px bg-white/10" />

        {/* Accent */}
        <Section title="ACCENT COLOR">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {PRESETS.map((p) => {
              const selected = accent.toUpperCase() === p.value.toUpperCase();
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setAccent(p.value.toUpperCase())}
                  className={`flex items-center gap-2 rounded-2xl border px-3 py-4 text-xs transition-all ${
                    selected ? "border-white/30 bg-black/45" : "border-white/12 bg-black/30 hover:bg-black/40"
                  }`}
                  title={p.name}
                >
                  <span className="h-4 w-4 rounded-full border border-white/15" style={{ backgroundColor: p.value }} />
                  <span className="text-white/85">{p.name}</span>
                </button>
              );
            })}
          </div>

          <ColorBar label="Custom accent" value={accent} onChange={setAccent} />
        </Section>

        <div className="mt-8 h-px bg-white/10" />

        {/* Background */}
        <Section title="BACKGROUND" subtitle="Default, solid color, or gradient.">
          <div className="grid grid-cols-3 gap-3">
            {(["default", "solid", "gradient"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setBgStyle(k)}
                className={`${choiceBase} ${bgStyle === k ? choiceOn : choiceOff}`}
              >
                {prettyBgStyle(k)}
              </button>
            ))}
          </div>

          {bgStyle === "solid" && <ColorBar label="Background color" value={bgColor} onChange={setBgColor} />}

          {bgStyle === "gradient" && (
            <>
              <ColorBar label="Gradient start" value={bgColor} onChange={setBgColor} />
              <ColorBar label="Gradient end" value={bgColor2} onChange={setBgColor2} />
            </>
          )}
        </Section>

        <div className="mt-8 h-px bg-white/10" />

        {/* Button shape */}
        <Section title="BUTTON SHAPE" subtitle="Choose the payment button radius.">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setButtonStyle("pill")}
              className={`${choiceBase} ${buttonStyle === "pill" ? choiceOn : choiceOff}`}
            >
              Pill
            </button>
            <button
              type="button"
              onClick={() => setButtonStyle("soft")}
              className={`${choiceBase} ${buttonStyle === "soft" ? choiceOn : choiceOff}`}
            >
              Soft Square
            </button>
          </div>
        </Section>

        <div className="mt-8 h-px bg-white/10" />

        {/* Pay button accent */}
        <Section title="PAY BUTTON ACCENT" subtitle="Extra premium flair on the pay button.">
          <div className="grid grid-cols-3 gap-3">
            {(["none", "outline", "shine"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setPayBtnAccent(k)}
                className={`${choiceBase} ${payBtnAccent === k ? choiceOn : choiceOff}`}
              >
                {prettyAccent(k)}
              </button>
            ))}
          </div>
        </Section>

        <div className="mt-8 h-px bg-white/10" />

        {/* Glow */}
        <Section title="ACCENT GLOW" subtitle="Adds a subtle premium glow effect.">
          <div
            className={`flex flex-col gap-3 rounded-2xl border px-4 py-4 md:flex-row md:items-center md:justify-between ${glassCardSoft}`}
          >
            <div>
              <div className="text-sm font-medium text-white/90">Accent glow</div>
              <div className="text-xs text-white/60">Toggle glow on the pay button.</div>
            </div>

            <button
              type="button"
              onClick={() => setAccentGlow((v) => !v)}
              className={`${bottomBtnBase} w-full md:w-auto ${
                accentGlow
                  ? "border border-white/20 bg-white/12 text-white/90"
                  : "border border-white/12 bg-black/30 text-white/75 hover:bg-black/40"
              }`}
            >
              {accentGlow ? "On" : "Off"}
            </button>
          </div>
        </Section>

        <div className="mt-8 h-px bg-white/10" />

<Section
  title="PAYMENTS"
  subtitle="Connect your Stripe account and control whether Pay Through VIA appears on your card."
>
  <div className={`rounded-2xl border px-4 py-4 ${glassCardSoft}`}>
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-medium text-white/90">Stripe account</div>
        <div className="text-xs text-white/60">
          {stripeConnected
            ? "Connected and ready to accept payments."
            : stripeAccountId
              ? "Stripe started, but setup may still be incomplete."
              : "No Stripe account connected yet."}
        </div>
      </div>

      <div className="text-xs rounded-full border border-white/12 px-3 py-1 text-white/75">
        {stripeConnected ? "Connected" : "Not connected"}
      </div>
    </div>

    <div className="mt-4 flex flex-col gap-3 md:flex-row">
      <button
        type="button"
        onClick={connectStripe}
        disabled={!isPremium || stripeLoading}
        className={`${bottomBtnBase} ${bottomBtnGlass} w-full md:w-auto disabled:opacity-50`}
      >
        {stripeLoading
          ? "Loading..."
          : stripeConnected
            ? "Manage Stripe"
            : "Connect Stripe"}
      </button>

      <button
        type="button"
        onClick={refreshStripeStatus}
        disabled={!isPremium || stripeLoading || !stripeAccountId}
        className={`${bottomBtnBase} ${bottomBtnGlass} w-full md:w-auto disabled:opacity-50`}
      >
        Refresh status
      </button>
    </div>
  </div>

  <div className={`rounded-2xl border px-4 py-4 ${glassCardSoft}`}>
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-medium text-white/90">Show Pay Through VIA</div>
        <div className="text-xs text-white/60">
          This only appears on the public card after Stripe is connected.
        </div>
      </div>

      <button
        type="button"
        onClick={() => setViaPaymentsEnabled((v) => !v)}
        disabled={!isPremium || !stripeConnected}
        className={`${bottomBtnBase} w-full md:w-auto ${
          viaPaymentsEnabled
            ? "border border-white/20 bg-white/12 text-white/90"
            : "border border-white/12 bg-black/30 text-white/75 hover:bg-black/40"
        } disabled:opacity-50`}
      >
        {viaPaymentsEnabled ? "On" : "Off"}
      </button>
    </div>
  </div>
</Section>

        <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <button type="button" onClick={reset} className={`${bottomBtnBase} w-full md:w-auto ${bottomBtnGlass}`}>
            Reset to default
          </button>
          <div className="text-center text-xs text-white/55 md:text-right">
            {isPremium ? "Premium enabled" : "Premium required"}
          </div>
        </div>
      </div>

      {/* Bottom bar (fixed; always visible) */}
      <div className="fixed inset-x-0 bottom-0 z-50 pb-[calc(env(safe-area-inset-bottom)+12px)] md:hidden">
        <div className="mx-auto w-full max-w-[720px] px-4">
          <div
            className={`relative overflow-hidden rounded-3xl border shadow-[0_14px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl ${bottomGlass}`}
          >
            {/* contrast fade */}
            <div className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-t from-black/40 to-transparent" />

            {/* Accent tint (so bar isn't just black) */}
            <div className="pointer-events-none absolute inset-0" style={{ background: accent, opacity: Number(bottomTint) }} />

            <div className="relative px-4 py-3">
              <div className="flex gap-3">
                <button type="button" onClick={reset} className={`flex-1 ${bottomBtnBase} ${bottomBtnGlass}`}>
                  Reset
                </button>

                <button
                  type="button"
                  onClick={() => save({ goBack: true })}
                  disabled={loading || saving || !isPremium}
                  className={`relative flex-[1.25] overflow-hidden border border-white/12 ${bottomBtnBase} disabled:opacity-50`}
                  style={{
                    backgroundColor: accent,
                    color: lightAccent ? "#000000" : "#FFFFFF",
                  }}
                >
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
                  <span className="relative">
                    {saving ? "Saving…" : isPremium ? "Save & return" : "Premium required"}
                  </span>
                </button>
              </div>

              <div className="mt-2 text-center text-[11px] text-white/70">
                Changes apply instantly to your card look.
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed left-1/2 top-6 z-[100] -translate-x-1/2 rounded-full border border-white/15 bg-black/70 px-4 py-2 text-sm text-white/90 backdrop-blur">
          {toast}
        </div>
      )}
    </div>
  );
}