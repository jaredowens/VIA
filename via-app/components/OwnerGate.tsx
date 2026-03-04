"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function OwnerGate({
  cardId,
  children,
}: {
  cardId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "ok" | "blocked">("checking");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const id = (cardId ?? "").trim().toUpperCase();
      if (!id) {
        setState("blocked");
        setMsg("Missing card id.");
        return;
      }

      try {
        // optional: ensure they are signed in (fast)
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          router.push("/login");
          return;
        }

        const res = await fetch(`/api/card-is-owner?cardId=${encodeURIComponent(id)}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          router.push("/login");
          return;
        }

        const j = await res.json();
        if (cancelled) return;

        if (!j?.isOwner) {
          setState("blocked");
          setMsg("Owner-only page.");
          return;
        }

        setState("ok");
      } catch {
        if (!cancelled) {
          setState("blocked");
          setMsg("Could not verify ownership.");
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [cardId, router]);

  if (state === "checking") {
    return (
      <div className="min-h-screen bg-[#0A0A0B] text-white p-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-[#121214]/70 p-6 backdrop-blur-xl">
          <div className="text-sm text-white/60">Checking access…</div>
        </div>
      </div>
    );
  }

  if (state === "blocked") {
    return (
      <div className="min-h-screen bg-[#0A0A0B] text-white p-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-[#121214]/70 p-6 backdrop-blur-xl">
          <div className="text-sm text-white/70">{msg || "Access denied."}</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}