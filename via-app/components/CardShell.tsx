"use client";

import { useEffect, useState } from "react";

type ThemePayload = {
  bgStyle?: "default" | "solid" | "gradient";
  bgColor?: string | null;
  bgColor2?: string | null;
};

function computeBackground(t: ThemePayload) {
  const bgStyle = t.bgStyle ?? "default";
  const bgColor = t.bgColor ?? "#0A0A0B";
  const bgColor2 = t.bgColor2 ?? "#111114";

  if (bgStyle === "solid") return { background: bgColor };
  if (bgStyle === "gradient") return { background: `linear-gradient(135deg, ${bgColor}, ${bgColor2})` };
  return { background: "#0A0A0B" };
}

export default function CardShell({
  cardId,
  children,
}: {
  cardId: string;
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<ThemePayload>({ bgStyle: "default" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/card-public?cardId=${encodeURIComponent(cardId)}`, { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        if (cancelled) return;

        setTheme({
          bgStyle: j.bgStyle ?? "default",
          bgColor: j.bgColor ?? null,
          bgColor2: j.bgColor2 ?? null,
        });
      } catch {
        // ignore
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [cardId]);

  const backgroundStyle = computeBackground(theme);

  return (
    <div className="relative min-h-screen overflow-hidden text-white" style={backgroundStyle}>
      {/* keep your nice ambient overlays so gradients still feel premium */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/10 blur-[90px]" />
        <div className="absolute top-1/3 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-white/6 blur-[110px]" />
        <div className="absolute inset-0 shadow-[inset_0_0_140px_rgba(0,0,0,0.75)]" />
        <div className="grain absolute inset-0 opacity-[0.10]" />
      </div>

      <div className="relative min-h-screen">{children}</div>

      <style jsx>{`
        .grain {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.35'/%3E%3C/svg%3E");
          mix-blend-mode: overlay;
        }
      `}</style>
    </div>
  );
}