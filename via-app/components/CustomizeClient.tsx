"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Payload = {
  cardId: string;
  isPremium?: boolean;
  accentColor?: string | null;
  verified?: boolean;
  buttonStyle?: "pill" | "soft";
  accentGlow?: boolean;
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

function normalizeHex(input: string) {
  const t = (input ?? "").trim();
  if (!t) return "";
  const v = t.startsWith("#") ? t : `#${t}`;
  const ok = /^#[0-9a-fA-F]{6}$/.test(v);
  return ok ? v.toUpperCase() : "";
}

export default function CustomizeClient({ cardId }: { cardId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [isPremium, setIsPremium] = useState(false);

  const [accent, setAccent] = useState("#7C3AED");
  const [hexDraft, setHexDraft] = useState("#7C3AED");
  const [showHex, setShowHex] = useState(false);

  const [buttonStyle, setButtonStyle] = useState<"pill" | "soft">("pill");
  const [accentGlow, setAccentGlow] = useState(true);

  const [toast, setToast] = useState("");

  function showToast(t: string) {
    setToast(t);
    setTimeout(() => setToast(""), 1400);
  }

  // load current settings from public payload (fast)
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

        const a = (data.accentColor ?? "#7C3AED").trim() || "#7C3AED";
        setAccent(a);
        setHexDraft(a);

        setButtonStyle((data.buttonStyle ?? "pill") as "pill" | "soft");
        setAccentGlow(data.accentGlow ?? true);

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

  const dirty = useMemo(() => {
    // if they opened hex and typed a valid hex, compare to accent
    const normalized = normalizeHex(hexDraft) || accent;
    return normalized !== accent || false;
  }, [hexDraft, accent]);

  async function save() {
    if (!isPremium) return showToast("Premium required");
    const normalized = normalizeHex(hexDraft) || accent;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("cards")
        .update({
          accent_color: normalized,
          button_style: buttonStyle,
          accent_glow: accentGlow,
        })
        .eq("id", cardId);

      if (error) throw error;

      setAccent(normalized);
      setHexDraft(normalized);
      showToast("Saved");
    } catch (e: any) {
      showToast(e?.message ? String(e.message) : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setAccent("#7C3AED");
    setHexDraft("#7C3AED");
    setButtonStyle("pill");
    setAccentGlow(true);
    showToast("Reset");
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white p-8">
      <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-[#121214]/70 p-6 backdrop-blur-xl">
        <a
          href={`/c/${cardId}`}
          className="mb-4 inline-block rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-white/75 hover:bg-white/10"
        >
           Return to Card
        </a>

        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Customize</h1>
            <p className="mt-1 text-sm text-white/60">Accent, button style, and glow.</p>
          </div>

          <button
            onClick={save}
            disabled={loading || saving || !isPremium}
            className="rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-white/85 hover:bg-white/10 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        {/* Live preview */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs tracking-[0.35em] text-white/45">LIVE PREVIEW</div>
          <div className="mt-4">
            <button
              className={`w-full overflow-hidden border border-white/12 px-4 py-4 font-semibold tracking-wide text-white/95 transition-all ${payBtnRadius} ${payBtnGlow}`}
              style={{ backgroundColor: accent }}
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
        </div>

        {/* Accent presets */}
        <div className="mt-6">
          <div className="mb-3 text-xs tracking-[0.35em] text-white/45">ACCENT THEME</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PRESETS.map((p) => {
              const selected = accent.toUpperCase() === p.value.toUpperCase();
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => {
                    setAccent(p.value);
                    setHexDraft(p.value);
                    setShowHex(false);
                  }}
                  className={`rounded-2xl border px-3 py-3 text-left transition-all ${
                    selected ? "border-white/30 bg-white/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-5 w-5 rounded-full border border-white/15"
                      style={{ backgroundColor: p.value }}
                    />
                    <div className="text-xs font-medium text-white/85">{p.name}</div>
                  </div>
                  <div className="mt-2 text-[11px] text-white/45">{p.value}</div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setShowHex((v) => !v)}
            className="mt-4 text-xs text-white/70 hover:text-white"
          >
            {showHex ? "Hide custom hex" : "Use custom hex"}
          </button>

          {showHex && (
            <div className="mt-3 flex items-center gap-3">
              <input
                value={hexDraft}
                onChange={(e) => setHexDraft(e.target.value)}
                placeholder="#7C3AED"
                className="w-full rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-sm text-white/85 outline-none focus:border-white/25"
              />
              <button
                type="button"
                onClick={() => {
                  const n = normalizeHex(hexDraft);
                  if (!n) return showToast("Invalid hex");
                  setAccent(n);
                  showToast("Applied");
                }}
                className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm text-white/85 hover:bg-white/10"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        {/* Button style */}
        <div className="mt-6">
          <div className="mb-3 text-xs tracking-[0.35em] text-white/45">BUTTON STYLE</div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setButtonStyle("pill")}
              className={`flex-1 rounded-2xl border px-4 py-3 text-sm ${
                buttonStyle === "pill" ? "border-white/30 bg-white/10" : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              Pill
            </button>
            <button
              type="button"
              onClick={() => setButtonStyle("soft")}
              className={`flex-1 rounded-2xl border px-4 py-3 text-sm ${
                buttonStyle === "soft" ? "border-white/30 bg-white/10" : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              Soft Square
            </button>
          </div>
        </div>

        {/* Glow */}
        <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
          <div>
            <div className="text-sm font-medium text-white/85">Accent glow</div>
            <div className="text-xs text-white/50">Adds a subtle premium glow effect.</div>
          </div>
          <button
            type="button"
            onClick={() => setAccentGlow((v) => !v)}
            className={`rounded-full border px-3 py-2 text-xs ${
              accentGlow ? "border-white/25 bg-white/10 text-white/85" : "border-white/10 bg-transparent text-white/60"
            }`}
          >
            {accentGlow ? "On" : "Off"}
          </button>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-white/12 bg-transparent px-4 py-2 text-sm text-white/70 hover:bg-white/5"
          >
            Reset to default
          </button>

          <div className="text-xs text-white/40">
            {isPremium ? "Premium enabled" : "Premium required"}
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