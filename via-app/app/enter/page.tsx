"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EnterPage() {
  const [cardId, setCardId] = useState("");
  const router = useRouter();

  function continueToClaim() {
    const id = cardId.trim();
    if (!id) return;

    // ✅ Always go straight to claim.
    // Middleware will redirect to /login if needed.
    router.push(`/claim/${encodeURIComponent(id)}`);
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-[520px] rounded-[28px] border border-white/10 bg-[#121214]/80 p-10">
        <h1 className="text-lg font-medium text-white/90 text-center">
          Enter Card ID
        </h1>
        <p className="mt-2 text-sm text-white/55 text-center">
          Paste the ID from the back of the card so we can claim it.
        </p>

        <div className="mt-8 space-y-4">
          <input
            value={cardId}
            onChange={(e) => setCardId(e.target.value)}
            placeholder="ex: AB12"
            className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none placeholder:text-white/35"
          />

          <button
            onClick={continueToClaim}
            disabled={!cardId.trim()}
            className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-4 font-medium text-white/90 disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
