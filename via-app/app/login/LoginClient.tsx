"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

const RETURN_KEY = "via:returnTo";
const RETURN_COOKIE = "via_returnTo";

function setReturnCookie(value: string) {
  // 10 minutes
  const maxAge = 60 * 10;
  document.cookie = `${RETURN_COOKIE}=${encodeURIComponent(
    value
  )}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

export default function LoginClient() {
  const searchParams = useSearchParams();
  const returnTo = useMemo(
    () => searchParams.get("returnTo") || "/",
    [searchParams]
  );

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled && data.session) window.location.href = returnTo;
    })();
    return () => {
      cancelled = true;
    };
  }, [returnTo]);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    if (loading || cooldown > 0) return;

    setLoading(true);
    setMsg("");

    // Backup returnTo in BOTH localStorage and a cookie
    try {
      localStorage.setItem(RETURN_KEY, returnTo);
    } catch {}
    try {
      setReturnCookie(returnTo);
    } catch {}

    // IMPORTANT: keep redirectTo simple. We’ll recover returnTo in callback via cookie/localStorage.
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback`
        : undefined;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }

    setMsg("Check your email for your VIA sign-in link.");
    setLoading(false);

    setCooldown(60);
    const t = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(t);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0A0A0B] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/10 blur-[90px]" />
        <div className="absolute top-1/3 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-white/6 blur-[110px]" />
        <div className="absolute inset-0 shadow-[inset_0_0_140px_rgba(0,0,0,0.85)]" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-[520px] rounded-[28px] border border-white/10 bg-[#121214]/80 p-12 shadow-[0_30px_120px_rgba(0,0,0,0.75)] backdrop-blur-xl">
          <div className="mb-12 flex justify-center">
            <div className="select-none text-[38px] font-light tracking-[0.55em] text-transparent bg-clip-text bg-gradient-to-b from-white to-white/55">
              VIA
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-lg font-medium tracking-wide text-white/90">
              Sign in
            </h1>
            <p className="mt-3 text-[12px] tracking-[0.35em] text-white/45">
              MAGIC LINK (NO PASSWORD)
            </p>
          </div>

          <form onSubmit={sendLink} className="mt-10 space-y-5">
            <div>
              <label className="block text-xs tracking-wider text-white/60 mb-2">
                EMAIL
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="you@example.com"
                required
                className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
              />
            </div>

            {!!msg && (
              <p className="text-center text-sm text-white/70">{msg}</p>
            )}

            <button
              type="submit"
              disabled={loading || cooldown > 0}
              className="group relative w-full overflow-hidden rounded-2xl border border-white/12 bg-white/5 px-4 py-4 font-medium tracking-wide text-white/90 transition-all duration-200 hover:-translate-y-[1px] hover:border-white/20 hover:bg-white/7 disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {loading
                ? "Sending…"
                : cooldown > 0
                ? `Resend in ${cooldown}s`
                : "Send sign-in link"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
