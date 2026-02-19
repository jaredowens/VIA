"use client";

import { useEffect } from "react";

const RETURN_KEY = "via:returnTo";
const RETURN_COOKIE = "via_returnTo";

function getCookie(name: string) {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : "";
}

export default function FinishAuthPage() {
  useEffect(() => {
    let dest = "/"; // ✅ unprotected fallback

    try {
      const ls = localStorage.getItem(RETURN_KEY);
      if (ls) dest = ls;
      localStorage.removeItem(RETURN_KEY);
    } catch {}

    try {
      const c = getCookie(RETURN_COOKIE);
      if (c) dest = c;
      document.cookie = `${RETURN_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
    } catch {}

    window.location.replace(dest || "/");
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0B] text-white">
      <p className="text-white/60 text-sm tracking-wide">Signing you in…</p>
    </div>
  );
}
