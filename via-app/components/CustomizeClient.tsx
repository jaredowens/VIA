"use client";

import { useEffect, useState } from "react";
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

/** Full-width "color bar" control. */
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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs text-white/60">{label}</div>
        <div className="text-[11px] tracking-wider text-white/45">{safe}</div>
      </div>

      <div className="relative h-12 w-full overflow-hidden rounded-xl border border-white/10">
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

function Panel({
  title,
  desc,
  children,
  id,
}: {
  id: string;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
        <div className="flex flex-col gap-1">
          <div className="text-sm font-semibold text-white/90">{title}</div>
          {desc ? <div className="text-xs text-white/55">{desc}</div> : null}
        </div>
        <div className="mt-4 space-y-3">{children}</div>
      </div>
    </section>
  );
}

export default function CustomizeClient({ cardId }: { cardId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [isPremium, setIsPremium] = useState(false);

  // Accent / premium button
  const [accent, setAccent] = useState("#7C3AED");
  const [buttonStyle, setButtonStyle] = useState<"pill" | "soft">("pill");
  const [accentGlow, setAccentGlow] = useState(true);
  const [payBtnAccent, setPayBtnAccent] = useState<"none" | "outline" | "shine">(
    "none"
  );

  // Background
  const [bgStyle, setBgStyle] = useState<"default" | "solid" | "gradient">(
    "default"
  );
  const [bgColor, setBgColor] = useState("#0A0A0B");
  const [bgColor2, setBgColor2] = useState("#111114");

  const [toast, setToast] = useState("");

  const lightAccent = isLightColor(accent);

  function showToast(t: string) {
    setToast(t);
    setTimeout(() => setToast(""), 1400);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/card-public?cardId=${encodeURIComponent(cardId)}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("load failed");
        const data = (await res.json()) as Payload;
        if (cancelled) return;

        const a = cleanHex((data.accentColor ?? "#7C3AED").trim(), "#7C3AED");
        setAccent(a);

        setButtonStyle((data.buttonStyle ?? "pill") as "pill" | "soft");
        setAccentGlow(data.accentGlow ?? true);
        setPayBtnAccent(
          (data.payBtnAccent ?? "none") as "none" | "outline" | "shine"
        );

        const bs = (data.bgStyle ?? "default") as
          | "default"
          | "solid"
          | "gradient";
        setBgStyle(bs);
        setBgColor(cleanHex(data.bgColor ?? "#0A0A0B", "#0A0A0B"));
        setBgColor2(cleanHex(data.bgColor2 ?? "#111114", "#111114"));

        setIsPremium(Boolean(data.isPremium));
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

  const backgroundPreviewStyle =
    bgStyle === "solid"
      ? { background: bgColor }
      : bgStyle === "gradient"
      ? { background: `linear-gradient(135deg, ${bgColor}, ${bgColor2})` }
      : { background: "#0A0A0B" };

  async function save() {
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
          bg_color_2:
            bgStyle === "gradient" ? cleanHex(bgColor2, "#111114") : null,

          pay_btn_accent: payBtnAccent,
        })
        .eq("id", cardId);

      if (error) throw error;
      showToast("Saved");
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
    <div className="min-h-screen bg-[#0A0A0B] text-white px-4 py-6 pb-28 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-6xl rounded-2xl border border-white/10 bg-[#121214]/70 p-4 md:p-8 backdrop-blur-xl">
        <a
          href={`/c/${cardId}`}
          className="mb-4 inline-block w-full md:w-auto text-center rounded-xl border border-white/12 bg-white/5 px-3 py-3 md:py-2 text-xs text-white/75 hover:bg-white/10"
        >
          Return to Card
        </a>

        {/* Top header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Customize</h1>
            <p className="mt-1 text-sm text-white/60">
              Premium settings for accent, background, and button styling.
            </p>
          </div>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              Reset
            </button>
            <button
              onClick={save}
              disabled={loading || saving || !isPremium}
              className="rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-white/85 hover:bg-white/10 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {/* Stripe/Apple layout: sidebar + content */}
        <div className="mt-6 grid gap-6 md:grid-cols-[260px_1fr]">
          {/* Sidebar (desktop) */}
          <aside className="hidden md:block">
            <div className="sticky top-6 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs tracking-[0.35em] text-white/45">
                  SECTIONS
                </div>
                <div className="mt-3 flex flex-col gap-1 text-sm">
                  {[
                    ["preview", "Live preview"],
                    ["accent", "Accent color"],
                    ["background", "Background"],
                    ["shape", "Button shape"],
                    ["payaccent", "Pay button accent"],
                    ["glow", "Accent glow"],
                  ].map(([id, label]) => (
                    <a
                      key={id}
                      href={`#${id}`}
                      className="rounded-xl px-3 py-2 text-white/75 hover:bg-white/10 hover:text-white"
                    >
                      {label}
                    </a>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs tracking-[0.35em] text-white/45">
                  STATUS
                </div>
                <div className="mt-3 text-sm text-white/70">
                  {isPremium ? "Premium enabled" : "Premium required"}
                </div>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <main className="space-y-4">
            <Panel id="preview" title="Live preview" desc="See your changes instantly.">
              <div
                className="rounded-2xl border border-white/10 p-5"
                style={backgroundPreviewStyle}
              >
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
                  <div className="mt-3 text-sm text-white/60">
                    Customize is Premium-only. Upgrade to unlock.
                  </div>
                )}
              </div>
            </Panel>

            <Panel
              id="accent"
              title="Accent color"
              desc="Used for payment button + premium highlights."
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {PRESETS.map((p) => {
                  const selected = accent.toUpperCase() === p.value.toUpperCase();
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setAccent(p.value.toUpperCase())}
                      className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-xs transition-all ${
                        selected
                          ? "border-white/30 bg-white/10"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                      title={p.name}
                    >
                      <span
                        className="h-4 w-4 rounded-full border border-white/15"
                        style={{ backgroundColor: p.value }}
                      />
                      <span className="text-white/80">{p.name}</span>
                    </button>
                  );
                })}
              </div>

              <ColorBar label="Custom accent" value={accent} onChange={setAccent} />
            </Panel>

            <Panel id="background" title="Background" desc="Default, solid color, or gradient.">
              <div className="grid grid-cols-3 gap-3">
                {(["default", "solid", "gradient"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setBgStyle(k)}
                    className={`rounded-2xl border px-4 py-4 text-sm capitalize ${
                      bgStyle === k
                        ? "border-white/30 bg-white/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>

              {bgStyle === "solid" && (
                <ColorBar label="Background color" value={bgColor} onChange={setBgColor} />
              )}

              {bgStyle === "gradient" && (
                <>
                  <ColorBar label="Gradient start" value={bgColor} onChange={setBgColor} />
                  <ColorBar label="Gradient end" value={bgColor2} onChange={setBgColor2} />
                </>
              )}
            </Panel>

            <Panel id="shape" title="Button shape" desc="Choose the payment button radius.">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setButtonStyle("pill")}
                  className={`rounded-2xl border px-4 py-4 text-sm ${
                    buttonStyle === "pill"
                      ? "border-white/30 bg-white/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  Pill
                </button>
                <button
                  type="button"
                  onClick={() => setButtonStyle("soft")}
                  className={`rounded-2xl border px-4 py-4 text-sm ${
                    buttonStyle === "soft"
                      ? "border-white/30 bg-white/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  Soft Square
                </button>
              </div>
            </Panel>

            <Panel id="payaccent" title="Pay button accent" desc="Extra premium flair on the pay button.">
              <div className="grid grid-cols-3 gap-3">
                {(["none", "outline", "shine"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setPayBtnAccent(k)}
                    className={`rounded-2xl border px-3 py-4 text-sm capitalize ${
                      payBtnAccent === k
                        ? "border-white/30 bg-white/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </Panel>

            <Panel id="glow" title="Accent glow" desc="Adds a subtle premium glow effect.">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-white/70">
                  Toggle glow on the pay button.
                </div>

                <button
                  type="button"
                  onClick={() => setAccentGlow((v) => !v)}
                  className={`w-full md:w-auto rounded-2xl border px-4 py-3 text-sm ${
                    accentGlow
                      ? "border-white/25 bg-white/10 text-white/85"
                      : "border-white/10 bg-transparent text-white/60"
                  }`}
                >
                  {accentGlow ? "On" : "Off"}
                </button>
              </div>
            </Panel>

            {/* Mobile footer info */}
            <div className="md:hidden text-center text-xs text-white/40 pt-2">
              {isPremium ? "Premium enabled" : "Premium required"}
            </div>
          </main>
        </div>
      </div>

      {/* Sticky Save Bar (mobile) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0A0A0B]/85 backdrop-blur md:hidden">
        <div className="mx-auto w-full max-w-6xl px-4 py-3">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={reset}
              className="flex-1 rounded-2xl border border-white/12 bg-white/5 py-4 font-semibold text-white/80 hover:bg-white/10"
            >
              Reset
            </button>
            <button
              onClick={save}
              disabled={loading || saving || !isPremium}
              className="flex-[1.2] rounded-2xl py-4 font-semibold disabled:opacity-50"
              style={{
                backgroundColor: accent,
                color: lightAccent ? "#000000" : "#FFFFFF",
              }}
            >
              {saving ? "Saving…" : isPremium ? "Save changes" : "Premium required"}
            </button>
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